import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = params;

    const referral = await prisma.referral.update({
      where: { id },
      data: {
        ...(body.referrerName !== undefined && { referrerName: body.referrerName }),
        ...(body.commission !== undefined && { commission: parseFloat(body.commission) }),
        ...(body.isActive !== undefined && { isActive: body.isActive })
      }
    });

    return NextResponse.json(referral);
  } catch (error) {
    console.error('Erro ao atualizar indicação:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;
    await prisma.referral.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar indicação:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
