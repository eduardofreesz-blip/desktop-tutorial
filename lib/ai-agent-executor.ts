// @ts-nocheck
// Executor Principal do Agente IA Inteligente
import { AGENT_TOOLS, getToolsForAPI, executeTool, AgentContext } from './ai-agent';
import { prisma } from './db';
import { getCustomerProfile, getConversationHistory, detectIntent, analyzeSentiment } from './ai-assistant';

const API_URL = 'https://apps.abacus.ai/v1/chat/completions';
const MAX_ITERATIONS = 5; // Máximo de iterações de ferramentas

interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface AgentResponse {
  message: string;
  actions?: Array<{
    tool: string;
    result: any;
  }>;
  context?: any;
}

// Construir prompt de sistema completo
function buildAgentSystemPrompt(context: AgentContext, additionalContext?: string): string {
  const now = new Date();
  const brazilTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const hora = brazilTime.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  
  return `Você é a ARIA (Assistente de Recargas Inteligente Avançada), a IA super inteligente da Universal Recargas.

🎯 SUA IDENTIDADE:
- Nome: ARIA
- Personalidade: Inteligente, proativa, amigável e extremamente capaz
- Você tem ACESSO TOTAL ao banco de dados e pode executar qualquer ação
- Você pode criar, editar, deletar apps, planos, códigos, pedidos, etc.
- Você pode enviar mensagens, gerar relatórios, gerenciar clientes
- SEMPRE execute as ações quando solicitado - não apenas descreva o que faria

📅 DATA/HORA ATUAL: ${brazilTime.toLocaleString('pt-BR')}
👋 SAUDAÇÃO: ${saudacao}

📱 CONTEXTO DO USUÁRIO:
- Telefone: ${context.phoneNumber}
- Nome: ${context.customerName || 'Não identificado'}
- Admin: ${context.isAdmin ? 'Sim' : 'Não'}

${additionalContext || ''}

🛠️ FERRAMENTAS DISPONÍVEIS:
Você tem acesso a ${AGENT_TOOLS.length} ferramentas para executar ações:

${AGENT_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')}

❗ REGRAS IMPORTANTES:
1. SEMPRE use as ferramentas quando o usuário pedir uma ação
2. Se o usuário pedir "crie um app", "mude o preço", "liste clientes" - FAÇA ISSO usando as ferramentas
3. Não diga "vou fazer" - simplesmente FAÇA chamando as ferramentas
4. Seja proativo: se o usuário menciona um problema, ofereça soluções e execute
5. Após executar ações, confirme o que foi feito com detalhes
6. Use emojis com moderação para tornar a conversa amigável
7. Responda SEMPRE em português brasileiro
8. Para múltiplas ações, execute todas em sequência

💡 EXEMPLOS DE INTERAÇÃO:
- "Crie o app HBO Max" → Use criar_app
- "Qual o estoque?" → Use verificar_estoque
- "Mude o preço do Netflix mensal para 25" → Use atualizar_preco
- "Liste os pedidos de hoje" → Use listar_pedidos
- "Envie uma mensagem para 5511999..." → Use enviar_mensagem
- "Confirme o pagamento do pedido X" → Use confirmar_pagamento`;
}

// Obter contexto enriquecido do cliente
async function getEnrichedContext(phoneNumber: string): Promise<string> {
  let contextParts: string[] = [];
  
  try {
    // Perfil do cliente
    const profile = await getCustomerProfile(phoneNumber);
    if (profile) {
      contextParts.push(`
👤 PERFIL DO CLIENTE:
- Apps favoritos: ${profile.preferredApps.join(', ') || 'Nenhum'}
- Plano preferido: ${profile.preferredPlanType || 'Variado'}
- Total pedidos: ${profile.totalOrders}
- Total gasto: R$ ${profile.totalSpent.toFixed(2)}
- Tags: ${profile.tags.join(', ') || 'Novo'}
- Cliente desde: ${profile.memberSince ? new Date(profile.memberSince).toLocaleDateString('pt-BR') : 'Hoje'}`);
    }
    
    // Último pedido
    const lastOrder = await prisma.order.findFirst({
      where: { clientPhone: phoneNumber },
      include: { app: true, plan: true },
      orderBy: { createdAt: 'desc' }
    });
    
    if (lastOrder) {
      contextParts.push(`
📦 ÚLTIMO PEDIDO:
- App: ${lastOrder.app.name}
- Plano: ${lastOrder.plan.type}
- Status: ${lastOrder.status}
- Data: ${lastOrder.createdAt.toLocaleDateString('pt-BR')}`);
    }
    
    // Métricas rápidas do sistema
    const [totalApps, totalOrders, pendingOrders] = await Promise.all([
      prisma.app.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'pending_payment' } })
    ]);
    
    contextParts.push(`
📊 MÉTRICAS DO SISTEMA:
- Apps ativos: ${totalApps}
- Total pedidos: ${totalOrders}
- Pedidos pendentes: ${pendingOrders}`);
    
  } catch (error) {
    console.error('[AI Agent] Erro ao obter contexto:', error);
  }
  
  return contextParts.join('\n');
}

