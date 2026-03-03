import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { sendWhatsAppMessage, getConnectionStatus } from '@/lib/whatsapp-web';
import {
  sendExpirationReminders,
  sendReactivationCampaign,
  sendWelcomeMessage,
  getNotificationStats
} from '@/lib/skills';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const { type, command, quick } = await request.json();

    // Verificar conexão WhatsApp para tarefas que precisam enviar mensagens
    const needsWhatsApp = ['reminder', 'reminders', 'notify', 'promo', 'reactivation', 'welcome'];
    if (needsWhatsApp.includes(type)) {
      const status = getConnectionStatus();
      if (status.status !== 'connected') {
        return NextResponse.json({
          success: false,
          message: 'WhatsApp não conectado. Conecte primeiro.',
          details: { whatsappStatus: status.status }
        });
      }
    }

    let result: any = { success: false, message: 'Tipo de tarefa não reconhecido' };

    switch (type) {
      // === LEMBRETES DE VENCIMENTO ===
      case 'reminder':
      case 'reminders': {
        const reminderResult = await sendExpirationReminders();
        result = {
          success: reminderResult.success || reminderResult.sentCount > 0,
          message: `${reminderResult.sentCount} lembretes enviados`,
          details: {
            enviados: reminderResult.sentCount,
            erros: reminderResult.errors.length > 0 ? reminderResult.errors : undefined
          }
        };
        break;
      }

      // === REATIVAÇÃO DE CLIENTES INATIVOS ===
      case 'reactivation': {
        const reactivationResult = await sendReactivationCampaign(30);
        result = {
          success: reactivationResult.success || reactivationResult.sentCount > 0,
          message: `${reactivationResult.sentCount} mensagens de reativação enviadas`,
          details: {
            enviados: reactivationResult.sentCount,
            erros: reactivationResult.errors.length > 0 ? reactivationResult.errors : undefined
          }
        };
        break;
      }

      // === BOAS-VINDAS PENDENTES ===
      case 'welcome': {
        // Buscar clientes que ainda não receberam boas-vindas
        const newCustomers = await prisma.conversation.findMany({
          where: {
            state: { not: 'WELCOME' },
            direction: 'incoming'
          },
          distinct: ['phoneNumber'],
          take: 10,
          orderBy: { createdAt: 'desc' }
        });

        let sent = 0;
        for (const customer of newCustomers) {
          const alreadyWelcomed = await prisma.conversation.findFirst({
            where: {
              phoneNumber: customer.phoneNumber,
              state: 'WELCOME'
            }
          });

          if (!alreadyWelcomed) {
            const success = await sendWelcomeMessage(customer.phoneNumber, customer.clientName || undefined);
            if (success) sent++;
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        result = {
          success: true,
          message: `${sent} mensagens de boas-vindas enviadas`,
          details: { enviados: sent, total: newCustomers.length }
        };
        break;
      }

      // === ENVIAR PROMO ===
      case 'promo': {
        if (!command) {
          result = { success: false, message: 'Digite a mensagem promocional' };
          break;
        }

        // Buscar clientes ativos (compraram nos últimos 90 dias)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const activeCustomers = await prisma.order.findMany({
          where: {
            status: 'code_sent',
            createdAt: { gte: ninetyDaysAgo }
          },
          distinct: ['clientPhone'],
          select: { clientPhone: true }
        });

        let sent = 0;
        const errors: string[] = [];

        for (const customer of activeCustomers) {
          try {
            await sendWhatsAppMessage(customer.clientPhone, command);
            sent++;
            await new Promise(r => setTimeout(r, 3000)); // Delay para evitar bloqueio
          } catch (e: any) {
            errors.push(customer.clientPhone);
          }
        }

        result = {
          success: sent > 0,
          message: `Promo enviada para ${sent}/${activeCustomers.length} clientes`,
          details: { enviados: sent, total: activeCustomers.length, erros: errors.length }
        };
        break;
      }

      // === NOTIFICAR CLIENTES ===
      case 'notify': {
        if (!command) {
          result = { success: false, message: 'Digite a mensagem para notificar' };
          break;
        }

        // Pegar clientes com pedidos pendentes
        const pendingOrders = await prisma.order.findMany({
          where: { status: 'awaiting_payment' },
          distinct: ['clientPhone'],
          select: { clientPhone: true, clientName: true }
        });

        let sent = 0;
        for (const order of pendingOrders) {
          try {
            await sendWhatsAppMessage(order.clientPhone, command);
            sent++;
            await new Promise(r => setTimeout(r, 2000));
          } catch (e) {
            // ignore
          }
        }

        result = {
          success: sent > 0,
          message: `Notificação enviada para ${sent} clientes`,
          details: { enviados: sent, total: pendingOrders.length }
        };
        break;
      }

      // === GERAR RELATÓRIO ===
      case 'report':
      case 'stats': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [ordersToday, revenueToday, messagesCount, notificationStats] = await Promise.all([
          prisma.order.count({
            where: { createdAt: { gte: today }, status: 'code_sent' }
          }),
          prisma.order.aggregate({
            where: { createdAt: { gte: today }, status: 'code_sent' },
            _sum: { amount: true }
          }),
          prisma.conversation.count({
            where: { createdAt: { gte: today } }
          }),
          getNotificationStats()
        ]);

        const revenue = revenueToday._sum.amount || 0;

        result = {
          success: true,
          message: `📊 Relatório do Dia\n\n💰 Vendas: ${ordersToday}\n💵 Faturamento: R$ ${revenue.toFixed(2)}\n💬 Mensagens: ${messagesCount}\n⏰ Lembretes Pendentes: ${notificationStats.pendingReminders}\n😴 Clientes Inativos: ${notificationStats.inactiveCustomers}`,
          details: {
            vendas: ordersToday,
            faturamento: revenue,
            mensagens: messagesCount,
            lembretesPendentes: notificationStats.pendingReminders,
            clientesInativos: notificationStats.inactiveCustomers,
            enviadosHoje: notificationStats.sentToday
          }
        };
        break;
      }

      // === COMANDO CUSTOM ===
      case 'custom': {
        if (!command) {
          result = { success: false, message: 'Digite um comando' };
          break;
        }

        // Interpretar comando natural
        const lowerCommand = command.toLowerCase();

        if (lowerCommand.includes('lembrete') || lowerCommand.includes('vencimento')) {
          const reminderResult = await sendExpirationReminders();
          result = {
            success: true,
            message: `Enviados ${reminderResult.sentCount} lembretes de vencimento`,
            details: reminderResult
          };
        } else if (lowerCommand.includes('inativo') || lowerCommand.includes('reativar')) {
          const reactivationResult = await sendReactivationCampaign();
          result = {
            success: true,
            message: `Enviadas ${reactivationResult.sentCount} mensagens de reativação`,
            details: reactivationResult
          };
        } else if (lowerCommand.includes('estatística') || lowerCommand.includes('relatório')) {
          // Recursivamente chama o case 'stats'
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const ordersToday = await prisma.order.count({
            where: { createdAt: { gte: today }, status: 'code_sent' }
          });
          result = {
            success: true,
            message: `Vendas hoje: ${ordersToday}`,
            details: { vendas: ordersToday }
          };
        } else {
          result = {
            success: false,
            message: 'Comando não reconhecido. Tente: "enviar lembretes", "reativar inativos", "gerar relatório"'
          };
        }
        break;
      }

      default:
        result = { success: false, message: `Tipo "${type}" não implementado` };
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[OpenClaw Tasks] Erro:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await getNotificationStats();
    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
