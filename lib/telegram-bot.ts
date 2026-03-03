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
let pollingInterval: NodeJS.Timeout | null = null;

export async function loadTelegramConfig(): Promise<TelegramConfig | null> {
  const config = await prisma.config.findUnique({ where: { key: 'telegram_config' } });
  if (!config?.value) return null;
  try { return JSON.parse(config.value); } catch { return null; }
}

export async function configureTelegramBot(botToken: string): Promise<{ success: boolean; message: string; username?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    if (!res.ok) return { success: false, message: 'Token inválido' };
    const data = await res.json();
    const username = data.result?.username;

    await prisma.config.upsert({
      where: { key: 'telegram_config' },
      update: { value: JSON.stringify({ botToken, botUsername: username, isActive: true }) },
      create: { key: 'telegram_config', value: JSON.stringify({ botToken, botUsername: username, isActive: true }) },
    });

    return { success: true, message: `Bot @${username} configurado!`, username };
  } catch (error) {
    return { success: false, message: `Erro: ${error}` };
  }
}

export async function startTelegramPolling(): Promise<{ success: boolean; message: string; error?: string }> {
  const config = await loadTelegramConfig();
  if (!config?.botToken) return { success: false, message: 'Bot não configurado' };

  telegramStatus = { connected: true, polling: true, botUsername: config.botUsername };
  return { success: true, message: 'Polling iniciado' };
}

export async function stopTelegramPolling(): Promise<{ success: boolean; message: string }> {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  telegramStatus = { ...telegramStatus, polling: false };
  return { success: true, message: 'Polling parado' };
}

export function getTelegramStatus(): TelegramStatus {
  return telegramStatus;
}

export async function removeTelegramBot(): Promise<{ success: boolean; message: string }> {
  await stopTelegramPolling();
  await prisma.config.deleteMany({ where: { key: 'telegram_config' } });
  telegramStatus = { connected: false, polling: false };
  return { success: true, message: 'Bot removido' };
}
