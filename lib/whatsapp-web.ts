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
  status: "disconnected" | "connecting" | "connected";
  phone: string;
  code: string | null;
  qrCode: string | null;
  reason: string | null;
  lastChangeAt: number;
  lastError: string;
};

const logger = pino({ level: "silent" });

const AUTH_DIR =
  process.env.WA_AUTH_DIR ||
  process.env.WA_SESSION_DIR || // compat com envs antigas
  path.join(process.cwd(), "wa_auth");

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
        touchState({ qrCode: qr, status: "connecting" });
        console.log("[WhatsApp] QR Code gerado - escaneie com seu celular");
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
          // pequeno delay pra não loopar agressivo
          setTimeout(() => {
            void initWA().catch(() => {});
          }, 1500);
        }
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

// compat extra: alguns lugares podem importar isso
export { waState };
