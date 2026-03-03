import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email é obrigatório' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Email não encontrado no sistema' }, { status: 404 });
    }

    const token = crypto.randomBytes(3).toString('hex').toUpperCase();

    await prisma.config.upsert({
      where: { key: `reset_token_${email}` },
      update: { value: JSON.stringify({ token, expiresAt: Date.now() + 30 * 60 * 1000 }) },
      create: { key: `reset_token_${email}`, value: JSON.stringify({ token, expiresAt: Date.now() + 30 * 60 * 1000 }) },
    });

    return NextResponse.json({ success: true, token, message: 'Código gerado com sucesso' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
