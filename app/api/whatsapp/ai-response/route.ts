export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generateAIResponse } from '@/lib/ai-assistant';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { customerMessage, context } = await request.json();

    if (!customerMessage) {
      return NextResponse.json(
        { error: 'Mensagem do cliente é obrigatória' },
        { status: 400 }
      );
    }

    const aiResponse = await generateAIResponse(customerMessage, context);

    return NextResponse.json({
      success: true,
      response: aiResponse,
    });
  } catch (error) {
    console.error('Erro ao gerar resposta IA:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar resposta' },
      { status: 500 }
    );
  }
}
