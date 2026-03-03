export async function hasFitBankCredentials(): Promise<boolean> {
  return false;
}

export function getFitBankCredentials(): Record<string, string> {
  return { clientId: '', clientSecret: '', partnerId: '', pixKey: '', pixKeyType: '' };
}

export async function generatePixCollection(dataOrAmount: Record<string, unknown> | number, orderId?: string, description?: string): Promise<any> {
  return {
    paymentId: orderId,
    qrCode: '',
    qrCodeBase64: '',
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

export function isFitBankPaymentApproved(status: string): boolean {
  return status === 'Settled' || status === 'Confirmed';
}

export function isFitBankPaymentCanceled(status: string): boolean {
  return status === 'Canceled' || status === 'Expired';
}
