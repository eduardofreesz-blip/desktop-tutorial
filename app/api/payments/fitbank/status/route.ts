// Status da integração FitBank
import { NextResponse } from 'next/server';
import { hasFitBankCredentials, getFitBankCredentials } from '@/lib/fitbank';

export async function GET() {
  const configured = hasFitBankCredentials();
  const credentials = getFitBankCredentials();
  const environment = process.env.FITBANK_ENVIRONMENT || 'sandbox';

  return NextResponse.json({
    configured,
    environment,
    partnerId: credentials?.partnerId ? `${credentials.partnerId.slice(0, 4)}...` : null,
    hasPixKey: !!credentials?.pixKey,
    pixKeyType: credentials?.pixKeyType || null,
    webhookUrl: `${process.env.NEXTAUTH_URL || ''}/api/webhook/fitbank`,
  });
}
