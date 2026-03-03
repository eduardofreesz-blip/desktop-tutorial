// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createPixPayment, hasGetnetCredentials } from '@/lib/getnet';
import { createPagSeguroPixPayment, hasPagSeguroCredentials } from '@/lib/pagseguro';
import { generatePixCollection, hasFitBankCredentials } from '@/lib/fitbank';

// Obter provider ativo
async function getActiveProvider(): Promise<string> {
  try {
    const config = await prisma.config.findUnique({ where: { key: 'active_provider' } });
    return config?.value || 'getnet';
  } catch {
    return 'getnet';
  }
}

// Criar pagamento PIX
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        app: true,
        plan: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    const activeProvider = await getActiveProvider();
    console.log('[PIX] Provider ativo:', activeProvider);

    // FitBank
    if (activeProvider === 'fitbank') {
      if (!hasFitBankCredentials()) {
        return NextResponse.json(
          { error: 'Credenciais FitBank não configuradas' },
          { status: 500 }
        );
      }

      const pixResponse = await generatePixCollection({
        orderId: order.id,
        amount: order.amount,
        description: `Recarga ${order.app?.name} - ${order.plan?.type}`,
        expirationMinutes: 60,
        payerName: order.clientName || 'Cliente',
        payerDocument: order.clientDocument || undefined,
      });

      if (!pixResponse.success) {
        return NextResponse.json(
          { error: pixResponse.error || 'Erro ao gerar PIX FitBank' },
          { status: 500 }
        );
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'awaiting_payment',
          paymentId: pixResponse.documentNumber,
        },
      });

      return NextResponse.json({
        success: true,
        paymentId: pixResponse.documentNumber,
        qrCode: pixResponse.qrCodeText || pixResponse.hashCode,
        qrCodeBase64: pixResponse.qrCodeBase64,
        expirationDate: pixResponse.expirationDate,
        provider: 'fitbank',
      });
    }

    // PagSeguro
    if (activeProvider === 'pagseguro') {
      if (!hasPagSeguroCredentials()) {
        return NextResponse.json(
          { error: 'Credenciais PagSeguro não configuradas' },
          { status: 500 }
        );
      }

      const pixResponse = await createPagSeguroPixPayment({
        amount: Math.round(order.amount * 100),
        orderId: order.id,
        customerName: order.clientName || 'Cliente',
        customerCpf: '00000000000',
        description: `Recarga ${order.app?.name} - ${order.plan?.type}`,
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'pending_payment' },
      });

      const qrCode = pixResponse.qr_codes?.[0];
      return NextResponse.json({
        success: true,
        paymentId: pixResponse.id,
        qrCode: qrCode?.text,
        qrCodeImage: qrCode?.links?.find(l => l.rel === 'QRCODE.PNG')?.href,
        status: pixResponse.status,
        provider: 'pagseguro',
      });
    }

    // Getnet (padrão)
    if (!hasGetnetCredentials()) {
      return NextResponse.json(
        { error: 'Credenciais Getnet não configuradas' },
        { status: 500 }
      );
    }

    const pixResponse = await createPixPayment({
      amount: Math.round(order.amount * 100),
      orderId: `ORDER_${order.id}`,
      customerId: order.clientPhone.replace(/\D/g, ''),
      customerName: order.clientName ?? undefined,
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'pending_payment' },
    });

    return NextResponse.json({
      success: true,
      paymentId: pixResponse.payment_id,
      qrCode: pixResponse.qr_code,
      qrCodeImage: pixResponse.additional_data?.qr_code_image,
      status: pixResponse.status,
      provider: 'getnet',
    });
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error);
    return NextResponse.json(
      { error: 'Erro ao criar pagamento PIX' },
      { status: 500 }
    );
  }
}
