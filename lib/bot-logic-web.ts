// @ts-nocheck
import { prisma } from './db';
import { createPixPayment, hasGetnetCredentials } from './getnet';
import { 
  generateAIResponse, 
  AIContext, 
  detectIntent, 
  getCustomerProfile,
  getConversationHistory,
  analyzeSentiment 
} from './ai-assistant';
import { createUnifiedPix, hasProviderCredentials, PixProvider } from './pix-banks';
import { createMercadoPagoCheckoutLink, hasMercadoPagoCredentials } from './mercadopago';
import { runAgent, requiresAgentAction, AgentContext } from './ai-agent-executor';

// Estados da conversa
const ConversationState = {
  MENU: 'MENU',
  SELECTING_APP: 'SELECTING_APP',
  SELECTING_PLAN: 'SELECTING_PLAN',
  ENTERING_COUPON: 'ENTERING_COUPON',
  SELECTING_PAYMENT_METHOD: 'SELECTING_PAYMENT_METHOD',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  HUMAN_SUPPORT: 'HUMAN_SUPPORT',
  COMPLETED: 'COMPLETED',
} as const;

interface ConversationContext {
  appId?: string;
  planId?: string;
  orderId?: string;
  couponCode?: string;
  discount?: number;
}

// Mapeamento de tipos de plano
const PLAN_TYPES = {
  monthly: 'mensal',
  quarterly: 'trimestral',
  semiannual: 'semestral',
  annual: 'anual',
  mensal: 'mensal',
  trimestral: 'trimestral',
  semestral: 'semestral',
  anual: 'anual',
} as const;

// Obter saudação baseada na hora do dia
function getSaudacao(): string {
  const hora = new Date().getHours() - 3; // Ajuste para fuso horário Brasil
  const horaAjustada = hora < 0 ? hora + 24 : hora;
  
  if (horaAjustada >= 5 && horaAjustada < 12) {
    return 'Bom dia';
  } else if (horaAjustada >= 12 && horaAjustada < 18) {
    return 'Boa tarde';
  } else {
    return 'Boa noite';
  }
}

function getPlanName(type: string): string {
  const normalized = type.toLowerCase();
  return PLAN_TYPES[normalized as keyof typeof PLAN_TYPES] || type;
}

function getPlanNameDisplay(type: string): string {
  const name = getPlanName(type);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Buscar ou criar conversa do cliente
async function getOrCreateConversation(phoneNumber: string, clientName: string) {
  let conversation = await prisma.conversation.findFirst({
    where: { phoneNumber },
    orderBy: { createdAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        phoneNumber,
        clientName,
        message: '',
        direction: 'INBOUND',
        state: ConversationState.MENU,
        context: {},
      },
    });
  }

  return conversation;
}

// Salvar mensagem no histórico
async function saveMessage(
  phoneNumber: string,
  clientName: string,
  message: string,
  direction: 'INBOUND' | 'OUTBOUND',
  state: string,
  context: ConversationContext
) {
  await prisma.conversation.create({
    data: {
      phoneNumber,
      clientName,
      message,
      direction,
      state,
      context: context as any,
    },
  });
}

// Buscar apps disponíveis
async function getActiveApps() {
  return prisma.app.findMany({
    where: { isActive: true },
    include: {
      plans: {
        where: { isActive: true },
        orderBy: { price: 'asc' },
      },
    },
  });
}

// Buscar configuração
async function getConfig(key: string): Promise<string> {
  const config = await prisma.config.findUnique({ where: { key } });
  return config?.value || '';
}

// Verificar estoque de código disponível
async function hasAvailableCode(planId: string): Promise<boolean> {
  const count = await prisma.code.count({
    where: { planId, status: 'available' },
  });
  return count > 0;
}

// Criar pedido
async function createOrder(
  phoneNumber: string,
  clientName: string,
  appId: string,
  planId: string,
  discount: number = 0
) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { app: true },
  });

  if (!plan) return null;

  const finalAmount = Math.max(0, plan.price - discount);

  const order = await prisma.order.create({
    data: {
      clientPhone: phoneNumber,
      clientName,
      appId,
      planId,
      amount: finalAmount,
      status: 'pending_payment',
    },
  });

  return order;
}

// Criar pagamento PIX via Getnet
async function createGetnetPixPayment(orderId: string, amount: number, customerId: string): Promise<{
  success: boolean;
  qrCode?: string;
  qrCodeImage?: string;
  paymentId?: string;
  error?: string;
}> {
  try {
    const hasCredentials = hasGetnetCredentials();
    
    if (!hasCredentials) {
      return { success: false, error: 'Credenciais Getnet não configuradas' };
    }
    
    const pixResponse = await createPixPayment({
      amount: Math.round(amount * 100),
      orderId: `ORDER_${orderId}`,
      customerId: customerId.replace(/\D/g, ''),
    });

    return {
      success: true,
      qrCode: pixResponse.qr_code,
      qrCodeImage: pixResponse.additional_data?.qr_code_image,
      paymentId: pixResponse.payment_id,
    };
  } catch (error) {
    console.error('[Getnet PIX] Erro:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao gerar PIX' };
  }
}

// Interface para mensagem interativa
export interface InteractiveMessage {
  type: 'text' | 'buttons' | 'list' | 'image' | 'video';
  text?: string;
  title?: string;
  buttons?: Array<{ id: string; title: string }>;
  listSections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  listButtonText?: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  footer?: string;
}

