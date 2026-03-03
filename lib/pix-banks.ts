// @ts-nocheck
// PIX Banks Integration - Itaú, Sicoob, Getnet
import fs from 'fs';

const SECRETS_PATH = '/home/ubuntu/.config/abacusai_auth_secrets.json';

export type PixProvider = 'getnet' | 'itau' | 'sicoob' | 'manual';

export interface PixConfig {
  provider: PixProvider;
  // Getnet
  getnet_client_id?: string;
  getnet_client_secret?: string;
  getnet_seller_id?: string;
  // Itaú
  itau_client_id?: string;
  itau_client_secret?: string;
  itau_chave_pix?: string;
  // Sicoob
  sicoob_client_id?: string;
  sicoob_client_secret?: string;
  sicoob_chave_pix?: string;
  // Manual
  manual_pix_key?: string;
  manual_pix_name?: string;
}

export interface PixPaymentResult {
  success: boolean;
  qrCode?: string;
  qrCodeImage?: string;
  paymentId?: string;
  copiaCola?: string;
  error?: string;
}

function getSecrets() {
  try {
    const data = fs.readFileSync(SECRETS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function getPixCredentials(provider: PixProvider): Record<string, string> {
  const secrets = getSecrets();
  
  switch (provider) {
    case 'getnet':
      const getnetSecrets = secrets?.getnet?.secrets || {};
      return {
        clientId: getnetSecrets?.client_id?.value?.trim() || process.env.GETNET_CLIENT_ID || '',
        clientSecret: getnetSecrets?.client_secret?.value?.trim() || process.env.GETNET_CLIENT_SECRET || '',
        sellerId: getnetSecrets?.seller_id?.value?.trim() || process.env.GETNET_SELLER_ID || '',
      };
    case 'itau':
      const itauSecrets = secrets?.itau?.secrets || {};
      return {
        clientId: itauSecrets?.client_id?.value?.trim() || process.env.ITAU_CLIENT_ID || '',
        clientSecret: itauSecrets?.client_secret?.value?.trim() || process.env.ITAU_CLIENT_SECRET || '',
        chavePix: itauSecrets?.chave_pix?.value?.trim() || process.env.ITAU_CHAVE_PIX || '',
      };
    case 'sicoob':
      const sicoobSecrets = secrets?.sicoob?.secrets || {};
      return {
        clientId: sicoobSecrets?.client_id?.value?.trim() || process.env.SICOOB_CLIENT_ID || '',
        clientSecret: sicoobSecrets?.client_secret?.value?.trim() || process.env.SICOOB_CLIENT_SECRET || '',
        chavePix: sicoobSecrets?.chave_pix?.value?.trim() || process.env.SICOOB_CHAVE_PIX || '',
      };
    default:
      return {};
  }
}

export function hasProviderCredentials(provider: PixProvider): boolean {
  const creds = getPixCredentials(provider);
  
  switch (provider) {
    case 'getnet':
      return !!(creds.clientId && creds.clientSecret && creds.sellerId);
    case 'itau':
      return !!(creds.clientId && creds.clientSecret && creds.chavePix);
    case 'sicoob':
      return !!(creds.clientId && creds.clientSecret && creds.chavePix);
    default:
      return false;
  }
}

// ========== ITAÚ PIX API ==========
let itauToken: { token: string; expiresAt: number } | null = null;

async function getItauToken(): Promise<string> {
  if (itauToken && Date.now() < itauToken.expiresAt) {
    return itauToken.token;
  }

  const { clientId, clientSecret } = getPixCredentials('itau');
  const isProduction = process.env.ITAU_ENVIRONMENT === 'production';
  const baseUrl = isProduction 
    ? 'https://sts.itau.com.br' 
    : 'https://sts.sandbox.itau.com.br';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=cob.write cob.read',
  });

  if (!response.ok) {
    throw new Error(`Itaú Auth Error: ${response.status}`);
  }

  const data = await response.json();
  itauToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

export async function createItauPix(amount: number, orderId: string): Promise<PixPaymentResult> {
  try {
    const token = await getItauToken();
    const { chavePix } = getPixCredentials('itau');
    const isProduction = process.env.ITAU_ENVIRONMENT === 'production';
    const baseUrl = isProduction 
      ? 'https://secure.api.itau' 
      : 'https://secure.sandbox.api.itau';

    const txid = `ORDER${orderId}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 35);
    
    const payload = {
      calendario: {
        expiracao: 3600, // 1 hour
      },
      valor: {
        original: amount.toFixed(2),
      },
      chave: chavePix,
      solicitacaoPagador: `Pedido ${orderId}`,
    };

    const response = await fetch(`${baseUrl}/pix_recebimentos/v2/cob/${txid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Itaú PIX] Error:', error);
      return { success: false, error: 'Erro ao criar PIX Itaú' };
    }

    const data = await response.json();
    
    // Get QR Code
    const qrResponse = await fetch(`${baseUrl}/pix_recebimentos/v2/cob/${txid}/qrcode`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    const qrData = await qrResponse.json();

    return {
      success: true,
      qrCode: qrData.qrcode || data.pixCopiaECola,
      qrCodeImage: qrData.imagemQrcode,
      paymentId: txid,
      copiaCola: data.pixCopiaECola,
    };
  } catch (error) {
    console.error('[Itaú PIX] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// ========== SICOOB PIX API ==========
let sicoobToken: { token: string; expiresAt: number } | null = null;

async function getSicoobToken(): Promise<string> {
  if (sicoobToken && Date.now() < sicoobToken.expiresAt) {
    return sicoobToken.token;
  }

  const { clientId, clientSecret } = getPixCredentials('sicoob');
  const isProduction = process.env.SICOOB_ENVIRONMENT === 'production';
  const baseUrl = isProduction 
    ? 'https://auth.sicoob.com.br' 
    : 'https://sandbox.sicoob.com.br/auth';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=cob.write cob.read pix.write pix.read',
  });

  if (!response.ok) {
    throw new Error(`Sicoob Auth Error: ${response.status}`);
  }

  const data = await response.json();
  sicoobToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

export async function createSicoobPix(amount: number, orderId: string): Promise<PixPaymentResult> {
  try {
    const token = await getSicoobToken();
    const { chavePix } = getPixCredentials('sicoob');
    const isProduction = process.env.SICOOB_ENVIRONMENT === 'production';
    const baseUrl = isProduction 
      ? 'https://api.sicoob.com.br/pix/api/v2' 
      : 'https://sandbox.sicoob.com.br/pix/api/v2';

    const txid = `ORD${orderId}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 35);
    
    const payload = {
      calendario: {
        expiracao: 3600,
      },
      valor: {
        original: amount.toFixed(2),
      },
      chave: chavePix,
      solicitacaoPagador: `Pedido ${orderId}`,
    };

    const response = await fetch(`${baseUrl}/cob/${txid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'client_id': getPixCredentials('sicoob').clientId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Sicoob PIX] Error:', error);
      return { success: false, error: 'Erro ao criar PIX Sicoob' };
    }

    const data = await response.json();
    
    // Get QR Code
    const qrResponse = await fetch(`${baseUrl}/cob/${txid}/qrcode`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'client_id': getPixCredentials('sicoob').clientId,
      },
    });
    
    const qrData = await qrResponse.json();

    return {
      success: true,
      qrCode: qrData.qrcode || data.pixCopiaECola,
      qrCodeImage: qrData.imagemQrcode,
      paymentId: txid,
      copiaCola: data.pixCopiaECola,
    };
  } catch (error) {
    console.error('[Sicoob PIX] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// ========== UNIFIED PIX CREATION ==========
import { createPixPayment, hasGetnetCredentials } from './getnet';

export async function createUnifiedPix(
  provider: PixProvider,
  amount: number,
  orderId: string,
  customerId: string
): Promise<PixPaymentResult> {
  console.log(`[PIX] Creating with provider: ${provider}`);
  
  switch (provider) {
    case 'getnet':
      if (!hasGetnetCredentials()) {
        return { success: false, error: 'Credenciais Getnet não configuradas' };
      }
      try {
        const result = await createPixPayment({
          amount: Math.round(amount * 100),
          orderId: `ORDER_${orderId}`,
          customerId: customerId.replace(/\D/g, ''),
        });
        return {
          success: true,
          qrCode: result.qr_code,
          qrCodeImage: result.additional_data?.qr_code_image,
          paymentId: result.payment_id,
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Erro Getnet' };
      }

    case 'itau':
      if (!hasProviderCredentials('itau')) {
        return { success: false, error: 'Credenciais Itaú não configuradas' };
      }
      return createItauPix(amount, orderId);

    case 'sicoob':
      if (!hasProviderCredentials('sicoob')) {
        return { success: false, error: 'Credenciais Sicoob não configuradas' };
      }
      return createSicoobPix(amount, orderId);

    default:
      return { success: false, error: 'Provider não suportado' };
  }
}
