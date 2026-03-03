import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Listar clientes em modo humano
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar últimas conversas de cada cliente com humanMode
    const conversations = await prisma.conversation.findMany({
      where: { humanMode: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['phoneNumber'],
      take: 100,
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Erro ao buscar modo humano:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST - Ativar/desativar modo humano
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { phoneNumber, enabled } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 });
    }

    // Atualizar todas as conversas do cliente
    await prisma.conversation.updateMany({
      where: { phoneNumber },
      data: { humanMode: enabled },
    });

    // Criar nova entrada de conversa para registrar a mudança
    await prisma.conversation.create({
      data: {
        phoneNumber,
        clientName: 'Sistema',
        message: enabled ? '[MODO HUMANO ATIVADO]' : '[MODO HUMANO DESATIVADO]',
        direction: 'SYSTEM',
        state: 'MENU',
        humanMode: enabled,
      },
    });

    return NextResponse.json({
      success: true,
      message: enabled ? 'Modo humano ativado' : 'Modo humano desativado',
    });
  } catch (error) {
    console.error('Erro ao alterar modo humano:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