// ==========================================
// MENU PRINCIPAL - USA CONFIGS DO SITE
// ==========================================
export async function formatMainMenu(clientName: string): Promise<InteractiveMessage[]> {
  const saudacao = getSaudacao();
  const nome = clientName || 'Cliente';
  const welcomeImage = await getConfig('welcome_image');
  const welcomeMsg = await getConfig('welcome_message') || 'Bem-vindo ao Universal Recargas! 🎉';
  const menuTitle = await getConfig('menu_title') || 'UNIVERSAL RECARGAS';
  const opt1 = await getConfig('menu_option_1') || '🎁 COMPRAR';
  const opt2 = await getConfig('menu_option_2') || '🧑 SUPORTE';
  const opt3 = await getConfig('menu_option_3') || '📲 INSTALAÇÃO';
  const opt4 = await getConfig('menu_option_4') || '📝 MEUS PEDIDOS';
  const opt5 = await getConfig('menu_option_5') || 'ℹ️ SOBRE NÓS';
  const footer = await getConfig('menu_footer') || '🛒 Universal Recargas - Sua Loja de Confiança';

  const messages: InteractiveMessage[] = [];

  if (welcomeImage) {
    messages.push({ type: 'image', imageUrl: welcomeImage, caption: '' });
  }

  // Uma única mensagem clara: WhatsApp não tem botões clicáveis, usuário precisa DIGITAR o número
  const buildMarker = process.env.BOT_BUILD_MARKER || 'v2';
  const menuText = `*${saudacao}, ${nome}!* 👋\n\n*${welcomeMsg}*\n\n🔒 *PAGAMENTO PIX COPIA COLA* 🔒\n\n*Digite o número da opção:*\n\n1️⃣ ${opt1}\n2️⃣ ${opt2}\n3️⃣ ${opt3}\n4️⃣ ${opt4}\n5️⃣ ${opt5}\n\n0️⃣ Voltar ao menu\n\n${footer}\n_${buildMarker}_`;

  messages.push({ type: 'text', text: menuText });

  return messages;
}

// Lista de Apps para compra - texto com lista (WhatsApp não renderiza botões)
async function formatAppsList(): Promise<InteractiveMessage> {
  const apps = await getActiveApps();
  
  if (apps.length === 0) {
    return {
      type: 'text',
      text: '😔 Nenhum app disponível no momento. Volte mais tarde!\n\nDigite *0* para voltar ao menu.',
    };
  }

  const lines = apps.map((app: any, i: number) => {
    const minPrice = app.plans.length > 0 ? Math.min(...app.plans.map((p: any) => p.price)) : 0;
    return `${i + 1}️⃣ *${app.name}* - R$ ${minPrice.toFixed(0)}`;
  });
  
  const text = `📱 *APPS DISPONÍVEIS*\n\n*Digite o número do app desejado:*\n\n${lines.join('\n')}\n\n0️⃣ Voltar ao menu`;
  
  return { type: 'text', text };
}

// Opções de forma de pagamento (PIX, Cartão, Transferência)
async function formatPaymentMethodOptions(
  appName: string,
  planName: string,
  price: number,
  discount: number = 0,
  originalPrice?: number
): Promise<string> {
  const cardEnabled = await getConfig('card_enabled') === 'true';
  const transferEnabled = await getConfig('transfer_enabled') === 'true';
  let lines = `📱 *${appName}* - ${planName}\n`;
  if (discount > 0 && originalPrice) {
    lines += `💰 *Valor original:* R$ ${originalPrice.toFixed(2)}\n`;
    lines += `🎁 *Desconto:* R$ ${discount.toFixed(2)}\n`;
  }
  lines += `✨ *Valor:* R$ ${price.toFixed(2)}\n\n`;
  lines += `💳 *ESCOLHA A FORMA DE PAGAMENTO:*\n\n`;
  lines += `1️⃣ PIX (copia e cola)\n`;
  if (cardEnabled) lines += `2️⃣ Cartão de crédito\n`;
  if (transferEnabled) lines += `3️⃣ Transferência bancária\n`;
  lines += `\n0️⃣ Voltar ao menu`;
  return lines;
}

// Filtrar planos válidos
function filterValidPlans(plans: any[]): any[] {
  const validTypes = ['monthly', 'quarterly', 'semiannual', 'annual', 'mensal', 'trimestral', 'semestral', 'anual'];
  return plans.filter((p: any) => validTypes.includes(p.type.toLowerCase()));
}

// Lista de planos de um app - texto com lista (WhatsApp não renderiza botões)
function formatPlansList(app: any): InteractiveMessage {
  const validPlans = filterValidPlans(app.plans || []);
  
  if (validPlans.length === 0) {
    return {
      type: 'text',
      text: `📱 *${app.name}*\n\n⚠️ Nenhum plano disponível no momento.\n\nDigite *0* para voltar.`,
    };
  }

  const lines = validPlans.map((plan: any, i: number) => {
    const planName = getPlanNameDisplay(plan.type);
    return `${i + 1}️⃣ *${planName}* - R$ ${plan.price.toFixed(2)}`;
  });
  
  const text = `📱 *${app.name.toUpperCase()}*\n\n💳 PIX Copia e Cola • Entrega Automática\n🔒 100% Seguro\n\n*Digite o número do plano desejado:*\n\n${lines.join('\n')}\n\n0️⃣ Voltar`;
  
  return { type: 'text', text };
}

