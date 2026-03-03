import { NextResponse } from 'next/server';
import { hasPagSeguroCredentials } from '@/lib/pagseguro';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = hasPagSeguroCredentials();
  const environment = process.env.PAGSEGURO_ENVIRONMENT || 'sandbox';
  const webhookUrl = `${process.env.NEXTAUTH_URL || 'https://universal.abacusai.app'}/api/webhook/pagseguro`;

  return NextResponse.json({
    configured,
    environment,
    webhookUrl,
    provider: 'pagseguro',
    features: {
      pix: true,
      creditCard: true,
      boleto: false, // Não implementado ainda
    },
  });
}
