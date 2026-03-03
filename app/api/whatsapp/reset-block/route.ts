export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { resetBlockState, getConnectionStatus } from '@/lib/whatsapp-web';

export async function POST() {
  try {
    resetBlockState();
    const status = getConnectionStatus();
    return NextResponse.json({ 
      success: true, 
      message: 'Estado de bloqueio resetado. Você pode tentar conectar novamente.',
      ...status 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao resetar bloqueio' },
      { status: 500 }
    );
  }
}
