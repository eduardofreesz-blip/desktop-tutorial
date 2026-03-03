import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const apps = await prisma.app.findMany({
      where: { isActive: true },
      include: {
        plans: true,
      },
    });

    // Buscar contagem de códigos disponíveis para cada plano
    const stats = await Promise.all(
      apps.map(async (app: { id: string; name: string; plans: Array<{ id: string; type: string }> }) => {
        const plansWithCount = await Promise.all(
          app.plans.map(async (plan: { id: string; type: string }) => {
            const count = await prisma.code.count({
              where: { planId: plan.id, status: 'available' },
            });
            return {
              planId: plan.id,
              planType: plan.type,
              available: count,
            };
          })
        );
        return {
          appId: app.id,
          appName: app.name,
          plans: plansWithCount,
        };
      })
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  }
}
