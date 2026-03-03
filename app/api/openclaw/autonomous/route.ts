import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { processCommand, quickCommand, loadAdminNumbers, saveAdminNumbers } from '@/lib/openclaw/core';
import { getAIConfig, saveAIConfig, PROVIDERS, testProvider } from '@/lib/openclaw/providers';
import { readFile, listFiles, searchInFiles } from '@/lib/openclaw/file-editor';
import { getPendingActionsByChannel, cancelAllActions } from '@/lib/openclaw/confirmation';
import { getSystemStats } from '@/lib/openclaw/executor';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action, command, config, confirmationId, quickCmd } = body;

    // Ações específicas
    switch (action) {
      case 'process':
        // Processar comando principal
        const result = await processCommand({
          command,
          channel: 'web',
          confirmationId
        });
        return NextResponse.json(result);

      case 'quick':
        // Comando rápido
        const quickResult = await quickCommand(quickCmd);
        return NextResponse.json(quickResult);

      case 'read_file':
        // Ler arquivo
        const file = await readFile(body.filePath);
        return NextResponse.json({
          success: !!file,
          file,
          message: file ? 'Arquivo lido' : 'Arquivo não encontrado'
        });

      case 'list_files':
        // Listar arquivos
        const files = await listFiles(body.dirPath || '.', body.extensions);
        return NextResponse.json({ success: true, files });

      case 'search':
        // Buscar em arquivos
        const searchResults = await searchInFiles(body.searchTerm, body.dirPath);
        return NextResponse.json({ success: true, results: searchResults });

      case 'save_config':
        // Salvar configuração
        await saveAIConfig(config);
        return NextResponse.json({ success: true, message: 'Configuração salva' });

      case 'test_provider':
        // Testar provider
        const testResult = await testProvider(body.providerId, body.apiKey);
        return NextResponse.json(testResult);

      case 'get_pending':
        // Buscar ações pendentes
        const pending = getPendingActionsByChannel('web');
        return NextResponse.json({ success: true, actions: pending });

      case 'cancel_all':
        // Cancelar todas as ações pendentes
        const cancelled = cancelAllActions('web');
        return NextResponse.json({ success: true, cancelled });

      case 'system_stats':
        // Status do sistema
        const stats = await getSystemStats();
        return NextResponse.json({ success: true, stats });

      case 'save_admins':
        // Salvar números admin
        await saveAdminNumbers(body.numbers || []);
        return NextResponse.json({ success: true, message: 'Admins salvos' });

      case 'load_admins':
        // Carregar números admin
        const admins = await loadAdminNumbers();
        return NextResponse.json({ success: true, admins });

      default:
        // Comando padrão (processar como texto)
        if (command) {
          const defaultResult = await processCommand({
            command,
            channel: 'web'
          });
          return NextResponse.json(defaultResult);
        }
        return NextResponse.json({ success: false, message: 'Ação não especificada' });
    }

  } catch (error: any) {
    console.error('[OpenClaw API] Erro:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'config':
        const config = await getAIConfig();
        return NextResponse.json({ success: true, config });

      case 'providers':
        return NextResponse.json({ success: true, providers: PROVIDERS });

      case 'stats':
        const stats = await getSystemStats();
        return NextResponse.json({ success: true, stats });

      case 'pending':
        const pending = getPendingActionsByChannel('web');
        return NextResponse.json({ success: true, actions: pending });

      case 'admins':
        const admins = await loadAdminNumbers();
        return NextResponse.json({ success: true, admins });

      default:
        // Retornar status geral
        const [configData, statsData, pendingData, adminsData] = await Promise.all([
          getAIConfig(),
          getSystemStats(),
          getPendingActionsByChannel('web'),
          loadAdminNumbers()
        ]);

        return NextResponse.json({
          success: true,
          config: configData,
          stats: statsData,
          pending: pendingData,
          admins: adminsData,
          providers: PROVIDERS
        });
    }

  } catch (error: any) {
    console.error('[OpenClaw API GET] Erro:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
