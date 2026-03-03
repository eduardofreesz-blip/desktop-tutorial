'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import {
  Brain,
  Zap,
  Server,
  Key,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Save,
  TestTube,
  Cpu,
  Cloud,
  DollarSign,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Info
} from 'lucide-react';

interface ProviderInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  pricing: string;
  models: string[];
  requiresKey: boolean;
  docsUrl: string;
  color: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: <Cloud className="w-6 h-6" />,
    description: 'Acesso a múltiplos modelos (GPT, Claude, Llama, etc.) com uma única API',
    pricing: '~$5-20/mês',
    models: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3-haiku', 'anthropic/claude-3-sonnet', 'meta-llama/llama-3.1-70b-instruct', 'google/gemini-pro'],
    requiresKey: true,
    docsUrl: 'https://openrouter.ai/keys',
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    icon: <Sparkles className="w-6 h-6" />,
    description: 'GPT-4, GPT-3.5 Turbo - Modelos da OpenAI diretamente',
    pricing: '~$10-30/mês',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    requiresKey: true,
    docsUrl: 'https://platform.openai.com/api-keys',
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    icon: <Brain className="w-6 h-6" />,
    description: 'Claude 3 - Modelos avançados da Anthropic',
    pricing: '~$15-40/mês',
    models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
    requiresKey: true,
    docsUrl: 'https://console.anthropic.com/settings/keys',
    color: 'from-orange-500 to-amber-500'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: <Zap className="w-6 h-6" />,
    description: 'Gemini 1.5 Pro/Flash - Modelos do Google AI Studio',
    pricing: 'Grátis/~$5-15/mês',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-2.0-flash-exp'],
    requiresKey: true,
    docsUrl: 'https://aistudio.google.com/app/apikey',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: <Server className="w-6 h-6" />,
    description: 'Modelos locais na sua VPS - Gratuito, mas requer recursos',
    pricing: 'Grátis',
    models: ['llama3.2:3b', 'llama3.2:1b', 'phi3:mini', 'mistral:7b', 'gemma2:2b'],
    requiresKey: false,
    docsUrl: 'https://ollama.ai/download',
    color: 'from-blue-500 to-cyan-500'
  }
];

