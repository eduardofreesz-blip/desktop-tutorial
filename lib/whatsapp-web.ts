import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
import path from "path";

export type WAStatusState = {
  status: "disconnected" | "connecting" | "connected" | "qr_ready";
  phone: string;
  code: string | null;
  qrCode: string | null;
  reason: string | null;
  lastChangeAt: number;
  lastError: string;
};

const logger = pino({ level: "silent" });

const AUTH_DIR = process.env.WA_AUTH_DIR || path.join(process.cwd(), "wa_auth");

let sock: WASocket | null = null;
let initPromise: Promise<WASocket> | null = null;

const waState: WAStatusState = {
  status: "disconnected",
  phone: "",
  code: null,
  qrCode: null,
  reason: null,
  lastChangeAt: Date.now(),
  lastError: "",
};

function touchState(patch: Partial<WAStatusState>) {
  Object.assign(waState, patch);
  waState.lastChangeAt = Date.now();
}

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function normalizePhone(phone: string) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function buildProxyAgentIfAny() {
  // Se você usar WA_PROXY_URL, a lib que cria agente depende do seu projeto.
  // Aqui deixo "no-op" (não quebra build). Se quiser proxy real, a gente coloca depois.
  // Importante: NÃO logar credenciais.
  return undefined as any;
}

export async function initWA(): Promise<WASocket> {
  if (sock) return sock;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ensureAuthDir();

    touchState({ status: "connecting", reason: null, lastError: "" });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const s = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      browser: ["UniversalRecargas", "Chrome", "1.0.0"],
      // proxy: (se seu projeto usar algum wrapper) -> aqui mantemos sem quebrar
      agent: buildProxyAgentIfAny(),
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    s.ev.on("creds.update", saveCreds);

    s.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update || {};

      if (qr) {
        const QRCode = require('qrcode');
        QRCode.toDataURL(qr, { width: 256, margin: 2 })
          .then((qrDataUrl: string) => {
            touchState({ qrCode: qrDataUrl, status: "qr_ready" as any });
            console.log("[WhatsApp] QR Code gerado - escaneie com seu celular");
          })
          .catch(() => {
            touchState({ qrCode: qr, status: "qr_ready" as any });
            console.log("[WhatsApp] QR Code gerado (texto)");
          });
      }

      if (connection === "open") {
        touchState({
          status: "connected",
          reason: "USER_ACTIVATED",
          lastError: "",
          qrCode: null,
        });
      }

      if (connection === "close") {
        const boom = lastDisconnect?.error as Boom | undefined;
        const code = boom?.output?.statusCode;

        const reason =
          code === DisconnectReason.loggedOut
            ? "LOGGED_OUT"
            : code === DisconnectReason.connectionClosed
              ? "CONNECTION_CLOSED"
              : code === DisconnectReason.connectionLost
                ? "CONNECTION_LOST"
                : code === DisconnectReason.restartRequired
                  ? "RESTART_REQUIRED"
                  : code === DisconnectReason.timedOut
                    ? "TIMED_OUT"
                    : "UNKNOWN";

        const shouldReconnect = code !== DisconnectReason.loggedOut;

        touchState({
          status: "disconnected",
          reason,
          lastError: boom?.message || "Connection Closed",
          code: null,
          qrCode: null,
        });

        sock = null;
        initPromise = null;

        if (shouldReconnect) {
          setTimeout(() => {
            void initWA().catch(() => {});
          }, 1500);
        }
      }
    });

    // Handler de mensagens recebidas
    s.ev.on("messages.upsert", async (m: any) => {
      try {
        const msg = m.messages?.[0];
        if (!msg || msg.key?.fromMe || !msg.message) return;

        const phoneRaw = msg.key?.remoteJid || "";
        if (phoneRaw.endsWith("@g.us") || phoneRaw === "status@broadcast") return;

        const phone = phoneRaw.replace("@s.whatsapp.net", "");
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          "";

        if (!text.trim()) return;

        const pushName = msg.pushName || "Cliente";
        console.log(`[WhatsApp] Mensagem de ${phone} (${pushName}): ${text.substring(0, 50)}`);

        const botResponse = await handleBotMessage(phone, pushName, text);
        if (botResponse) {
          if (typeof botResponse === "string") {
            await s.sendMessage(phoneRaw, { text: botResponse });
          } else {
            // Tentar enviar com botões/lista, fallback para texto
            try {
              await s.sendMessage(phoneRaw, botResponse as any);
            } catch {
              await s.sendMessage(phoneRaw, { text: (botResponse as any).text || String(botResponse) });
            }
          }
          const preview = typeof botResponse === "string" ? botResponse.substring(0, 50) : "mensagem interativa";
          console.log(`[WhatsApp] Resposta para ${phone}: ${preview}`);
        }
      } catch (err: any) {
        console.error("[WhatsApp] Erro ao processar mensagem:", err?.message || err);
      }
    });

    sock = s;
    return s;
  })();

  return initPromise;
}

