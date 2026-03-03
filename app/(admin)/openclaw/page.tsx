'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Bot,
  Send,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  TestTube,
  Cpu,
  Server,
  Key,
  MessageSquare,
  Terminal,
  FileCode,
  RefreshCw,
  Trash2,
  Copy,
  Play,
  Clock,
  AlertTriangle,
  Phone,
  Plus,
  X,
  Activity,
  HardDrive,
  Zap
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'response' | 'confirmation_needed' | 'executed' | 'error';
  pendingAction?: any;
}

interface Provider {
  id: string;
  name: string;
  models: string[];
  requiresKey: boolean;
}

interface SystemStats {
  memory: string;
  disk: string;
  cpu: string;
}

export default function OpenClawPage() {
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Config State - Providers inicializados diretamente
  const [providers, setProviders] = useState<Provider[]>([
    { id: 'routellm', name: 'RouteLLM (Abacus)', models: ['route-llm', 'gpt-4o', 'claude-3-sonnet'], requiresKey: false },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'], requiresKey: true },
    { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'], requiresKey: true },
    { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], requiresKey: true },
    { id: 'ollama', name: 'Ollama (Local)', models: ['llama3.2:1b', 'llama3.2:3b', 'mistral', 'codellama'], requiresKey: false },
  ]);
  const [selectedProvider, setSelectedProvider] = useState('routellm');
  const [selectedModel, setSelectedModel] = useState('route-llm');
  const [apiKey, setApiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);

  // Admin Numbers
  const [adminNumbers, setAdminNumbers] = useState<string[]>([]);
  const [newAdminNumber, setNewAdminNumber] = useState('');

  // System Stats
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // WhatsApp Bot Toggle
  const [openclawBotEnabled, setOpenclawBotEnabled] = useState(false);
  const [savingBotConfig, setSavingBotConfig] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState('chat');

  // Load initial data
  useEffect(() => {
    loadConfig();
    loadStats();
    loadBotConfig();
  }, []);

  // Load bot config
  const loadBotConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.openclaw_bot_enabled === 'true') {
        setOpenclawBotEnabled(true);
      }
    } catch (e) {
      console.error('Erro ao carregar config bot:', e);
    }
  };

  // Toggle bot
  const toggleOpenClawBot = async () => {
    setSavingBotConfig(true);
    try {
      const newValue = !openclawBotEnabled;
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openclaw_bot_enabled: newValue ? 'true' : 'false' })
      });
      
      if (res.ok) {
        setOpenclawBotEnabled(newValue);
        toast.success(newValue ? '🤖 OpenClaw ativado como bot do WhatsApp!' : '📴 Bot tradicional reativado');
      }
    } catch (e) {
      toast.error('Erro ao alterar configuração');
    } finally {
      setSavingBotConfig(false);
    }
  };

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/openclaw/autonomous');
      const data = await res.json();
      
      if (data.success) {
        setProviders(data.providers || []);
        if (data.config) {
          setSelectedProvider(data.config.provider || 'routellm');
          setSelectedModel(data.config.model || 'route-llm');
          setApiKey(data.config.apiKey || '');
          setOllamaUrl(data.config.ollamaUrl || 'http://localhost:11434');
          setTemperature(data.config.temperature || 0.7);
          setMaxTokens(data.config.maxTokens || 4096);
        }
        if (data.admins) {
          setAdminNumbers(data.admins);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/openclaw/autonomous?action=stats');
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/openclaw/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process',
          command: input,
          confirmationId: pendingConfirmation?.id
        })
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'Sem resposta',
        timestamp: new Date(),
        type: data.type,
        pendingAction: data.pendingAction
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.type === 'confirmation_needed' && data.pendingAction) {
        setPendingConfirmation(data.pendingAction);
      } else {
        setPendingConfirmation(null);
      }

    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erro: ${error.message}`,
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmation = async (confirm: boolean) => {
    if (!pendingConfirmation) return;

    setLoading(true);
    try {
      const res = await fetch('/api/openclaw/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process',
          command: confirm ? 'sim' : 'nao',
          confirmationId: pendingConfirmation.id
        })
      });

      const data = await res.json();

      const responseMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        type: data.type
      };

      setMessages(prev => [...prev, responseMessage]);
      setPendingConfirmation(null);

      if (data.type === 'executed') {
        toast.success('Ação executada com sucesso!');
      }
    } catch (error: any) {
      toast.error('Erro ao processar confirmação');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/openclaw/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          config: {
            provider: selectedProvider,
            model: selectedModel,
            apiKey,
            ollamaUrl,
            temperature,
            maxTokens
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Configuração salva!');
      } else {
        toast.error(data.message || 'Erro ao salvar');
      }
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
  };

  const testConnection = async () => {
    setTestingProvider(true);
    try {
      const res = await fetch('/api/openclaw/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_provider',
          providerId: selectedProvider,
          apiKey
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Conexão OK!');
      } else {
        toast.error(data.message || 'Falha na conexão');
      }
    } catch (error) {
      toast.error('Erro ao testar conexão');
    } finally {
      setTestingProvider(false);
    }
  };

  const addAdminNumber = async () => {
    if (!newAdminNumber.trim()) return;
    
    const cleaned = newAdminNumber.replace(/\D/g, '');
    if (adminNumbers.includes(cleaned)) {
      toast.error('Número já adicionado');
      return;
    }

    const newNumbers = [...adminNumbers, cleaned];
    setAdminNumbers(newNumbers);
    setNewAdminNumber('');

    try {
      await fetch('/api/openclaw/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_admins', numbers: newNumbers })
      });
      toast.success('Admin adicionado!');
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const removeAdminNumber = async (number: string) => {
    const newNumbers = adminNumbers.filter(n => n !== number);
    setAdminNumbers(newNumbers);

    try {
      await fetch('/api/openclaw/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_admins', numbers: newNumbers })
      });
      toast.success('Admin removido!');
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPendingConfirmation(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">OpenClaw</h1>
            <p className="text-sm text-muted-foreground">Assistente AI Autônomo</p>
          </div>
        </div>

        {/* Status Cards */}
        <div className="flex gap-4">
          {stats && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Cpu className="w-4 h-4 text-blue-500" />
                <span className="text-sm">{stats.cpu}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Activity className="w-4 h-4 text-green-500" />
                <span className="text-sm">{stats.memory}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <HardDrive className="w-4 h-4 text-orange-500" />
                <span className="text-sm">{stats.disk}</span>
              </div>
            </>
          )}
          <Button variant="outline" size="sm" onClick={loadStats} disabled={loadingStats}>
            <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* WhatsApp Bot Toggle */}
      <Card className={`mb-4 border-2 ${openclawBotEnabled ? 'border-green-500 bg-green-500/10' : 'border-gray-300'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${openclawBotEnabled ? 'bg-green-500' : 'bg-gray-400'}`}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Motor do WhatsApp Bot</h3>
                <p className="text-sm text-muted-foreground">
                  {openclawBotEnabled 
                    ? '🤖 OpenClaw IA está respondendo todas as mensagens' 
                    : '📋 Bot tradicional (baseado em regras)'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={toggleOpenClawBot}
                disabled={savingBotConfig}
                variant={openclawBotEnabled ? "default" : "outline"}
                className={`min-w-[180px] ${openclawBotEnabled ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                {savingBotConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : openclawBotEnabled ? (
                  <CheckCircle className="w-4 h-4 mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                {openclawBotEnabled ? 'OpenClaw ATIVO' : 'Bot Tradicional'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Chat
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="w-4 h-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <Phone className="w-4 h-4" /> WhatsApp Admin
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Terminal OpenClaw</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Zap className="w-3 h-3" />
                    {selectedProvider}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={clearChat}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bot className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Digite um comando para começar</p>
                      <p className="text-sm mt-2">Ex: "arruma o botão de pagamentos que não salva"</p>
                    </div>
                  )}
                  
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : msg.type === 'error'
                            ? 'bg-red-100 dark:bg-red-900/30 border border-red-200'
                            : msg.type === 'confirmation_needed'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200'
                            : msg.type === 'executed'
                            ? 'bg-green-100 dark:bg-green-900/30 border border-green-200'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {msg.role === 'assistant' && (
                            <Bot className="w-5 h-5 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs opacity-60">
                                {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                              </span>
                              {msg.role === 'assistant' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => copyToClipboard(msg.content)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Confirmation Buttons */}
              {pendingConfirmation && (
                <div className="flex gap-2 justify-center py-3 border-t mt-2">
                  <Button
                    onClick={() => handleConfirmation(true)}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar
                  </Button>
                  <Button
                    onClick={() => handleConfirmation(false)}
                    disabled={loading}
                    variant="destructive"
                    className="gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancelar
                  </Button>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2 pt-4 border-t mt-2">
                <Textarea
                  placeholder="Digite um comando... (Ex: 'arruma o botão de pagamentos')"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1 min-h-[60px] resize-none"
                  disabled={loading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="self-end gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Provider Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Provedor de IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Provedor</Label>
                  <Select value={selectedProvider} onValueChange={(v) => {
                    setSelectedProvider(v);
                    const provider = providers.find(p => p.id === v);
                    if (provider?.models[0]) setSelectedModel(provider.models[0]);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentProvider?.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {currentProvider?.requiresKey && (
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Sua API Key"
                    />
                  </div>
                )}

                {selectedProvider === 'ollama' && (
                  <div className="space-y-2">
                    <Label>URL do Ollama</Label>
                    <Input
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={testConnection} disabled={testingProvider} variant="outline" className="gap-2">
                    {testingProvider ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                    Testar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configurações Avançadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Temperatura: {temperature}</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Menor = mais preciso, Maior = mais criativo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Máx Tokens</Label>
                  <Input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    min={256}
                    max={8192}
                  />
                </div>

                <Button onClick={saveConfig} disabled={savingConfig} className="w-full gap-2">
                  {savingConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar Configuração
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Provider Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações dos Provedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium">RouteLLM (Abacus)</h4>
                  <p className="text-sm text-muted-foreground">Já configurado, usa sua conta Abacus</p>
                  <Badge variant="outline" className="mt-2">Recomendado</Badge>
                </div>
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium">Google Gemini</h4>
                  <p className="text-sm text-muted-foreground">Gratuito até 60 req/min</p>
                  <Badge variant="outline" className="mt-2">Gratuito</Badge>
                </div>
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium">DeepSeek</h4>
                  <p className="text-sm text-muted-foreground">~$0.14/1M tokens</p>
                  <Badge variant="outline" className="mt-2">Barato</Badge>
                </div>
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium">OpenAI</h4>
                  <p className="text-sm text-muted-foreground">GPT-4o e outros</p>
                  <Badge variant="outline" className="mt-2">Premium</Badge>
                </div>
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium">Ollama (Local)</h4>
                  <p className="text-sm text-muted-foreground">Gratuito, roda na VPS</p>
                  <Badge variant="outline" className="mt-2">Local</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Admin Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          {/* Motor do Bot - Toggle Principal */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Motor do Bot WhatsApp
              </CardTitle>
              <CardDescription>
                Escolha qual sistema vai responder as mensagens do WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">
                    {openclawBotEnabled ? '🤖 OpenClaw IA' : '📋 Bot Tradicional'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {openclawBotEnabled 
                      ? 'IA responde com linguagem natural e contexto' 
                      : 'Bot baseado em regras e menus numéricos'}
                  </p>
                </div>
                <Button
                  onClick={toggleOpenClawBot}
                  disabled={savingBotConfig}
                  size="lg"
                  variant={openclawBotEnabled ? "default" : "outline"}
                  className={`min-w-[200px] ${openclawBotEnabled ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {savingBotConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : openclawBotEnabled ? (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {openclawBotEnabled ? 'OpenClaw IA ATIVO' : 'Ativar OpenClaw IA'}
                </Button>
              </div>
              
              {openclawBotEnabled && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    ✅ OpenClaw IA ativo! Usando provedor: <strong>{selectedProvider}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Números Admin */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Números Admin WhatsApp
              </CardTitle>
              <CardDescription>
                Adicione números que podem controlar o OpenClaw via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Number */}
              <div className="flex gap-2">
                <Input
                  placeholder="5511999999999"
                  value={newAdminNumber}
                  onChange={(e) => setNewAdminNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAdminNumber()}
                />
                <Button onClick={addAdminNumber} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
              </div>

              {/* Numbers List */}
              <div className="space-y-2">
                {adminNumbers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum número admin cadastrado
                  </p>
                ) : (
                  adminNumbers.map((number) => (
                    <div key={number} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-green-500" />
                        <span>+{number}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAdminNumber(number)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Instructions */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Como usar via WhatsApp:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Envie mensagem começando com <code>/</code> ou <code>#</code></li>
                  <li>• Exemplo: <code>/status</code> - ver status do sistema</li>
                  <li>• Exemplo: <code>/restart</code> - reiniciar aplicação</li>
                  <li>• Ou envie em linguagem natural: "arruma o botão X"</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
