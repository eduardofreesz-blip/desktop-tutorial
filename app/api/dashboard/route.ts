import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);

    const [
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
      pendingOrders,
      codesAvailable,
      codesUsed,
      recentOrders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.aggregate({ _sum: { amount: true } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: weekStart } } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: monthStart } } }),
      prisma.order.groupBy({ by: ['clientPhone'] }).then(r => r.length),
      prisma.order.groupBy({ by: ['clientPhone'], where: { createdAt: { gte: monthStart } } }).then(r => r.length),
      prisma.order.count({ where: { status: 'pending_payment' } }),
      prisma.code.count({ where: { status: 'available' } }),
      prisma.code.count({ where: { status: 'used' } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { app: true, plan: true },
      }),
    ]);

    const topApps = await prisma.order.groupBy({
      by: ['appId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const topAppsWithNames = await Promise.all(
      topApps.map(async (item) => {
        const app = await prisma.app.findUnique({ where: { id: item.appId } });
        return { name: app?.name || 'Desconhecido', orders: item._count.id };
      })
    );

    const chartData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = await prisma.order.count({
        where: { createdAt: { gte: date, lt: nextDate } },
      });
      const dayRevenue = await prisma.order.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: date, lt: nextDate } },
      });

      chartData.push({
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        orders: dayOrders,
        revenue: dayRevenue._sum.amount || 0,
      });
    }

    return NextResponse.json({
      stats: {
        totalOrders,
        todayOrders,
        weekOrders,
        monthOrders,
        totalRevenue: totalRevenue._sum.amount || 0,
        todayRevenue: todayRevenue._sum.amount || 0,
        weekRevenue: weekRevenue._sum.amount || 0,
        monthRevenue: monthRevenue._sum.amount || 0,
        totalCustomers,
        newCustomersMonth,
        activeOrders: todayOrders,
        pendingOrders,
        codesAvailable,
        codesUsed,
        conversionRate: totalOrders > 0 ? (codesUsed / totalOrders) * 100 : 0,
      },
      chartData,
      topApps: topAppsWithNames,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        clientName: order.clientName || 'Cliente',
        clientPhone: order.clientPhone,
        appName: order.app.name,
        planType: order.plan.type,
        amount: order.amount,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
