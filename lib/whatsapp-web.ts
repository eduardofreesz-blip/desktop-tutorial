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

  let reply = "";

  // Menu principal / saudações
  if (lower === "menu" || lower === "voltar" || lower === "0" || lower.match(/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|oi!|e ai|opa|eai)$/)) {
    const apps = await prisma.app.findMany({ where: { isActive: true } });
    const appList = apps.map((a, i) => `${i + 1}️⃣ *${a.name}*`).join("\n");
    const menuText = `👋 Olá *${name}*! Bem-vindo à *Universal Recargas*! 🎯\n\nSomos especializados em códigos de recarga para apps de streaming.\n\n📱 *Apps Disponíveis:*\n${appList}\n\n📌 Digite o *número* ou *nome* do app desejado\n\n💰 *preços* - Ver tabela completa\n📦 *pedidos* - Seus pedidos\n❓ *ajuda* - Mais opções`;
    await saveState(prisma, phone, "MENU", menuText);

    // Tentar enviar como lista interativa
    try {
      const sections = [{
        title: "📱 Apps",
        rows: apps.map((a, i) => ({
          title: a.name,
          rowId: `app_${a.id}`,
          description: a.description || `App de streaming`,
        })),
      }, {
        title: "⚙️ Opções",
        rows: [
          { title: "💰 Ver Preços", rowId: "precos", description: "Tabela completa de preços" },
          { title: "📦 Meus Pedidos", rowId: "pedidos", description: "Acompanhe suas compras" },
          { title: "❓ Ajuda", rowId: "ajuda", description: "Central de ajuda" },
        ],
      }];

      return {
        text: menuText,
        buttonText: "📋 Ver Opções",
        sections,
        title: "Universal Recargas",
        footer: "Escolha uma opção acima 👆",
      };
    } catch {
      return menuText;
    }
  }

  // Ajuda
  if (lower === "ajuda" || lower === "help" || lower === "?") {
    reply = `❓ *Central de Ajuda*\n\n📱 *Comprar:* Digite o nome do app\n📦 *Meus Pedidos:* Digite "pedidos"\n💰 *Preços:* Digite "preços"\n📞 *Atendente:* Digite "atendente"\n🔙 *Menu:* Digite "menu"`;
    return reply;
  }

  // Preços
  if (lower === "preços" || lower === "precos" || lower === "valores" || lower === "planos") {
    const apps = await prisma.app.findMany({ where: { isActive: true }, include: { plans: { where: { isActive: true } } } });
    const list = apps.map(a => {
      const plans = a.plans.map(p => `  💵 ${p.type}: *R$ ${p.price.toFixed(2)}*`).join("\n");
      return `📱 *${a.name}*\n${plans}`;
    }).join("\n\n");
    reply = `💰 *Tabela de Preços:*\n\n${list}\n\n📌 Digite o nome do app para comprar\n🔙 Digite *menu* para voltar`;
    return reply;
  }

  // Meus pedidos
  if (lower === "pedidos" || lower === "meus pedidos" || lower === "status") {
    const orders = await prisma.order.findMany({
      where: { clientPhone: phone }, take: 5, orderBy: { createdAt: "desc" },
      include: { app: true, plan: true },
    });
    if (orders.length === 0) {
      reply = `📦 Você ainda não tem pedidos.\n\n📱 Digite o nome de um app para fazer sua primeira compra!`;
    } else {
      const list = orders.map(o => {
        const status = o.status === "code_sent" ? "✅ Enviado" : o.status === "paid" ? "💰 Pago" : o.status === "pending_payment" ? "⏳ Aguardando pagamento" : "❌ " + o.status;
        return `• *${o.app.name}* (${o.plan.type}) - R$ ${o.amount.toFixed(2)} - ${status}`;
      }).join("\n");
      reply = `📦 *Seus Pedidos:*\n\n${list}\n\n🔙 Digite *menu* para voltar`;
    }
    return reply;
  }

  // Atendente
  if (lower === "atendente" || lower === "humano" || lower === "pessoa" || lower === "falar com alguem") {
    reply = `👤 *Modo Atendente*\n\nUm atendente será notificado e responderá em breve.\nEnquanto isso, sinta-se à vontade para perguntar!\n\n🔙 Digite *menu* para voltar ao bot`;
    return reply;
  }

  // Seleção via lista interativa (app_id)
  if (lower.startsWith("app_")) {
    const appId = text.replace("app_", "");
    const appExists = await prisma.app.findUnique({ where: { id: appId } });
    if (appExists) return await showAppPlans(prisma, phone, appId);
  }

  // Selecionar app por número
  if (lower.match(/^[1-9]$/)) {
    const apps = await prisma.app.findMany({ where: { isActive: true } });
    const idx = parseInt(lower) - 1;
    if (idx >= 0 && idx < apps.length) {
      return await showAppPlans(prisma, phone, apps[idx].id);
    }
  }

  // Selecionar app por nome
  const app = await prisma.app.findFirst({
    where: { isActive: true, name: { contains: text, mode: "insensitive" } },
  });
  if (app) {
    return await showAppPlans(prisma, phone, app.id);
  }

  // Seleção via lista interativa (plan type)
  if (lower.startsWith("plan_")) {
    const parts = text.split("_");
    if (parts.length >= 3) {
      const planType = parts[1];
      const appId = parts.slice(2).join("_");
      const plan = await prisma.plan.findFirst({ where: { appId, type: planType, isActive: true } });
      const appData = await prisma.app.findUnique({ where: { id: appId } });
      if (plan && appData) {
        return await createOrder(prisma, phone, name, appData, plan);
      }
    }
  }

  // Selecionar plano (mensal, trimestral, anual)
  if (state === "SELECT_PLAN" && lower.match(/^(mensal|trimestral|anual|monthly|quarterly|annual|1|2|3)$/)) {
    const planMap: Record<string, string> = { "1": "monthly", mensal: "monthly", "2": "quarterly", trimestral: "quarterly", "3": "annual", anual: "annual", monthly: "monthly", quarterly: "quarterly", annual: "annual" };
    const planType = planMap[lower] || lower;

    const context = lastConv?.context as any;
    const appId = context?.appId;

    if (appId) {
      const plan = await prisma.plan.findFirst({ where: { appId, type: planType, isActive: true } });
      const appData = await prisma.app.findUnique({ where: { id: appId } });
      if (plan && appData) {
        return await createOrder(prisma, phone, name, appData, plan);
      }
    }
  }

  // Mensagem padrão
  reply = `🤔 Não entendi. Tente:\n\n📱 Nome de um app para comprar\n📦 *pedidos* - Ver seus pedidos\n💰 *preços* - Ver valores\n❓ *ajuda* - Mais opções\n🔙 *menu* - Menu principal`;
  return reply;
}

