import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId');
    const status = searchParams.get('status');

    const where: any = {};
    if (appId) where.appId = appId;
    if (status) where.status = status;

    const codes = await prisma.code.findMany({
      where,
      include: {
        app: true,
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(codes);
  } catch (error) {
    console.error('Erro ao buscar códigos:', error);
    return NextResponse.json({ error: 'Erro ao buscar códigos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { codes, appId, planId } = body;

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: 'Códigos são obrigatórios' },
        { status: 400 }
      );
    }

    if (!appId || !planId) {
      return NextResponse.json(
        { error: 'App e plano são obrigatórios' },
        { status: 400 }
      );
    }

    const validCodes = codes
      .map((c: string) => c?.trim())
      .filter((c: string) => c && c.length > 0);

    if (validCodes.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum código válido fornecido' },
        { status: 400 }
      );
    }

    const existingCodes = await prisma.code.findMany({
      where: { code: { in: validCodes } },
    });

    const existingCodesSet = new Set(existingCodes.map((c: { code: string }) => c.code));
    const newCodes = validCodes.filter((c: string) => !existingCodesSet.has(c));

    if (newCodes.length === 0) {
      return NextResponse.json(
        { error: 'Todos os códigos já existem' },
        { status: 400 }
      );
    }

    const createdCodes = await prisma.code.createMany({
      data: newCodes.map((code: string) => ({
        code,
        appId,
        planId,
        status: 'available',
      })),
    });

    return NextResponse.json({
      message: `${createdCodes.count} códigos adicionados com sucesso`,
      added: createdCodes.count,
      duplicates: validCodes.length - newCodes.length,
    });
  } catch (error) {
    console.error('Erro ao adicionar códigos:', error);
    return NextResponse.json(
      { error: 'Erro ao adicionar códigos' },
      { status: 500 }
    );
  }
}
