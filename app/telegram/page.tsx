'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Send, Power, Loader2, Bot, Trash2, ExternalLink, CheckCircle2, XCircle, Settings 
} from 'lucide-react';
import { toast } from 'sonner';

interface TelegramStatus {
  configured: boolean;
  active: boolean;
  botUsername: string | null;
  lastError: string | null;
}

export default function TelegramPage() {
  const [status, setStatus] = useState<TelegramStatus>({
    configured: false,
    active: false,
    botUsername: null,
    lastError: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [botToken, setBotToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleConfigure = async () => {
    if (!botToken.trim()) {
      toast.error('Digite o token do bot');
      return;
    }

    setActionLoading('configure');
    try {
      const res = await fetch('/api/telegram/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Bot @${data.username} configurado com sucesso!`);
        setBotToken('');
        setShowTokenInput(false);
        fetchStatus();
      } else {
        toast.error(data.error || 'Erro ao configurar bot');
      }
    } catch (error) {
      toast.error('Erro ao configurar bot');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async () => {
    setActionLoading('start');
    try {
      const res = await fetch('/api/telegram/start', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast.success('Bot Telegram iniciado!');
        fetchStatus();
      } else {
        toast.error(data.error || 'Erro ao iniciar bot');
      }
    } catch (error) {
      toast.error('Erro ao iniciar bot');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading('stop');
    try {
      const res = await fetch('/api/telegram/stop', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast.success('Bot Telegram parado');
        fetchStatus();
      } else {
        toast.error(data.error || 'Erro ao parar bot');
      }
    } catch (error) {
      toast.error('Erro ao parar bot');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Tem certeza que deseja remover a configuração do bot Telegram?')) {
      return;
    }

    setActionLoading('remove');
    try {
      const res = await fetch('/api/telegram/remove', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast.success('Bot removido');
        fetchStatus();
      } else {
        toast.error(data.error || 'Erro ao remover bot');
      }
    } catch (error) {
      toast.error('Erro ao remover bot');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Telegram</h2>
          <p className="text-muted-foreground">
            Configure e gerencie o bot do Telegram
          </p>
        </div>
        {status.configured ? (
          status.active ? (
            <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Ativo</Badge>
          ) : (
            <Badge className="bg-yellow-500"><XCircle className="w-3 h-3 mr-1" /> Parado</Badge>
          )
        ) : (
          <Badge className="bg-gray-500"><Settings className="w-3 h-3 mr-1" /> Não configurado</Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card de Configuração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-500" />
              Configuração do Bot
            </CardTitle>
            <CardDescription>
              {status.configured 
                ? `Bot conectado: @${status.botUsername}` 
                : 'Configure seu bot do Telegram'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!status.configured ? (
              <>
                {!showTokenInput ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                      <Send className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="font-medium mb-2">Conecte seu Bot Telegram</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Venda também pelo Telegram com o mesmo sistema
                    </p>
                    <Button onClick={() => setShowTokenInput(true)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configurar Bot
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Token do Bot</label>
                      <Input
                        placeholder="Cole o token aqui..."
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        type="password"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleConfigure}
                        disabled={actionLoading === 'configure'}
                        className="flex-1"
                      >
                        {actionLoading === 'configure' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowTokenInput(false);
                          setBotToken('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-lg font-medium text-blue-800">@{status.botUsername}</p>
                  <a
                    href={`https://t.me/${status.botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1 mt-1"
                  >
                    Abrir no Telegram <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {status.lastError && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                    {status.lastError}
                  </div>
                )}

                <div className="flex gap-2">
                  {!status.active ? (
                    <Button
                      onClick={handleStart}
                      disabled={actionLoading === 'start'}
                      className="flex-1"
                    >
                      {actionLoading === 'start' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4 mr-2" />
                      )}
                      Iniciar Bot
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStop}
                      disabled={actionLoading === 'stop'}
                      variant="outline"
                      className="flex-1"
                    >
                      {actionLoading === 'stop' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4 mr-2" />
                      )}
                      Parar Bot
                    </Button>
                  )}
                  <Button
                    onClick={handleRemove}
                    disabled={actionLoading === 'remove'}
                    variant="destructive"
                    size="icon"
                  >
                    {actionLoading === 'remove' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de Instruções */}
        <Card>
          <CardHeader>
            <CardTitle>📖 Como criar um Bot no Telegram</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="font-bold text-blue-500">1.</span>
                <span>Abra o Telegram e busque por <strong>@BotFather</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-500">2.</span>
                <span>Envie o comando <code className="bg-gray-100 px-1 rounded">/newbot</code></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-500">3.</span>
                <span>Escolha um nome para o bot (ex: "Universal Recargas")</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-500">4.</span>
                <span>Escolha um username (deve terminar em "bot", ex: "universalrecargasbot")</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-500">5.</span>
                <span>Copie o <strong>token</strong> que o BotFather enviar e cole acima</span>
              </li>
            </ol>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">✅ Vantagens do Telegram</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Botões interativos nativos</li>
                <li>• Sem limite de mensagens</li>
                <li>• Funciona 24h sem precisar de celular conectado</li>
                <li>• Mesma lógica de vendas do WhatsApp</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card de Status */}
      {status.configured && (
        <Card>
          <CardHeader>
            <CardTitle>Status do Bot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg text-center">
                <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                  status.active ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {status.active ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <p className="font-medium">{status.active ? 'Bot Ativo' : 'Bot Parado'}</p>
                <p className="text-sm text-muted-foreground">
                  {status.active ? 'Recebendo mensagens' : 'Clique em Iniciar'}
                </p>
              </div>

              <div className="p-4 border rounded-lg text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
                <p className="font-medium">@{status.botUsername}</p>
                <p className="text-sm text-muted-foreground">Username do bot</p>
              </div>

              <div className="p-4 border rounded-lg text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-purple-100 rounded-full flex items-center justify-center">
                  <Send className="w-6 h-6 text-purple-600" />
                </div>
                <p className="font-medium">Mesma Lógica</p>
                <p className="text-sm text-muted-foreground">Usa o mesmo fluxo do WhatsApp</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
