import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { stopTelegramPolling, getTelegramStatus } from '@/lib/telegram-bot';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await stopTelegramPolling();
    
    const status = getTelegramStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error('Erro ao parar Telegram:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