/**
 * ✅ Export compat: alguns arquivos/imports do seu projeto esperam função waStatus()
 * e outros esperam "estado" vindo de getConnectionStatus().
 */
export function waStatus(): WAStatusState {
  return { ...waState };
}

export function getConnectionStatus(): WAStatusState {
  return waStatus();
}

export async function connectWhatsApp(): Promise<WASocket> {
  return initWA();
}

export async function disconnectWhatsApp(): Promise<void> {
  try {
    if (sock) await sock.logout();
  } catch {
    // ignore
  } finally {
    sock = null;
    initPromise = null;
    touchState({ status: "disconnected", code: null, qrCode: null });
  }
}

export function resetBlockState(): void {
  // seu projeto usa isso pra limpar “erro travado”
  touchState({ lastError: "", reason: null });
}

export async function clearSession(): Promise<void> {
  // limpa a sessão do baileys e reseta estado
  await disconnectWhatsApp();

  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }

  touchState({
    status: "disconnected",
    phone: "",
    code: null,
    qrCode: null,
    reason: null,
    lastError: "",
  });
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const s = await initWA();
  const digits = normalizePhone(to);
  if (!digits) return false;

  const jid = digits.includes("@s.whatsapp.net") ? digits : `${digits}@s.whatsapp.net`;
  await s.sendMessage(jid, { text: String(text || "") });
  return true;
}

/**
 * ✅ Helper compat: seu projeto chama sendInteractiveMessage(phone, {type,text,buttons...})
 * A gente aceita "type" mas IGNORA e transforma em texto para não quebrar TS nem build.
 */
export type InteractivePayload = {
  // compat antigo (IGNORADO)
  type?: "buttons" | "list" | string;

  // texto base
  text?: string;

  // botões (vira texto)
  buttons?: Array<{ id?: string; title: string }>;

  // lista (vira texto)
  listButtonText?: string;
  listSections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
};

export async function sendInteractiveMessage(to: string, payload: InteractivePayload): Promise<boolean> {
  const baseText = payload?.text ?? "";

  const buttons = (payload?.buttons ?? []).slice(0, 3);
  const buttonsText =
    buttons.length > 0
      ? "\n\nOpções:\n" + buttons.map((b, i) => `${i + 1}) ${b.title}`).join("\n")
      : "";

  const rows = (payload?.listSections ?? []).flatMap((s) => s.rows ?? []);
  const listText =
    rows.length > 0
      ? `\n\n${payload?.listButtonText ?? "Opções"}:\n` +
        rows
          .slice(0, 10)
          .map((r, i) => `${i + 1}) ${r.title}${r.description ? " - " + r.description : ""}`)
          .join("\n")
      : "";

  return sendWhatsAppMessage(to, `${baseText}${buttonsText}${listText}`.trim());
}

/**
 * ✅ Pairing code (código de pareamento)
 * Importante: só retorna código se o WhatsApp liberar. Se vier null, pode ser bloqueio/limite.
 */
export async function getPairingCode(phoneNumber: string): Promise<string | null> {
  const digits = normalizePhone(phoneNumber);
  if (!digits) return null;

  try {
    const s = await initWA();
    touchState({ phone: digits, status: "connecting", lastError: "", reason: null, code: null });

    // @ts-ignore — baileys expõe requestPairingCode em runtime (dependendo da versão)
    const code: string | undefined = await s.requestPairingCode(digits);

    if (code) {
      touchState({ code, phone: digits });
      return code;
    }

    return null;
  } catch (e: any) {
    touchState({ lastError: String(e?.message || e), code: null });
    return null;
  }
}