// Confirmação de pedido com PIX
async function formatOrderConfirmation(
  appName: string,
  planType: string,
  price: number,
  qrCode: string,
  discount: number = 0,
  qrCodeImage?: string | null
): InteractiveMessage | InteractiveMessage[] {
  const planName = getPlanNameDisplay(planType);
  const originalPrice = price + discount;

  let caption = `✅ *PEDIDO CONFIRMADO!*\n\n`;
  caption += `📱 *App:* ${appName}\n`;
  caption += `⏰ *Plano:* ${planName}\n`;
  if (discount > 0) {
    caption += `💰 *Valor Original:* ~R$ ${originalPrice.toFixed(2)}~\n`;
    caption += `🎁 *Desconto:* R$ ${discount.toFixed(2)}\n`;
    caption += `✨ *Valor Final:* R$ ${price.toFixed(2)}\n`;
  } else {
    caption += `💰 *Valor:* R$ ${price.toFixed(2)}\n`;
  }
  caption += `\n━━━━━━━━━━━━━━━━━━\n`;
  caption += `🔐 *PIX - Escaneie o QR Code ou copie o código da mensagem anterior*\n`;
  caption += `━━━━━━━━━━━━━━━━━━\n\n`;
  caption += `✨ *Seu código será enviado AUTOMATICAMENTE após o pagamento!*\n\n`;
  caption += `⏰ O PIX expira em 30 minutos\n\n`;
  caption += `Digite:\n*1* - Ver status do pedido\n*0* - Voltar ao menu`;

  // Resolver imagem do QR: usar a fornecida ou gerar a partir do código
  let finalQrImage: string | null = null;
  if (qrCodeImage && qrCodeImage.length > 50) {
    finalQrImage = qrCodeImage.startsWith('data:') ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`;
  } else if (qrCode && qrCode.length > 20) {
    try {
      const QRCode = require('qrcode');
      finalQrImage = await QRCode.toDataURL(qrCode, { width: 400, margin: 2 });
    } catch (e) {
      console.warn('[PIX] Erro ao gerar QR a partir do código:', e);
    }
  }

  const messages: InteractiveMessage[] = [];

  // 1) Código PIX PRIMEIRO, sozinho (uma mensagem = toque e copia fácil)
  if (qrCode) {
    messages.push({
      type: 'text',
      text: qrCode,
    });
  }

  // 2) Imagem do QR + detalhes do pedido (ou só detalhes se não tiver imagem)
  if (finalQrImage) {
    messages.push({
      type: 'image',
      imageUrl: finalQrImage,
      caption,
    });
  } else if (qrCode) {
    messages.push({
      type: 'text',
      text: caption,
    });
  }

  if (messages.length > 0) {
    return messages;
  }

  // Fallback: tudo em texto (não deveria chegar aqui se tiver qrCode)
  return {
    type: 'text',
    text: `${caption}\n\n📋 *CÓDIGO PIX:*\n\n${qrCode || '(código não disponível)'}`,
  };
}

// Confirmação manual
function formatOrderConfirmationManual(
  appName: string,
  planType: string,
  price: number,
  pixKey: string,
  pixName: string,
  discount: number = 0
): InteractiveMessage {
  const planName = getPlanNameDisplay(planType);
  const originalPrice = price + discount;

  let text = `✅ *PEDIDO CONFIRMADO!*\n\n`;
  text += `📱 *App:* ${appName}\n`;
  text += `⏰ *Plano:* ${planName}\n`;
  
  if (discount > 0) {
    text += `💰 *Valor Original:* ~R$ ${originalPrice.toFixed(2)}~\n`;
    text += `🎁 *Desconto:* R$ ${discount.toFixed(2)}\n`;
    text += `✨ *Valor Final:* R$ ${price.toFixed(2)}\n`;
  } else {
    text += `💰 *Valor:* R$ ${price.toFixed(2)}\n`;
  }

  text += `\n━━━━━━━━━━━━━━━━━━\n`;
  text += `💳 *DADOS PARA PAGAMENTO*\n`;
  text += `━━━━━━━━━━━━━━━━━━\n\n`;
  text += `📲 *Chave PIX:* ${pixKey}\n`;
  text += `👤 *Nome:* ${pixName}\n`;
  text += `💵 *Valor:* R$ ${price.toFixed(2)}\n\n`;
  text += `⚠️ Após o pagamento, aguarde a confirmação.\n\n`;
  text += `Digite:\n`;
  text += `*1* - Ver status do pedido\n`;
  text += `*0* - Voltar ao menu`;

  return {
    type: 'text',
    text,
  };
}

// Mensagem de suporte humanizado
async function formatHumanSupport(): Promise<InteractiveMessage> {
  const msg = await getConfig('human_mode_message') ||
    `🧑 *SUPORTE HUMANIZADO*\n\nVocê será atendido por um de nossos atendentes em breve.\n\n⏰ Horário de atendimento:\n*Segunda a Sexta:* 9h às 18h\n*Sábado:* 9h às 14h\n\nAguarde que logo responderemos!\n\n_Digite *bot* para voltar ao atendimento automático._`;
  return { type: 'text', text: msg };
}

// Mensagem de instalação
async function formatInstallation(): Promise<InteractiveMessage> {
  const installText = await getConfig('installation_text') || 
    `📲 *INSTALAÇÃO*\n\n*Passos para instalar seu app:*\n\n1️⃣ Baixe o aplicativo na loja do seu dispositivo\n2️⃣ Abra o app e clique em "Ativar"\n3️⃣ Cole o código recebido\n4️⃣ Pronto! Aproveite!\n\n⚠️ *IMPORTANTE:*\n- Vincule o código ao seu celular, e-mail e crie uma senha\n- Código de recarga é utilizado apenas 1 vez\n\nDúvidas? Digite *2* para suporte humanizado.\n\nDigite *0* para voltar ao menu.`;
  
  return {
    type: 'text',
    text: installText,
  };
}

// Mensagem de meus pedidos
async function formatMyOrders(phoneNumber: string): Promise<InteractiveMessage> {
  const orders = await prisma.order.findMany({
    where: { clientPhone: phoneNumber },
    include: { app: true, plan: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (orders.length === 0) {
    return {
      type: 'text',
      text: `📝 *MEUS PEDIDOS*\n\nVocê ainda não tem pedidos.\n\nDigite *1* para comprar recargas!\nDigite *0* para voltar ao menu.`,
    };
  }

  let text = `📝 *MEUS PEDIDOS*\n\n`;
  
  orders.forEach((order, index) => {
    const statusEmoji = order.status === 'code_sent' ? '✅' : 
                        order.status === 'paid' ? '💳' : '⏳';
    const statusText = order.status === 'code_sent' ? 'Entregue' :
                       order.status === 'paid' ? 'Pago' : 'Pendente';
    const date = new Date(order.createdAt).toLocaleDateString('pt-BR');
    
    text += `${statusEmoji} *${order.app.name}* - ${order.plan?.type || 'Plano'}\n`;
    text += `   💰 R$ ${order.amount.toFixed(2)} | ${statusText} | ${date}\n\n`;
  });

  text += `Digite *0* para voltar ao menu.`;

  return {
    type: 'text',
    text,
  };
}

// Mensagem sobre nós
async function formatAboutUs(): Promise<InteractiveMessage> {
  const aboutText = await getConfig('about_us_text') ||
    `ℹ️ *SOBRE NÓS*\n\n🎯 *Universal Recargas*\n\nSomos especializados na venda de códigos de ativação para aplicativos de streaming.\n\n✅ Entrega automática\n✅ Pagamento seguro via PIX\n✅ Suporte humanizado\n✅ Melhor preço do mercado\n\n📱 Trabalhamos com as principais plataformas!\n\nDigite *0* para voltar ao menu.`;

  return {
    type: 'text',
    text: aboutText,
  };
}

// Texto de entrega de código
async function formatCodeDelivery(code: string, appName: string, planType: string): Promise<InteractiveMessage> {
  const extraText = await getConfig('code_delivery_text') || 
    `Muita atenção após colocar seu código!\n\n⚠️ *IMPORTANTE:*\n- Vincule o código ao celular, e-mail e crie sua senha\n- Código de recarga é utilizado apenas 1 vez, após isso fica inválido\n\n🌟 Obrigado por escolher nossos serviços! 🌟`;

  const planName = getPlanNameDisplay(planType);

  return {
    type: 'text',
    text: `🎉 *CÓDIGO ENTREGUE COM SUCESSO!*\n\n📱 *App:* ${appName}\n⏰ *Plano:* ${planName}\n\n🔑 *Seu código de ativação:*\n\n\`\`\`${code}\`\`\`\n\n${extraText}\n\nDigite *0* para voltar ao menu.`,
  };
}

