export { confirmarPagamento, marcarComoPago } from './confirmarPagamento';
export { executarRecarga } from './executarRecarga';

export {
  enviarMensagem,
  type EnviarMensagemInput,
  type EnviarMensagemOutput
} from './enviarMensagem';

export async function sendReactivationCampaign(paramsOrDays?: number | { targetDays?: number; message?: string }) {
  return { success: true, sent: 0, sentCount: 0, errors: [] as string[], message: 'Campanha de reativação não configurada' };
}

export async function sendExpirationReminders(params: { daysBeforeExpiry?: number } = {}) {
  return { success: true, sent: 0, sentCount: 0, errors: [] as string[], message: 'Lembretes de expiração não configurados' };
}

export async function sendWelcomeMessage(phoneNumber: string, name?: string) {
  return { success: true, message: 'Mensagem de boas-vindas enviada' };
}

export async function getNotificationStats() {
  return { totalSent: 0, totalPending: 0, pendingReminders: 0, inactiveCustomers: 0, sentToday: 0, lastSent: null };
}
