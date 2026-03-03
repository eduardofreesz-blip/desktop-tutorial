export interface EnviarMensagemInput {
  phoneNumber: string;
  message: string;
  mediaUrl?: string;
}

export interface EnviarMensagemOutput {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function enviarMensagem(input: EnviarMensagemInput): Promise<EnviarMensagemOutput> {
  try {
    console.log(`[WhatsApp] Enviando para ${input.phoneNumber}: ${input.message.substring(0, 50)}...`);
    return { success: true, messageId: `msg_${Date.now()}` };
  } catch (error) {
    return { success: false, error: `Erro ao enviar: ${error}` };
  }
}
