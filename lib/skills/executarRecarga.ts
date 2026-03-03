import { prisma } from '../db';

export async function executarRecarga(orderId: string): Promise<{ success: boolean; message: string; code?: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { app: true, plan: true },
    });

    if (!order) return { success: false, message: 'Pedido não encontrado' };
    if (order.status !== 'paid') return { success: false, message: 'Pedido não foi pago' };

    const availableCode = await prisma.code.findFirst({
      where: { appId: order.appId, planId: order.planId, status: 'available' },
    });

    if (!availableCode) return { success: false, message: 'Sem códigos disponíveis para este plano' };

    await prisma.$transaction([
      prisma.code.update({
        where: { id: availableCode.id },
        data: { status: 'used', usedAt: new Date(), usedBy: order.clientPhone },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'code_sent', codeId: availableCode.id, activatedAt: new Date() },
      }),
    ]);

    return { success: true, message: `Código enviado: ${availableCode.code}`, code: availableCode.code };
  } catch (error) {
    return { success: false, message: `Erro: ${error}` };
  }
}
