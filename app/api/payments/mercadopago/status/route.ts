import { NextResponse } from 'next/server';
import { hasMercadoPagoCredentials } from '@/lib/mercadopago';

export async function GET() {
  const configured = hasMercadoPagoCredentials();
  const environment = process.env.MERCADOPAGO_ENVIRONMENT || 'sandbox';

  return NextResponse.json({
    configured,
    environment,
    webhookUrl: `${process.env.NEXTAUTH_URL || ''}/api/webhook/mercadopago`,
  });
}
