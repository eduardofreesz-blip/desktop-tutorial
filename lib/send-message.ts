/**
 * Envia mensagem para cliente - WhatsApp ou Telegram conforme clientPhone
 */
import { sendWhatsAppMessage, getConnectionStatus } from './whatsapp-web';
import { sendTelegramMessageToClient } from './telegram-bot';

export async function sendMessageToClient(clientPhone: string, message: string): Promise<boolean> {
  if (!clientPhone) return false;
  if (clientPhone.startsWith('tg_')) {
    return sendTelegramMessageToClient(clientPhone, message);
  }
  const status = getConnectionStatus();
  if (status.status === 'connected') {
    return sendWhatsAppMessage(clientPhone, message);
  }
  return false;
}