// Executar o agente com loop de ferramentas
export async function runAgent(
  userMessage: string,
  context: AgentContext
): Promise<AgentResponse> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  
  if (!apiKey) {
    console.log('[AI Agent] Sem API key - usando processamento local');
    return localAgentProcess(userMessage, context);
  }
  
  console.log(`[AI Agent] Iniciando para ${context.phoneNumber}: "${userMessage}"`);
  
  // Detectar intenção e sentimento
  const { intent, confidence, entities } = detectIntent(userMessage);
  const sentiment = analyzeSentiment(userMessage);
  
  console.log(`[AI Agent] Intent: ${intent} (${confidence}), Sentiment: ${sentiment}`);
  
  // Obter contexto enriquecido
  const enrichedContext = await getEnrichedContext(context.phoneNumber);
  
  // Construir prompt do sistema
  const systemPrompt = buildAgentSystemPrompt(context, enrichedContext);
  
  // Histórico de conversa
  const history = await getConversationHistory(context.phoneNumber, 10);
  
  // Construir mensagens
  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({
      role: h.role === 'customer' ? 'user' as const : 'assistant' as const,
      content: h.message
    })),
    { role: 'user', content: userMessage }
  ];
  
  const executedActions: Array<{ tool: string; result: any }> = [];
  let iterations = 0;
  
  // Loop de execução de ferramentas
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`[AI Agent] Iteração ${iterations}`);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages,
          tools: getToolsForAPI(),
          tool_choice: 'auto',
          max_tokens: 1500,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Agent] Erro na API:', response.status, errorText);
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const assistantMessage = data.choices[0]?.message;
      
      if (!assistantMessage) {
        throw new Error('Resposta inválida da API');
      }
      
      // Verificar se há chamadas de ferramentas
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`[AI Agent] ${assistantMessage.tool_calls.length} ferramenta(s) solicitada(s)`);
        
        // Adicionar mensagem do assistente com tool_calls
        messages.push({
          role: 'assistant',
          content: assistantMessage.content,
          tool_calls: assistantMessage.tool_calls
        });
        
        // Executar cada ferramenta
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            console.error('[AI Agent] Erro ao parsear argumentos:', toolCall.function.arguments);
          }
          
          console.log(`[AI Agent] Executando: ${toolName}`, toolArgs);
          
          // Executar a ferramenta
          const result = await executeTool(toolName, toolArgs, context);
          
          console.log(`[AI Agent] Resultado de ${toolName}:`, result.success ? 'Sucesso' : 'Erro');
          
          executedActions.push({ tool: toolName, result });
          
          // Adicionar resultado da ferramenta
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
            name: toolName
          });
        }
        
        // Continuar o loop para processar resultados
        continue;
      }
      
      // Sem mais ferramentas - retornar resposta final
      const finalMessage = assistantMessage.content || 'Pronto! A ação foi executada com sucesso.';
      
      console.log(`[AI Agent] Resposta final: ${finalMessage.substring(0, 100)}...`);
      
      // Salvar conversa
      await saveAgentConversation(context.phoneNumber, userMessage, finalMessage, context.customerName);
      
      return {
        message: finalMessage,
        actions: executedActions.length > 0 ? executedActions : undefined
      };
      
    } catch (error: any) {
      console.error('[AI Agent] Erro:', error);
      
      if (iterations >= MAX_ITERATIONS) {
        return {
          message: 'Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente ou digite *menu* para ver as opções.',
          actions: executedActions
        };
      }
    }
  }
  
  // Máximo de iterações atingido
  return {
    message: 'A operação foi processada. Posso ajudar com mais alguma coisa?',
    actions: executedActions
  };
}

