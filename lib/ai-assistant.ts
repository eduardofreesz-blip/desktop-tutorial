// @ts-nocheck
import { prisma } from './db';

export interface AIContext {
  phoneNumber: string;
  clientName?: string;
  state?: string;
  intent?: string;
  history?: Array<{ role: string; content: string }>;
}

export async function generateAIResponse(
  message: string,
  context: AIContext
): Promise<string> {
  return `Olá! Sou a assistente da Universal Recargas. Como posso ajudar?`;
}

export async function detectIntent(message: string): Promise<string> {
  const lower = message.toLowerCase();
  if (lower.includes('comprar') || lower.includes('quero')) return 'purchase';
  if (lower.includes('status') || lower.includes('pedido')) return 'order_status';
  if (lower.includes('ajuda') || lower.includes('help')) return 'help';
  if (lower.includes('plano') || lower.includes('preço')) return 'pricing';
  return 'general';
}

export async function getCustomerProfile(phoneNumber: string) {
  const orders = await prisma.order.findMany({
    where: { clientPhone: phoneNumber },
    include: { app: true, plan: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const preferredApps = [...new Set(orders.map((o) => o.app?.name).filter(Boolean))];
  const totalSpent = orders.reduce((sum, o) => sum + o.amount, 0);
  const planTypes = orders.map((o) => o.plan?.type).filter(Boolean);
  const preferredPlanType = planTypes.length > 0 ? planTypes[0] : null;

  return {
    phoneNumber,
    totalOrders: orders.length,
    recentOrders: orders,
    isReturning: orders.length > 0,
    preferredApps,
    preferredPlanType,
    totalSpent,
    tags: [] as string[],
    memberSince: orders.length > 0 ? orders[orders.length - 1].createdAt : null,
  };
}

export async function getConversationHistory(phoneNumber: string, limit = 20) {
  const messages = await prisma.conversation.findMany({
    where: { phoneNumber },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return messages.reverse();
}

export async function analyzeSentiment(message: string): Promise<'positive' | 'negative' | 'neutral'> {
  const positiveWords = ['obrigado', 'ótimo', 'bom', 'excelente', 'perfeito'];
  const negativeWords = ['ruim', 'problema', 'reclamação', 'demora', 'erro'];
  const lower = message.toLowerCase();

  if (positiveWords.some((w) => lower.includes(w))) return 'positive';
  if (negativeWords.some((w) => lower.includes(w))) return 'negative';
  return 'neutral';
}