async function showAppPlans(prisma: any, phone: string, appId: string): Promise<string | Record<string, any>> {
  const app = await prisma.app.findUnique({ where: { id: appId }, include: { plans: { where: { isActive: true } } } });
  if (!app) return "App não encontrado.";

  const planLabels: Record<string, string> = { monthly: "Mensal (30 dias)", quarterly: "Trimestral (90 dias)", annual: "Anual (365 dias)" };
  const plans = app.plans.map((p: any, i: number) => `${i + 1}️⃣ *${planLabels[p.type] || p.type}* - R$ ${p.price.toFixed(2)}`).join("\n");
  const codes = await prisma.code.count({ where: { appId, status: "available" } });

  const textReply = `📱 *${app.name}*\n${app.description || ""}\n\n💰 *Escolha seu plano:*\n${plans}\n\n✅ ${codes} códigos disponíveis\n\n📌 Digite *mensal*, *trimestral* ou *anual*\n🔙 Digite *menu* para voltar`;
  await saveState(prisma, phone, "SELECT_PLAN", textReply, { appId });

  // Tentar enviar com botões
  try {
    const buttons = app.plans.slice(0, 3).map((p: any) => ({
      buttonId: `plan_${p.type}_${appId}`,
      buttonText: { displayText: `${planLabels[p.type] || p.type} - R$ ${p.price.toFixed(2)}` },
      type: 1,
    }));

    return {
      text: `📱 *${app.name}*\n${app.description || ""}\n\n✅ ${codes} códigos disponíveis\n\n💰 Escolha seu plano:`,
      buttons,
      footer: "Universal Recargas 🎯",
      headerType: 1,
    };
  } catch {
    return textReply;
  }
}

async function createOrder(prisma: any, phone: string, name: string, app: any, plan: any): Promise<string> {
  const order = await prisma.order.create({
    data: { clientPhone: phone, clientName: name, appId: app.id, planId: plan.id, amount: plan.price, status: "pending_payment" },
  });

  const config = await prisma.config.findMany({ where: { key: { in: ["pix_key", "pix_name"] } } });
  const pixKey = config.find((c: any) => c.key === "pix_key")?.value || "";
  const pixName = config.find((c: any) => c.key === "pix_name")?.value || "";

  const reply = `✅ *Pedido Criado com Sucesso!*\n\n📱 App: *${app.name}*\n📋 Plano: *${plan.type}*\n💰 Valor: *R$ ${plan.price.toFixed(2)}*\n🆔 Pedido: #${order.id.substring(0, 8)}\n\n━━━━━━━━━━━━━━━\n💳 *PAGAMENTO VIA PIX*\n━━━━━━━━━━━━━━━\n\n🔑 Chave PIX: *${pixKey || "Não configurada"}*\n👤 Titular: *${pixName || "Não configurado"}*\n💵 Valor: *R$ ${plan.price.toFixed(2)}*\n\n⏱️ Você tem *30 minutos* para pagar\n📸 Envie o *comprovante* aqui após pagar\n\n🔙 Digite *menu* para voltar`;
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
