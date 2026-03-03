import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Código não fornecido' });
    }

    const invite = await prisma.invite.findUnique({
      where: { code },
    });

    if (!invite) {
      return NextResponse.json({ valid: false, error: 'Convite não encontrado' });
    }

    // Verificar se está ativo
    if (!invite.isActive) {
      return NextResponse.json({ valid: false, error: 'Convite desativado' });
    }

    // Verificar se expirou
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Convite expirado' });
    }

    // Verificar limite de usos
    if (invite.usedCount >= invite.maxUses) {
      return NextResponse.json({ valid: false, error: 'Convite já atingiu o limite de usos' });
    }

    return NextResponse.json({
      valid: true,
      invite: {
        email: invite.email,
        role: invite.role,
      },
    });
  } catch (error) {
    console.error('Erro ao validar convite:', error);
    return NextResponse.json({ valid: false, error: 'Erro interno' });
  }
}
