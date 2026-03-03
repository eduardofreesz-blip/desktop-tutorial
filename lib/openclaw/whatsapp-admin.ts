export async function handleWhatsAppMessage(phoneNumber: string, message: string): Promise<string | null> {
  return null;
}

export async function processAdminWhatsAppMessage(phoneNumber: string, message: string): Promise<{ handled: boolean; response?: string }> {
  return { handled: false };
}
