import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

interface OrderData {
  id: string;
  createdAt: Date;
  status: string;
  amount: number;
  clientPhone: string;
  clientName?: string | null;
  app?: { name: string } | null;
  plan?: { type: string } | null;
}

interface AppData {
  name: string;
  _count: { orders: number };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Buscar todos os pedidos de uma vez e calcular métricas
    const allOrders = await prisma.order.findMany({
      include: { app: true, plan: true }
    });

    const apps = await prisma.app.findMany({
      include: { _count: { select: { orders: true } } }
    });

    const [codesAvailable, codesUsed] = await Promise.all([
      prisma.code.count({ where: { status: 'available' } }),
      prisma.code.count({ where: { status: 'used' } })
    ]);

    // Calcular métricas a partir dos dados
    const orders = allOrders as OrderData[];
    const totalOrders = orders.length;
    const todayOrders = orders.filter((o: OrderData) => o.createdAt >= today).length;
    const weekOrders = orders.filter((o: OrderData) => o.createdAt >= startOfWeek).length;
    const monthOrders = orders.filter((o: OrderData) => o.createdAt >= startOfMonth).length;

    const completedOrders = orders.filter((o: OrderData) => o.status === 'code_sent');
    const totalRevenue = completedOrders.reduce((sum: number, o: OrderData) => sum + o.amount, 0);
    const todayRevenue = completedOrders.filter((o: OrderData) => o.createdAt >= today).reduce((sum: number, o: OrderData) => sum + o.amount, 0);
    const weekRevenue = completedOrders.filter((o: OrderData) => o.createdAt >= startOfWeek).reduce((sum: number, o: OrderData) => sum + o.amount, 0);
    const monthRevenue = completedOrders.filter((o: OrderData) => o.createdAt >= startOfMonth).reduce((sum: number, o: OrderData) => sum + o.amount, 0);

    const uniqueCustomers = new Set(orders.map((o: OrderData) => o.clientPhone));
    const totalCustomers = uniqueCustomers.size;
    const newCustomersMonth = new Set(orders.filter((o: OrderData) => o.createdAt >= startOfMonth).map((o: OrderData) => o.clientPhone)).size;

    const activeOrders = completedOrders.length;
    const pendingOrders = orders.filter((o: OrderData) => o.status === 'pending_payment').length;

    // Dados diários dos últimos 30 dias
    const dailyMap: Record<string, { orders: number; revenue: number }> = {};
    orders.filter((o: OrderData) => o.createdAt >= thirtyDaysAgo).forEach((o: OrderData) => {
      const date = o.createdAt.toISOString().split('T')[0];
      if (!dailyMap[date]) dailyMap[date] = { orders: 0, revenue: 0 };
      dailyMap[date].orders++;
      if (o.status === 'code_sent') dailyMap[date].revenue += o.amount;
    });

    const recentOrders = orders
      .sort((a: OrderData, b: OrderData) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    // Processar dados para gráficos
    const chartData = Object.entries(dailyMap)
      .map(([date, data]: [string, { orders: number; revenue: number }]) => ({
        date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        orders: data.orders,
        revenue: data.revenue
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Apps mais vendidos
    const appsData = apps as AppData[];
    const topApps = appsData
      .map((app: AppData) => ({ name: app.name, orders: app._count.orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    return NextResponse.json({
      stats: {
        totalOrders,
        todayOrders,
        weekOrders,
        monthOrders,
        totalRevenue,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalCustomers,
        newCustomersMonth,
        activeOrders,
        pendingOrders,
        codesAvailable,
        codesUsed,
        conversionRate: totalOrders > 0 ? ((activeOrders / totalOrders) * 100).toFixed(1) : 0
      },
      chartData,
      topApps,
      recentOrders: recentOrders.map((o: OrderData) => ({
        id: o.id,
        clientName: o.clientName || 'Cliente',
        clientPhone: o.clientPhone,
        appName: o.app?.name || 'App',
        planType: o.plan?.type || 'Plano',
        amount: o.amount,
        status: o.status,
        createdAt: o.createdAt
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