export default function AISettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (selectedProvider === 'ollama') {
      loadOllamaModels();
    }
  }, [selectedProvider, baseUrl]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/settings/ai');
      const data = await res.json();
      
      if (data.provider) setSelectedProvider(data.provider);
      if (data.model) setModel(data.model);
      if (data.baseUrl) setBaseUrl(data.baseUrl);
      if (data.temperature) setTemperature(parseFloat(data.temperature));
      if (data.maxTokens) setMaxTokens(parseInt(data.maxTokens));
      setApiKeySet(data.apiKeySet || false);
      setApiKeyPreview(data.apiKeyPreview || '');
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOllamaModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_ollama_models', baseUrl })
      });
      const data = await res.json();
      setOllamaModels(data.models || []);
    } catch (error) {
      console.error('Erro ao listar modelos Ollama:', error);
      setOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKey || undefined,
          model,
          baseUrl: selectedProvider === 'ollama' ? baseUrl : undefined,
          temperature,
          maxTokens
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Configurações salvas!');
        if (apiKey) {
          setApiKeySet(true);
          setApiKeyPreview(apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4));
          setApiKey('');
        }
      } else {
        toast.error(data.error || 'Erro ao salvar');
      }
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          provider: selectedProvider,
          apiKey: apiKey || undefined,
          model,
          baseUrl: selectedProvider === 'ollama' ? baseUrl : undefined,
          temperature,
          maxTokens
        })
      });
      
      const data = await res.json();
      setTestResult(data);
      
      if (data.success) {
        toast.success('Conexão funcionando!');
      } else {
        toast.error(data.message || 'Falha na conexão');
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Erro ao testar conexão' });
      toast.error('Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const getProviderInfo = (id: string) => PROVIDERS.find(p => p.id === id);
  const currentProvider = getProviderInfo(selectedProvider);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-500" />
            Inteligência Artificial
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure o provedor de IA para WhatsApp, Telegram e ARIA
          </p>
        </div>
        <Badge variant={apiKeySet || selectedProvider === 'ollama' ? 'default' : 'destructive'} className="gap-1">
          {apiKeySet || selectedProvider === 'ollama' ? (
            <><CheckCircle className="w-3 h-3" /> Configurado</>
          ) : (
            <><XCircle className="w-3 h-3" /> Não configurado</>
          )}
        </Badge>
      </div>

      <Tabs defaultValue="provider" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="provider" className="gap-2">
            <Cloud className="w-4 h-4" /> Provedor
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="w-4 h-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2">
            <TestTube className="w-4 h-4" /> Testar
          </TabsTrigger>
        </TabsList>

        {/* Tab: Provedor */}
        <TabsContent value="provider" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROVIDERS.map((provider) => (
              <Card
                key={provider.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedProvider === provider.id
                    ? 'ring-2 ring-primary shadow-lg'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => {
                  setSelectedProvider(provider.id);
                  setModel(provider.models[0]);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${provider.color} text-white`}>
                      {provider.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{provider.name}</h3>
                        <Badge variant="outline" className="gap-1">
                          <DollarSign className="w-3 h-3" />
                          {provider.pricing}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {provider.description}
                      </p>
                      {selectedProvider === provider.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600">Selecionado</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {currentProvider && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-700 dark:text-blue-300">
                      Como obter API Key do {currentProvider.name}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      {currentProvider.requiresKey ? (
                        <>Acesse o painel do provedor para criar sua chave de API.</>                      ) : (
                        <>Este provedor roda localmente e não precisa de API Key.</>                      )}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1"
                      onClick={() => window.open(currentProvider.docsUrl, '_blank')}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir Documentação
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Configuração */}
        <TabsContent value="config" className="space-y-4">
          {!selectedProvider ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Selecione um provedor na aba anterior</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* API Key */}
              {currentProvider?.requiresKey && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Key className="w-5 h-5" /> API Key
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {apiKeySet && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">Chave configurada: {apiKeyPreview}</span>
                      </div>
                    )}
                    <div>
                      <Label>Nova API Key (deixe vazio para manter a atual)</Label>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-... ou sua chave de API"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ollama URL */}
              {selectedProvider === 'ollama' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Server className="w-5 h-5" /> Servidor Ollama
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>URL do Servidor</Label>
                      <div className="flex gap-2">
                        <Input
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder="http://localhost:11434"
                        />
                        <Button
                          variant="outline"
                          onClick={loadOllamaModels}
                          disabled={loadingModels}
                        >
                          {loadingModels ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {ollamaModels.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        {ollamaModels.length} modelos encontrados
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Modelo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Cpu className="w-5 h-5" /> Modelo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider === 'ollama' && ollamaModels.length > 0 ? (
                        ollamaModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))
                      ) : (
                        currentProvider?.models.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Parâmetros */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="w-5 h-5" /> Parâmetros
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Temperatura: {temperature.toFixed(1)}</Label>
                      <span className="text-xs text-muted-foreground">
                        {temperature < 0.3 ? 'Preciso' : temperature < 0.7 ? 'Equilibrado' : 'Criativo'}
                      </span>
                    </div>
                    <Slider
                      value={[temperature]}
                      onValueChange={([v]) => setTemperature(v)}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>
                  <div>
                    <Label>Máximo de Tokens</Label>
                    <Select value={String(maxTokens)} onValueChange={(v) => setMaxTokens(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512 (Respostas curtas)</SelectItem>
                        <SelectItem value="1024">1024 (Médio)</SelectItem>
                        <SelectItem value="2048">2048 (Padrão)</SelectItem>
                        <SelectItem value="4096">4096 (Longas)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Botão Salvar */}
              <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Configurações
              </Button>
            </>
          )}
        </TabsContent>

        {/* Tab: Testar */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5" /> Testar Conexão
              </CardTitle>
              <CardDescription>
                Verifique se a configuração está funcionando corretamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span>Provedor:</span>
                  <span className="font-medium">{currentProvider?.name || 'Não selecionado'}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span>Modelo:</span>
                  <span className="font-medium">{model || 'Não selecionado'}</span>
                </div>
                {selectedProvider === 'ollama' && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span>URL:</span>
                    <span className="font-medium">{baseUrl}</span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleTest}
                disabled={testing || !selectedProvider}
                className="w-full gap-2"
                variant={testResult?.success ? 'default' : 'outline'}
              >
                {testing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Testar Conexão</>
                )}
              </Button>

              {testResult && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">
                      {testResult.success ? 'Conexão OK!' : 'Erro na Conexão'}
                    </p>
                    <p className="text-sm mt-1">{testResult.message}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
