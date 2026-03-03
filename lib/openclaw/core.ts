import { prisma } from '../db';

export async function processCommand(commandOrObj: string | Record<string, unknown>, context?: Record<string, unknown>): Promise<{ success: boolean; message: string; data?: unknown }> {
  const command = typeof commandOrObj === 'string' ? commandOrObj : (commandOrObj as Record<string, unknown>).command as string || '';
  const lower = command.toLowerCase().trim();

  if (!lower) return { success: false, message: 'Nenhum comando fornecido.' };

  // Status geral
  if (lower.includes('status') || lower.includes('resumo') || lower.includes('como esta') || lower.includes('como está')) {
    const [apps, orders, codes, codesUsed, customers, revenue] = await Promise.all([
      prisma.app.count(),
      prisma.order.count(),
      prisma.code.count({ where: { status: 'available' } }),
      prisma.code.count({ where: { status: 'used' } }),
      prisma.order.groupBy({ by: ['clientPhone'] }).then(r => r.length),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent' } }),
    ]);
    return {
      success: true,
      message: `📊 **Status do Sistema**\n\n📱 Apps: ${apps}\n📦 Pedidos: ${orders}\n🔑 Códigos disponíveis: ${codes}\n✅ Códigos usados: ${codesUsed}\n👥 Clientes únicos: ${customers}\n💰 Faturamento total: R$ ${(revenue._sum.amount || 0).toFixed(2)}`,
      data: { apps, orders, codes, codesUsed, customers, revenue: revenue._sum.amount || 0 }
    };
  }

  // Listar apps
  if (lower.includes('listar app') || lower.includes('apps') || lower.includes('aplicativo')) {
    const apps = await prisma.app.findMany({
      include: { _count: { select: { codes: true, orders: true, plans: true } } }
    });
    const list = apps.map(a => `• **${a.name}** - ${a._count.codes} códigos, ${a._count.orders} pedidos, ${a.isActive ? '✅ Ativo' : '❌ Inativo'}`).join('\n');
    return { success: true, message: `📱 **Apps cadastrados (${apps.length}):**\n\n${list || 'Nenhum app cadastrado.'}`, data: apps };
  }

  // Listar pedidos
  if (lower.includes('pedido') || lower.includes('order') || lower.includes('venda')) {
    const orders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { app: true, plan: true },
    });
    if (orders.length === 0) return { success: true, message: '📦 Nenhum pedido encontrado.' };
    const list = orders.map(o => 
      `• **${o.clientName || o.clientPhone}** - ${o.app.name} (${o.plan.type}) - R$ ${o.amount.toFixed(2)} - ${o.status}`
    ).join('\n');
    return { success: true, message: `📦 **Últimos pedidos (${orders.length}):**\n\n${list}`, data: orders };
  }

  // Listar códigos
  if (lower.includes('código') || lower.includes('codigo') || lower.includes('code') || lower.includes('estoque')) {
    const stats = await prisma.code.groupBy({
      by: ['status'],
      _count: true,
    });
    const total = stats.reduce((s, i) => s + i._count, 0);
    const available = stats.find(s => s.status === 'available')?._count || 0;
    const used = stats.find(s => s.status === 'used')?._count || 0;
    return {
      success: true,
      message: `🔑 **Estoque de Códigos:**\n\n📦 Total: ${total}\n✅ Disponíveis: ${available}\n🔴 Usados: ${used}`,
      data: { total, available, used }
    };
  }

  // Listar clientes
  if (lower.includes('cliente') || lower.includes('customer')) {
    const customers = await prisma.order.groupBy({
      by: ['clientPhone', 'clientName'],
      _count: true,
      _sum: { amount: true },
      orderBy: { _count: { clientPhone: 'desc' } },
      take: 10,
    });
    const list = customers.map(c => 
      `• **${c.clientName || c.clientPhone}** - ${c._count} pedidos - R$ ${(c._sum.amount || 0).toFixed(2)}`
    ).join('\n');
    return { success: true, message: `👥 **Top clientes (${customers.length}):**\n\n${list || 'Nenhum cliente encontrado.'}`, data: customers };
  }

  // Faturamento
  if (lower.includes('faturamento') || lower.includes('receita') || lower.includes('revenue') || lower.includes('dinheiro') || lower.includes('ganho')) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [total, todayRev, weekRev, monthRev] = await Promise.all([
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent' } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent', createdAt: { gte: today } } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent', createdAt: { gte: weekAgo } } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'code_sent', createdAt: { gte: monthAgo } } }),
    ]);
    return {
      success: true,
      message: `💰 **Faturamento:**\n\n📅 Hoje: R$ ${(todayRev._sum.amount || 0).toFixed(2)}\n📅 Semana: R$ ${(weekRev._sum.amount || 0).toFixed(2)}\n📅 Mês: R$ ${(monthRev._sum.amount || 0).toFixed(2)}\n📅 Total: R$ ${(total._sum.amount || 0).toFixed(2)}`,
    };
  }

  // Ajuda
  if (lower.includes('ajuda') || lower.includes('help') || lower.includes('comando') || lower === '?') {
    return {
      success: true,
      message: `🤖 **Comandos disponíveis:**\n\n• **status** - Visão geral do sistema\n• **apps** - Listar aplicativos\n• **pedidos** - Últimos pedidos\n• **códigos** / **estoque** - Estoque de códigos\n• **clientes** - Top clientes\n• **faturamento** - Relatório de faturamento\n• **ajuda** - Lista de comandos`,
    };
  }

  // Saudações
  if (lower.match(/^(oi|olá|ola|hey|hello|bom dia|boa tarde|boa noite|e ai|eai)/)) {
    return {
      success: true,
      message: `👋 Olá! Sou o **OpenClaw**, seu assistente de gestão.\n\nDigite **ajuda** para ver os comandos disponíveis, ou me pergunte qualquer coisa sobre seu negócio!`,
    };
  }

  // Comando não reconhecido - tenta interpretar
  return {
    success: true,
    message: `🤔 Não entendi o comando "${command}".\n\nDigite **ajuda** para ver os comandos disponíveis.\n\n💡 Dica: você pode perguntar sobre **status**, **pedidos**, **códigos**, **clientes** ou **faturamento**.`,
  };
}

export async function quickCommand(cmd: string): Promise<string> {
  const result = await processCommand(cmd);
  return result.message;
}

export async function loadAdminNumbers(): Promise<string[]> {
  const config = await prisma.config.findUnique({ where: { key: 'admin_numbers' } });
  if (!config?.value) return [];
  try { return JSON.parse(config.value); } catch { return []; }
}

export async function saveAdminNumbers(numbers: string[]): Promise<void> {
  await prisma.config.upsert({
    where: { key: 'admin_numbers' },
    update: { value: JSON.stringify(numbers) },
    create: { key: 'admin_numbers', value: JSON.stringify(numbers) },
  });
}
