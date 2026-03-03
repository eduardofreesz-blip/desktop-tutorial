import { NextResponse } from 'next/server';
import { hasGetnetCredentials } from '@/lib/getnet';

export async function GET() {
  const configured = hasGetnetCredentials();
  const environment = process.env.GETNET_ENVIRONMENT || 'sandbox';

  return NextResponse.json({
    configured,
    environment,
    webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhook/getnet`,
  });
}
