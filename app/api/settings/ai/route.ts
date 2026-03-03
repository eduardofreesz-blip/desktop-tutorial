import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { testLLMConnection, listOllamaModels, LLMConfig } from '@/lib/llm-provider';

/**
 * GET - Obtém configuração atual de IA
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const configs = await prisma.config.findMany({
      where: {
        key: {
          startsWith: 'llm_'
        }
      }
    });

    const configMap: Record<string, string> = {};
    configs.forEach(c => {
      // Não retorna a API key completa por segurança
      if (c.key === 'llm_api_key' && c.value) {
        configMap[c.key] = c.value.substring(0, 8) + '...' + c.value.substring(c.value.length - 4);
        configMap['llm_api_key_set'] = 'true';
      } else {
        configMap[c.key] = c.value;
      }
    });

    return NextResponse.json({
      provider: configMap.llm_provider || null,
      model: configMap.llm_model || null,
      baseUrl: configMap.llm_base_url || 'http://localhost:11434',
      temperature: configMap.llm_temperature || '0.7',
      maxTokens: configMap.llm_max_tokens || '2048',
      apiKeySet: configMap.llm_api_key_set === 'true',
      apiKeyPreview: configMap.llm_api_key || null
    });
  } catch (error: any) {
    console.error('[AI Settings] Erro ao obter configuração:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST - Salva configuração de IA
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey, model, baseUrl, temperature, maxTokens } = body;

    // Salva configurações
    const configsToSave: { key: string; value: string }[] = [];

    if (provider) {
      configsToSave.push({ key: 'llm_provider', value: provider });
    }

    if (apiKey) {
      configsToSave.push({ key: 'llm_api_key', value: apiKey });
    }

    if (model) {
      configsToSave.push({ key: 'llm_model', value: model });
    }

    if (baseUrl) {
      configsToSave.push({ key: 'llm_base_url', value: baseUrl });
    }

    if (temperature !== undefined) {
      configsToSave.push({ key: 'llm_temperature', value: String(temperature) });
    }

    if (maxTokens !== undefined) {
      configsToSave.push({ key: 'llm_max_tokens', value: String(maxTokens) });
    }

    // Upsert cada configuração
    for (const config of configsToSave) {
      await prisma.config.upsert({
        where: { key: config.key },
        update: { value: config.value },
        create: { key: config.key, value: config.value }
      });
    }

    return NextResponse.json({ success: true, message: 'Configurações salvas!' });
  } catch (error: any) {
    console.error('[AI Settings] Erro ao salvar configuração:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT - Testa conexão com o provedor
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'test') {
      const config: LLMConfig = {
        provider: body.provider,
        apiKey: body.apiKey,
        model: body.model,
        baseUrl: body.baseUrl,
        temperature: body.temperature,
        maxTokens: body.maxTokens
      };

      const result = await testLLMConnection(config);
      return NextResponse.json(result);
    }

    if (action === 'list_ollama_models') {
      const models = await listOllamaModels(body.baseUrl);
      return NextResponse.json({ models });
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error: any) {
    console.error('[AI Settings] Erro na ação:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
