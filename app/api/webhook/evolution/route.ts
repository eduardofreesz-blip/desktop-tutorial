/**
 * Webhook para Evolution API
 * Recebe mensagens e envia resposta via Evolution API
 * Configure em: Evolution API > Webhook > URL deste endpoint
 * Ative/desative em: WhatsApp > Evolution API
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processIncomingMessage } from '@/lib/bot-logic-web';
import { formatSimpleMessage } from '@/lib/bot-logic-web';

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'evolution';

function splitPixFromMessage(text: string): { pixCode: string | null; rest: string } {
  if (!text || typeof text !== 'string') return { pixCode: null, rest: text };
  const pixMatch = text.match(/(00020[0-9a-zA-Z\-\.]+)/);
  if (!pixMatch) return { pixCode: null, rest: text };
  const candidate = pixMatch[1];
  if (candidate.length < 80 || !candidate.includes('br.gov.bcb.pix')) return { pixCode: null, rest: text };
  const rest = text.replace(candidate, '').replace(/\n{3,}/g, '\n\n').trim();
  return { pixCode: candidate, rest };
}

function getEvolutionHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_API_TOKEN;
  if (key) h['Authorization'] = `Bearer ${key}`;
  return h;
}

async function sendViaEvolution(phone: string, text: string): Promise<boolean> {
  try {
    const { pixCode, rest } = splitPixFromMessage(text);
    const number = phone.replace(/\D/g, '');
    const baseUrl = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
    const headers = getEvolutionHeaders();
    const payload = (t: string) => ({ number, text: t });

    if (pixCode) {
      await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(payload(pixCode)) });
      if (rest) await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(payload(rest)) });
    } else {
      await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(payload(text || ' ')) });
    }
    return true;
  } catch (e) {
    console.error('[Evolution Webhook] Erro ao enviar:', e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await prisma.config.findUnique({ where: { key: 'evolution_api_enabled' } });
    if (config?.value !== 'true') {
      return NextResponse.json({ received: true, skipped: 'evolution_disabled' });
    }

    const body = await req.json();
    const event = (body?.event || body?.data?.event || '').toLowerCase();
    const data = body?.data || body;

    if (event !== 'messages.upsert' && event !== 'messages_upsert') {
      return NextResponse.json({ received: true });
    }

    const messages = data?.messages || body?.messages || data?.message || [];
    const msg = messages[0];
    if (!msg || msg?.key?.fromMe) return NextResponse.json({ received: true });

    const jid = msg?.key?.remoteJid || '';
    const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
    const text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || '';
    const pushName = msg?.pushName || 'Cliente';

    if (!phone || !text?.trim()) return NextResponse.json({ received: true });

    const result = await processIncomingMessage(phone, text, pushName, 'whatsapp');
    if (!result) return NextResponse.json({ received: true });

    const toSend = Array.isArray(result) ? result : [result];
    const mediaUrl = `${EVOLUTION_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
    const number = phone.replace(/\D/g, '');

    for (const item of toSend) {
      const m = item as any;
      if (typeof m === 'string') {
        await sendViaEvolution(phone, m);
      } else if (m?.type === 'image' && m?.imageUrl) {
        const base64 = m.imageUrl.startsWith('data:') ? m.imageUrl.replace(/^data:image\/\w+;base64,/, '') : m.imageUrl;
        try {
          const res = await fetch(mediaUrl, {
            method: 'POST',
            headers: getEvolutionHeaders(),
            body: JSON.stringify({
              number,
              mediatype: 'image',
              mimetype: 'image/png',
              media: base64,
              caption: m.caption || '',
              fileName: 'qrcode.png',
            }),
          });
          if (!res.ok && m.caption) await sendViaEvolution(phone, m.caption);
        } catch {
          if (m.caption) await sendViaEvolution(phone, m.caption);
        }
      } else {
        const txt = m?.text || m?.caption || formatSimpleMessage(m) || '';
        if (txt) await sendViaEvolution(phone, txt);
      }
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('[Evolution Webhook] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
