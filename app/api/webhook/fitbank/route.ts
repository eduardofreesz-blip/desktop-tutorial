// Webhook FitBank para receber notificações de pagamento PIX
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsAppMessage, getConnectionStatus } from '@/lib/whatsapp-web';
import { isFitBankPaymentApproved, isFitBankPaymentCanceled } from '@/lib/fitbank';

// POST - Receber notificação de pagamento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[FitBank Webhook] Notificação recebida:', JSON.stringify(body, null, 2));

    // Extrair informações do payload FitBank
    const documentNumber = body.DocumentNumber || body.documentNumber || body.Identifier;
    const status = body.Status || body.status;
    const transactionId = body.TransactionId || body.EndToEndId || body.transactionId;

    if (!documentNumber) {
      console.log('[FitBank Webhook] DocumentNumber não encontrado no payload');
      return NextResponse.json({ received: true, status: 'missing_document_number' });
    }

    // Buscar pedido pelo paymentId
    const order = await prisma.order.findFirst({
      where: { paymentId: documentNumber },
      include: { app: true, plan: true },
    });

    if (!order) {
      console.log('[FitBank Webhook] Pedido não encontrado para:', documentNumber);
      return NextResponse.json({ received: true, status: 'order_not_found' });
    }

    // Verificar status do pagamento
    if (isFitBankPaymentApproved(status)) {
      console.log('[FitBank Webhook] Pagamento aprovado para pedido:', order.id);
      await processApprovedPayment(order, transactionId);
    } else if (isFitBankPaymentCanceled(status)) {
      console.log('[FitBank Webhook] Pagamento cancelado para pedido:', order.id);
      await processCanceledPayment(order);
    } else {
      console.log(`[FitBank Webhook] Status não processável: ${status}`);
    }

    return NextResponse.json({ received: true, status: 'processed' });
  } catch (error: any) {
    console.error('[FitBank Webhook] Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

// GET - Verificação do webhook
export async function GET() {
  return NextResponse.json({
    status: 'active',
    provider: 'fitbank',
    message: 'Webhook FitBank ativo',
    timestamp: new Date().toISOString(),
  });
}

// Processar pagamento aprovado
async function processApprovedPayment(order: any, transactionId?: string) {
  try {
    // Buscar código disponível
    const code = await prisma.code.findFirst({
      where: {
        appId: order.appId,
        planId: order.planId,
        status: 'available',
      },
    });

    if (!code) {
      console.error('[FitBank Webhook] Sem código disponível para:', order.id);
      return;
    }

    // Calcular data de expiração
    const now = new Date();
    let expiresAt = new Date();
    
    const planType = order.plan?.type?.toLowerCase() || 'monthly';
    if (planType.includes('anual') || planType.includes('annual') || planType.includes('yearly')) {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else if (planType.includes('trimestral') || planType.includes('quarterly')) {
      expiresAt.setMonth(expiresAt.getMonth() + 3);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Atualizar código como usado
    await prisma.code.update({
      where: { id: code.id },
      data: {
        status: 'used',
        usedAt: now,
        usedBy: order.clientPhone,
      },
    });

    // Atualizar pedido
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'code_sent',
        codeId: code.id,
        activatedAt: now,
        expiresAt: expiresAt,
        reminderSent: false,
      },
    });

    // Enviar código via WhatsApp
    const connectionStatus = await getConnectionStatus();
    if (connectionStatus.status === 'connected' && order.clientPhone) {
      const message = `✅ *PAGAMENTO CONFIRMADO!*

🎉 Obrigado pela compra!

📱 *App:* ${order.app?.name || 'N/A'}
📅 *Plano:* ${order.plan?.type || 'N/A'}
💰 *Valor:* R$ ${order.amount.toFixed(2)}

🔑 *Seu código de ativação:*
\`\`\`${code.code}\`\`\`

📅 *Válido até:* ${expiresAt.toLocaleDateString('pt-BR')}

_Você receberá um lembrete antes da expiração._

Obrigado por escolher a Universal Recargas! 🚀`;

      await sendWhatsAppMessage(order.clientPhone, message);

      // Registrar conversa
      await prisma.conversation.create({
        data: {
          phoneNumber: order.clientPhone,
          message: message,
          direction: 'outgoing',
          state: 'MENU',
        },
      });
    }

    console.log('[FitBank Webhook] Código enviado com sucesso:', code.code);
  } catch (error) {
    console.error('[FitBank Webhook] Erro ao processar pagamento:', error);
    throw error;
  }
}

// Processar pagamento cancelado
async function processCanceledPayment(order: any) {
  try {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
    });

    // Notificar cliente
    const connectionStatus = await getConnectionStatus();
    if (connectionStatus.status === 'connected' && order.clientPhone) {
      const message = `❌ *Pagamento não confirmado*

Infelizmente seu pagamento PIX não foi processado ou expirou.

📱 *App:* ${order.app?.name || 'N/A'}
📅 *Plano:* ${order.plan?.type || 'N/A'}
💰 *Valor:* R$ ${order.amount.toFixed(2)}

Se você ainda deseja realizar a compra, por favor inicie um novo pedido.

Digite *1* para ver nosso menu principal.`;

      await sendWhatsAppMessage(order.clientPhone, message);
    }

    console.log('[FitBank Webhook] Pedido cancelado:', order.id);
  } catch (error) {
    console.error('[FitBank Webhook] Erro ao cancelar pedido:', error);
  }
}
