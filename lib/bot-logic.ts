// @ts-nocheck
import { processIncomingMessage as processWeb } from './bot-logic-web';

export async function processIncomingMessage(
  phoneNumber: string,
  message: string,
  messageType?: string,
  metadata?: Record<string, unknown>
): Promise<{ response: string; state?: string }> {
  try {
    const result = await processWeb(phoneNumber, message);
    return { response: typeof result === 'string' ? result : 'Mensagem recebida!', state: 'processed' };
  } catch (error) {
    console.error('Error processing message:', error);
    return { response: 'Desculpe, ocorreu um erro. Tente novamente.' };
  }
}