// Bot message handler
async function handleBotMessage(phone: string, name: string, text: string): Promise<string | Record<string, any>> {
  const { prisma } = await import("./db");
  const lower = text.toLowerCase().trim();

  // Salvar mensagem recebida
  try {
    await prisma.conversation.create({
      data: { phoneNumber: phone, clientName: name, message: text, direction: "incoming", state: "MENU" },
    });
  } catch {}

  // Buscar estado da conversa
  const lastConv = await prisma.conversation.findFirst({
    where: { phoneNumber: phone, direction: "outgoing" },
    orderBy: { createdAt: "desc" },
  });
  const state = lastConv?.state || "MENU";
  const context = (lastConv?.context as any) || {};

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  // ═══════════════════════════════════
  // MENU PRINCIPAL / SAUDAÇÕES
  // ═══════════════════════════════════
  if (lower === "menu" || lower === "voltar" || lower === "inicio" || lower === "0" || lower.match(/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|oi!|e ai|opa|eai|opa!|oii|oie|hi|hello|start)$/)) {
    const apps = await prisma.app.findMany({ where: { isActive: true } });
    const appList = apps.map((a, i) => `  ${i + 1}️⃣  *${a.name}*`).join("\n");
    const reply = `${saudacao}, *${name}*! 👋\n\n🎯 *UNIVERSAL RECARGAS*\n_Códigos de recarga para streaming_\n\n━━━━━━━━━━━━━━━━━━\n📱 *NOSSOS APPS:*\n━━━━━━━━━━━━━━━━━━\n${appList}\n\n━━━━━━━━━━━━━━━━━━\n📌 *Digite o número ou nome do app*\n\n_Outras opções:_\n💰 *preços* → Tabela completa\n📦 *pedidos* → Seus pedidos\n📞 *atendente* → Falar com humano\n❓ *ajuda* → Central de ajuda`;
    await saveState(prisma, phone, "MENU", reply);
    return reply;
  }

  // ═══════════════════════════════════
  // AJUDA
  // ═══════════════════════════════════
  if (lower === "ajuda" || lower === "help" || lower === "?") {
    return `❓ *CENTRAL DE AJUDA*\n\n📱 _Comprar:_\n  → Digite o *nome do app* ou *número*\n  → Escolha o plano\n  → Pague via PIX\n  → Receba seu código!\n\n⌨️ *Comandos:*\n  📋 *menu* → Menu principal\n  💰 *preços* → Tabela de preços\n  📦 *pedidos* → Seus pedidos\n  📞 *atendente* → Falar com humano\n  🔙 *voltar* → Voltar ao menu\n\n💬 Ou simplesmente digite o que precisa!`;
  }

  // ═══════════════════════════════════
  // PREÇOS
  // ═══════════════════════════════════
  if (lower === "preços" || lower === "precos" || lower === "valores" || lower === "planos" || lower === "tabela") {
    const apps = await prisma.app.findMany({ where: { isActive: true }, include: { plans: { where: { isActive: true }, orderBy: { price: "asc" } } } });
    let list = "";
    for (const a of apps) {
      const codes = await prisma.code.count({ where: { appId: a.id, status: "available" } });
      const planLabels: Record<string, string> = { monthly: "Mensal", quarterly: "Trimestral", annual: "Anual" };
      const planOrder: Record<string, number> = { monthly: 1, quarterly: 2, annual: 3 };
      const sorted = [...a.plans].sort((x: any, y: any) => (planOrder[x.type.toLowerCase()] || 9) - (planOrder[y.type.toLowerCase()] || 9));
      const plans = sorted.map(p => `  💵 ${planLabels[p.type.toLowerCase()] || p.type}: *R$ ${p.price.toFixed(2)}*`).join("\n");
      list += `\n📱 *${a.name}* ${codes > 0 ? `_(${codes} disponíveis)_` : "_(esgotado)_"}\n${plans}\n`;
    }
    return `💰 *TABELA DE PREÇOS*\n━━━━━━━━━━━━━━━━━━${list}\n━━━━━━━━━━━━━━━━━━\n📌 Digite o *nome do app* para comprar\n🔙 *menu* para voltar`;
  }

  // ═══════════════════════════════════
  // MEUS PEDIDOS
  // ═══════════════════════════════════
  if (lower === "pedidos" || lower === "meus pedidos" || lower === "meu pedido" || lower === "compras") {
    const orders = await prisma.order.findMany({
      where: { clientPhone: phone }, take: 5, orderBy: { createdAt: "desc" },
      include: { app: true, plan: true },
    });
    if (orders.length === 0) {
      return `📦 *SEUS PEDIDOS*\n\nVocê ainda não tem pedidos.\n\n🛒 Digite o *nome de um app* para fazer sua primeira compra!\n🔙 *menu* para voltar`;
    }
    const statusIcons: Record<string, string> = {
      code_sent: "✅ Código enviado",
      paid: "💰 Pago - aguardando código",
      pending_payment: "⏳ Aguardando pagamento",
      cancelled: "❌ Cancelado",
    };
    const list = orders.map((o, i) => {
      const planLabels: Record<string, string> = { monthly: "Mensal", quarterly: "Trimestral", annual: "Anual" };
      const date = new Date(o.createdAt).toLocaleDateString("pt-BR");
      return `${i + 1}. *${o.app.name}* - ${planLabels[o.plan.type.toLowerCase()] || o.plan.type}\n   💵 R$ ${o.amount.toFixed(2)} | ${statusIcons[o.status] || o.status}\n   📅 ${date}`;
    }).join("\n\n");
    return `📦 *SEUS PEDIDOS*\n━━━━━━━━━━━━━━━━━━\n\n${list}\n\n━━━━━━━━━━━━━━━━━━\n🔙 *menu* para voltar`;
  }

  // ═══════════════════════════════════
  // ATENDENTE / HUMANO
  // ═══════════════════════════════════
  if (lower === "atendente" || lower === "humano" || lower === "pessoa" || lower === "falar com alguem" || lower === "suporte") {
    await saveState(prisma, phone, "HUMAN_MODE", "", { humanMode: true });
    return `👤 *MODO ATENDENTE*\n━━━━━━━━━━━━━━━━━━\n\nVocê está falando com um atendente agora.\nAguarde, responderemos em breve! ⏳\n\n_Para voltar ao bot automático:_\n🤖 Digite *bot* ou *menu*`;
  }

  // Voltar do modo humano
  if ((lower === "bot" || lower === "menu") && state === "HUMAN_MODE") {
    const apps = await prisma.app.findMany({ where: { isActive: true } });
    const appList = apps.map((a, i) => `  ${i + 1}️⃣  *${a.name}*`).join("\n");
    const reply = `🤖 *Bot ativado!*\n\n📱 *NOSSOS APPS:*\n${appList}\n\n📌 Digite o *número* ou *nome* do app`;
    await saveState(prisma, phone, "MENU", reply);
    return reply;
  }

  // Se está em modo humano, não responde automaticamente
  if (state === "HUMAN_MODE") {
    return "";
  }

  // ═══════════════════════════════════
  // CUPOM
  // ═══════════════════════════════════
  if (lower.startsWith("cupom ") || lower.startsWith("cupom:")) {
    const code = text.replace(/^cupom[:\s]+/i, "").trim().toUpperCase();
    const coupon = await prisma.coupon.findFirst({ where: { code, isActive: true } });
    if (coupon) {
      const discount = coupon.discountType === "percentage" ? `${coupon.discountValue}%` : `R$ ${coupon.discountValue.toFixed(2)}`;
      return `🎫 *Cupom válido!*\n\n🏷️ Código: *${coupon.code}*\n💰 Desconto: *${discount}*\n\n📱 Escolha um app e o desconto será aplicado!\n🔙 *menu* para voltar`;
    }
    return `❌ Cupom *${code}* não encontrado ou expirado.\n\n🔙 *menu* para voltar`;
  }

  // ═══════════════════════════════════
  // COMPROVANTE / PAGAMENTO
  // ═══════════════════════════════════
  if (state === "AWAITING_PAYMENT" && (lower.includes("paguei") || lower.includes("pago") || lower.includes("comprovante") || lower.includes("transferi") || lower.includes("enviei") || lower.includes("fiz o pix"))) {
    const orderId = context?.orderId;
    if (orderId) {
      return `📸 *Comprovante recebido!*\n\n✅ Vamos verificar seu pagamento.\n⏱️ Prazo: até *10 minutos*\n\n📦 Pedido: #${String(orderId).substring(0, 8)}\n\nAssim que confirmado, seu código será enviado aqui automaticamente! 🚀\n\n_Se precisar de ajuda:_ *atendente*`;
    }
  }

  // ═══════════════════════════════════
  // SELECIONAR APP POR NÚMERO
  // ═══════════════════════════════════
  if (lower.match(/^[1-9]$/) && (state === "MENU" || state === "SELECT_APP")) {
    const apps = await prisma.app.findMany({ where: { isActive: true } });
    const idx = parseInt(lower) - 1;
    if (idx >= 0 && idx < apps.length) {
      return await showAppPlans(prisma, phone, apps[idx].id);
    }
  }

  // ═══════════════════════════════════
  // SELECIONAR APP POR NOME
  // ═══════════════════════════════════
  const app = await prisma.app.findFirst({
    where: { isActive: true, name: { contains: text, mode: "insensitive" } },
  });
  if (app) {
    return await showAppPlans(prisma, phone, app.id);
  }

  // ═══════════════════════════════════
  // SELECIONAR PLANO
  // ═══════════════════════════════════
  if (state === "SELECT_PLAN") {
    let appId = context?.appId;
    if (!appId) {
      const convs = await prisma.conversation.findMany({
        where: { phoneNumber: phone, direction: "outgoing", state: "SELECT_PLAN" },
        orderBy: { createdAt: "desc" }, take: 5,
      });
      for (const c of convs) {
        const ctx = c.context as any;
        if (ctx?.appId) { appId = ctx.appId; break; }
      }
    }

    if (appId) {
      const pOrder: Record<string, number> = { monthly: 1, quarterly: 2, annual: 3 };
      const allPlans = await prisma.plan.findMany({ where: { appId, isActive: true } });
      const sorted = allPlans.sort((a: any, b: any) => (pOrder[a.type.toLowerCase()] || 9) - (pOrder[b.type.toLowerCase()] || 9));
      const appData = await prisma.app.findUnique({ where: { id: appId } });
      let picked = null;

      if (lower === "1" && sorted[0]) picked = sorted[0];
      else if (lower === "2" && sorted[1]) picked = sorted[1];
      else if (lower === "3" && sorted[2]) picked = sorted[2];
      else if (lower.match(/^(mensal|mes)$/)) picked = sorted.find((p: any) => p.type.toLowerCase() === "monthly");
      else if (lower.match(/^(trimestral|tri|trimestre)$/)) picked = sorted.find((p: any) => p.type.toLowerCase() === "quarterly");
      else if (lower.match(/^(anual|ano|annual)$/)) picked = sorted.find((p: any) => p.type.toLowerCase() === "annual");

      if (picked && appData) {
        return await createOrder(prisma, phone, name, appData, picked);
      }
    }

    if (!lower.match(/^(menu|voltar|ajuda|preços|precos|pedidos|atendente|oi|olá|ola)$/)) {
      return `❌ Opção inválida.\n\nDigite:\n  1️⃣ *mensal*\n  2️⃣ *trimestral*\n  3️⃣ *anual*\n\n🔙 *menu* para voltar`;
    }
  }

  // ═══════════════════════════════════
  // CANCELAR PEDIDO
  // ═══════════════════════════════════
  if (lower === "cancelar" && state === "AWAITING_PAYMENT" && context?.orderId) {
    await prisma.order.update({ where: { id: context.orderId }, data: { status: "cancelled", cancelledAt: new Date() } });
    return `❌ *Pedido cancelado.*\n\n📱 Digite *menu* para fazer um novo pedido.`;
  }

  // ═══════════════════════════════════
  // MENSAGEM NÃO RECONHECIDA
  // ═══════════════════════════════════
  return `Olá *${name}*! 😊\n\nNão entendi sua mensagem. Veja o que posso fazer:\n\n📱 *Comprar* → Digite o nome de um app\n💰 *preços* → Ver tabela de preços\n📦 *pedidos* → Ver suas compras\n📋 *menu* → Menu completo\n❓ *ajuda* → Central de ajuda\n\n_Exemplo: digite "Unitv" para comprar_`;
}

