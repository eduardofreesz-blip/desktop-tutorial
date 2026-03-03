export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { disconnectWhatsApp } from '@/lib/whatsapp-web';

export async function POST() {
  try {
    await disconnectWhatsApp();
    return NextResponse.json({ status: 'disconnected', message: 'Desconectado com sucesso' });
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    return NextResponse.json(
      { status: 'error', error: String(error) },
      { status: 500 }
    );
  }
}
