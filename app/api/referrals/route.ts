import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const referrals = await prisma.referral.findMany({
      include: {
        referredUsers: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        _count: {
          select: { referredUsers: true, payouts: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Estatísticas gerais
    const stats = await prisma.referral.aggregate({
      _sum: { totalEarnings: true, pendingPayout: true, totalReferrals: true }
    });

    return NextResponse.json({
      referrals,
      stats: {
        totalReferrers: referrals.length,
        totalReferrals: stats._sum.totalReferrals || 0,
        totalEarnings: stats._sum.totalEarnings || 0,
        pendingPayouts: stats._sum.pendingPayout || 0
      }
    });
  } catch (error) {
    console.error('Erro ao buscar indicações:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { referrerPhone, referrerName, commission = 10 } = body;

    if (!referrerPhone) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
    }

    // Verificar se já existe
    const existing = await prisma.referral.findUnique({
      where: { referrerPhone }
    });

    if (existing) {
      return NextResponse.json({ error: 'Este telefone já está cadastrado' }, { status: 400 });
    }

    // Gerar código único
    let referralCode = generateReferralCode();
    let codeExists = await prisma.referral.findUnique({ where: { referralCode } });
    while (codeExists) {
      referralCode = generateReferralCode();
      codeExists = await prisma.referral.findUnique({ where: { referralCode } });
    }

    const referral = await prisma.referral.create({
      data: {
        referrerPhone,
        referrerName: referrerName || null,
        referralCode,
        commission: parseFloat(String(commission)),
        isActive: true
      }
    });

    return NextResponse.json(referral);
  } catch (error) {
    console.error('Erro ao criar indicação:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
