import { NextResponse } from "next/server";
import { connectWhatsApp } from "@/lib/whatsapp-web";

export async function GET() {
  await connectWhatsApp();
  return NextResponse.json({ ok: true });
}
