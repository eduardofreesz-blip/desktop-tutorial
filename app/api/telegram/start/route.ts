import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { startTelegramPolling, getTelegramStatus } from '@/lib/telegram-bot';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const result = await startTelegramPolling();
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    const status = getTelegramStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error('Erro ao iniciar Telegram:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
