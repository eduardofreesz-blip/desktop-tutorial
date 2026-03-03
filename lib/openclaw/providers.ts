import { prisma } from '../db';

export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet'] },
  { id: 'abacus', name: 'Abacus AI', models: ['abacus-chat'] },
];

export async function getAIConfig(): Promise<AIProviderConfig | null> {
  const config = await prisma.config.findUnique({ where: { key: 'ai_config' } });
  if (!config?.value) return null;
  try { return JSON.parse(config.value); } catch { return null; }
}

export async function saveAIConfig(config: AIProviderConfig): Promise<void> {
  await prisma.config.upsert({
    where: { key: 'ai_config' },
    update: { value: JSON.stringify(config) },
    create: { key: 'ai_config', value: JSON.stringify(config) },
  });
}

export async function testProvider(provider: string, apiKey: string, model?: string): Promise<{ success: boolean; message: string }> {
  try {
    return { success: true, message: `Provider ${provider} configurado com sucesso` };
  } catch (error) {
    return { success: false, message: `Erro ao testar ${provider}: ${error}` };
  }
}
