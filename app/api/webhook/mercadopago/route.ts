import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Webhook MP] Recebido:', JSON.stringify(body).substring(0, 200));

    if (body.type === 'payment' && body.data?.id) {
      const paymentId = String(body.data.id);
      const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

      if (!mpToken) return NextResponse.json({ received: true });

      // Consultar pagamento no Mercado Pago
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` },
      });

      if (res.ok) {
        const payment = await res.json();
        const status = payment.status;
        const orderId = payment.external_reference;

        console.log(`[Webhook MP] Pagamento ${paymentId} - Status: ${status} - Pedido: ${orderId}`);

        if (status === 'approved' && orderId) {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { app: true, plan: true },
          });

          if (order && order.status === 'pending_payment') {
            // Buscar código disponível
            const code = await prisma.code.findFirst({
              where: { appId: order.appId, planId: order.planId, status: 'available' },
            });

            if (code) {
              // Atualizar código e pedido
              await prisma.$transaction([
                prisma.code.update({
                  where: { id: code.id },
                  data: { status: 'used', usedAt: new Date(), usedBy: order.clientPhone },
                }),
                prisma.order.update({
                  where: { id: orderId },
                  data: { status: 'code_sent', paidAt: new Date(), codeId: code.id, activatedAt: new Date() },
                }),
              ]);

              // Enviar código via WhatsApp
              try {
                const { sendWhatsAppMessage } = await import('@/lib/whatsapp-web');
                const planLabels: Record<string, string> = { monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual' };
                const msg = `✅ *PAGAMENTO CONFIRMADO!*\n━━━━━━━━━━━━━━━━━━\n\n📱 App: *${order.app.name}*\n📋 Plano: *${planLabels[order.plan.type.toLowerCase()] || order.plan.type}*\n\n🔑 *SEU CÓDIGO:*\n\`\`\`${code.code}\`\`\`\n\n📋 Copie o código acima e ative no app!\n\n🙏 Obrigado pela compra!\n📱 Digite *menu* para comprar mais`;
                await sendWhatsAppMessage(order.clientPhone, msg);
                console.log(`[Webhook MP] Código enviado para ${order.clientPhone}: ${code.code.substring(0, 6)}...`);
              } catch (err) {
                console.error('[Webhook MP] Erro ao enviar WhatsApp:', err);
              }
            } else {
              console.error(`[Webhook MP] Sem código disponível para pedido ${orderId}`);
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook MP] Erro:', error);
    return NextResponse.json({ received: true });
  }
}
