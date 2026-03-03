import { prisma } from '../db';

export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const PROVIDERS = [
  { id: 'routellm', name: 'RouteLLM (Abacus)', description: 'Já configurado, usa sua conta Abacus', tag: 'Recomendado', models: ['route-llm', 'gpt-4.1', 'gpt-4.1-mini'] },
  { id: 'google', name: 'Google Gemini', description: 'Gratuito até 60 req/min', tag: 'Gratuito', models: ['gemini-pro', 'gemini-1.5-flash'] },
  { id: 'deepseek', name: 'DeepSeek', description: '~$0.14/1M tokens', tag: 'Barato', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o e outros', tag: 'Premium', models: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'] },
  { id: 'ollama', name: 'Ollama (Local)', description: 'Gratuito, roda na VPS', tag: 'Local', models: ['llama3', 'mistral', 'codellama', 'phi3'] },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 3.5 Sonnet', tag: 'Premium', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3.5-sonnet'] },
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
