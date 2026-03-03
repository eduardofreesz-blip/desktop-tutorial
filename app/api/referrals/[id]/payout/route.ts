import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { pixKey } = body;

    const referral = await prisma.referral.findUnique({ where: { id } });
    if (!referral) {
      return NextResponse.json({ error: 'Indicação não encontrada' }, { status: 404 });
    }

    if (referral.pendingPayout <= 0) {
      return NextResponse.json({ error: 'Sem saldo para pagamento' }, { status: 400 });
    }

    // Criar registro de pagamento
    const payout = await prisma.referralPayout.create({
      data: {
        referralId: id,
        amount: referral.pendingPayout,
        pixKey: pixKey || null,
        status: 'paid',
        paidAt: new Date()
      }
    });

    // Zerar saldo pendente
    await prisma.referral.update({
      where: { id },
      data: { pendingPayout: 0 }
    });

    return NextResponse.json(payout);
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
