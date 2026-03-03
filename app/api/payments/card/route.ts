import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createCardPayment, hasGetnetCredentials, isPaymentApproved } from '@/lib/getnet';
import { createPagSeguroCardPayment, hasPagSeguroCredentials, isPagSeguroPaymentApproved } from '@/lib/pagseguro';

// Obter provider ativo
async function getActiveProvider(): Promise<string> {
  try {
    const config = await prisma.config.findUnique({ where: { key: 'active_provider' } });
    return config?.value || 'getnet';
  } catch {
    return 'getnet';
  }
}

// Criar pagamento com cartão
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderId,
      customer,
      card,
      installments = 1,
    } = body;

    if (!orderId || !customer || !card) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
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
    console.log('[Card] Provider ativo:', activeProvider);

    // PagSeguro
    if (activeProvider === 'pagseguro') {
      if (!hasPagSeguroCredentials()) {
        return NextResponse.json(
          { error: 'Credenciais PagSeguro não configuradas' },
          { status: 500 }
        );
      }

      const cardResponse = await createPagSeguroCardPayment({
        amount: Math.round(order.amount * 100),
        orderId: order.id,
        description: `Recarga ${order.app?.name} - ${order.plan?.type}`,
        softDescriptor: 'UNIVERSAL',
        installments,
        customer: {
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          email: customer.email,
          cpf: customer.documentNumber.replace(/\D/g, ''),
          phone: order.clientPhone.replace(/\D/g, ''),
        },
        card: {
          number: card.number.replace(/\D/g, ''),
          holderName: card.holderName,
          expMonth: card.expirationMonth,
          expYear: card.expirationYear,
          securityCode: card.securityCode,
        },
      });

      const chargeStatus = cardResponse.charges?.[0]?.status || cardResponse.status;
      const approved = isPagSeguroPaymentApproved(chargeStatus);

      if (approved) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'paid',
            paidAt: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: approved,
        paymentId: cardResponse.id,
        status: chargeStatus,
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

    const cardResponse = await createCardPayment({
      amount: Math.round(order.amount * 100),
      orderId: `ORDER_${order.id}`,
      softDescriptor: 'UNIVERSAL',
      customer: {
        customerId: order.clientPhone.replace(/\D/g, ''),
        firstName: customer.firstName,
        lastName: customer.lastName,
        documentType: customer.documentType || 'CPF',
        documentNumber: customer.documentNumber.replace(/\D/g, ''),
        email: customer.email,
        phone: order.clientPhone.replace(/\D/g, ''),
      },
      card: {
        number: card.number.replace(/\D/g, ''),
        holderName: card.holderName,
        expirationMonth: card.expirationMonth,
        expirationYear: card.expirationYear,
        securityCode: card.securityCode,
      },
      installments,
    });

    if (isPaymentApproved(cardResponse.status)) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: isPaymentApproved(cardResponse.status),
      paymentId: cardResponse.payment_id,
      status: cardResponse.status,
      authorizationCode: cardResponse.credit?.authorization_code,
      provider: 'getnet',
    });
  } catch (error) {
    console.error('Erro ao criar pagamento cartão:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pagamento com cartão' },
      { status: 500 }
    );
  }
}
