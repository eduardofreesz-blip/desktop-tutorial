export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { disconnectWhatsApp, connectWhatsApp, getConnectionStatus } from '@/lib/whatsapp-web';

export async function POST() {
  try {
    // Desconectar primeiro
    await disconnectWhatsApp();
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reconectar
    await connectWhatsApp();
    
    const status = getConnectionStatus();
    return NextResponse.json({ 
      success: true, 
      message: 'Bot reiniciado com sucesso',
      ...status 
    });
  } catch (error) {
    console.error('Erro ao reiniciar bot:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
