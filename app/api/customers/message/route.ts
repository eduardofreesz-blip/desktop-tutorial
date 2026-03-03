import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendWhatsAppMessage, getConnectionStatus } from '@/lib/whatsapp-web';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phones, messageType, customMessage } = body;

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json(
        { error: 'Selecione pelo menos um cliente' },
        { status: 400 }
      );
    }

    // Verificar conexão WhatsApp
    const status = getConnectionStatus();
    if (status.status !== 'connected') {
      return NextResponse.json(
        { error: 'WhatsApp não conectado' },
        { status: 400 }
      );
    }

    let message = '';

    switch (messageType) {
      case 'miss_you':
        message = `💚 *Sentimos sua falta!*

Olá! Faz um tempo que você não aparece por aqui.

Estamos com saudades! 🥺

Temos ótimos preços e novidades esperando por você!

⬇️ *Digite "menu" para ver nossos apps*

Um abraço,
Equipe Universal Recargas 🚀`;
        break;

      case 'promo':
        message = `🎉 *PROMOÇÃO ESPECIAL!*

Olá! Temos uma oferta imperdível para você!

📱 Renove seu plano agora e aproveite!

⬇️ *Digite "menu" para ver as opções*

Universal Recargas 🚀`;
        break;

      case 'custom':
        message = customMessage || 'Olá! Entre em contato conosco.';
        break;

      default:
        message = `👋 Olá!

Digite "menu" para ver nossos apps disponíveis.

Universal Recargas 🚀`;
    }

    let sent = 0;
    const errors: string[] = [];

    for (const phone of phones) {
      try {
        const success = await sendWhatsAppMessage(phone, message);
        if (success) {
          sent++;

          // Salvar no histórico
          await prisma.conversation.create({
            data: {
              phoneNumber: phone,
              clientName: 'Cliente',
              message,
              direction: 'OUTBOUND',
              state: 'COMPLETED',
              context: { type: messageType, bulk: true },
            },
          });
        } else {
          errors.push(phone);
        }
      } catch (error) {
        errors.push(phone);
      }

      // Delay entre mensagens para evitar bloqueio
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      sent,
      total: phones.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Erro ao enviar mensagens:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar mensagens' },
      { status: 500 }
    );
  }
}
