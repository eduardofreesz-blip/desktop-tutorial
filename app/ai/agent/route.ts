// API do Agente IA ARIA - Acesso via Painel Admin
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { runAgent, quickAgentResponse, AgentContext } from '@/lib/ai-agent-executor';
import { prisma } from '@/lib/db';

// POST - Enviar mensagem para ARIA
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { message, quick } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! }
    });

    // Contexto do admin
    const context: AgentContext = {
      phoneNumber: user?.phone || 'admin-panel',
      customerName: user?.name || session.user.name || 'Admin',
      isAdmin: true,
      sessionId: session.user.email ?? undefined
    };

    // Se é uma consulta rápida, usar resposta simplificada
    if (quick) {
      const response = await quickAgentResponse(message, context);
      return NextResponse.json({ message: response });
    }

    // Executar agente completo
    const result = await runAgent(message, context);

    return NextResponse.json({
      message: result.message,
      actions: result.actions,
      success: true
    });

  } catch (error: any) {
    console.error('[AI Agent API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação', details: error.message },
      { status: 500 }
    );
  }
}

// GET - Obter informações do agente
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Importar ferramentas
    const { AGENT_TOOLS } = await import('@/lib/ai-agent');

    return NextResponse.json({
      name: 'ARIA',
      description: 'Assistente de Recargas Inteligente Avançada',
      version: '2.0',
      capabilities: [
        'Criar, editar e deletar apps',
        'Gerenciar planos e preços',
        'Adicionar e buscar códigos',
        'Gerenciar pedidos e pagamentos',
        'Análise de clientes',
        'Criar e gerenciar cupons',
        'Gerar relatórios de vendas',
        'Enviar mensagens WhatsApp',
        'Gerenciar usuários e painéis',
        'Verificar vencimentos e enviar lembretes'
      ],
      toolsCount: AGENT_TOOLS.length,
      tools: AGENT_TOOLS.map(t => ({
        name: t.name,
        description: t.description
      }))
    });

  } catch (error: any) {
    console.error('[AI Agent API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao obter informações' },
      { status: 500 }
    );
  }
}
