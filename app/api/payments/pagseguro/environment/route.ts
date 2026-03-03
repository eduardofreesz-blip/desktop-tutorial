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

    // Atualizar .env
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {
      envContent = '';
    }

    // Atualizar ou adicionar PAGSEGURO_ENVIRONMENT
    if (envContent.includes('PAGSEGURO_ENVIRONMENT=')) {
      envContent = envContent.replace(
        /PAGSEGURO_ENVIRONMENT=.*/,
        `PAGSEGURO_ENVIRONMENT=${environment}`
      );
    } else {
      envContent += `\nPAGSEGURO_ENVIRONMENT=${environment}`;
    }

    fs.writeFileSync(envPath, envContent);
    process.env.PAGSEGURO_ENVIRONMENT = environment;

    return NextResponse.json({
      success: true,
      environment,
      message: `Ambiente alterado para ${environment}`,
    });
  } catch (error) {
    console.error('Erro ao atualizar ambiente PagSeguro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar ambiente' },
      { status: 500 }
    );
  }
}
