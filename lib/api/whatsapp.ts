/**
 * API WhatsApp - Entry Point Simplificado
 * Recebe mensagens e roteia para o OpenClaw
 */

import { processCommand } from '@/lib/openclaw/core';
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

/**
 * Processa mensagem recebida do WhatsApp
 */
export async function processWhatsAppMessage(msg: WhatsAppMessage): Promise<WhatsAppResponse> {
  const startTime = Date.now();
  const { phone, message, pushName } = msg;

  try {
    console.log(`[WhatsApp API] Processando: ${phone} - ${message.slice(0, 50)}...`);

    const result = await processCommand({
      command: message,
      channel: 'whatsapp',
      phoneNumber: phone
    });

    const duration = Date.now() - startTime;
    console.log(`[WhatsApp API] Processado em ${duration}ms`);

    return {
      success: result.success,
      reply: result.message
    };
  } catch (error: any) {
    console.error('[WhatsApp API] Erro:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
