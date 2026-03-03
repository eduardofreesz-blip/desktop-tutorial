export async function hasPagSeguroCredentials(): Promise<boolean> {
  return !!(process.env.PAGSEGURO_TOKEN && process.env.PAGSEGURO_EMAIL);
}

export async function createPagSeguroPixPayment(dataOrAmount: Record<string, unknown> | number, orderId?: string, description?: string): Promise<any> {
  if (typeof dataOrAmount === 'object') {
    return createPagSeguroPixPaymentImpl(
      (dataOrAmount.amount as number) || 0,
      (dataOrAmount.orderId as string) || '',
      (dataOrAmount.description as string)
    );
  }
  return createPagSeguroPixPaymentImpl(dataOrAmount, orderId || '', description);
}

async function createPagSeguroPixPaymentImpl(amount: number, orderId: string, description?: string) {
  const token = process.env.PAGSEGURO_TOKEN;
  const env = process.env.PAGSEGURO_ENVIRONMENT || 'sandbox';
  const baseUrl = env === 'production'
    ? 'https://api.pagseguro.com'
    : 'https://sandbox.api.pagseguro.com';

  try {
    const response = await fetch(`${baseUrl}/instant-payments/cob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        reference_id: orderId,
        customer: { name: 'Cliente', email: 'cliente@email.com' },
        qr_codes: [{ amount: { value: Math.round(amount * 100) } }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      paymentId: data.id || orderId,
      qrCode: data.qr_codes?.[0]?.text || '',
      qrCodeUrl: data.qr_codes?.[0]?.links?.[0]?.href || '',
      status: 'pending',
    };
  } catch (error) {
    console.error('PagSeguro PIX error:', error);
    return null;
  }
}

export async function createPagSeguroCardPayment(dataOrAmount: Record<string, unknown> | number, orderId?: string, cardData?: Record<string, unknown>): Promise<any> {
  const id = typeof dataOrAmount === 'number' ? orderId : (dataOrAmount as Record<string, unknown>).orderId as string;
  return { paymentId: id || 'unknown', status: 'pending', id, charges: [{ status: 'WAITING' }] } as any;
}

export function isPagSeguroPaymentApproved(status: string): boolean {
  return ['PAID', 'AVAILABLE'].includes(status?.toUpperCase());
}

export function mapPagSeguroStatus(status: string): string {
  const map: Record<string, string> = {
    WAITING: 'pending_payment',
    PAID: 'paid',
    AVAILABLE: 'paid',
    IN_DISPUTE: 'pending_payment',
    REFUNDED: 'cancelled',
    CANCELED: 'cancelled',
  };
  return map[status?.toUpperCase()] || 'pending_payment';
}
