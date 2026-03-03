// Alterar ambiente FitBank (sandbox/production)
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { environment } = await request.json();

    if (!['sandbox', 'production'].includes(environment)) {
      return NextResponse.json(
        { error: 'Ambiente inválido. Use sandbox ou production.' },
        { status: 400 }
      );
    }

    // Atualizar .env
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Atualizar ou adicionar FITBANK_ENVIRONMENT
    const envRegex = /^FITBANK_ENVIRONMENT=.*/m;
    const newEnvLine = `FITBANK_ENVIRONMENT=${environment}`;

    if (envRegex.test(envContent)) {
      envContent = envContent.replace(envRegex, newEnvLine);
    } else {
      envContent += `\n${newEnvLine}`;
    }

    fs.writeFileSync(envPath, envContent);

    // Atualizar runtime
    process.env.FITBANK_ENVIRONMENT = environment;

    return NextResponse.json({
      success: true,
      message: `Ambiente alterado para ${environment}`,
      environment,
    });
  } catch (error: any) {
    console.error('[FitBank] Erro ao alterar ambiente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao alterar ambiente' },
      { status: 500 }
    );
  }
}
