import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, amount, appId, planType } = body;

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Código não informado' });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'Cupom não encontrado' });
    }

    if (!coupon.isActive) {
      return NextResponse.json({ valid: false, error: 'Cupom inativo' });
    }

    const now = new Date();
    if (coupon.validFrom > now) {
      return NextResponse.json({ valid: false, error: 'Cupom ainda não válido' });
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      return NextResponse.json({ valid: false, error: 'Cupom expirado' });
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ valid: false, error: 'Cupom esgotado' });
    }

    if (coupon.minAmount && amount < coupon.minAmount) {
      return NextResponse.json({ 
        valid: false, 
        error: `Valor mínimo: R$ ${coupon.minAmount.toFixed(2)}` 
      });
    }

    if (coupon.appId && coupon.appId !== appId) {
      return NextResponse.json({ valid: false, error: 'Cupom não válido para este app' });
    }

    if (coupon.planType && coupon.planType !== planType) {
      return NextResponse.json({ valid: false, error: 'Cupom não válido para este plano' });
    }

    // Calcular desconto
    let discount = 0;
    if (coupon.discountType === 'percent') {
      discount = (amount * coupon.discountValue) / 100;
    } else {
      discount = Math.min(coupon.discountValue, amount);
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      discount,
      finalAmount: amount - discount
    });
  } catch (error) {
    console.error('Erro ao validar cupom:', error);
    return NextResponse.json({ valid: false, error: 'Erro interno' }, { status: 500 });
  }
}
