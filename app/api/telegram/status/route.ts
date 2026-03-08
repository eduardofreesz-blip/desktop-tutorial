import { NextResponse } from 'next/server';
import { getTelegramStatus, loadTelegramConfig, startTelegramPolling } from '@/lib/telegram-bot';

export async function GET() {
  try {
    const config = await loadTelegramConfig();
    const status = getTelegramStatus();
    
    // Auto-iniciar polling se configurado mas não rodando
    if (config?.isActive && config?.botToken && !status.polling) {
      console.log('[Telegram] Auto-iniciando polling...');
      await startTelegramPolling();
    }
    
    return NextResponse.json({ ...getTelegramStatus(), configured: !!config?.botToken });
  } catch (error) {
    console.error('Erro ao buscar status Telegram:', error);
    return NextResponse.json(
      { configured: false, active: false, polling: false, botUsername: null, lastError: String(error) },
      { status: 500 }
    );
  }
}
