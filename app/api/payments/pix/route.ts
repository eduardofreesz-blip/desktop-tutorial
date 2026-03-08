// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createPixPayment, hasGetnetCredentials } from '@/lib/getnet';
import { createPagSeguroPixPayment, hasPagSeguroCredentials } from '@/lib/pagseguro';
import { generatePixCollection, hasFitBankCredentials } from '@/lib/fitbank';
import { createMercadoPagoPixPayment, hasMercadoPagoCredentials } from '@/lib/mercadopago';

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

    // Mercado Pago
    if (activeProvider === 'mercadopago') {
      if (!hasMercadoPagoCredentials()) {
        return NextResponse.json(
          { error: 'Credenciais Mercado Pago não configuradas' },
          { status: 500 }
        );
      }

      const pixResponse = await createMercadoPagoPixPayment(
        order.amount,
        order.id,
        order.clientPhone.replace(/\D/g, ''),
        undefined
      );

      if (!pixResponse.success) {
        return NextResponse.json(
          { error: pixResponse.error || 'Erro ao gerar PIX Mercado Pago' },
          { status: 500 }
        );
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'pending_payment', paymentId: pixResponse.paymentId },
      });

      return NextResponse.json({
        success: true,
        paymentId: pixResponse.paymentId,
        qrCode: pixResponse.qrCode,
        qrCodeImage: pixResponse.qrCodeImage,
        status: pixResponse.status,
        provider: 'mercadopago',
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

    const pixResponse = await createPixPayment(
      Math.round(order.amount * 100),
      `ORDER_${order.id}`,
      order.clientPhone.replace(/\D/g, '')
    );

    if (!pixResponse) {
      return NextResponse.json(
        { error: 'Erro ao gerar PIX Getnet' },
        { status: 500 }
      );
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'pending_payment' },
    });

    return NextResponse.json({
      success: true,
      paymentId: pixResponse?.paymentId,
      qrCode: pixResponse?.qrCode,
      qrCodeImage: pixResponse?.qrCodeBase64,
      status: pixResponse?.status,
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
