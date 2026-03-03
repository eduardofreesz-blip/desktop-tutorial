import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendWhatsAppMessage, getConnectionStatus } from '@/lib/whatsapp-web';
import { isPagSeguroPaymentApproved, mapPagSeguroStatus } from '@/lib/pagseguro';

// Processar pagamento aprovado
async function processApprovedPayment(orderId: string) {
  console.log('[PagSeguro Webhook] Processando pagamento aprovado:', orderId);

  // Buscar pedido
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      app: true,
      plan: true,
    },
  });

  if (!order) {
    console.error('[PagSeguro Webhook] Pedido não encontrado:', orderId);
    return;
  }

  if (order.status === 'code_sent') {
    console.log('[PagSeguro Webhook] Pedido já processado:', orderId);
    return;
  }

  // Buscar código disponível
  const availableCode = await prisma.code.findFirst({
    where: {
      appId: order.appId,
      planId: order.planId,
      status: 'available',
    },
  });

  if (!availableCode) {
    console.error('[PagSeguro Webhook] Sem códigos disponíveis para:', order.appId, order.planId);
    return;
  }

  // Calcular data de expiração
  const now = new Date();
  let expiresAt = new Date(now);
  
  const planType = order.plan?.type?.toUpperCase() || 'MONTHLY';
  if (planType.includes('ANUAL') || planType.includes('ANNUAL')) {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else if (planType.includes('TRIMESTRAL') || planType.includes('QUARTERLY')) {
    expiresAt.setMonth(expiresAt.getMonth() + 3);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  // Atualizar código como usado
  await prisma.code.update({
    where: { id: availableCode.id },
    data: {
      status: 'used',
      usedAt: now,
    },
  });

  // Atualizar pedido
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'code_sent',
      codeId: availableCode.id,
      paidAt: now,
      activatedAt: now,
      expiresAt,
      reminderSent: false,
    },
  });

  // Enviar código via WhatsApp
  const connectionStatus = await getConnectionStatus();
  if (connectionStatus.status === 'connected') {
    const message = `✅ *Pagamento Confirmado!*\n\n` +
      `Olá ${order.clientName || 'Cliente'}!\n\n` +
      `Seu pagamento foi aprovado com sucesso!\n\n` +
      `📱 *App:* ${order.app?.name}\n` +
      `📅 *Plano:* ${order.plan?.type}\n` +
      `🔑 *Seu Código:* \`${availableCode.code}\`\n\n` +
      `⏰ Validade: ${expiresAt.toLocaleDateString('pt-BR')}\n\n` +
      `Obrigado pela preferência! 🙏`;

    await sendWhatsAppMessage(order.clientPhone, message);
    console.log('[PagSeguro Webhook] Código enviado via WhatsApp');
  }
}

// POST - Webhook do PagSeguro
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[PagSeguro Webhook] Notificação recebida:', JSON.stringify(body, null, 2));

    // Estrutura da notificação do PagSeguro
    const orderId = body.reference_id || body.id;
    const charges = body.charges || [];
    const qrCodes = body.qr_codes || [];

    // Verificar status das cobranças (cartão)
    for (const charge of charges) {
      if (isPagSeguroPaymentApproved(charge.status)) {
        await processApprovedPayment(orderId);
        break;
      }
    }

    // Verificar status dos QR codes (PIX)
    for (const qr of qrCodes) {
      if (isPagSeguroPaymentApproved(qr.status)) {
        await processApprovedPayment(orderId);
        break;
      }
    }

    // Status geral do pedido
    if (isPagSeguroPaymentApproved(body.status)) {
      await processApprovedPayment(orderId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[PagSeguro Webhook] Erro:', error);
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 });
  }
}

// GET - Verificação do webhook
export async function GET() {
  return NextResponse.json({
    status: 'active',
    provider: 'pagseguro',
    message: 'Webhook PagSeguro ativo',
  });
}
