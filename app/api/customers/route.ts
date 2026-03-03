import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Buscar todos os pedidos agrupados por cliente
    const orders = await prisma.order.findMany({
      where: {
        status: 'code_sent',
      },
      include: {
        plan: true,
        app: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Agrupar por cliente
    const customerMap = new Map<string, {
      phone: string;
      name: string;
      lastOrderDate: string;
      totalOrders: number;
      totalSpent: number;
      lastPlanType: string;
      status: 'active' | 'expiring' | 'expired' | 'inactive';
      daysInactive?: number;
      expiresAt?: Date;
    }>();

    for (const order of orders) {
      const phone = order.clientPhone;
      const existing = customerMap.get(phone);

      if (!existing) {
        const now = new Date();
        const lastOrderDate = new Date(order.createdAt);
        const daysSinceOrder = Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let status: 'active' | 'expiring' | 'expired' | 'inactive' = 'active';
        let daysInactive: number | undefined;

        if (order.expiresAt) {
          const expiresAt = new Date(order.expiresAt);
          const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry < 0) {
            status = 'expired';
          } else if (daysUntilExpiry <= 3) {
            status = 'expiring';
          }
        }

        // Cliente inativo: não compra há mais de 30 dias e plano venceu
        if (daysSinceOrder > 30 && (status === 'expired' || !order.expiresAt)) {
          status = 'inactive';
          daysInactive = daysSinceOrder;
        }

        // Normalizar tipo de plano
        let planType = order.plan.type.toLowerCase();
        if (planType === 'monthly') planType = 'mensal';
        if (planType === 'quarterly') planType = 'trimestral';
        if (planType === 'annual') planType = 'anual';

        customerMap.set(phone, {
          phone,
          name: order.clientName || 'Cliente',
          lastOrderDate: order.createdAt.toISOString(),
          totalOrders: 1,
          totalSpent: order.amount,
          lastPlanType: planType,
          status,
          daysInactive,
          expiresAt: order.expiresAt || undefined,
        });
      } else {
        existing.totalOrders++;
        existing.totalSpent += order.amount;
      }
    }

    const customers = Array.from(customerMap.values()).sort((a, b) => {
      // Ordenar por status (inativos primeiro) e depois por data
      if (a.status === 'inactive' && b.status !== 'inactive') return -1;
      if (a.status !== 'inactive' && b.status === 'inactive') return 1;
      return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime();
    });

    // Calcular estatísticas
    const stats = {
      total: customers.length,
      mensal: customers.filter((c) => c.lastPlanType === 'mensal').length,
      trimestral: customers.filter((c) => c.lastPlanType === 'trimestral').length,
      anual: customers.filter((c) => c.lastPlanType === 'anual').length,
      inactive: customers.filter((c) => c.status === 'inactive').length,
    };

    return NextResponse.json({ customers, stats });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar clientes' },
      { status: 500 }
    );
  }
}
