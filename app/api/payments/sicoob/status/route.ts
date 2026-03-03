import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

function getCredentials() {
  const secretsPath = '/home/ubuntu/.config/abacusai_auth_secrets.json';
  
  try {
    const data = fs.readFileSync(secretsPath, 'utf-8');
    const secrets = JSON.parse(data);
    const sicoobSecrets = secrets?.sicoob?.secrets || {};
    
    return {
      clientId: (sicoobSecrets?.client_id?.value || process.env.SICOOB_CLIENT_ID || '').trim(),
      clientSecret: (sicoobSecrets?.client_secret?.value || process.env.SICOOB_CLIENT_SECRET || '').trim(),
      chavePix: (sicoobSecrets?.chave_pix?.value || process.env.SICOOB_CHAVE_PIX || '').trim(),
    };
  } catch {
    return {
      clientId: (process.env.SICOOB_CLIENT_ID || '').trim(),
      clientSecret: (process.env.SICOOB_CLIENT_SECRET || '').trim(),
      chavePix: (process.env.SICOOB_CHAVE_PIX || '').trim(),
    };
  }
}

export async function GET() {
  const { clientId, clientSecret, chavePix } = getCredentials();
  const configured = !!(clientId && clientSecret && chavePix);
  const environment = process.env.SICOOB_ENVIRONMENT || 'sandbox';
  const webhookUrl = `${process.env.NEXTAUTH_URL || 'https://universal.abacusai.app'}/api/webhook/sicoob`;

  return NextResponse.json({
    configured,
    environment,
    webhookUrl,
    provider: 'sicoob',
    features: {
      pix: true,
      creditCard: false,
      boleto: false,
    },
  });
}
