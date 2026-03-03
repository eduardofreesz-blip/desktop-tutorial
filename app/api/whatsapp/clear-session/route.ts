export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { disconnectWhatsApp, clearSession, getConnectionStatus } from '@/lib/whatsapp-web';

export async function POST() {
  try {
    // Desconectar primeiro
    await disconnectWhatsApp();
    
    // Limpar a sessão
    await clearSession();
    
    const status = getConnectionStatus();
    return NextResponse.json({ 
      success: true, 
      message: 'Sessão removida com sucesso. Você precisará escanear o QR Code novamente.',
      ...status 
    });
  } catch (error) {
    console.error('Erro ao limpar sessão:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