// Salvar conversa do agente
async function saveAgentConversation(
  phoneNumber: string,
  userMessage: string,
  botResponse: string,
  customerName?: string
): Promise<void> {
  try {
    // Salvar mensagem do usuário
    await prisma.conversation.create({
      data: {
        phoneNumber,
        clientName: customerName || 'Cliente',
        message: userMessage,
        direction: 'incoming',
        state: 'AI_AGENT',
        context: {}
      }
    });
    
    // Salvar resposta do bot
    await prisma.conversation.create({
      data: {
        phoneNumber,
        clientName: 'ARIA Bot',
        message: botResponse,
        direction: 'outgoing',
        state: 'AI_AGENT',
        context: {}
      }
    });
  } catch (error) {
    console.error('[AI Agent] Erro ao salvar conversa:', error);
  }
}

// Função simplificada para respostas rápidas (sem ferramentas)
export async function quickAgentResponse(
  userMessage: string,
  context: AgentContext
): Promise<string> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  
  if (!apiKey) {
    const result = await localAgentProcess(userMessage, context);
    return result.message;
  }
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Você é ARIA, a assistente da Universal Recargas. Seja breve, amigável e use emojis. Responda em português brasileiro.
Cliente: ${context.customerName || 'Desconhecido'}
Hora: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
          },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 250,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    return data.choices[0]?.message?.content || 'Como posso ajudar?';
    
  } catch (error) {
    console.error('[AI Agent] Erro em quickResponse:', error);
    return 'Olá! Em que posso ajudar hoje? 😊';
  }
}

// Função para verificar se uma mensagem requer ações do agente
export function requiresAgentAction(message: string): boolean {
  const lowerMsg = message.toLowerCase().trim();
  
  // Palavras-chave que indicam ações
  const actionKeywords = [
    'crie', 'criar', 'adicione', 'adicionar', 'remova', 'remover', 'delete', 'deletar',
    'atualize', 'atualizar', 'mude', 'mudar', 'altere', 'alterar', 'edite', 'editar',
    'liste', 'listar', 'mostre', 'mostrar', 'veja', 'ver', 'exiba', 'exibir',
    'envie', 'enviar', 'mande', 'mandar', 'confirme', 'confirmar',
    'cancele', 'cancelar', 'reenvie', 'reenviar',
    'relatório', 'resumo', 'estoque', 'vendas', 'métricas',
    'cupom', 'desconto', 'promoção',
    'cliente', 'pedido', 'código', 'app', 'plano',
    'usuário', 'painel', 'convite',
    'lembrete', 'vencimento', 'indicação',
    'quanto', 'quantos', 'qual', 'quais'
  ];
  
  return actionKeywords.some(keyword => lowerMsg.includes(keyword));
}

// Função para processar comandos admin via WhatsApp
export async function processAdminCommand(
  message: string,
  phoneNumber: string,
  customerName?: string
): Promise<AgentResponse> {
  // Verificar se é admin (baseado em configuração)
  const adminPhones = (process.env.ADMIN_PHONES || '').split(',').map(p => p.trim());
  const isAdmin = adminPhones.includes(phoneNumber) || adminPhones.length === 0;
  
  const context: AgentContext = {
    phoneNumber,
    customerName,
    isAdmin
  };
  
  // Se requer ação, usar agente completo
  if (requiresAgentAction(message)) {
    return await runAgent(message, context);
  }
  
  // Caso contrário, resposta rápida
  const response = await quickAgentResponse(message, context);
  return { message: response };
}

