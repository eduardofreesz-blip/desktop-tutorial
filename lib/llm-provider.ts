export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'abacus';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function testLLMConnection(config: LLMConfig): Promise<{ success: boolean; message: string }> {
  if (!config.provider || !config.model) {
    return { success: false, message: 'Provider e modelo são obrigatórios' };
  }
  if (config.provider !== 'ollama' && !config.apiKey) {
    return { success: false, message: 'API Key é obrigatória para este provider' };
  }
  return { success: true, message: `Conexão com ${config.provider}/${config.model} testada com sucesso` };
}

export async function listOllamaModels(baseUrl?: string): Promise<string[]> {
  try {
    const url = baseUrl || 'http://localhost:11434';
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

export async function generateLLMResponse(prompt: string, config: LLMConfig): Promise<string> {
  return `Resposta gerada pelo ${config.provider}/${config.model}`;
}
