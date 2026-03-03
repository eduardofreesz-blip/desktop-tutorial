import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendWhatsAppMessage, getConnectionStatus } from '@/lib/whatsapp-web';

interface ReminderOrder {
  id: string;
  clientPhone: string;
  clientName: string;
  expiresAt: Date | null;
  app: { name: string };
  plan: { type: string };
}

// API para verificar e enviar lembretes de vencimento
// Deve ser chamada periodicamente (cron job ou tarefa agendada)
export async function POST(request: NextRequest) {
  try {
    // Verificar se WhatsApp está conectado
    const whatsappStatus = getConnectionStatus();
    if (whatsappStatus.status !== 'connected') {
      return NextResponse.json(
        { error: 'WhatsApp não conectado', sent: 0 },
        { status: 400 }
      );
    }

    // Buscar pedidos que vão vencer nos próximos 3 dias e ainda não receberam lembrete
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const ordersToRemind = await prisma.order.findMany({
      where: {
        status: 'code_sent',
        reminderSent: false,
        expiresAt: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        app: true,
        plan: true,
      },
    });

    let sentCount = 0;
    const results: { orderId: string; success: boolean; error?: string }[] = [];

    for (const order of ordersToRemind) {
      const expiresFormatted = order.expiresAt?.toLocaleDateString('pt-BR') ?? 'N/A';
      const daysLeft = order.expiresAt
        ? Math.ceil((order.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const planName =
        order.plan.type === 'monthly'
          ? 'Mensal'
          : order.plan.type === 'quarterly'
          ? 'Trimestral'
          : 'Anual';

      const message = `⏰ *LEMBRETE DE VENCIMENTO*

Olá${order.clientName ? ` ${order.clientName}` : ''}! 👋

Seu plano está prestes a vencer:

📱 *App:* ${order.app.name}
⏰ *Plano:* ${planName}
📅 *Vence em:* ${expiresFormatted} (${daysLeft} dia${daysLeft > 1 ? 's' : ''})

━━━━━━━━━━━━━━━━━━

🔄 *RENOVE AGORA* e continue aproveitando!

Digite *menu* para ver as opções de renovação.

Universal Recargas 🚀`;

      try {
        const sent = await sendWhatsAppMessage(order.clientPhone, message);

        if (sent) {
          // Marcar como lembrete enviado
          await prisma.order.update({
            where: { id: order.id },
            data: { reminderSent: true },
          });

          // Salvar no histórico
          await prisma.conversation.create({
            data: {
              phoneNumber: order.clientPhone,
              clientName: order.clientName ?? 'Cliente',
              message,
              direction: 'OUTBOUND',
              state: 'COMPLETED',
              context: { type: 'reminder', orderId: order.id },
            },
          });

          sentCount++;
          results.push({ orderId: order.id, success: true });
        } else {
          results.push({ orderId: order.id, success: false, error: 'Falha ao enviar' });
        }
      } catch (error) {
        results.push({ orderId: order.id, success: false, error: String(error) });
      }
    }

    return NextResponse.json({
      message: `Lembretes enviados: ${sentCount} de ${ordersToRemind.length}`,
      sent: sentCount,
      total: ordersToRemind.length,
      results,
    });
  } catch (error) {
    console.error('Erro ao verificar lembretes:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar lembretes' },
      { status: 500 }
    );
  }
}

// GET para verificar pedidos próximos do vencimento (sem enviar)
export async function GET() {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const ordersToRemind = await prisma.order.findMany({
      where: {
        status: 'code_sent',
        reminderSent: false,
        expiresAt: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        app: true,
        plan: true,
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    return NextResponse.json({
      pendingReminders: ordersToRemind.length,
      orders: (ordersToRemind as ReminderOrder[]).map((order: ReminderOrder) => ({
        id: order.id,
        clientPhone: order.clientPhone,
        clientName: order.clientName,
        app: order.app.name,
        plan: order.plan.type,
        expiresAt: order.expiresAt,
        daysLeft: order.expiresAt
          ? Math.ceil((order.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar lembretes pendentes:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar lembretes pendentes' },
      { status: 500 }
    );
  }
}
