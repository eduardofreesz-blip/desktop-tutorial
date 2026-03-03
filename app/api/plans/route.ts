import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Buscar todos os planos
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const apps = await prisma.app.findMany({
      where: { isActive: true },
      include: {
        plans: {
          orderBy: { type: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(apps);
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST - Criar ou atualizar planos de um app
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { appId, plans } = body;

    if (!appId || !plans || !Array.isArray(plans)) {
      return NextResponse.json(
        { error: 'appId e plans são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o app existe
    const app = await prisma.app.findUnique({ where: { id: appId } });
    if (!app) {
      return NextResponse.json({ error: 'App não encontrado' }, { status: 404 });
    }

    // Atualizar ou criar cada plano
    const results = [];
    for (const plan of plans) {
      const { type, price, isActive } = plan;

      if (!type || price === undefined) {
        continue;
      }

      // Normalizar tipo para uppercase
      const normalizedType = type.toUpperCase();

      // Verificar se plano já existe
      const existingPlan = await prisma.plan.findFirst({
        where: { appId, type: normalizedType },
      });

      if (existingPlan) {
        // Atualizar plano existente
        const updated = await prisma.plan.update({
          where: { id: existingPlan.id },
          data: {
            price: parseFloat(price.toString()),
            isActive: isActive !== undefined ? isActive : true,
          },
        });
        results.push(updated);
      } else {
        // Criar novo plano
        const created = await prisma.plan.create({
          data: {
            appId,
            type: normalizedType,
            price: parseFloat(price.toString()),
            isActive: isActive !== undefined ? isActive : true,
          },
        });
        results.push(created);
      }
    }

    return NextResponse.json({
      message: 'Planos salvos com sucesso',
      plans: results,
    });
  } catch (error: any) {
    console.error('Erro ao salvar planos:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
