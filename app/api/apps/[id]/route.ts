import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, logoUrl, bannerUrl, videoUrl, active, isActive } = body;

    const app = await prisma.app.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(bannerUrl !== undefined && { bannerUrl }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(isActive !== undefined && { isActive }),
        ...(active !== undefined && { isActive: active }),
      },
    });

    return NextResponse.json(app);
  } catch (error) {
    console.error('Erro ao atualizar app:', error);
    return NextResponse.json({ error: 'Erro ao atualizar app' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await prisma.app.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'App deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar app:', error);
    return NextResponse.json({ error: 'Erro ao deletar app' }, { status: 500 });
  }
}
