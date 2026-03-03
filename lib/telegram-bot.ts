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

async function pollMessages(botToken: string) {
  if (!telegramStatus.polling) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=10&allowed_updates=["message"]`,
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
        if (update.message?.text) {
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

    let reply = '';
    const lower = text.toLowerCase();

    if (lower === '/start' || lower === 'oi' || lower === 'olá') {
      const apps = await prisma.app.findMany({ where: { isActive: true }, include: { plans: true } });
      const appList = apps.map(a => `📱 *${a.name}*\n${a.description || ''}`).join('\n\n');
      reply = `👋 Olá ${userName}! Bem-vindo à *Universal Recargas*!\n\nSomos especializados em códigos de recarga.\n\n${appList}\n\nDigite o nome do app que deseja!`;
    } else if (lower === '/apps' || lower === 'apps') {
      const apps = await prisma.app.findMany({ where: { isActive: true }, include: { plans: true } });
      const appList = apps.map(a => {
        const plans = a.plans.filter(p => p.isActive).map(p => `  • ${p.type}: R$ ${p.price.toFixed(2)}`).join('\n');
        return `📱 *${a.name}*\n${plans}`;
      }).join('\n\n');
      reply = `📱 *Apps Disponíveis:*\n\n${appList}`;
    } else if (lower === '/ajuda' || lower === 'ajuda' || lower === '/help') {
      reply = `❓ *Comandos disponíveis:*\n\n/start - Iniciar\n/apps - Ver apps e preços\n/ajuda - Esta mensagem\n\nOu simplesmente digite o nome do app que deseja!`;
    } else {
      const app = await prisma.app.findFirst({
        where: { isActive: true, name: { contains: text, mode: 'insensitive' } },
        include: { plans: { where: { isActive: true } } },
      });

      if (app) {
        const plans = app.plans.map(p => `• *${p.type}*: R$ ${p.price.toFixed(2)}`).join('\n');
        reply = `📱 *${app.name}*\n${app.description || ''}\n\n💰 *Planos:*\n${plans}\n\nPara comprar, entre em contato pelo WhatsApp!`;
      } else {
        reply = `Não encontrei esse app. Digite /apps para ver os disponíveis!`;
      }
    }

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'Markdown' }),
    });

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
