import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, invites });
  } catch (error) {
    console.error('Erro ao buscar convites:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }

    const { email, role, maxUses, expiresAt, panelId } = await request.json();

    // Gerar código único
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    const invite = await prisma.invite.create({
      data: {
        code,
        email: email || null,
        role: role || 'user',
        maxUses: maxUses || 1,
        panelId: panelId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({ success: true, invite });
  } catch (error) {
    console.error('Erro ao criar convite:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
