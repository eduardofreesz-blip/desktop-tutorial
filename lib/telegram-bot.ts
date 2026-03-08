import { prisma } from './db';

interface TelegramConfig {
  botToken: string;
  botUsername?: string;
  isActive: boolean;
}

interface TelegramStatus {
  connected: boolean;
  polling: boolean;
  botUsername?: string;
  lastError?: string;
}

let telegramStatus: TelegramStatus = { connected: false, polling: false };
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
let lastUpdateId = 0;

export async function loadTelegramConfig(): Promise<TelegramConfig | null> {
  const config = await prisma.config.findUnique({ where: { key: 'telegram_config' } });
  if (!config?.value) return null;
  try { return JSON.parse(config.value); } catch { return null; }
}

export async function configureTelegramBot(botToken: string): Promise<{ success: boolean; message: string; username?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: err.description || 'Token inválido' };
    }
    const data = await res.json();
    if (!data.ok) return { success: false, message: 'Token inválido' };

    const username = data.result?.username;

    await prisma.config.upsert({
      where: { key: 'telegram_config' },
      update: { value: JSON.stringify({ botToken, botUsername: username, isActive: true }) },
      create: { key: 'telegram_config', value: JSON.stringify({ botToken, botUsername: username, isActive: true }) },
    });

    telegramStatus = { connected: true, polling: false, botUsername: username };
    return { success: true, message: `Bot @${username} configurado com sucesso!`, username };
  } catch (error: any) {
    return { success: false, message: `Erro de conexão: ${error.message}` };
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string, buttons?: Array<Array<{text: string, callback_data: string}>>) {
  const body: any = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (buttons) {
    body.reply_markup = { inline_keyboard: buttons };
  }
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function pollMessages(botToken: string) {
  if (!telegramStatus.polling) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=10&allowed_updates=["message","callback_query"]`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!res.ok) {
      telegramStatus.lastError = 'Erro ao buscar mensagens';
      return;
    }

    const data = await res.json();
    if (data.ok && data.result?.length > 0) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        if (update.callback_query) {
          const cb = update.callback_query;
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id }),
          });
          await handleTelegramMessage(botToken, { chat: cb.message.chat, text: cb.data, from: cb.from });
        } else if (update.message?.text) {
          await handleTelegramMessage(botToken, update.message);
        }
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      telegramStatus.lastError = error.message;
    }
  }

  if (telegramStatus.polling) {
    pollingTimeout = setTimeout(() => pollMessages(botToken), 1000);
  }
}

async function handleTelegramMessage(botToken: string, message: any) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const userName = message.from?.first_name || 'Usuário';

  try {
    await prisma.conversation.create({
      data: {
        phoneNumber: `tg_${chatId}`,
        clientName: userName,
        message: text,
        direction: 'incoming',
        state: 'MENU',
      },
    });

    const lower = text.toLowerCase();
    const planLabels: Record<string, string> = { monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual' };
    const planOrder: Record<string, number> = { monthly: 1, quarterly: 2, annual: 3 };

    // Callback de seleção de app (app_ID)
    if (lower.startsWith('app_')) {
      const appId = text.replace('app_', '');
      const app = await prisma.app.findUnique({ where: { id: appId }, include: { plans: { where: { isActive: true } } } });
      if (app) {
        const sorted = [...app.plans].sort((a, b) => (planOrder[a.type.toLowerCase()] || 9) - (planOrder[b.type.toLowerCase()] || 9));
        const buttons = sorted.map(p => ([{ text: `${planLabels[p.type.toLowerCase()] || p.type} - R$ ${p.price.toFixed(2)}`, callback_data: `plan_${p.id}_${app.id}` }]));
        buttons.push([{ text: '🔙 Voltar ao Menu', callback_data: 'menu' }]);
        const codes = await prisma.code.count({ where: { appId, status: 'available' } });
        await sendTelegramMessage(botToken, chatId, `📱 *${app.name}*\n${app.description || ''}\n\n✅ ${codes} códigos disponíveis\n\n💰 *Escolha seu plano:*`, buttons);
      }
      return;
    }

    // Callback de seleção de plano (plan_PLANID_APPID)
    if (lower.startsWith('plan_')) {
      const parts = text.split('_');
      const planId = parts[1];
      const appId = parts[2];
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      const app = await prisma.app.findUnique({ where: { id: appId } });
      if (plan && app) {
        const available = await prisma.code.count({ where: { appId, planId, status: 'available' } });
        if (available === 0) {
          await sendTelegramMessage(botToken, chatId, '❌ *Estoque esgotado!* Tente outro plano.', [[{ text: '🔙 Menu', callback_data: 'menu' }]]);
          return;
        }
        const order = await prisma.order.create({
          data: { clientPhone: `tg_${chatId}`, clientName: userName, appId, planId, amount: plan.price, status: 'pending_payment' },
        });
        const config = await prisma.config.findMany({ where: { key: { in: ['pix_key', 'pix_name'] } } });
        const pixKey = config.find(c => c.key === 'pix_key')?.value || '';
        const pixName = config.find(c => c.key === 'pix_name')?.value || '';

        // Tentar PIX automático Mercado Pago
        let pixMsg = '';
        const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (mpToken) {
          try {
            const res = await fetch('https://api.mercadopago.com/v1/payments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mpToken}`, 'X-Idempotency-Key': `tg-${order.id}` },
              body: JSON.stringify({ transaction_amount: plan.price, description: `${app.name} - ${planLabels[plan.type.toLowerCase()] || plan.type}`, payment_method_id: 'pix', payer: { email: 'cliente@universalrecargas.com' }, external_reference: order.id }),
            });
            if (res.ok) {
              const data = await res.json();
              const pixCode = data.point_of_interaction?.transaction_data?.qr_code || '';
              if (pixCode) {
                await prisma.order.update({ where: { id: order.id }, data: { paymentId: String(data.id) } });
                pixMsg = `\n💳 *PIX COPIA E COLA:*\n\`\`\`${pixCode}\`\`\`\n\n📋 Copie e cole no app do banco\n✅ Pagamento confirmado automaticamente!`;
              }
            }
          } catch {}
        }
        if (!pixMsg) {
          pixMsg = `\n💳 *PIX Manual:*\n🔑 Chave: *${pixKey || 'Não configurada'}*\n👤 Nome: *${pixName || ''}*\n💵 Valor: *R$ ${plan.price.toFixed(2)}*`;
        }

        await sendTelegramMessage(botToken, chatId, `🎉 *PEDIDO CRIADO!*\n\n📱 App: *${app.name}*\n📋 Plano: *${planLabels[plan.type.toLowerCase()] || plan.type}*\n💰 Valor: *R$ ${plan.price.toFixed(2)}*\n🆔 Pedido: #${order.id.substring(0, 8)}${pixMsg}`, [[{ text: '📦 Meus Pedidos', callback_data: 'pedidos' }], [{ text: '🔙 Menu', callback_data: 'menu' }]]);
      }
      return;
    }

    // Menu / Start
    if (lower === '/start' || lower === 'oi' || lower === 'olá' || lower === 'menu' || lower === 'voltar') {
      const apps = await prisma.app.findMany({ where: { isActive: true } });
      const buttons = apps.map(a => ([{ text: `📱 ${a.name}`, callback_data: `app_${a.id}` }]));
      buttons.push([{ text: '💰 Preços', callback_data: 'precos' }, { text: '📦 Pedidos', callback_data: 'pedidos' }]);
      buttons.push([{ text: '❓ Ajuda', callback_data: 'ajuda' }]);
      await sendTelegramMessage(botToken, chatId, `👋 Olá *${userName}*!\n\n🎯 *UNIVERSAL RECARGAS*\nCódigos de recarga para streaming\n\n📱 *Escolha um app:*`, buttons);
      return;
    }

    // Preços
    if (lower === '/precos' || lower === 'precos' || lower === 'preços') {
      const apps = await prisma.app.findMany({ where: { isActive: true }, include: { plans: { where: { isActive: true } } } });
      let list = '';
      for (const a of apps) {
        const sorted = [...a.plans].sort((x, y) => (planOrder[x.type.toLowerCase()] || 9) - (planOrder[y.type.toLowerCase()] || 9));
        const plans = sorted.map(p => `  💵 ${planLabels[p.type.toLowerCase()] || p.type}: R$ ${p.price.toFixed(2)}`).join('\n');
        list += `\n📱 *${a.name}*\n${plans}\n`;
      }
      const buttons = apps.map(a => ([{ text: `📱 Comprar ${a.name}`, callback_data: `app_${a.id}` }]));
      buttons.push([{ text: '🔙 Menu', callback_data: 'menu' }]);
      await sendTelegramMessage(botToken, chatId, `💰 *TABELA DE PREÇOS*${list}`, buttons);
      return;
    }

    // Pedidos
    if (lower === '/pedidos' || lower === 'pedidos') {
      const orders = await prisma.order.findMany({ where: { clientPhone: `tg_${chatId}` }, take: 5, orderBy: { createdAt: 'desc' }, include: { app: true, plan: true } });
      if (orders.length === 0) {
        await sendTelegramMessage(botToken, chatId, '📦 Você ainda não tem pedidos.', [[{ text: '📱 Comprar', callback_data: 'menu' }]]);
        return;
      }
      const statusIcons: Record<string, string> = { code_sent: '✅ Enviado', paid: '💰 Pago', pending_payment: '⏳ Aguardando', cancelled: '❌ Cancelado' };
      const list = orders.map(o => `• *${o.app.name}* (${planLabels[o.plan.type.toLowerCase()] || o.plan.type}) - R$ ${o.amount.toFixed(2)} - ${statusIcons[o.status] || o.status}`).join('\n');
      await sendTelegramMessage(botToken, chatId, `📦 *SEUS PEDIDOS:*\n\n${list}`, [[{ text: '🔙 Menu', callback_data: 'menu' }]]);
      return;
    }

    // Ajuda
    if (lower === '/ajuda' || lower === 'ajuda' || lower === '/help') {
      await sendTelegramMessage(botToken, chatId, '❓ *AJUDA*\n\n📱 Clique em um app para comprar\n💰 /precos - Ver preços\n📦 /pedidos - Seus pedidos\n🔙 /start - Menu principal', [[{ text: '🔙 Menu', callback_data: 'menu' }]]);
      return;
    }

    // Buscar app por nome
    const app = await prisma.app.findFirst({ where: { isActive: true, name: { contains: text, mode: 'insensitive' } } });
    if (app) {
      const plans = await prisma.plan.findMany({ where: { appId: app.id, isActive: true } });
      const sorted = [...plans].sort((a, b) => (planOrder[a.type.toLowerCase()] || 9) - (planOrder[b.type.toLowerCase()] || 9));
      const buttons = sorted.map(p => ([{ text: `${planLabels[p.type.toLowerCase()] || p.type} - R$ ${p.price.toFixed(2)}`, callback_data: `plan_${p.id}_${app.id}` }]));
      buttons.push([{ text: '🔙 Menu', callback_data: 'menu' }]);
      await sendTelegramMessage(botToken, chatId, `📱 *${app.name}*\n${app.description || ''}\n\n💰 *Escolha:*`, buttons);
      return;
    }

    // Não entendeu
    await sendTelegramMessage(botToken, chatId, '🤔 Não entendi. Use os botões abaixo:', [[{ text: '📱 Ver Apps', callback_data: 'menu' }], [{ text: '💰 Preços', callback_data: 'precos' }, { text: '❓ Ajuda', callback_data: 'ajuda' }]]);

    await prisma.conversation.create({
      data: {
        phoneNumber: `tg_${chatId}`,
        clientName: 'Bot',
        message: reply,
        direction: 'outgoing',
        state: 'MENU',
      },
    });
  } catch (error) {
    console.error('[Telegram] Erro ao processar mensagem:', error);
  }
}

export async function startTelegramPolling(): Promise<{ success: boolean; message: string; error?: string }> {
  const config = await loadTelegramConfig();
  if (!config?.botToken) return { success: false, message: 'Bot não configurado', error: 'Configure o bot primeiro' };

  if (telegramStatus.polling) return { success: true, message: 'Polling já está ativo' };

  telegramStatus = { connected: true, polling: true, botUsername: config.botUsername };
  pollMessages(config.botToken);
  return { success: true, message: `Polling iniciado para @${config.botUsername}` };
}

export async function stopTelegramPolling(): Promise<{ success: boolean; message: string }> {
  telegramStatus.polling = false;
  if (pollingTimeout) { clearTimeout(pollingTimeout); pollingTimeout = null; }
  telegramStatus = { ...telegramStatus, polling: false };
  return { success: true, message: 'Polling parado' };
}

export function getTelegramStatus(): TelegramStatus {
  return { ...telegramStatus };
}

export async function removeTelegramBot(): Promise<{ success: boolean; message: string }> {
  await stopTelegramPolling();
  await prisma.config.deleteMany({ where: { key: 'telegram_config' } });
  telegramStatus = { connected: false, polling: false };
  return { success: true, message: 'Bot removido' };
}
