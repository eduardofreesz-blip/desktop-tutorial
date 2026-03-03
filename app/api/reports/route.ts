import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

interface ReportOrder {
  createdAt: Date;
  amount: number;
  app: { name: string };
  plan: { type: string };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const appId = searchParams.get('appId');

    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to + 'T23:59:59') : new Date();

    const where: any = {
      createdAt: { gte: dateFrom, lte: dateTo },
      status: 'code_sent'
    };

    if (appId) {
      where.appId = appId;
    }

    // Buscar pedidos
    const orders = await prisma.order.findMany({
      where,
      include: {
        app: { select: { name: true } },
        plan: { select: { type: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular resumo
    const typedOrders = orders as ReportOrder[];
    const totalRevenue = typedOrders.reduce((sum: number, o: ReportOrder) => sum + o.amount, 0);
    const totalOrders = typedOrders.length;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Taxa de conversão (pedidos confirmados / todos os pedidos)
    const allOrdersCount = await prisma.order.count({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        ...(appId && { appId })
      }
    });
    const conversionRate = allOrdersCount > 0 ? ((totalOrders / allOrdersCount) * 100).toFixed(1) : '0';

    // App mais vendido
    const appCounts: Record<string, number> = {};
    typedOrders.forEach((o: ReportOrder) => {
      appCounts[o.app.name] = (appCounts[o.app.name] || 0) + 1;
    });
    const topApp = Object.entries(appCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    // Plano mais vendido
    const planCounts: Record<string, number> = {};
    typedOrders.forEach((o: ReportOrder) => {
      planCounts[o.plan.type] = (planCounts[o.plan.type] || 0) + 1;
    });
    const topPlan = Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    // Dados diários
    const dailyMap: Record<string, { orders: number; revenue: number }> = {};
    typedOrders.forEach((o: ReportOrder) => {
      const date = o.createdAt.toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { orders: 0, revenue: 0 };
      }
      dailyMap[date].orders++;
      dailyMap[date].revenue += o.amount;
    });

    const dailyData = Object.entries(dailyMap)
      .map(([date, data]: [string, { orders: number; revenue: number }]) => ({
        date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        ...data
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Dados por app
    const appMap: Record<string, { orders: number; revenue: number }> = {};
    typedOrders.forEach((o: ReportOrder) => {
      if (!appMap[o.app.name]) {
        appMap[o.app.name] = { orders: 0, revenue: 0 };
      }
      appMap[o.app.name].orders++;
      appMap[o.app.name].revenue += o.amount;
    });

    const appData = Object.entries(appMap)
      .map(([name, data]: [string, { orders: number; revenue: number }]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Dados por plano
    const planData = Object.entries(planCounts)
      .map(([type, count]: [string, number]) => ({
        type,
        count,
        percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalOrders,
        averageTicket,
        conversionRate: parseFloat(String(conversionRate)),
        topApp,
        topPlan
      },
      dailyData,
      appData,
      planData,
      orders: orders.map((o: any) => ({
        id: o.id,
        clientName: o.clientName || 'Cliente',
        clientPhone: o.clientPhone,
        appName: o.app.name,
        planType: o.plan.type,
        amount: o.amount,
        status: o.status,
        createdAt: o.createdAt
      }))
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
