// @ts-nocheck
import { prisma } from './db';

export interface AgentContext {
  phoneNumber: string;
  clientName?: string;
  customerName?: string;
  isAdmin?: boolean;
  sessionId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  currentState?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'search_apps',
    description: 'Busca apps disponíveis no catálogo',
    parameters: { type: 'object', properties: { query: { type: 'string' } } },
  },
  {
    name: 'check_order_status',
    description: 'Verifica status de um pedido',
    parameters: { type: 'object', properties: { orderId: { type: 'string' } } },
  },
  {
    name: 'get_plans',
    description: 'Lista planos disponíveis para um app',
    parameters: { type: 'object', properties: { appId: { type: 'string' } } },
  },
  {
    name: 'create_order',
    description: 'Cria um novo pedido',
    parameters: {
      type: 'object',
      properties: {
        appId: { type: 'string' },
        planId: { type: 'string' },
        clientPhone: { type: 'string' },
        clientName: { type: 'string' },
      },
    },
  },
];

export function getToolsForAPI() {
  return AGENT_TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: AgentContext
): Promise<string> {
  switch (toolName) {
    case 'search_apps': {
      const apps = await prisma.app.findMany({
        where: { isActive: true, name: { contains: (args.query as string) || '', mode: 'insensitive' } },
        include: { plans: true },
      });
      return JSON.stringify(apps);
    }
    case 'get_plans': {
      const plans = await prisma.plan.findMany({
        where: { appId: args.appId as string, isActive: true },
      });
      return JSON.stringify(plans);
    }
    case 'check_order_status': {
      const order = await prisma.order.findUnique({
        where: { id: args.orderId as string },
        include: { app: true, plan: true },
      });
      return order ? JSON.stringify(order) : 'Pedido não encontrado';
    }
    case 'create_order': {
      const order = await prisma.order.create({
        data: {
          appId: args.appId as string,
          planId: args.planId as string,
          clientPhone: args.clientPhone as string || context.phoneNumber,
          clientName: args.clientName as string || context.clientName,
          amount: 0,
          status: 'pending_payment',
        },
      });
      return JSON.stringify(order);
    }
    default:
      return `Ferramenta ${toolName} não encontrada`;
  }
}
