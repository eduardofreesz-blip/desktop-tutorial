import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const apps = await prisma.app.findMany({
      include: {
        plans: true,
        _count: {
          select: {
            codes: { where: { status: 'available' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(apps);
  } catch (error) {
    console.error('Erro ao buscar apps:', error);
    return NextResponse.json({ error: 'Erro ao buscar apps' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, logoUrl, bannerUrl, videoUrl, active, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const app = await prisma.app.create({
      data: {
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        bannerUrl: bannerUrl || null,
        videoUrl: videoUrl || null,
        isActive: isActive ?? active ?? true,
      },
    });

    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar app:', error);
    return NextResponse.json({ error: 'Erro ao criar app' }, { status: 500 });
  }
}