// ==========================================
// PROCESSAR MENSAGEM RECEBIDA
// ==========================================
// Normaliza telefone para lookup consistente (evita 11999999999 vs 5511999999999)
function normalizePhoneForLookup(phone: string): string {
  if (!phone || typeof phone !== 'string') return phone || '';
  if (phone.startsWith('tg_')) return phone; // Telegram: preservar tg_chatId
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

export async function processIncomingMessage(
  phoneNumber: string,
  messageText: string,
  clientNameOrPlatform?: string,
  platform: 'whatsapp' | 'telegram' = 'whatsapp'
): Promise<InteractiveMessage | InteractiveMessage[] | null> {
  const phone = normalizePhoneForLookup(phoneNumber);
  let clientName = 'Cliente';
  if (clientNameOrPlatform === 'telegram' || clientNameOrPlatform === 'whatsapp') {
    platform = clientNameOrPlatform;
  } else if (clientNameOrPlatform) {
    clientName = clientNameOrPlatform;
  }
  
  const text = messageText.trim().toLowerCase();

  // Buscar última conversa (usando phone normalizado)
  const lastConversation = await prisma.conversation.findFirst({
    where: { phoneNumber: phone },
    orderBy: { createdAt: 'desc' },
  });

  const currentState = lastConversation?.state || ConversationState.MENU;
  const context: ConversationContext = (lastConversation?.context as ConversationContext) || {};

  // Verificar se está em modo humano
  const isHumanMode = lastConversation?.humanMode === true;

  // Salvar mensagem recebida
  await saveMessage(phone, clientName, messageText, 'INBOUND', currentState, context);

  // Se está em modo humano
  if (isHumanMode) {
    if (text === 'bot' || text === 'voltar bot' || text === 'ativar bot') {
      await prisma.conversation.updateMany({
        where: { phoneNumber: phone },
        data: { humanMode: false },
      });
      return formatMainMenu(clientName);
    }
    return null;
  }

  // ==========================================
  // COMANDOS DO MENU PRINCIPAL
  // ==========================================

  // Voltar ao menu (0, menu, inicio, oi, olá)
  if (text === '0' || text === 'menu' || text === 'inicio' || text === 'oi' || text === 'olá' || text === 'ola' || text === 'hi' || text === 'hello') {
    await saveMessage(phone, clientName, '', 'OUTBOUND', ConversationState.MENU, {});
    return formatMainMenu(clientName);
  }

  // ==========================================
  // ESTADO: MENU PRINCIPAL
  // ==========================================
  if (currentState === ConversationState.MENU || !currentState) {
    // 1 - Comprar Recargas
    if (text === '1' || text === 'comprar' || text === 'recargas') {
      await saveMessage(phone, clientName, '', 'OUTBOUND', ConversationState.SELECTING_APP, {});
      return formatAppsList();
    }

    // 2 - Suporte Humanizado
    if (text === '2' || text === 'suporte' || text === 'atendente' || text === 'humano') {
      await prisma.conversation.updateMany({
        where: { phoneNumber: phone },
        data: { humanMode: true },
      });
      await saveMessage(phone, clientName, '', 'OUTBOUND', ConversationState.HUMAN_SUPPORT, {});
      return await formatHumanSupport();
    }

    // 3 - Instalação
    if (text === '3' || text === 'instalação' || text === 'instalar' || text === 'tutorial') {
      return formatInstallation();
    }

    // 4 - Meus Pedidos
    if (text === '4' || text === 'pedidos' || text === 'meus pedidos') {
      return formatMyOrders(phone);
    }
    
    // 5 - Sobre Nós
    if (text === '5' || text === 'sobre') {
      return formatAboutUs();
    }

    // ==========================================
    // IA INTELIGENTE PARA MENSAGENS NÃO RECONHECIDAS
    // ==========================================
    
    // Detectar intenção da mensagem
    const { intent, confidence, entities } = detectIntent(messageText);
    console.log(`[BOT-AI] Intenção: ${intent} (${(confidence * 100).toFixed(0)}%) | Entidades:`, entities);
    
    // Analisar sentimento
    const sentiment = analyzeSentiment(messageText);
    if (sentiment === 'negative') {
      console.log('[BOT-AI] Sentimento negativo detectado - priorizando atendimento');
    }
    
    // Buscar perfil e histórico do cliente para contexto rico
    const customerProfile = await getCustomerProfile(phone);
    const conversationHistory = await getConversationHistory(phone, 8);

    // Buscar último pedido
    let lastOrder = undefined;
    if (customerProfile && customerProfile.totalOrders > 0) {
      const recentOrder = await prisma.order.findFirst({
        where: { clientPhone: phone },
        include: { app: true, plan: true },
        orderBy: { createdAt: 'desc' },
      });
      if (recentOrder) {
        lastOrder = {
          app: recentOrder.app?.name || 'App',
          plan: recentOrder.plan?.type || 'mensal',
          status: recentOrder.status,
          date: recentOrder.createdAt.toISOString(),
        };
      }
    }
    
    // Se intenção clara de compra, direcionar para menu
    if (intent === 'purchase_intent' && confidence > 0.8) {
      if (entities.app) {
        // Cliente quer app específico - mostrar planos direto
        const apps = await getActiveApps();
        const targetApp = apps.find(a => 
          a.name.toLowerCase().includes(entities.app.toLowerCase())
        );
        if (targetApp) {
          await prisma.conversation.create({
            data: {
              phoneNumber: phone,
              clientName,
              message: messageText,
              direction: 'incoming',
              state: ConversationState.SELECTING_PLAN,
              context: { appId: targetApp.id },
            },
          });
          return formatPlansList(targetApp);
        }
      }
      return formatMainMenu(clientName);
    }
    
    // Se pedido de status, mostrar pedidos
    if (intent === 'order_status' && confidence > 0.8 && customerProfile && customerProfile.totalOrders > 0) {
      return await formatMyOrders(phone);
    }
    
    // Se problema/suporte, oferecer ajuda humana
    if (intent === 'support_issue' && confidence > 0.8) {
      return { 
        type: 'text', 
        text: `Entendo que você está com um problema! 😟\n\nPara resolver mais rápido, digite *5* para falar com nosso suporte humano.\n\nOu me conte mais detalhes do que está acontecendo.` 
      };
    }
    
    // ==========================================
    // AGENTE IA INTELIGENTE - ARIA
    // ==========================================
    
    // Verificar se é um telefone admin (pode executar ações)
    const adminPhones = (process.env.ADMIN_PHONES || '').split(',').map(p => p.trim()).filter(p => p);
    const isAdmin = adminPhones.includes(phone) || adminPhones.some(p => phone.includes(p));
    
    // Verificar se a mensagem requer ações do agente (criar, editar, deletar, etc.)
    const needsAgentAction = requiresAgentAction(messageText);
    
    // Se é admin e requer ação, usar agente completo
    if (isAdmin && needsAgentAction) {
      console.log(`[BOT-AGENT] Admin detectado: ${phone} - Executando agente inteligente`);

      try {
        const agentContext: AgentContext = {
          phoneNumber: phone,
          customerName: clientName,
          isAdmin: true
        };
        
        const agentResult = await runAgent(messageText, agentContext);
        
        if (agentResult.message) {
          // Se houve ações executadas, mostrar resumo
          if (agentResult.actions && agentResult.actions.length > 0) {
            const actionsSummary = agentResult.actions
              .map(a => `✓ ${a.tool}: ${a.result.success ? 'OK' : 'Erro'}`)
              .join('\n');
            
            return { 
              type: 'text', 
              text: `${agentResult.message}\n\n📋 *Ações executadas:*\n${actionsSummary}` 
            };
          }
          
          return { type: 'text', text: agentResult.message };
        }
      } catch (e) {
        console.error('[BOT-AGENT] Erro no agente:', e);
      }
    }
    
    // Para outras intenções ou mensagens gerais, usar IA generativa
    const aiAutoResponse = await getConfig('ai_auto_response');
    
    // IA sempre ativa para saudações e agradecimentos (mais natural)
    const alwaysUseAI = ['greeting', 'thanks', 'goodbye'].includes(intent);
    
    // Para não-admins ou mensagens simples, usar IA normal
    if (aiAutoResponse === 'true' || alwaysUseAI) {
      try {
        // Se não é admin mas a mensagem parece querer ação, usar agente em modo limitado
        if (needsAgentAction) {
          console.log(`[BOT-AGENT] Usuário comum solicitando informações via agente`);
          
          const agentContext: AgentContext = {
            phoneNumber: phone,
            customerName: clientName,
            isAdmin: false
          };
          
          const agentResult = await runAgent(messageText, agentContext);
          if (agentResult.message) {
            return { type: 'text', text: agentResult.message };
          }
        }
        
        const aiContext: AIContext = {
          customerName: clientName,
          customerPhone: phone,
          lastOrder,
          conversationHistory: conversationHistory.map(c => ({
            role: c.role,
            message: c.message,
          })),
          customerProfile: customerProfile || undefined,
        };
        
        const aiResponse = await generateAIResponse(messageText, aiContext);
        if (aiResponse) {
          return { type: 'text', text: aiResponse };
        }
      } catch (e) {
        console.error('[BOT-AI] Erro:', e);
      }
    }

    // Fallback: Retornar menu principal
    return formatMainMenu(clientName);
  }

  // ==========================================
  // ESTADO: SELECIONANDO APP
  // ==========================================
  if (currentState === ConversationState.SELECTING_APP) {
    if (text === '0') return formatMainMenu(clientName);
    
    const apps = await getActiveApps();
    const appIndex = parseInt(text, 10) - 1;
    
    if (appIndex >= 0 && appIndex < apps.length) {
      const selectedApp = apps[appIndex];
      await saveMessage(phone, clientName, '', 'OUTBOUND', ConversationState.SELECTING_PLAN, { appId: selectedApp.id });
      
      // Enviar imagem do app se existir
      const messages: InteractiveMessage[] = [];
      
      if (selectedApp.bannerUrl || selectedApp.logoUrl) {
        messages.push({
          type: 'image',
          imageUrl: selectedApp.bannerUrl || selectedApp.logoUrl || '',
          caption: `📱 *${selectedApp.name}*`,
        });
      }
      
      messages.push(formatPlansList(selectedApp));
      return messages;
    }
    
    // Número inválido - reenviar lista de apps
    return await formatAppsList();
  }

  // ==========================================
  // ESTADO: SELECIONANDO PLANO
  // ==========================================
  if (currentState === ConversationState.SELECTING_PLAN) {
    const app = await prisma.app.findUnique({
      where: { id: context.appId },
      include: { plans: { where: { isActive: true }, orderBy: { price: 'asc' } } },
    });

    if (!app) {
      return formatMainMenu(clientName);
    }

    const validPlans = filterValidPlans(app.plans);
    const planIndex = parseInt(text) - 1;
    
    if (planIndex >= 0 && planIndex < validPlans.length) {
      const selectedPlan = validPlans[planIndex];
      
      // Verificar estoque
      const hasStock = await hasAvailableCode(selectedPlan.id);
      if (!hasStock) {
        return {
          type: 'text',
          text: `⚠️ *SEM ESTOQUE*\n\nO plano ${getPlanNameDisplay(selectedPlan.type)} de ${app.name} está sem estoque no momento.\n\nDigite *0* para escolher outro plano.`,
        };
      }

      // Verificar se cupom está habilitado
      const showCoupon = await getConfig('show_coupon_option');
      if (showCoupon === 'true') {
        await saveMessage(phone, clientName, '', 'OUTBOUND', ConversationState.ENTERING_COUPON, { 
          appId: context.appId, 
          planId: selectedPlan.id 
        });
        
        return {
          type: 'text',
          text: `📱 *${app.name}* - ${getPlanNameDisplay(selectedPlan.type)}\n💰 *Valor:* R$ ${selectedPlan.price.toFixed(2)}\n\n🎟️ *Você tem cupom de desconto?*\n\n*1* - Sim, tenho cupom\n*2* - Não, continuar sem cupom\n*0* - Voltar`,
        };
      }

      // Verificar se há mais de uma forma de pagamento - mostrar escolha
      const cardEnabled = await getConfig('card_enabled') === 'true';
      const transferEnabled = await getConfig('transfer_enabled') === 'true';
      if (cardEnabled || transferEnabled) {
        await saveMessage(phone, clientName, '', 'OUTBOUND', ConversationState.SELECTING_PAYMENT_METHOD, { 
          appId: context.appId, 
          planId: selectedPlan.id,
          discount: 0,
        });
        return {
          type: 'text',
          text: await formatPaymentMethodOptions(app.name, getPlanNameDisplay(selectedPlan.type), selectedPlan.price, 0),
        };
      }

      // Ir direto para criar pedido PIX
      return await createOrderAndGeneratePix(phone, clientName, app, selectedPlan, 0);
    }
    
    return {
      type: 'text',
      text: '❌ Opção inválida. Digite o número do plano desejado ou *0* para voltar.',
    };
  }

  // ==========================================
  // ESTADO: ENTRANDO CUPOM
  // ==========================================
  if (currentState === ConversationState.ENTERING_COUPON) {
    // 1 - Tem cupom
    if (text === '1' || text === 'sim') {
      return {
        type: 'text',
        text: '🎟️ *CUPOM DE DESCONTO*\n\nDigite o código do seu cupom:',
      };
    }
    
    // 2 - Não tem cupom
    if (text === '2' || text === 'não' || text === 'nao') {
      const app = await prisma.app.findUnique({
        where: { id: context.appId },
        include: { plans: true },
      });
      const plan = await prisma.plan.findUnique({ where: { id: context.planId } });
      
      if (!app || !plan) {
        return formatMainMenu(clientName);
      }

      const cardEnabled = await getConfig('card_enabled') === 'true';
      const transferEnabled = await getConfig('transfer_enabled') === 'true';
      if (cardEnabled || transferEnabled) {
        await saveMessage(phone, clientName, '', 'OUTBOUND', ConversationState.SELECTING_PAYMENT_METHOD, { 
          appId: context.appId, 
          planId: context.planId,
          discount: 0,
        });
        return {
          type: 'text',
          text: await formatPaymentMethodOptions(app.name, getPlanNameDisplay(plan.type), plan.price, 0),
        };
      }
      
      return await createOrderAndGeneratePix(phone, clientName, app, plan, 0);
    }
    
    // Validar cupom
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: text.toUpperCase(),
        isActive: true,
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } },
        ],
      },
    });

    if (!coupon) {
      return {
        type: 'text',
        text: '❌ *Cupom inválido ou expirado!*\n\nDigite outro cupom ou:\n*2* - Continuar sem cupom\n*0* - Voltar ao menu',
      };
    }

    // Verificar uso máximo
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return {
        type: 'text',
        text: '❌ *Cupom esgotado!*\n\nEste cupom já foi usado o número máximo de vezes.\n\n*2* - Continuar sem cupom\n*0* - Voltar ao menu',
      };
    }

    const app = await prisma.app.findUnique({
      where: { id: context.appId },
      include: { plans: true },
    });
    const plan = await prisma.plan.findUnique({ where: { id: context.planId } });
    
    if (!app || !plan) {
      return formatMainMenu(clientName);
    }

    // Calcular desconto
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (plan.price * coupon.discountValue) / 100;
    } else {
      discount = coupon.discountValue;
    }
    discount = Math.min(discount, plan.price);

    // Verificar valor mínimo
    if (coupon.minAmount && plan.price < coupon.minAmount) {
      return {
        type: 'text',
        text: `❌ *Cupom não aplicável!*\n\nEste cupom requer um valor mínimo de R$ ${coupon.minAmount.toFixed(2)}.\n\n*2* - Continuar sem cupom\n*0* - Voltar ao menu`,
      };
    }

    // Incrementar uso do cupom
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });

    const cardEnabled = await getConfig('card_enabled') === 'true';
    const transferEnabled = await getConfig('transfer_enabled') === 'true';
    if (cardEnabled || transferEnabled) {
      const finalPrice = Math.max(0, plan.price - discount);
      await saveMessage(phone, clientName, '', 'OUTBOUND', ConversationState.SELECTING_PAYMENT_METHOD, { 
        appId: context.appId, 
        planId: context.planId,
        discount,
        couponCode: coupon.code,
      });
      return {
        type: 'text',
        text: await formatPaymentMethodOptions(app.name, getPlanNameDisplay(plan.type), finalPrice, discount, plan.price),
      };
    }

    return await createOrderAndGeneratePix(phone, clientName, app, plan, discount, coupon.code);
  }

  // ==========================================
  // ESTADO: SELECIONANDO FORMA DE PAGAMENTO
  // ==========================================
  if (currentState === ConversationState.SELECTING_PAYMENT_METHOD) {
    if (text === '0') {
      return formatMainMenu(clientName);
    }

    if (text === '1') {
      // PIX
      const app = await prisma.app.findUnique({
        where: { id: context.appId },
        include: { plans: true },
      });
      const plan = await prisma.plan.findUnique({ where: { id: context.planId } });
      if (!app || !plan) return formatMainMenu(clientName);
      const discount = context.discount ?? 0;
      return await createOrderAndGeneratePix(phone, clientName, app, plan, discount, context.couponCode);
    }

    if (text === '2') {
      // Cartão - criar pedido e enviar link Mercado Pago
      const app = await prisma.app.findUnique({
        where: { id: context.appId },
        include: { plans: true },
      });
      const plan = await prisma.plan.findUnique({ where: { id: context.planId } });
      if (!app || !plan) return formatMainMenu(clientName);
      const discount = context.discount ?? 0;
      return await createOrderAndSendCardLink(phone, clientName, app, plan, discount, context.couponCode);
    }

    if (text === '3') {
      // Transferência bancária
      const app = await prisma.app.findUnique({
        where: { id: context.appId },
        include: { plans: true },
      });
      const plan = await prisma.plan.findUnique({ where: { id: context.planId } });
      if (!app || !plan) return formatMainMenu(clientName);
      const discount = context.discount ?? 0;
      return await createOrderAndSendTransferInfo(phone, clientName, app, plan, discount, context.couponCode);
    }

    const cardEnabled = await getConfig('card_enabled') === 'true';
    const transferEnabled = await getConfig('transfer_enabled') === 'true';
    let errMsg = '❌ Opção inválida. Digite *1* para PIX';
    if (cardEnabled) errMsg += ', *2* para Cartão';
    if (transferEnabled) errMsg += ', *3* para Transferência';
    errMsg += ' ou *0* para voltar.';
    return { type: 'text', text: errMsg };
  }

  // ==========================================
  // ESTADO: AGUARDANDO PAGAMENTO
  // ==========================================
  if (currentState === ConversationState.AWAITING_PAYMENT) {
    // 1 - Ver status
    if (text === '1' || text === 'status') {
      const order = await prisma.order.findUnique({
        where: { id: context.orderId },
        include: { app: true, plan: true },
      });

      if (!order) {
        return {
          type: 'text',
          text: '❌ Pedido não encontrado.\n\nDigite *0* para voltar ao menu.',
        };
      }

      const statusEmoji = order.status === 'code_sent' ? '✅' : 
                          order.status === 'paid' ? '💳' : '⏳';
      const statusText = order.status === 'code_sent' ? 'Código Enviado' :
                         order.status === 'paid' ? 'Pago - Aguardando envio' : 'Aguardando Pagamento';

      return {
        type: 'text',
        text: `📋 *STATUS DO PEDIDO*\n\n📱 *App:* ${order.app.name}\n⏰ *Plano:* ${order.plan?.type || '-'}\n💰 *Valor:* R$ ${order.amount.toFixed(2)}\n\n${statusEmoji} *Status:* ${statusText}\n\nDigite *0* para voltar ao menu.`,
      };
    }
  }

  // Default: mostrar menu
  return formatMainMenu(clientName);
}

