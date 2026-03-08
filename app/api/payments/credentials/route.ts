import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import fs from 'fs';
import path from 'path';

const SECRETS_PATH = '/home/ubuntu/.config/abacusai_auth_secrets.json';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { provider, credentials } = await request.json();

    if (!provider || !credentials) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { clientId, clientSecret, sellerId, chavePix } = credentials;

    // Validate based on provider
    if (provider === 'getnet') {
      if (!clientId || !clientSecret || !sellerId) {
        return NextResponse.json({ error: 'Preencha Client ID, Client Secret e Seller ID' }, { status: 400 });
      }
    } else if (provider === 'pagseguro') {
      if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Preencha o Token (Client ID) e o Email (Client Secret)' }, { status: 400 });
      }
    } else if (provider === 'itau' || provider === 'sicoob') {
      if (!clientId || !clientSecret || !chavePix) {
        return NextResponse.json({ error: 'Preencha Client ID, Client Secret e Chave PIX' }, { status: 400 });
      }
    } else if (provider === 'mercadopago') {
      if (!clientId) {
        return NextResponse.json({ error: 'Preencha o Access Token' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Provider não suportado' }, { status: 400 });
    }

    // Read existing secrets
    let secrets: Record<string, any> = {};
    try {
      const data = fs.readFileSync(SECRETS_PATH, 'utf-8');
      secrets = JSON.parse(data);
    } catch {
      secrets = {};
    }

    // Update credentials based on provider
    if (provider === 'getnet') {
      secrets.getnet = {
        secrets: {
          client_id: { value: clientId.trim() },
          client_secret: { value: clientSecret.trim() },
          seller_id: { value: sellerId.trim() },
        },
      };
    } else if (provider === 'pagseguro') {
      secrets.pagseguro = {
        secrets: {
          token: { value: clientId.trim() },
          email: { value: clientSecret.trim() },
        },
      };
    } else if (provider === 'itau') {
      secrets.itau = {
        secrets: {
          client_id: { value: clientId.trim() },
          client_secret: { value: clientSecret.trim() },
          chave_pix: { value: chavePix.trim() },
        },
      };
    } else if (provider === 'sicoob') {
      secrets.sicoob = {
        secrets: {
          client_id: { value: clientId.trim() },
          client_secret: { value: clientSecret.trim() },
          chave_pix: { value: chavePix.trim() },
        },
      };
    } else if (provider === 'mercadopago') {
      secrets.mercadopago = {
        secrets: {
          access_token: { value: clientId.trim() },
        },
      };
    }

    // Write back
    fs.writeFileSync(SECRETS_PATH, JSON.stringify(secrets, null, 2));

    // Update .env file for runtime access
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {
      envContent = '';
    }

    // Set env vars based on provider
    const envVars: Record<string, string> = {};
    if (provider === 'getnet') {
      envVars.GETNET_CLIENT_ID = clientId.trim();
      envVars.GETNET_CLIENT_SECRET = clientSecret.trim();
      envVars.GETNET_SELLER_ID = sellerId.trim();
    } else if (provider === 'pagseguro') {
      envVars.PAGSEGURO_TOKEN = clientId.trim();
      envVars.PAGSEGURO_EMAIL = clientSecret.trim();
    } else if (provider === 'itau') {
      envVars.ITAU_CLIENT_ID = clientId.trim();
      envVars.ITAU_CLIENT_SECRET = clientSecret.trim();
      envVars.ITAU_CHAVE_PIX = chavePix.trim();
    } else if (provider === 'sicoob') {
      envVars.SICOOB_CLIENT_ID = clientId.trim();
      envVars.SICOOB_CLIENT_SECRET = clientSecret.trim();
      envVars.SICOOB_CHAVE_PIX = chavePix.trim();
    } else if (provider === 'mercadopago') {
      envVars.MERCADOPAGO_ACCESS_TOKEN = clientId.trim();
    }

    for (const [key, value] of Object.entries(envVars)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
      process.env[key] = value;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');

    return NextResponse.json({ 
      success: true,
      message: 'Credenciais salvas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar credenciais:', error);
    return NextResponse.json({ error: 'Erro ao salvar credenciais' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Read secrets
    let secrets: any = {};
    try {
      const data = fs.readFileSync(SECRETS_PATH, 'utf-8');
      secrets = JSON.parse(data);
    } catch {
      return NextResponse.json({ configured: false });
    }

    const getnetSecrets = secrets?.getnet?.secrets || {};
    const hasGetnet = !!(getnetSecrets?.client_id?.value && 
                         getnetSecrets?.client_secret?.value && 
                         getnetSecrets?.seller_id?.value);

    const pagseguroSecrets = secrets?.pagseguro?.secrets || {};
    const hasPagseguro = !!(pagseguroSecrets?.token?.value && 
                           pagseguroSecrets?.email?.value);

    const mercadopagoSecrets = secrets?.mercadopago?.secrets || {};
    const hasMercadoPago = !!mercadopagoSecrets?.access_token?.value;

    return NextResponse.json({
      configured: hasGetnet || hasPagseguro || hasMercadoPago,
      providers: {
        getnet: hasGetnet,
        pagseguro: hasPagseguro,
        mercadopago: hasMercadoPago,
        asaas: false,
        stripe: false,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao verificar credenciais' }, { status: 500 });
  }
}