async function showAppPlans(prisma: any, phone: string, appId: string): Promise<string> {
  const app = await prisma.app.findUnique({ where: { id: appId }, include: { plans: { where: { isActive: true }, orderBy: { price: "asc" } } } });
  if (!app) return "❌ App não encontrado. Digite *menu* para voltar.";

  const planLabels: Record<string, string> = { monthly: "Mensal (30 dias)", quarterly: "Trimestral (90 dias)", annual: "Anual (365 dias)" };
  const planEmojis: Record<string, string> = { monthly: "📅", quarterly: "📆", annual: "🗓️" };
  const planOrder: Record<string, number> = { monthly: 1, quarterly: 2, annual: 3 };
  const codes = await prisma.code.count({ where: { appId, status: "available" } });

  // Ordenar: mensal primeiro, depois trimestral, depois anual
  const sortedPlans = [...app.plans].sort((a: any, b: any) => 
    (planOrder[a.type.toLowerCase()] || 9) - (planOrder[b.type.toLowerCase()] || 9)
  );

  const plans = sortedPlans.map((p: any, i: number) => {
    const typeKey = p.type.toLowerCase();
    const label = planLabels[typeKey] || p.type;
    const emoji = planEmojis[typeKey] || "📋";
    const savings = typeKey === "quarterly" ? " _💡 Economize!_" : typeKey === "annual" ? " _🔥 Melhor custo!_" : "";
    return `  ${i + 1}️⃣  ${emoji} *${label}*\n      💵 *R$ ${p.price.toFixed(2)}*${savings}`;
  }).join("\n\n");

  const reply = `📱 *${app.name.toUpperCase()}*\n_${app.description || "App de streaming"}_\n\n━━━━━━━━━━━━━━━━━━\n💰 *ESCOLHA SEU PLANO:*\n━━━━━━━━━━━━━━━━━━\n\n${plans}\n\n━━━━━━━━━━━━━━━━━━\n✅ *${codes}* códigos disponíveis\n\n📌 *Responda com:*\n  → *mensal* ou *1*\n  → *trimestral* ou *2*\n  → *anual* ou *3*\n\n🔙 *menu* para voltar`;
  await saveState(prisma, phone, "SELECT_PLAN", reply, { appId });
  return reply;
}

