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

async function sendViaEvolution(phone: string, text: string): Promise<boolean> {
  try {
    const { pixCode, rest } = splitPixFromMessage(text);
    const number = phone.replace(/\D/g, '');
    const baseUrl = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
    const payload = (t: string) => ({ number, text: t });

    if (pixCode) {
      await fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(pixCode)) });
      if (rest) await fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(rest)) });
    } else {
      await fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(text || ' ')) });
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
    const event = body?.event || body?.data?.event;
    const data = body?.data || body;

    if (event !== 'messages.upsert' && body?.event !== 'messages.upsert') {
      return NextResponse.json({ received: true });
    }

    const messages = data?.messages || body?.messages || [];
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
    for (const item of toSend) {
      const m = item as any;
      if (typeof m === 'string') {
        await sendViaEvolution(phone, m);
      } else if (m?.type === 'image' && m?.imageUrl) {
        // Evolution API send image - simplificado: envia caption como texto
        if (m.caption) await sendViaEvolution(phone, m.caption);
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
