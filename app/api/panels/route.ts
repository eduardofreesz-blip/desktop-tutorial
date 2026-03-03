import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });
    }

    const panels = await prisma.panel.findMany({
      where: user.role === 'admin' ? {} : { ownerId: user.id },
      include: {
        owner: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, panels });
  } catch (error) {
    console.error('Erro ao buscar painéis:', error);
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

    const { name, slug, maxApps, maxCodes, commission, expiresAt } = await request.json();

    // Verificar se slug já existe
    const existingPanel = await prisma.panel.findUnique({
      where: { slug },
    });

    if (existingPanel) {
      return NextResponse.json({ success: false, error: 'Slug já existe' }, { status: 400 });
    }

    const panel = await prisma.panel.create({
      data: {
        name,
        slug,
        ownerId: user.id,
        maxApps: maxApps || 5,
        maxCodes: maxCodes || 1000,
        commission: commission || 0,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        owner: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, panel });
  } catch (error) {
    console.error('Erro ao criar painel:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
