export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage, getConnectionStatus } from "@/lib/whatsapp-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Aceita 2 formatos:
    // { phoneNumber, message }
    // { to, text }
    const phoneNumber = body.phoneNumber ?? body.to;
    const message = body.message ?? body.text;

    if (!phoneNumber || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "phoneNumber/message (ou to/text) são obrigatórios",
        },
        { status: 400 }
      );
    }

    const status = getConnectionStatus();

    if (status.status !== "connected") {
      return NextResponse.json(
        {
          success: false,
          error: "WhatsApp não conectado",
          status,
        },
        { status: 409 }
      );
    }

    const ok = await sendWhatsAppMessage(
      String(phoneNumber),
      String(message)
    );

    if (ok) {
      return NextResponse.json({
        success: true,
        message: "Mensagem enviada com sucesso",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Falha ao enviar mensagem",
      },
      { status: 500 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
