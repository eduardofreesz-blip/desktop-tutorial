import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendWhatsAppMessage, getConnectionStatus } from '@/lib/whatsapp-web';
import { isPaymentApproved } from '@/lib/getnet';

// Webhook para receber notificações de pagamento da Getnet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Webhook Getnet recebido:', JSON.stringify(body, null, 2));

    // Extrair informações do webhook
    const {
      payment_id,
      order_id,
      status,
      amount,
      payment_type,
    } = body;

    if (!order_id) {
      console.log('Webhook sem order_id, ignorando');
      return NextResponse.json({ received: true });
    }

    // Buscar pedido pelo ID
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: order_id },
          { id: order_id.replace('ORDER_', '') },
        ],
      },
      include: {
        app: true,
        plan: true,
      },
    });

    if (!order) {
      console.log('Pedido não encontrado:', order_id);
      return NextResponse.json({ received: true, error: 'Order not found' });
    }

    // Atualizar dados do pagamento
    await prisma.order.update({
      where: { id: order.id },
      data: {
        // Salvar ID do pagamento Getnet no contexto
      },
    });

    // Verificar se o pagamento foi aprovado
    if (isPaymentApproved(status)) {
      console.log('Pagamento aprovado! Processando pedido:', order.id);
      
      // Processar pagamento aprovado (liberar código)
      await processApprovedPayment(order);
    } else if (status === 'DENIED' || status === 'CANCELED') {
      console.log('Pagamento negado/cancelado:', order.id);
      
      // Atualizar status do pedido
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });

      // Notificar cliente
      const whatsappStatus = getConnectionStatus();
      if (whatsappStatus.status === 'connected') {
        await sendWhatsAppMessage(
          order.clientPhone,
          `❌ *Pagamento não aprovado*

Infelizmente seu pagamento para ${order.app.name} não foi aprovado.

Digite *menu* para tentar novamente com outro método de pagamento.`
        );
      }
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('Erro no webhook Getnet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Função para processar pagamento aprovado
async function processApprovedPayment(order: any) {
  try {
    // Verificar se já foi processado
    if (order.status === 'code_sent') {
      console.log('Pedido já processado:', order.id);
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
      console.error('Nenhum código disponível para:', order.appId, order.planId);
      
      // Notificar admin (pedido pago mas sem código)
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'paid', // Pago mas aguardando código
          paidAt: new Date(),
        },
      });
      return;
    }

    // Buscar instruções
    const config = await prisma.config.findFirst({
      where: {
        key: `instructions_${order.app.name.toLowerCase()}`,
      },
    });
    const instructions = config?.value ?? 'Instruções de ativação não disponíveis.';

    // Calcular data de vencimento
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

    const expiresFormatted = expiresAt.toLocaleDateString('pt-BR');
    const planName = order.plan.type === 'monthly' ? 'Mensal' 
      : order.plan.type === 'quarterly' ? 'Trimestral' : 'Anual';

    // Atualizar banco de dados
    await prisma.$transaction(async (tx: any) => {
      // Marcar código como usado
      await tx.code.update({
        where: { id: availableCode.id },
        data: {
          status: 'used',
          usedAt: new Date(),
        },
      });

      // Atualizar pedido
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'code_sent',
          codeId: availableCode.id,
          paidAt: new Date(),
          activatedAt: now,
          expiresAt: expiresAt,
          reminderSent: false,
        },
      });
    });

    // Enviar código via WhatsApp
    const whatsappStatus = getConnectionStatus();
    if (whatsappStatus.status === 'connected') {
      const message = `🎉 *PAGAMENTO CONFIRMADO AUTOMATICAMENTE!*

✅ Seu código de ativação:

━━━━━━━━━━━━━━━━━━
🔑 *${availableCode.code}*
━━━━━━━━━━━━━━━━━━

📱 *App:* ${order.app.name}
⏰ *Plano:* ${planName}
📅 *Válido até:* ${expiresFormatted}

📋 *INSTRUÇÕES DE USO:*
${instructions}

⚠️ Você receberá um lembrete 3 dias antes do vencimento!

Obrigado por comprar na Universal Recargas! 🚀

_Digite "menu" para fazer um novo pedido_`;

      await sendWhatsAppMessage(order.clientPhone, message);

      // Salvar no histórico
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

      console.log('Código enviado automaticamente para:', order.clientPhone);
    } else {
      console.log('WhatsApp desconectado, código salvo mas não enviado');
    }
  } catch (error) {
    console.error('Erro ao processar pagamento aprovado:', error);
    throw error;
  }
}

// GET para verificar se o webhook está ativo
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Webhook Getnet ativo',
    timestamp: new Date().toISOString(),
  });
}
