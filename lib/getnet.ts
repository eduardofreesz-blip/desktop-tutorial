export function isPaymentApproved(status: string): boolean {
  return ['APPROVED', 'CONFIRMED', 'AUTHORIZED'].includes(status?.toUpperCase());
}

export async function createCardPayment(dataOrAmount: Record<string, unknown> | number, orderId?: string, cardData?: Record<string, unknown>): Promise<any> {
  const id = typeof dataOrAmount === 'number' ? orderId : (dataOrAmount as Record<string, unknown>).orderId as string;
  return { payment_id: id, status: { code: 'PENDING' }, credit: {} } as any;
}

export async function getPaymentStatus(paymentId: string): Promise<{ status: string; paymentId: string }> {
  return { status: 'pending', paymentId };
}

export interface GetnetPixPayment {
  paymentId: string;
  status: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
}

export async function hasGetnetCredentials(): Promise<boolean> {
  return !!(
    process.env.GETNET_CLIENT_ID &&
    process.env.GETNET_CLIENT_SECRET &&
    process.env.GETNET_SELLER_ID
  );
}

export async function createPixPayment(
  amount: number,
  orderId: string,
  description?: string
): Promise<GetnetPixPayment | null> {
  if (!(await hasGetnetCredentials())) return null;

  const clientId = process.env.GETNET_CLIENT_ID;
  const clientSecret = process.env.GETNET_CLIENT_SECRET;
  const sellerId = process.env.GETNET_SELLER_ID;
  const env = process.env.GETNET_ENVIRONMENT || 'sandbox';
  const baseUrl = env === 'production'
    ? 'https://api.getnet.com.br'
    : 'https://api-sandbox.getnet.com.br';

  try {
    const authResponse = await fetch(`${baseUrl}/auth/oauth/v2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'scope=oob&grant_type=client_credentials',
    });

    if (!authResponse.ok) return null;
    const authData = await authResponse.json();

    const pixResponse = await fetch(`${baseUrl}/v1/payments/qrcode/pix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authData.access_token}`,
        'seller_id': sellerId || '',
      },
      body: JSON.stringify({
        amount: Math.round(amount),
        currency: 'BRL',
        order_id: orderId,
        customer_id: orderId,
      }),
    });

    if (!pixResponse.ok) return null;
    const pixData = await pixResponse.json();

    return {
      paymentId: pixData.payment_id || orderId,
      status: 'pending',
      qrCode: pixData.additional_data?.qr_code || '',
      qrCodeBase64: pixData.additional_data?.pix_image || '',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  } catch (error) {
    console.error('Getnet PIX error:', error);
    return null;
  }
}
