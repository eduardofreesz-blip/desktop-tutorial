import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus, hasGetnetCredentials } from '@/lib/getnet';

// Consultar status de pagamento
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json(
        { error: 'paymentId é obrigatório' },
        { status: 400 }
      );
    }

    if (!hasGetnetCredentials()) {
      return NextResponse.json(
        { error: 'Credenciais Getnet não configuradas' },
        { status: 500 }
      );
    }

    const status = await getPaymentStatus(paymentId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Erro ao consultar status:', error);
    return NextResponse.json(
      { error: 'Erro ao consultar status do pagamento' },
      { status: 500 }
    );
  }
}
