import { NextRequest, NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/bot-logic';

export const dynamic = 'force-dynamic';

/**
 * GET - Webhook verification
 * O WhatsApp envia uma requisição GET para verificar o webhook
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    console.log('[Webhook] Verificação recebida:', { mode, token, challenge });

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[Webhook] Verificação bem-sucedida!');
      return new NextResponse(challenge, { status: 200 });
    }

    console.log('[Webhook] Verificação falhou - token inválido');
    return NextResponse.json({ error: 'Token de verificação inválido' }, { status: 403 });
  } catch (error) {
    console.error('[Webhook] Erro na verificação:', error);
    return NextResponse.json({ error: 'Erro na verificação' }, { status: 500 });
  }
}

/**
 * POST - Recebe mensagens do WhatsApp
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('[Webhook] Mensagem recebida:', JSON.stringify(body, null, 2));

    // Verificar se é uma mensagem de webhook válida
    if (!body?.entry?.[0]?.changes?.[0]?.value) {
      console.log('[Webhook] Formato inválido - ignorando');
      return NextResponse.json({ success: true });
    }

    const value = body?.entry?.[0]?.changes?.[0]?.value;

    // Ignorar mensagens de status (enviadas, entregues, lidas)
    if (value?.statuses) {
      console.log('[Webhook] Status update - ignorando');
      return NextResponse.json({ success: true });
    }

    // Processar apenas mensagens de texto recebidas
    if (!value?.messages?.[0]) {
      console.log('[Webhook] Sem mensagens - ignorando');
      return NextResponse.json({ success: true });
    }

    const message = value?.messages?.[0];
    const messageType = message?.type;

    // Ignorar mensagens que não são de texto
    if (messageType !== 'text') {
      console.log(`[Webhook] Tipo de mensagem não suportado: ${messageType}`);
      return NextResponse.json({ success: true });
    }

    const from = message?.from; // Número do remetente
    const messageBody = message?.text?.body; // Conteúdo da mensagem

    if (!from || !messageBody) {
      console.log('[Webhook] Mensagem sem remetente ou conteúdo - ignorando');
      return NextResponse.json({ success: true });
    }

    console.log(`[Webhook] Processando mensagem de ${from}: ${messageBody}`);

    // Processar mensagem de forma assíncrona
    // O nome do cliente será obtido do histórico ou usará "Cliente" como padrão
    processIncomingMessage(from, messageBody, 'Cliente').catch((error) => {
      console.error('[Webhook] Erro ao processar mensagem:', error);
    });

    // Retornar imediatamente para o WhatsApp
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 });
  }
}