// ==========================================
// CRIAR PEDIDO E ENVIAR LINK CARTÃO
// ==========================================
async function createOrderAndSendCardLink(
  phoneNumber: string,
  clientName: string,
  app: any,
  plan: any,
  discount: number,
  couponCode?: string
): Promise<InteractiveMessage> {
  const activeProvider = (await getConfig('active_pix_provider') || await getConfig('active_provider')) || 'getnet';
  if (activeProvider !== 'mercadopago' || !hasMercadoPagoCredentials()) {
    return {
      type: 'text',
      text: `❌ *Cartão indisponível*\n\nO pagamento com cartão está disponível apenas com Mercado Pago. Configure o Mercado Pago como gateway ativo em Configurações > Pagamentos.\n\nDigite *1* para pagar com PIX ou *0* para voltar.`,
    };
  }

  const order = await createOrder(phoneNumber, clientName, app.id, plan.id, discount);
  if (!order) {
    return {
      type: 'text',
      text: '❌ Erro ao criar pedido. Tente novamente.\n\nDigite *0* para voltar ao menu.',
    };
  }

  const title = `Recarga ${app.name} - ${getPlanNameDisplay(plan.type)}`;
  const result = await createMercadoPagoCheckoutLink(order.id, title, order.amount, undefined);

  if (!result.success || !result.checkoutUrl) {
    return {
      type: 'text',
      text: `❌ Não foi possível gerar o link de pagamento. ${result.error || ''}\n\n*1* - Tentar com PIX\n*0* - Voltar ao menu`,
    };
  }

  await saveMessage(phoneNumber, clientName, '', 'OUTBOUND', ConversationState.AWAITING_PAYMENT, { 
    orderId: order.id,
    couponCode,
    discount,
  });

  const msg = `💳 *PAGAMENTO COM CARTÃO*\n\n` +
    `📱 *App:* ${app.name}\n` +
    `⏰ *Plano:* ${getPlanNameDisplay(plan.type)}\n` +
    `💰 *Valor:* R$ ${order.amount.toFixed(2)}\n\n` +
    `🔗 *Clique no link abaixo para pagar com cartão:*\n\n` +
    `${result.checkoutUrl}\n\n` +
    `✨ *Seu código será enviado automaticamente após o pagamento!*\n\n` +
    `Digite *1* - Ver status do pedido\n` +
    `Digite *0* - Voltar ao menu`;

  return { type: 'text', text: msg };
}

