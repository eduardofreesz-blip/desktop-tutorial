import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendWhatsAppMessage, getConnectionStatus } from '@/lib/whatsapp-web';
import { getMercadoPagoAccessToken } from '@/lib/mercadopago';

function isPaymentApproved(status: string): boolean {
  return status?.toLowerCase() === 'approved';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[Webhook Mercado Pago] Recebido:', JSON.stringify(body, null, 2));

    const { type, topic, action, data } = body;
    const isPayment = type === 'payment' || topic === 'payment' || action?.startsWith('payment');

    if (!isPayment || !data?.id) {
      return NextResponse.json({ received: true });
    }

    const paymentId = String(data.id);
    const accessToken = getMercadoPagoAccessToken();

    if (!accessToken) {
      console.error('[Webhook Mercado Pago] Access Token não configurado');
      return NextResponse.json({ received: true }, { status: 500 });
    }

    // Buscar detalhes do pagamento
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!paymentRes.ok) {
      console.error('[Webhook Mercado Pago] Erro ao buscar pagamento:', await paymentRes.text());
      return NextResponse.json({ received: true }, { status: 400 });
    }

    const payment = await paymentRes.json();
    const orderId = payment.external_reference;
    const status = payment.status;

    if (!orderId) {
      console.log('[Webhook Mercado Pago] Pagamento sem external_reference');
      return NextResponse.json({ received: true });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderId }, { paymentId: String(paymentId) }],
      },
      include: { app: true, plan: true },
    });

    if (!order) {
      console.log('[Webhook Mercado Pago] Pedido não encontrado:', orderId);
      return NextResponse.json({ received: true });
    }

    if (isPaymentApproved(status)) {
      console.log('[Webhook Mercado Pago] Pagamento aprovado, processando pedido:', order.id);
      await processApprovedPayment(order);
    } else if (['rejected', 'cancelled'].includes(status?.toLowerCase())) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });

      const whatsappStatus = getConnectionStatus();
      if (whatsappStatus.status === 'connected') {
        await sendWhatsAppMessage(
          order.clientPhone,
          `❌ *Pagamento não aprovado*\n\nInfelizmente seu pagamento para ${order.app.name} não foi aprovado.\n\nDigite *menu* para tentar novamente.`
        );
      }
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('[Webhook Mercado Pago] Erro:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processApprovedPayment(order: any) {
  if (order.status === 'code_sent') return;

  const availableCode = await prisma.code.findFirst({
    where: {
      appId: order.appId,
      planId: order.planId,
      status: 'available',
    },
  });

  if (!availableCode) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'paid', paidAt: new Date() },
    });
    return;
  }

  const config = await prisma.config.findFirst({
    where: { key: `instructions_${order.app.name.toLowerCase()}` },
  });
  const instructions = config?.value ?? 'Instruções de ativação não disponíveis.';

  const now = new Date();
  const expiresAt = new Date(now);
  switch (order.plan.type) {
    case 'monthly':
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      break;
    case 'quarterly':
      expiresAt.setMonth(expiresAt.getMonth() + 3);
      break;
    case 'annual':
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      break;
    default:
      expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const planName = order.plan.type === 'monthly' ? 'Mensal' : order.plan.type === 'quarterly' ? 'Trimestral' : 'Anual';

  await prisma.$transaction(async (tx: any) => {
    await tx.code.update({
      where: { id: availableCode.id },
      data: { status: 'used', usedAt: new Date() },
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'code_sent',
        codeId: availableCode.id,
        paidAt: new Date(),
        activatedAt: now,
        expiresAt,
        reminderSent: false,
      },
    });
  });

  const whatsappStatus = getConnectionStatus();
  if (whatsappStatus.status === 'connected') {
    const message = `🎉 *PAGAMENTO CONFIRMADO AUTOMATICAMENTE!*

✅ Seu código de ativação:

━━━━━━━━━━━━━━━━━━
🔑 *${availableCode.code}*
━━━━━━━━━━━━━━━━━━

📱 *App:* ${order.app.name}
⏰ *Plano:* ${planName}
📅 *Válido até:* ${expiresAt.toLocaleDateString('pt-BR')}

📋 *INSTRUÇÕES DE USO:*
${instructions}

Obrigado por comprar na Universal Recargas! 🚀

_Digite "menu" para fazer um novo pedido_`;

    await sendWhatsAppMessage(order.clientPhone, message);

    await prisma.conversation.create({
      data: {
        phoneNumber: order.clientPhone,
        clientName: order.clientName ?? 'Cliente',
        message,
        direction: 'OUTBOUND',
        state: 'COMPLETED',
        context: { orderId: order.id, type: 'code_delivery_auto' },
      },
    });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Webhook Mercado Pago ativo',
    timestamp: new Date().toISOString(),
  });
}
