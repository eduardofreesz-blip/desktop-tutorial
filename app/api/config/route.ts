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

    const configs = await prisma.config.findMany();

    const configMap: Record<string, string> = {};
    configs.forEach((config: { key: string; value: string }) => {
      configMap[config.key] = config.value;
    });

    return NextResponse.json(configMap);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar configurações' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    
    // Support both { configs: {...} } and flat object formats
    const configs = body.configs || body;

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json(
        { error: 'Configurações inválidas' },
        { status: 400 }
      );
    }

    for (const [key, value] of Object.entries(configs)) {
      if (typeof value === 'string') {
        await prisma.config.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Configurações salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar configurações' },
      { status: 500 }
    );
  }
}
