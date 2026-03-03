import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

function getCredentials() {
  const secretsPath = '/home/ubuntu/.config/abacusai_auth_secrets.json';
  
  try {
    const data = fs.readFileSync(secretsPath, 'utf-8');
    const secrets = JSON.parse(data);
    const itauSecrets = secrets?.itau?.secrets || {};
    
    return {
      clientId: (itauSecrets?.client_id?.value || process.env.ITAU_CLIENT_ID || '').trim(),
      clientSecret: (itauSecrets?.client_secret?.value || process.env.ITAU_CLIENT_SECRET || '').trim(),
      chavePix: (itauSecrets?.chave_pix?.value || process.env.ITAU_CHAVE_PIX || '').trim(),
    };
  } catch {
    return {
      clientId: (process.env.ITAU_CLIENT_ID || '').trim(),
      clientSecret: (process.env.ITAU_CLIENT_SECRET || '').trim(),
      chavePix: (process.env.ITAU_CHAVE_PIX || '').trim(),
    };
  }
}

export async function GET() {
  const { clientId, clientSecret, chavePix } = getCredentials();
  const configured = !!(clientId && clientSecret && chavePix);
  const environment = process.env.ITAU_ENVIRONMENT || 'sandbox';
  const webhookUrl = `${process.env.NEXTAUTH_URL || 'https://universal.abacusai.app'}/api/webhook/itau`;

  return NextResponse.json({
    configured,
    environment,
    webhookUrl,
    provider: 'itau',
    features: {
      pix: true,
      creditCard: false,
      boleto: false,
    },
  });
}
