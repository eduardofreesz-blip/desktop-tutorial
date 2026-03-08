/**
 * Endpoint para verificar se o deploy foi aplicado.
 * Acesse: https://seusite.com/api/deploy-info
 */
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let commit = 'unknown';
    let branch = 'unknown';
    try {
      commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      // git não disponível ou não é um repo
    }
    return NextResponse.json({
      ok: true,
      commit,
      branch,
      build: 'apps-em-texto-v2',
      message: 'Se você vê isso, o servidor está rodando. Compare "commit" com: git log -1 --oneline',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