async function createOrder(prisma: any, phone: string, name: string, app: any, plan: any): Promise<string> {
  // Verificar estoque
  const available = await prisma.code.count({ where: { appId: app.id, planId: plan.id, status: "available" } });
  if (available === 0) {
    return `❌ *Estoque esgotado!*\n\nO plano *${plan.type}* do *${app.name}* está sem estoque no momento.\n\n💡 Tente outro plano ou outro app.\n🔙 *menu* para voltar`;
  }

  const order = await prisma.order.create({
    data: { clientPhone: phone, clientName: name, appId: app.id, planId: plan.id, amount: plan.price, status: "pending_payment" },
  });

  const config = await prisma.config.findMany({ where: { key: { in: ["pix_key", "pix_name"] } } });
  const pixKey = config.find((c: any) => c.key === "pix_key")?.value || "";
  const pixName = config.find((c: any) => c.key === "pix_name")?.value || "";

  const planLabels: Record<string, string> = { monthly: "Mensal", quarterly: "Trimestral", annual: "Anual" };
  const planTypeKey = plan.type.toLowerCase();

  const reply = `🎉 *PEDIDO CRIADO!*\n━━━━━━━━━━━━━━━━━━\n\n📱 App: *${app.name}*\n📋 Plano: *${planLabels[planTypeKey] || plan.type}*\n💰 Valor: *R$ ${plan.price.toFixed(2)}*\n🆔 Pedido: *#${order.id.substring(0, 8)}*\n\n━━━━━━━━━━━━━━━━━━\n💳 *PAGUE VIA PIX:*\n━━━━━━━━━━━━━━━━━━\n\n🔑 Chave: *${pixKey || "Não configurada"}*\n👤 Nome: *${pixName || "Não configurado"}*\n💵 Valor: *R$ ${plan.price.toFixed(2)}*\n\n━━━━━━━━━━━━━━━━━━\n\n📸 *Após pagar, envie o comprovante aqui*\n⏱️ Prazo: *30 minutos*\n\n_Digite *cancelar* para cancelar o pedido_\n🔙 *menu* para voltar`;
  await saveState(prisma, phone, "AWAITING_PAYMENT", reply, { orderId: order.id });
  return reply;
}

async function saveState(prisma: any, phone: string, state: string, message: string, context?: any) {
  try {
    await prisma.conversation.create({
      data: { phoneNumber: phone, clientName: "Bot", message, direction: "outgoing", state, context: context || {} },
    });
  } catch {}
}

// compat extra: alguns lugares podem importar isso
export { waState };
