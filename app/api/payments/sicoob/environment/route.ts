import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { environment } = await request.json();

    if (!['sandbox', 'production'].includes(environment)) {
      return NextResponse.json({ error: 'Ambiente inválido' }, { status: 400 });
    }

    // Update .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {
      envContent = '';
    }

    const regex = /^SICOOB_ENVIRONMENT=.*$/m;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `SICOOB_ENVIRONMENT=${environment}`);
    } else {
      envContent += `\nSICOOB_ENVIRONMENT=${environment}`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    process.env.SICOOB_ENVIRONMENT = environment;

    return NextResponse.json({ success: true, environment });
  } catch (error) {
    console.error('Erro ao atualizar ambiente Sicoob:', error);
    return NextResponse.json({ error: 'Erro ao atualizar ambiente' }, { status: 500 });
  }
}
