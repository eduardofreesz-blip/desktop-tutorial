import { NextResponse } from "next/server";
import { connectWhatsApp, getConnectionStatus } from "@/lib/whatsapp-web";

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectWhatsApp();
  const status = getConnectionStatus();
  return NextResponse.json(status);
}

export async function POST() {
  await connectWhatsApp();
  const status = getConnectionStatus();
  return NextResponse.json(status);
}
