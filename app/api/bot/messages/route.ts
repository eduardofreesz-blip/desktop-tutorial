import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Mensagens padrão do bot
const DEFAULT_MESSAGES = [
  {
    key: 'welcome',
    title: 'Boas-vindas',
    content: `🎯 *UNIVERSAL RECARGAS*

Olá! Bem-vindo à Universal Recargas!
Vendemos códigos de ativação para diversos aplicativos.

Escolha uma opção:`,
  },
  {
    key: 'apps_list',
    title: 'Lista de Apps',
    content: '📱 *APPS DISPONÍVEIS*\n\nEscolha o app que deseja ativar:',
  },
  {
    key: 'plan_selected',
    title: 'Plano Selecionado',
    content: `✅ *PLANO SELECIONADO*

📱 *App:* {{app_name}}
⏰ *Plano:* {{plan_name}}
💰 *Valor:* R$ {{price}}

━━━━━━━━━━━━━━━━━━
💳 *ESCOLHA A FORMA DE PAGAMENTO:*
━━━━━━━━━━━━━━━━━━`,
  },
  {
    key: 'pix_payment',
    title: 'Pagamento PIX',
    content: `💳 *PAGAMENTO PIX*

📲 *Copie o código PIX abaixo:*

\`\`\`{{pix_code}}\`\`\`

⚡ Após o pagamento, seu código será enviado automaticamente!`,
  },
  {
    key: 'code_sent',
    title: 'Código Enviado',
    content: `✅ *PAGAMENTO CONFIRMADO!*

📱 *App:* {{app_name}}
⏰ *Plano:* {{plan_name}}

🔑 *Seu código de ativação:*
\`\`\`{{code}}\`\`\`

📅 *Expira em:* {{expires_at}}

❤️ Obrigado pela preferência!`,
  },
  {
    key: 'out_of_stock',
    title: 'Sem Estoque',
    content: '😔 Desculpe, estoque esgotado para o plano {{plan_name}}.\n\nTente outro plano ou volte mais tarde.',
  },
  {
    key: 'support',
    title: 'Suporte',
    content: '📞 *SUPORTE*\n\nPrecisa de ajuda? Fale conosco!\n\n⏰ Horário: Seg-Sex, 9h às 18h\n📧 Email: suporte@universalrecargas.com',
  },
];

// GET - Listar mensagens configuradas
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar mensagens do banco
    let messages = await prisma.botMessage.findMany({
      orderBy: { key: 'asc' },
    });

    // Se não houver mensagens, criar as padrão
    if (messages.length === 0) {
      await prisma.botMessage.createMany({
        data: DEFAULT_MESSAGES.map(m => ({
          key: m.key,
          title: m.title,
          content: m.content,
          isActive: true,
        })),
      });
      messages = await prisma.botMessage.findMany({
        orderBy: { key: 'asc' },
      });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PUT - Atualizar mensagem
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, content, isActive } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    const updated = await prisma.botMessage.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar mensagem:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST - Resetar mensagens para padrão
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Deletar todas as mensagens
    await prisma.botMessage.deleteMany();

    // Recriar com padrão
    await prisma.botMessage.createMany({
      data: DEFAULT_MESSAGES.map(m => ({
        key: m.key,
        title: m.title,
        content: m.content,
        isActive: true,
      })),
    });

    const messages = await prisma.botMessage.findMany({
      orderBy: { key: 'asc' },
    });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('Erro ao resetar mensagens:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