// Processamento local da ARIA (sem API externa)
async function localAgentProcess(userMessage: string, context: AgentContext): Promise<AgentResponse> {
  const lower = userMessage.toLowerCase().trim();
  const actions: Array<{ tool: string; result: any }> = [];

  // Saudações
  if (lower.match(/^(oi|olá|ola|hey|hello|bom dia|boa tarde|boa noite|e ai|eai|opa)/)) {
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    const stats = await getQuickStats();
    return {
      message: `${saudacao}! 👋 Eu sou a **ARIA**, sua assistente inteligente!\n\n📊 **Resumo rápido do sistema:**\n• 📱 ${stats.apps} apps cadastrados\n• 🔑 ${stats.codes} códigos disponíveis\n• 📦 ${stats.orders} pedidos\n• 👥 ${stats.customers} clientes\n• 💰 Faturamento: R$ ${stats.revenue.toFixed(2)}\n\n**O que posso fazer por você?** Peça qualquer coisa! 🚀`
    };
  }

  // Status / resumo
  if (lower.includes('status') || lower.includes('resumo') || lower.includes('como esta') || lower.includes('visão geral') || lower.includes('overview')) {
    const stats = await getQuickStats();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayOrders = await prisma.order.count({ where: { createdAt: { gte: today } } });
    const todayRevenue = await prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent', createdAt: { gte: today } } });
    return {
      message: `📊 **Status Completo do Sistema**\n\n**Geral:**\n• 📱 Apps: ${stats.apps}\n• 🔑 Códigos disponíveis: ${stats.codes}\n• 📦 Total pedidos: ${stats.orders}\n• 👥 Clientes: ${stats.customers}\n• 💰 Faturamento total: R$ ${stats.revenue.toFixed(2)}\n\n**Hoje:**\n• 📦 Pedidos hoje: ${todayOrders}\n• 💰 Faturamento hoje: R$ ${(todayRevenue._sum.amount || 0).toFixed(2)}\n\n**Estoque por app:**${await getStockSummary()}`,
      actions
    };
  }

  // Listar apps
  if (lower.includes('app') || lower.includes('aplicativo') || lower.includes('produto')) {
    const apps = await prisma.app.findMany({
      include: { plans: true, _count: { select: { codes: true, orders: true } } }
    });
    const list = apps.map(a => {
      const plans = a.plans.map(p => `${p.type}: R$ ${p.price.toFixed(2)}`).join(', ');
      return `\n📱 **${a.name}** ${a.isActive ? '✅' : '❌'}\n   ${a.description || 'Sem descrição'}\n   Planos: ${plans || 'Nenhum'}\n   Códigos: ${a._count.codes} | Pedidos: ${a._count.orders}`;
    }).join('\n');
    return { message: `📱 **Apps Cadastrados (${apps.length}):**${list || '\nNenhum app cadastrado.'}`, actions };
  }

  // Pedidos
  if (lower.includes('pedido') || lower.includes('venda') || lower.includes('order')) {
    const orders = await prisma.order.findMany({
      take: 10, orderBy: { createdAt: 'desc' },
      include: { app: true, plan: true }
    });
    if (orders.length === 0) return { message: '📦 Nenhum pedido encontrado ainda.\n\nOs pedidos aparecerão aqui quando clientes comprarem pelo WhatsApp!' };
    const list = orders.map(o =>
      `• **${o.clientName || o.clientPhone}** - ${o.app.name} (${o.plan.type}) - R$ ${o.amount.toFixed(2)} - ${o.status === 'code_sent' ? '✅ Enviado' : o.status === 'paid' ? '💰 Pago' : o.status === 'pending_payment' ? '⏳ Pendente' : '❌ ' + o.status}`
    ).join('\n');
    return { message: `📦 **Últimos Pedidos (${orders.length}):**\n\n${list}`, actions };
  }

  // Códigos / estoque
  if (lower.includes('código') || lower.includes('codigo') || lower.includes('estoque') || lower.includes('code')) {
    return { message: `🔑 **Estoque de Códigos:**${await getStockSummary()}`, actions };
  }

  // Clientes
  if (lower.includes('cliente') || lower.includes('customer')) {
    const customers = await prisma.order.groupBy({
      by: ['clientPhone', 'clientName'], _count: true, _sum: { amount: true },
      orderBy: { _count: { clientPhone: 'desc' } }, take: 10
    });
    if (customers.length === 0) return { message: '👥 Nenhum cliente encontrado ainda.' };
    const list = customers.map(c =>
      `• **${c.clientName || c.clientPhone}** - ${c._count} pedidos - R$ ${(c._sum.amount || 0).toFixed(2)}`
    ).join('\n');
    return { message: `👥 **Top Clientes (${customers.length}):**\n\n${list}`, actions };
  }

  // Faturamento
  if (lower.includes('faturamento') || lower.includes('receita') || lower.includes('ganho') || lower.includes('dinheiro') || lower.includes('lucro')) {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);
    const [total, todayR, weekR, monthR] = await Promise.all([
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent' } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent', createdAt: { gte: today } } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent', createdAt: { gte: weekAgo } } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent', createdAt: { gte: monthAgo } } }),
    ]);
    return {
      message: `💰 **Relatório de Faturamento:**\n\n📅 Hoje: **R$ ${(todayR._sum.amount || 0).toFixed(2)}**\n📅 Última semana: **R$ ${(weekR._sum.amount || 0).toFixed(2)}**\n📅 Último mês: **R$ ${(monthR._sum.amount || 0).toFixed(2)}**\n📅 Total geral: **R$ ${(total._sum.amount || 0).toFixed(2)}**`,
    };
  }

  // Cupons
  if (lower.includes('cupom') || lower.includes('cupons') || lower.includes('desconto')) {
    const coupons = await prisma.coupon.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    if (coupons.length === 0) return { message: '🎫 Nenhum cupom cadastrado.\n\nVá em **Cupons** no menu lateral para criar cupons de desconto!' };
    const list = coupons.map(c =>
      `• **${c.code}** - ${c.discountType === 'percentage' ? c.discountValue + '%' : 'R$ ' + c.discountValue.toFixed(2)} off ${c.isActive ? '✅' : '❌'} (${c.usedCount}/${c.maxUses || '∞'} usos)`
    ).join('\n');
    return { message: `🎫 **Cupons (${coupons.length}):**\n\n${list}`, actions };
  }

  // Ajuda
  if (lower.includes('ajuda') || lower.includes('help') || lower === '?' || lower.includes('o que voce faz') || lower.includes('o que você faz') || lower.includes('pode fazer')) {
    return {
      message: `🤖 **Eu sou a ARIA! Posso fazer tudo isso:**\n\n📊 **Consultas:**\n• "status" - Visão geral do sistema\n• "apps" - Listar aplicativos e planos\n• "pedidos" - Últimos pedidos\n• "códigos" - Estoque de códigos\n• "clientes" - Top clientes\n• "faturamento" - Relatório financeiro\n• "cupons" - Listar cupons\n\n💡 **Dicas:**\n• Pergunte naturalmente: "como estão as vendas?"\n• Peça detalhes: "me mostra os apps"\n• Solicite ações: "quantos códigos temos?"\n\n🔗 Para ações avançadas (criar apps, planos, etc), use os menus do painel lateral!`
    };
  }

  // Perguntas sobre vendas
  if (lower.includes('venda') || lower.includes('vender') || lower.includes('como vender') || lower.includes('me ajude com venda')) {
    const stats = await getQuickStats();
    return {
      message: `💡 **Dicas para suas vendas:**\n\n📱 Você tem **${stats.apps} apps** com **${stats.codes} códigos** disponíveis para vender.\n\n**Como funciona:**\n1. Cliente manda mensagem no WhatsApp\n2. Bot mostra os apps e planos disponíveis\n3. Cliente escolhe e paga via PIX\n4. Você confirma o pagamento em **Pedidos**\n5. Código é enviado automaticamente!\n\n**Para começar:**\n• Configure o WhatsApp na aba **WhatsApp**\n• Configure o PIX em **Configurações**\n• Adicione códigos em **Códigos**\n\nPrecisa de mais ajuda? 🚀`
    };
  }

  // Fallback - resposta genérica inteligente
  return {
    message: `🤖 Entendi sua mensagem: "${userMessage}"\n\nPosso te ajudar com:\n• 📊 **status** - Ver números do negócio\n• 📱 **apps** - Ver aplicativos\n• 📦 **pedidos** - Ver vendas\n• 🔑 **códigos** - Ver estoque\n• 💰 **faturamento** - Ver receitas\n• ❓ **ajuda** - Ver tudo que posso fazer\n\nO que gostaria de saber? 😊`
  };
}

async function getQuickStats() {
  const [apps, orders, codes, customers, revenue] = await Promise.all([
    prisma.app.count(),
    prisma.order.count(),
    prisma.code.count({ where: { status: 'available' } }),
    prisma.order.groupBy({ by: ['clientPhone'] }).then(r => r.length),
    prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent' } }),
  ]);
  return { apps, orders, codes, customers, revenue: revenue._sum.amount || 0 };
}

async function getStockSummary(): Promise<string> {
  const apps = await prisma.app.findMany({
    include: { plans: { include: { _count: { select: { codes: true } } } } }
  });
  let summary = '';
  for (const app of apps) {
    const planLines = app.plans
      .map(p => `   • ${p.type}: ${p._count.codes} códigos`)
      .join('\n');
    summary += `\n\n📱 **${app.name}:**\n${planLines || '   Sem planos'}`;
  }
  return summary || '\nNenhum app cadastrado.';
}

// Exportar para uso no bot
export type { AgentContext, AgentResponse };
