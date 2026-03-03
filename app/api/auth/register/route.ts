import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, inviteCode } = await request.json();

    // Validar campos obrigatórios
    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    // Verificar convite
    let invite = null;
    if (inviteCode) {
      invite = await prisma.invite.findUnique({
        where: { code: inviteCode },
      });

      if (!invite || !invite.isActive) {
        return NextResponse.json({ success: false, error: 'Convite inválido' }, { status: 400 });
      }

      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        return NextResponse.json({ success: false, error: 'Convite expirado' }, { status: 400 });
      }

      if (invite.usedCount >= invite.maxUses) {
        return NextResponse.json({ success: false, error: 'Convite já atingiu o limite de usos' }, { status: 400 });
      }

      // Se convite tem email específico, validar
      if (invite.email && invite.email !== email) {
        return NextResponse.json({ success: false, error: 'Este convite é para outro e-mail' }, { status: 400 });
      }
    } else {
      // Sem convite, recusar
      return NextResponse.json({ success: false, error: 'Convite necessário para cadastro' }, { status: 400 });
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ success: false, error: 'E-mail já cadastrado' }, { status: 400 });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: invite?.role || 'user',
      },
    });

    // Atualizar contador do convite
    if (invite) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: {
          usedCount: invite.usedCount + 1,
          usedAt: new Date(),
          isActive: invite.usedCount + 1 >= invite.maxUses ? false : invite.isActive,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Conta criada com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
