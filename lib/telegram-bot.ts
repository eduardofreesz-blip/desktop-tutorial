import { prisma } from './db';
import { processIncomingMessage, formatSimpleMessage, type InteractiveMessage } from './bot-logic-web';

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
  if (buttons && buttons.length > 0) {
    body.reply_markup = { inline_keyboard: buttons };
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error('[Telegram] Erro ao enviar:', await res.text());
}

async function sendTelegramBotResponse(botToken: string, chatId: number, response: InteractiveMessage | InteractiveMessage[] | null): Promise<void> {
  if (!response) return;
  const items = Array.isArray(response) ? response : [response];
  for (const item of items) {
    const m = item as InteractiveMessage;
    if (m.type === 'image' && m.imageUrl) {
      try {
        if (m.imageUrl.startsWith('http')) {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, photo: m.imageUrl, caption: m.caption || '', parse_mode: 'Markdown' }),
          });
          if (!res.ok && m.caption) await sendTelegramMessage(botToken, chatId, m.caption);
        } else if (m.caption) {
          await sendTelegramMessage(botToken, chatId, m.caption);
        }
      } catch (e) {
        console.error('[Telegram] Erro ao enviar imagem:', e);
        if (m.caption) await sendTelegramMessage(botToken, chatId, m.caption);
      }
    } else {
      const text = m.text || m.caption || formatSimpleMessage(m);
      if (!text) continue;
      let buttons: Array<Array<{text: string, callback_data: string}>> | undefined;
      if (m.buttons && m.buttons.length > 0) {
        buttons = [m.buttons.map(b => ({ text: (b.title || b.id || '').substring(0, 64), callback_data: b.id || b.title || '' }))];
      } else if (m.listSections && m.listSections.length > 0) {
        buttons = m.listSections.flatMap(s => (s.rows || []).map(r => [{ text: (r.title || r.id).substring(0, 64), callback_data: r.id || r.title || '' }]));
      }
      await sendTelegramMessage(botToken, chatId, text, buttons);
    }
  }
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
  let text = message.text || '';
  const userName = message.from?.first_name || 'Usuário';

  // Mapear comandos Telegram para formato do bot unificado
  const lower = text.toLowerCase();
  if (lower === '/start') text = 'menu';
  else if (lower === '/precos' || lower === 'preços') text = '1';
  else if (lower === '/pedidos') text = '4';
  else if (lower === '/ajuda' || lower === '/help') text = '5';

  try {
    const response = await processIncomingMessage(`tg_${chatId}`, text, userName, 'telegram');
    await sendTelegramBotResponse(botToken, chatId, response);
  } catch (error) {
    console.error('[Telegram] Erro ao processar mensagem:', error);
    await sendTelegramMessage(botToken, chatId, '❌ Ocorreu um erro. Tente novamente ou digite *menu* para voltar.');
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
