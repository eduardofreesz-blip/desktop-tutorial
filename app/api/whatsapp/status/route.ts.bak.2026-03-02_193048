export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { getConnectionStatus } from '@/lib/whatsapp-web';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const status = getConnectionStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Erro ao obter status:', error);
    return NextResponse.json(
      { status: 'error', error: String(error) },
      { status: 500 }
    );
  }
}
