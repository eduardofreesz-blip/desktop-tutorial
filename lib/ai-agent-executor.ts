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
    console.error('[AI Agent] API key não configurada');
    return {
      message: 'Desculpe, a IA não está configurada corretamente. Por favor, entre em contato com o suporte.'
    };
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
    return 'Olá! Como posso ajudar? Digite *menu* para ver as opções.';
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

// Exportar para uso no bot
export type { AgentContext, AgentResponse };