// ==========================================
// CRIAR PEDIDO E ENVIAR DADOS TRANSFERÊNCIA
// ==========================================
async function createOrderAndSendTransferInfo(
  phoneNumber: string,
  clientName: string,
  app: any,
  plan: any,
  discount: number,
  couponCode?: string
): Promise<InteractiveMessage> {
  const bankName = await getConfig('bank_name');
  const bankAgency = await getConfig('bank_agency');
  const bankAccount = await getConfig('bank_account');
  const bankAccountType = await getConfig('bank_account_type') || 'CPF';
  const beneficiaryName = await getConfig('beneficiary_name') || 'Universal Recargas';

  if (!bankName || !bankAgency || !bankAccount) {
    return {
      type: 'text',
      text: `❌ *Transferência indisponível*\n\nOs dados bancários não estão configurados. Configure em Configurações > Pagamentos > Transferência.\n\nDigite *1* para PIX ou *0* para voltar.`,
    };
  }

  const order = await createOrder(phoneNumber, clientName, app.id, plan.id, discount);
  if (!order) {
    return {
      type: 'text',
      text: '❌ Erro ao criar pedido. Tente novamente.\n\nDigite *0* para voltar ao menu.',
    };
  }

  await saveMessage(phoneNumber, clientName, '', 'OUTBOUND', ConversationState.AWAITING_PAYMENT, { 
    orderId: order.id,
    couponCode,
    discount,
  });

  const msg = `🏦 *PAGAMENTO VIA TRANSFERÊNCIA*\n\n` +
    `📱 *App:* ${app.name}\n` +
    `⏰ *Plano:* ${getPlanNameDisplay(plan.type)}\n` +
    `💰 *Valor:* R$ ${order.amount.toFixed(2)}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `*DADOS PARA TRANSFERÊNCIA:*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🏛️ *Banco:* ${bankName}\n` +
    `📍 *Agência:* ${bankAgency}\n` +
    `💳 *Conta:* ${bankAccount}\n` +
    `📋 *Tipo:* ${bankAccountType}\n` +
    `👤 *Favorecido:* ${beneficiaryName}\n\n` +
    `⚠️ *Envie o comprovante* após a transferência para agilizar a confirmação.\n\n` +
    `Digite *1* - Ver status do pedido\n` +
    `Digite *0* - Voltar ao menu`;

  return { type: 'text', text: msg };
}

// ==========================================
// CRIAR PEDIDO E GERAR PIX
// ==========================================
async function createOrderAndGeneratePix(
  phoneNumber: string,
  clientName: string,
  app: any,
  plan: any,
  discount: number,
  couponCode?: string
): Promise<InteractiveMessage> {
  // Criar pedido
  const order = await createOrder(phoneNumber, clientName, app.id, plan.id, discount);
  
  if (!order) {
    return {
      type: 'text',
      text: '❌ Erro ao criar pedido. Tente novamente.\n\nDigite *0* para voltar ao menu.',
    };
  }

  const finalPrice = order.amount;

  // Verificar se PIX automático está habilitado
  const pixAutoEnabled = await getConfig('pix_auto_enabled');
  const activeProvider = (await getConfig('active_pix_provider') || await getConfig('active_provider')) as PixProvider || 'getnet';
  
  // Tentar PIX automático
  if (pixAutoEnabled === 'true') {
    const hasCredentials = await hasProviderCredentials(activeProvider);
    
    if (hasCredentials) {
      try {
        const pixResult = await createUnifiedPix(
          activeProvider,
          finalPrice,
          order.id,
          phoneNumber
        );

        if (pixResult.success && pixResult.qrCode) {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentId: pixResult.paymentId || undefined },
          });
          await saveMessage(phoneNumber, clientName, '', 'OUTBOUND', ConversationState.AWAITING_PAYMENT, { 
            orderId: order.id,
            couponCode,
            discount,
          });
          
          return await formatOrderConfirmation(
            app.name,
            plan.type,
            finalPrice,
            pixResult.qrCode,
            discount,
            pixResult.qrCodeImage
          );
        }
      } catch (error) {
        console.error('Erro PIX automático:', error);
      }
    }
  }

  // Fallback: PIX manual
  const pixManualEnabled = await getConfig('pix_manual_enabled');
  const pixKey = await getConfig('pix_key');
  const pixName = await getConfig('pix_name') || 'Universal Recargas';
  
  if (pixManualEnabled === 'true' && pixKey) {
    await saveMessage(phoneNumber, clientName, '', 'OUTBOUND', ConversationState.AWAITING_PAYMENT, { 
      orderId: order.id,
      couponCode,
      discount,
    });
    
    return formatOrderConfirmationManual(app.name, plan.type, finalPrice, pixKey, pixName, discount);
  }

  // Nenhum método de pagamento configurado
  return {
    type: 'text',
    text: `❌ *Erro no sistema de pagamento*\n\nNão foi possível gerar o PIX. Entre em contato com o suporte.\n\nDigite *2* para suporte humanizado.\nDigite *0* para voltar ao menu.`,
  };
}

// Formatar mensagem como texto simples (fallback)
export function formatSimpleMessage(msg: InteractiveMessage): string {
  let text = msg.text || msg.caption || '';
  
  if (msg.buttons && msg.buttons.length > 0) {
    text += '\n\n';
    msg.buttons.forEach((btn, i) => {
      text += `${i + 1}. ${btn.title}\n`;
    });
  }
  
  if (msg.listSections) {
    msg.listSections.forEach(section => {
      text += `\n*${section.title}*\n`;
      section.rows.forEach((row, i) => {
        text += `${i + 1}. ${row.title}`;
        if (row.description) text += ` - ${row.description}`;
        text += '\n';
      });
    });
  }
  
  if (msg.footer) {
    text += `\n_${msg.footer}_`;
  }
  
  return text;
}
