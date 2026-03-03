// @ts-nocheck
// Gerar QR Code PIX via FitBank
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generatePixCollection, hasFitBankCredentials } from '@/lib/fitbank';

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'ID do pedido é obrigatório' },
        { status: 400 }
      );
    }

    if (!hasFitBankCredentials()) {
      return NextResponse.json(
        { error: 'FitBank não configurado' },
        { status: 400 }
      );
    }

    // Buscar pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { app: true, plan: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    // Gerar QR Code
    const result = await generatePixCollection({
      orderId: order.id,
      amount: order.amount,
      description: `${order.app?.name || 'App'} - ${order.plan?.type || 'Plano'}`,
      expirationMinutes: 60,
      payerName: order.clientName || 'Cliente',
      payerDocument: order.clientDocument || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erro ao gerar QR Code' },
        { status: 500 }
      );
    }

    // Atualizar pedido com referência do pagamento
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'awaiting_payment',
        paymentId: result.documentNumber,
      },
    });

    return NextResponse.json({
      success: true,
      provider: 'fitbank',
      paymentId: result.documentNumber,
      qrCodeBase64: result.qrCodeBase64,
      qrCodeText: result.qrCodeText || result.hashCode,
      textContent: result.textContent,
      expirationDate: result.expirationDate,
    });
  } catch (error: any) {
    console.error('[FitBank] Erro ao gerar PIX:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
