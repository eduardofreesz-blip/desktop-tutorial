import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Verificar código de indicação (usado pelo bot)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode, clientPhone, clientName, orderId, orderAmount } = body;

    if (!referralCode) {
      return NextResponse.json({ valid: false, error: 'Código não informado' });
    }

    const referral = await prisma.referral.findUnique({
      where: { referralCode: referralCode.toUpperCase() }
    });

    if (!referral) {
      return NextResponse.json({ valid: false, error: 'Código inválido' });
    }

    if (!referral.isActive) {
      return NextResponse.json({ valid: false, error: 'Código inativo' });
    }

    // Se foi passado um pedido, registrar a indicação
    if (orderId && orderAmount && clientPhone) {
      // Verificar se cliente já foi indicado
      const existingReferred = await prisma.referredUser.findFirst({
        where: { clientPhone }
      });

      if (!existingReferred) {
        const commission = (orderAmount * referral.commission) / 100;

        // Criar registro do cliente indicado
        await prisma.referredUser.create({
          data: {
            referralId: referral.id,
            clientPhone,
            clientName: clientName || null,
            firstOrderId: orderId,
            commission,
            status: 'completed'
          }
        });

        // Atualizar totais do indicador
        await prisma.referral.update({
          where: { id: referral.id },
          data: {
            totalReferrals: { increment: 1 },
            totalEarnings: { increment: commission },
            pendingPayout: { increment: commission }
          }
        });

        return NextResponse.json({
          valid: true,
          referrerName: referral.referrerName,
          commission,
          registered: true
        });
      }
    }

    return NextResponse.json({
      valid: true,
      referrerName: referral.referrerName
    });
  } catch (error) {
    console.error('Erro ao verificar indicação:', error);
    return NextResponse.json({ valid: false, error: 'Erro interno' }, { status: 500 });
  }
}
