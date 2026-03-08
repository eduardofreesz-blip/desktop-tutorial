/**
 * Mercado Pago PIX Integration
 * API: https://www.mercadopago.com.br/developers/en/reference/payments/_payments/post
 */

import fs from 'fs';

const SECRETS_PATH = '/home/ubuntu/.config/abacusai_auth_secrets.json';

function getSecrets(): Record<string, any> {
  try {
    const data = fs.readFileSync(SECRETS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function hasMercadoPagoCredentials(): boolean {
  const secrets = getSecrets();
  const token = secrets?.mercadopago?.secrets?.access_token?.value?.trim();
  if (token) return true;
  return !!(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN_TEST);
}

export function getMercadoPagoAccessToken(): string {
  const secrets = getSecrets();
  const fromSecrets = secrets?.mercadopago?.secrets?.access_token?.value?.trim();
  if (fromSecrets) return fromSecrets;

  const isProduction = process.env.MERCADOPAGO_ENVIRONMENT === 'production';
  const token = isProduction
    ? process.env.MERCADOPAGO_ACCESS_TOKEN
    : process.env.MERCADOPAGO_ACCESS_TOKEN_TEST || process.env.MERCADOPAGO_ACCESS_TOKEN;
  return token?.trim() || '';
}

export interface MercadoPagoPixResult {
  success: boolean;
  paymentId?: string;
  qrCode?: string;
  qrCodeImage?: string;
  status?: string;
  error?: string;
}

export async function createMercadoPagoPixPayment(
  amount: number,
  orderId: string,
  customerId: string,
  customerEmail?: string
): Promise<MercadoPagoPixResult> {
    const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Credenciais Mercado Pago não configuradas' };
  }

  const baseUrl = 'https://api.mercadopago.com';

  try {
    const idempotencyKey = `order-${orderId}-${Date.now()}`;

    const response = await fetch(`${baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: Number(amount.toFixed(2)),
        description: `Pedido ${orderId}`,
        payment_method_id: 'pix',
        payer: {
          email: customerEmail || (customerId.startsWith('tg_') ? 'cliente@telegram.mercadopago.com' : `${customerId.replace(/\D/g, '')}@temp.mercadopago.com`),
          first_name: 'Cliente',
        },
        external_reference: orderId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || JSON.stringify(data);
      console.error('[Mercado Pago PIX] Erro:', errorMsg);
      return {
        success: false,
        error: typeof errorMsg === 'string' ? errorMsg : 'Erro ao criar PIX Mercado Pago',
      };
    }

    // Mercado Pago retorna: point_of_interaction.transaction_data
    const poi = data?.point_of_interaction;
    const txn = poi?.transaction_data || data?.transaction_data;
    const qrCode =
      txn?.qr_code ||
      txn?.br_code ||
      txn?.emv ||
      poi?.transaction_data?.qr_code ||
      data?.point_of_interaction?.transaction_data?.ticket_url ||
      '';
    const qrCodeBase64 =
      txn?.qr_code_base64 ||
      poi?.transaction_data?.qr_code_base64 ||
      data?.point_of_interaction?.transaction_data?.qr_code_base64;

    if (!qrCode) {
      console.warn('[Mercado Pago PIX] Resposta sem QR/código - estrutura:', JSON.stringify(Object.keys(data || {})));
    }

    return {
      success: true,
      paymentId: String(data?.id || orderId),
      qrCode: qrCode || '',
      qrCodeImage: qrCodeBase64 || undefined,
      status: data?.status || 'pending',
    };
  } catch (error) {
    console.error('[Mercado Pago PIX] Erro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar PIX Mercado Pago',
    };
  }
}

/** Cria link de checkout (cartão/PIX/boleto) via Mercado Pago Preferences API */
export async function createMercadoPagoCheckoutLink(
  orderId: string,
  title: string,
  amount: number,
  payerEmail?: string
): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Credenciais Mercado Pago não configuradas' };
  }

  try {
    const baseUrl = 'https://api.mercadopago.com';
    const response = await fetch(`${baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            id: orderId,
            title: title.substring(0, 255),
            quantity: 1,
            unit_price: Number(amount.toFixed(2)),
            currency_id: 'BRL',
          },
        ],
        external_reference: orderId,
        payer: {
          email: payerEmail || `${orderId}@temp.mercadopago.com`,
        },
        payment_methods: {
          excluded_payment_types: [],
          installments: 12,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || JSON.stringify(data);
      console.error('[Mercado Pago Checkout] Erro:', errorMsg);
      return {
        success: false,
        error: typeof errorMsg === 'string' ? errorMsg : 'Erro ao criar link de pagamento',
      };
    }

    const checkoutUrl = data?.init_point || data?.sandbox_init_point;
    if (!checkoutUrl) {
      return { success: false, error: 'Link de checkout não retornado' };
    }

    return { success: true, checkoutUrl };
  } catch (error) {
    console.error('[Mercado Pago Checkout] Erro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar link de pagamento',
    };
  }
}
