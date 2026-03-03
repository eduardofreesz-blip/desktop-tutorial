export const runtime = "nodejs";

import { NextResponse } from 'next/server'
import { initWA, waStatus } from '@/lib/whatsapp-web'

export async function GET() {
  await initWA()
  return NextResponse.json({ ok: true, status: waStatus() })
}
