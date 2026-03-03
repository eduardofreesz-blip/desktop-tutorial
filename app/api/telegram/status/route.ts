import { NextResponse } from 'next/server';
import { getTelegramStatus, loadTelegramConfig } from '@/lib/telegram-bot';

export async function GET() {
  try {
    // Carregar configuração se necessário
    await loadTelegramConfig();
    
    const status = getTelegramStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Erro ao buscar status Telegram:', error);
    return NextResponse.json(
      { configured: false, active: false, botUsername: null, lastError: String(error) },
      { status: 500 }
    );
  }
}
