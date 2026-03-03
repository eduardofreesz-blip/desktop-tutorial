import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { sendWhatsAppMessage, getConnectionStatus } from '@/lib/whatsapp-web';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
      where: { id: params?.id ?? '' },
      include: { app: true, plan: true, code: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    if (order?.status !== 'pending_payment') {
      return NextResponse.json(
        { error: 'Pedido já foi processado' },
        { status: 400 }
      );
    }

    // Se já tem código reservado, usar ele
    let codeToUse = order?.code;

    // Se não tem código reservado, buscar um disponível
    if (!codeToUse) {
      codeToUse = await prisma.code.findFirst({
        where: {
          appId: order?.appId ?? '',
          planId: order?.planId ?? '',
          status: 'available',
        },
      });
    }

    if (!codeToUse) {
      return NextResponse.json(
        { error: 'Nenhum código disponível para este plano' },
        { status: 400 }
      );
    }

    // Buscar instruções de ativação
    const appNameLower = order?.app?.name?.toLowerCase?.() ?? '';
    const config = await prisma.config.findUnique({
      where: { key: `instructions_${appNameLower}` },
    });

    const instructions = config?.value ?? 'Instruções de ativação não disponíveis.';

    // Calcular data de vencimento baseado no tipo de plano
    const now = new Date();
    let expiresAt = new Date(now);
    
    switch (order?.plan?.type) {
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

    // Formatar data de vencimento
    const expiresFormatted = expiresAt.toLocaleDateString('pt-BR');
    const planName = order?.plan?.type === 'monthly' ? 'Mensal' : order?.plan?.type === 'quarterly' ? 'Trimestral' : 'Anual';
    
    const message = `🎉 *PAGAMENTO CONFIRMADO!*

✅ Seu código de ativação:

━━━━━━━━━━━━━━━━━━
🔑 *${codeToUse?.code ?? ''}*
━━━━━━━━━━━━━━━━━━

📱 *App:* ${order?.app?.name ?? ''}
⏰ *Plano:* ${planName}
📅 *Válido até:* ${expiresFormatted}

📋 *INSTRUÇÕES DE USO:*
${instructions}

⚠️ Você receberá um lembrete 3 dias antes do vencimento!

Obrigado por comprar na Universal Recargas! 🚀

_Digite "menu" para fazer um novo pedido_`;

    // Atualizar banco de dados
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Marcar código como usado
      await tx.code.update({
        where: { id: codeToUse?.id ?? '' },
        data: {
          status: 'used',
          usedAt: new Date(),
        },
      });

      // Atualizar pedido com data de ativação e vencimento
      await tx.order.update({
        where: { id: params?.id ?? '' },
        data: {
          status: 'code_sent',
          codeId: codeToUse?.id ?? '',
          paidAt: new Date(),
          activatedAt: now,
          expiresAt: expiresAt,
          reminderSent: false,
        },
      });

      // Salvar mensagem no histórico
      await tx.conversation.create({
        data: {
          phoneNumber: order?.clientPhone ?? '',
          clientName: order?.clientName ?? 'Cliente',
          message,
          direction: 'OUTBOUND',
          state: 'COMPLETED',
          context: {},
        },
      });
    });

    // Verificar se WhatsApp está conectado
    const whatsappStatus = getConnectionStatus();
    let sent = false;

    if (whatsappStatus.status === 'connected') {
      sent = await sendWhatsAppMessage(order?.clientPhone ?? '', message);
      if (!sent) {
        console.error('[Confirm Payment] Falha ao enviar mensagem via WhatsApp');
      }
    } else {
      console.warn('[Confirm Payment] WhatsApp não conectado. Mensagem salva mas não enviada.');
    }

    return NextResponse.json({
      message: 'Pagamento confirmado e código enviado com sucesso',
      code: codeToUse?.code ?? '',
      whatsappSent: sent,
      whatsappConnected: whatsappStatus.status === 'connected',
    });
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao confirmar pagamento' },
      { status: 500 }
    );
  }
}
