import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { environment } = body;

    if (!['sandbox', 'production'].includes(environment)) {
      return NextResponse.json(
        { error: 'Ambiente inválido. Use "sandbox" ou "production"' },
        { status: 400 }
      );
    }

    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {
      envContent = '';
    }

    if (envContent.includes('MERCADOPAGO_ENVIRONMENT=')) {
      envContent = envContent.replace(
        /MERCADOPAGO_ENVIRONMENT=.*/,
        `MERCADOPAGO_ENVIRONMENT=${environment}`
      );
    } else {
      envContent += `\nMERCADOPAGO_ENVIRONMENT=${environment}`;
    }

    fs.writeFileSync(envPath, envContent);
    process.env.MERCADOPAGO_ENVIRONMENT = environment;

    return NextResponse.json({
      success: true,
      environment,
      message: `Ambiente Mercado Pago alterado para ${environment}`,
    });
  } catch (error) {
    console.error('Erro ao atualizar ambiente Mercado Pago:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar ambiente' },
      { status: 500 }
    );
  }
}
