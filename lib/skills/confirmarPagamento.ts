import { prisma } from '../db';

export async function confirmarPagamento(orderId: string): Promise<{ success: boolean; message: string }> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { app: true } });
    if (!order) return { success: false, message: 'Pedido não encontrado' };
    if (order.status !== 'pending_payment') return { success: false, message: 'Pedido não está pendente' };

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'paid', paidAt: new Date() },
    });

    return { success: true, message: `Pagamento do pedido ${orderId} confirmado!` };
  } catch (error) {
    return { success: false, message: `Erro: ${error}` };
  }
}

export async function marcarComoPago(orderId: string): Promise<{ success: boolean; message: string }> {
  return confirmarPagamento(orderId);
}
