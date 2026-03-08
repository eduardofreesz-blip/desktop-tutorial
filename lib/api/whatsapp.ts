/**
 * API WhatsApp - Entry Point Simplificado
 */

import { sendWhatsAppMessage } from '@/lib/whatsapp-web';

export interface WhatsAppMessage {
  phone: string;
  message: string;
  pushName?: string;
  messageId?: string;
  timestamp?: number;
}

export interface WhatsAppResponse {
  success: boolean;
  reply?: string;
  error?: string;
}

export async function processWhatsAppMessage(msg: WhatsAppMessage): Promise<WhatsAppResponse> {
  const { phone, message } = msg;

  try {
    console.log(`[WhatsApp API] Processando: ${phone} - ${message.slice(0, 50)}...`);
    return { success: true, reply: 'Mensagem processada' };
  } catch (error: any) {
    console.error('[WhatsApp API] Erro:', error);
    return { success: false, error: error.message };
  }
}
