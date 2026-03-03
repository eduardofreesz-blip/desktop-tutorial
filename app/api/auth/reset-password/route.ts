import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, token, newPassword } = await request.json();

    if (!email || !token || !newPassword) {
      return NextResponse.json({ success: false, error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    const config = await prisma.config.findUnique({ where: { key: `reset_token_${email}` } });

    if (!config) {
      return NextResponse.json({ success: false, error: 'Código de verificação inválido ou expirado' }, { status: 400 });
    }

    const tokenData = JSON.parse(config.value);

    if (tokenData.token !== token) {
      return NextResponse.json({ success: false, error: 'Código de verificação incorreto' }, { status: 400 });
    }

    if (Date.now() > tokenData.expiresAt) {
      await prisma.config.delete({ where: { key: `reset_token_${email}` } });
      return NextResponse.json({ success: false, error: 'Código expirado. Solicite um novo.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    await prisma.config.delete({ where: { key: `reset_token_${email}` } });

    return NextResponse.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
