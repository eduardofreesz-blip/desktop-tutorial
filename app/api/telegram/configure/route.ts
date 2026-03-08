import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { configureTelegramBot } from '@/lib/telegram-bot';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const token = body.token || body.botToken;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token é obrigatório' },
        { status: 400 }
      );
    }

    const result = await configureTelegramBot(token);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao configurar Telegram:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
