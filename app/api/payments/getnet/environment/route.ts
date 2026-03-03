import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { environment } = await request.json();

    if (!['sandbox', 'production'].includes(environment)) {
      return NextResponse.json(
        { error: 'Ambiente inválido' },
        { status: 400 }
      );
    }

    // Atualizar variável de ambiente no .env
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch (error) {
      // Arquivo não existe, criar novo
    }

    // Atualizar ou adicionar GETNET_ENVIRONMENT
    const envLines = envContent.split('\n');
    let found = false;

    const newLines = envLines.map((line) => {
      if (line.startsWith('GETNET_ENVIRONMENT=')) {
        found = true;
        return `GETNET_ENVIRONMENT=${environment}`;
      }
      return line;
    });

    if (!found) {
      newLines.push(`GETNET_ENVIRONMENT=${environment}`);
    }

    fs.writeFileSync(envPath, newLines.join('\n'));

    // Atualizar process.env também
    process.env.GETNET_ENVIRONMENT = environment;

    return NextResponse.json({
      success: true,
      environment,
    });
  } catch (error) {
    console.error('Erro ao atualizar ambiente:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar ambiente' },
      { status: 500 }
    );
  }
}
