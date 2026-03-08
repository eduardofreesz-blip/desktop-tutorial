'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Smartphone, Wifi, WifiOff, RefreshCw, Send, QrCode, Power, Loader2, 
  RotateCcw, Trash2, Bot, Sparkles, Copy, Check, Clock, Server, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_ready';
  qrCode: string | null;
  lastError: string | null;
  phoneNumber?: string | null;
  userName?: string | null;
  scheduledReconnect?: string | null;
}

export default function WhatsAppPage() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'disconnected',
    qrCode: null,
    lastError: null,
  });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [evolutionEnabled, setEvolutionEnabled] = useState(false);
  const [evolutionLoading, setEvolutionLoading] = useState(false);

  // IA Assistant
  const [customerMessage, setCustomerMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, configRes] = await Promise.all([
        fetch('/api/whatsapp/status'),
        fetch('/api/config'),
      ]);
      const data = await statusRes.json();
      setConnectionStatus(data);
      const config = await configRes.json();
      setEvolutionEnabled(config?.evolution_api_enabled === 'true');
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  }, []);

  const handleEvolutionToggle = async (checked: boolean) => {
    setEvolutionLoading(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evolution_api_enabled: checked ? 'true' : 'false' }),
      });
      if (res.ok) {
        setEvolutionEnabled(checked);
        toast.success(checked ? 'Evolution API ativada' : 'Evolution API desativada');
      } else {
        toast.error('Erro ao salvar');
      }
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setEvolutionLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      setConnectionStatus(data);
      toast.success('Iniciando conexão...');
    } catch (error) {
      toast.error('Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading('disconnect');
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setConnectionStatus({ status: 'disconnected', qrCode: null, lastError: null });
      toast.success('Desconectado com sucesso');
    } catch (error) {
      toast.error('Erro ao desconectar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setActionLoading('restart');
    try {
      const res = await fetch('/api/whatsapp/restart', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Bot reiniciado com sucesso');
      } else {
        toast.error(data.error || 'Erro ao reiniciar');
      }
    } catch (error) {
      toast.error('Erro ao reiniciar bot');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearSession = async () => {
    if (!confirm('Tem certeza que deseja remover a sessão? Você precisará escanear o QR Code novamente.')) {
      return;
    }
    
    setActionLoading('clear');
    try {
      const res = await fetch('/api/whatsapp/clear-session', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus({ status: 'disconnected', qrCode: null, lastError: null });
        toast.success('Sessão removida. Escaneie o QR Code para reconectar.');
      } else {
        toast.error(data.error || 'Erro ao remover sessão');
      }
    } catch (error) {
      toast.error('Erro ao remover sessão');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetBlock = async () => {
    setActionLoading('reset');
    try {
      const res = await fetch('/api/whatsapp/reset-block', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus({ status: 'disconnected', qrCode: null, lastError: null });
        toast.success('Bloqueio resetado. Tente conectar novamente.');
      } else {
        toast.error(data.error || 'Erro ao resetar');
      }
    } catch (error) {
      toast.error('Erro ao resetar bloqueio');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone || !testMessage) {
      toast.error('Preencha o número e a mensagem');
      return;
    }

    setSendingTest(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: testPhone, message: testMessage }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Mensagem enviada!');
        setTestMessage('');
      } else {
        toast.error(data.error || 'Erro ao enviar');
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSendingTest(false);
    }
  };

  const handleGenerateAIResponse = async () => {
    if (!customerMessage.trim()) {
      toast.error('Digite a mensagem do cliente');
      return;
    }

    setAiLoading(true);
    setAiResponse('');
    
    try {
      const res = await fetch('/api/whatsapp/ai-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerMessage }),
      });
      const data = await res.json();

      if (data.success) {
        setAiResponse(data.response);
      } else {
        toast.error(data.error || 'Erro ao gerar resposta');
      }
    } catch (error) {
      toast.error('Erro ao gerar resposta da IA');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(aiResponse);
    setCopied(true);
    toast.success('Resposta copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return <Badge className="bg-green-500"><Wifi className="w-3 h-3 mr-1" /> Conectado</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Conectando...</Badge>;
      case 'qr_ready':
        return <Badge className="bg-blue-500"><QrCode className="w-3 h-3 mr-1" /> Aguardando QR Code</Badge>;
      default:
        return <Badge className="bg-gray-500"><WifiOff className="w-3 h-3 mr-1" /> Desconectado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">WhatsApp</h2>
          <p className="text-muted-foreground">
            Gerencie a conexão do bot de WhatsApp
          </p>
        </div>
        {getStatusBadge()}
      </div>

      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connection">
            <Smartphone className="w-4 h-4 mr-2" />
            Conexão
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="w-4 h-4 mr-2" />
            Assistente IA
          </TabsTrigger>
          <TabsTrigger value="test">
            <Send className="w-4 h-4 mr-2" />
            Teste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          {/* Evolution API - Ativar/Desativar */}
          <Card className={evolutionEnabled ? 'border-amber-500/50 bg-amber-50/30' : 'border-gray-200'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Evolution API
              </CardTitle>
              <CardDescription>
                Se você usa Evolution API (ex: http://187.77.34.61:8080), ative aqui. Se usa apenas a conexão Baileys abaixo, deixe desativado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Processar mensagens via Evolution API</p>
                  <p className="text-sm text-muted-foreground">
                    {evolutionEnabled ? 'Webhook ativo – mensagens do Evolution serão processadas' : 'Desativado – use a conexão Baileys (QR Code) abaixo'}
                  </p>
                </div>
                <Switch
                  checked={evolutionEnabled}
                  onCheckedChange={handleEvolutionToggle}
                  disabled={evolutionLoading}
                />
              </div>
              {evolutionEnabled && (
                <p className="mt-2 text-sm text-amber-700">
                  ⚠️ Com Evolution ativo, configure o webhook em Evolution API apontando para: <code className="bg-amber-100 px-1 rounded">/api/webhook/evolution</code>
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Card de Conexão */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Conexão WhatsApp
                </CardTitle>
                <CardDescription>
                  Conecte seu WhatsApp escaneando o QR Code
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectionStatus.status === 'qr_ready' && connectionStatus.qrCode && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-white rounded-lg">
                      <img
                        src={connectionStatus.qrCode}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64"
                      />
                    </div>
                    <p className="text-sm text-center text-muted-foreground">
                      Abra o WhatsApp no celular &gt; Menu &gt; Dispositivos conectados &gt; Conectar dispositivo
                    </p>
                  </div>
                )}

                {connectionStatus.status === 'connected' && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="p-4 bg-green-100 rounded-full">
                      <Wifi className="w-12 h-12 text-green-600" />
                    </div>
                    <p className="text-lg font-medium text-green-600">
                      WhatsApp Conectado!
                    </p>
                    {connectionStatus.phoneNumber && (
                      <div className="text-center">
                        <p className="text-sm font-medium">{connectionStatus.userName || 'Bot'}</p>
                        <p className="text-xs text-muted-foreground">+{connectionStatus.phoneNumber}</p>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      O bot está pronto para receber mensagens
                    </p>
                  </div>
                )}

                {connectionStatus.status === 'connecting' && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                    <p className="text-muted-foreground">Conectando...</p>
                  </div>
                )}

                {connectionStatus.status === 'disconnected' && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="p-4 bg-gray-100 rounded-full">
                      <WifiOff className="w-12 h-12 text-gray-400" />
                    </div>
                    <p className="text-muted-foreground">
                      WhatsApp desconectado
                    </p>
                  </div>
                )}

                {connectionStatus.lastError && (
                  <div className="p-4 text-sm bg-red-50 border border-red-200 rounded-lg space-y-3">
                    <div className="flex items-start gap-2">
                      <WifiOff className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-red-700 font-medium">{connectionStatus.lastError}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(connectionStatus.lastError.includes('Limpe') || connectionStatus.lastError.includes('encerrada') || connectionStatus.lastError.includes('sessão')) && (
                        <Button
                          size="sm"
                          onClick={handleClearSession}
                          disabled={actionLoading === 'clear'}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {actionLoading === 'clear' ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3 mr-1" />
                          )}
                          Limpar Sessão Agora
                        </Button>
                      )}
                      {(connectionStatus.lastError.includes('bloqueou') || connectionStatus.lastError.includes('405') || connectionStatus.lastError.includes('Aguarde')) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleResetBlock}
                          disabled={actionLoading === 'reset'}
                          className="text-red-600 border-red-300 hover:bg-red-100"
                        >
                          {actionLoading === 'reset' ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3 mr-1" />
                          )}
                          Resetar e Tentar
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Reconexão Agendada */}
                {connectionStatus.scheduledReconnect && (
                  <div className="p-4 text-sm bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="text-amber-700 font-medium">
                          ⏰ Reconexão automática agendada
                        </p>
                        <p className="text-amber-600 text-sm">
                          Tentativa às {new Date(connectionStatus.scheduledReconnect).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex gap-2">
                  {connectionStatus.status !== 'connected' ? (
                    <Button
                      onClick={handleConnect}
                      disabled={loading || connectionStatus.status === 'connecting'}
                      className="flex-1"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4 mr-2" />
                      )}
                      Conectar
                    </Button>
                  ) : (
                    <Button
                      onClick={handleDisconnect}
                      disabled={actionLoading === 'disconnect'}
                      variant="destructive"
                      className="flex-1"
                    >
                      {actionLoading === 'disconnect' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4 mr-2" />
                      )}
                      Desconectar
                    </Button>
                  )}
                  <Button
                    onClick={fetchStatus}
                    variant="outline"
                    size="icon"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card de Controles do Bot */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Controles do Bot
                </CardTitle>
                <CardDescription>
                  Ações avançadas para gerenciar o bot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <RotateCcw className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Reiniciar Bot</p>
                          <p className="text-xs text-muted-foreground">Reconecta sem perder sessão</p>
                        </div>
                      </div>
                      <Button
                        onClick={handleRestart}
                        disabled={actionLoading === 'restart' || connectionStatus.status === 'disconnected'}
                        size="sm"
                        variant="outline"
                      >
                        {actionLoading === 'restart' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Reiniciar'
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-red-700">Remover Sessão</p>
                          <p className="text-xs text-red-500">Necessário escanear QR novamente</p>
                        </div>
                      </div>
                      <Button
                        onClick={handleClearSession}
                        disabled={actionLoading === 'clear'}
                        size="sm"
                        variant="destructive"
                      >
                        {actionLoading === 'clear' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Remover'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                    <span>💡</span> Quando usar cada opção?
                  </h4>
                  <ul className="text-sm text-amber-700 space-y-2">
                    <li className="flex items-start gap-2">
                      <RotateCcw className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span><strong>Reiniciar:</strong> Use se o bot parou de responder</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Trash2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span><strong>Remover Sessão:</strong> Use para trocar de número ou resolver erros de login</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Assistente IA
              </CardTitle>
              <CardDescription>
                Use a IA para gerar respostas inteligentes para seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Mensagem do Cliente</label>
                <Textarea
                  placeholder="Cole aqui a mensagem do cliente..."
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleGenerateAIResponse}
                disabled={aiLoading || !customerMessage.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Gerar Resposta com IA
              </Button>

              {aiResponse && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Resposta Sugerida</label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyResponse}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 mr-1 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 mr-1" />
                      )}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </Button>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                    <p className="whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">💡 Dica</h4>
                <p className="text-sm text-yellow-700">
                  A IA gera respostas baseadas no contexto da sua loja de códigos. 
                  Revise e personalize antes de enviar ao cliente!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Enviar Mensagem de Teste
              </CardTitle>
              <CardDescription>
                Teste o envio de mensagens pelo bot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Número do WhatsApp</label>
                <Input
                  placeholder="5511999999999"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  disabled={connectionStatus.status !== 'connected'}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: código do país + DDD + número (sem espaços)
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Mensagem</label>
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={4}
                  disabled={connectionStatus.status !== 'connected'}
                />
              </div>
              <Button
                onClick={handleSendTest}
                disabled={connectionStatus.status !== 'connected' || sendingTest}
                className="w-full"
              >
                {sendingTest ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Mensagem
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>📖 Como usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">1️⃣ Conectar</h4>
              <p className="text-sm text-muted-foreground">
                Clique em "Conectar" e escaneie o QR Code com o WhatsApp do seu celular.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">2️⃣ Bot Ativo</h4>
              <p className="text-sm text-muted-foreground">
                Após conectar, o bot responderá automaticamente as mensagens dos clientes.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">3️⃣ Pedidos</h4>
              <p className="text-sm text-muted-foreground">
                Confirme os pagamentos na página de Pedidos para liberar os códigos automaticamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
