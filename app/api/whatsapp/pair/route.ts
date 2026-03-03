import { NextResponse } from "next/server";
import { getPairingCode } from "@/lib/whatsapp-web";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = (url.searchParams.get("phone") ?? "").replace(/[^\d]/g, "");

  if (!phone) {
    return NextResponse.json({ ok: true, phone: "", code: null });
  }

  const code = await getPairingCode(phone);
  return NextResponse.json({ ok: true, phone, code });
}
