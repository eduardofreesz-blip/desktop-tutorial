'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  CreditCard, CheckCircle, XCircle, AlertTriangle, RefreshCw, Settings, 
  Zap, Shield, Eye, EyeOff, Save, Key, Building2, QrCode, Wallet
} from 'lucide-react';

interface PaymentConfig {
  pixManualEnabled: boolean;
  pixAutoEnabled: boolean;
  pixKey: string;
  pixName: string;
  activeProvider: string;
  cardEnabled: boolean;
}

interface GetnetStatus {
  configured: boolean;
  environment: string;
  webhookUrl: string;
}

interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
  sellerId: string;
  chavePix: string;
}

export default function PaymentsSettingsPage() {
  const [status, setStatus] = useState<GetnetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [environment, setEnvironment] = useState('sandbox');
  const [showSecrets, setShowSecrets] = useState(false);
  
  const [config, setConfig] = useState<PaymentConfig>({
    pixManualEnabled: true,
    pixAutoEnabled: false,
    pixKey: '',
    pixName: '',
    activeProvider: 'getnet',
    cardEnabled: false,
  });

  const [credentials, setCredentials] = useState<ProviderCredentials>({
    clientId: '',
    clientSecret: '',
    sellerId: '',
    chavePix: '',
  });

  const checkStatus = useCallback(async (provider?: string) => {
    try {
      const activeProvider = provider || config.activeProvider;
      const endpoints: Record<string, string> = {
        getnet: '/api/payments/getnet/status',
        pagseguro: '/api/payments/pagseguro/status',
        itau: '/api/payments/itau/status',
        sicoob: '/api/payments/sicoob/status',
        mercadopago: '/api/payments/mercadopago/status',
        fitbank: '/api/payments/fitbank/status',
      };
      
      const endpoint = endpoints[activeProvider] || '/api/payments/getnet/status';
      
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setEnvironment(data.environment || 'sandbox');
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setLoading(false);
    }
  }, [config.activeProvider]);

  // Função para selecionar e salvar provedor automaticamente
  const handleSelectProvider = async (providerId: string) => {
    // Atualiza estado local imediatamente
    setConfig(prev => ({ ...prev, activeProvider: providerId }));
    
    // Salva no banco de dados
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_provider: providerId }),
      });

      if (res.ok) {
        toast.success(`${providers.find(p => p.id === providerId)?.name} selecionado!`);
        // Atualiza o status do novo provedor
        checkStatus(providerId);
      } else {
        toast.error('Erro ao salvar provedor');
      }
    } catch (error) {
      console.error('Erro ao salvar provedor:', error);
      toast.error('Erro ao salvar provedor');
    }
  };

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig({
          pixKey: data.pix_key || '',
          pixName: data.pix_name || '',
          pixManualEnabled: data.pix_manual_enabled !== 'false',
          pixAutoEnabled: data.pix_auto_enabled === 'true',
          activeProvider: data.active_provider || 'getnet',
          cardEnabled: data.card_enabled === 'true',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    loadConfig();
  }, [checkStatus, loadConfig]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const configData = {
        pix_key: config.pixKey,
        pix_name: config.pixName,
        pix_manual_enabled: config.pixManualEnabled.toString(),
        pix_auto_enabled: config.pixAutoEnabled.toString(),
        active_provider: config.activeProvider,
        card_enabled: config.cardEnabled.toString(),
      };
      
      console.log('Saving config:', configData);
      
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      if (res.ok) {
        toast.success('Configurações salvas com sucesso!');
        // Reload to confirm saved
        await loadConfig();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const saveCredentials = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payments/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.activeProvider,
          credentials,
        }),
      });

      if (res.ok) {
        toast.success('Credenciais salvas com sucesso!');
        setCredentials({ clientId: '', clientSecret: '', sellerId: '', chavePix: '' });
        checkStatus();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar credenciais');
      }
    } catch (error) {
      toast.error('Erro ao salvar credenciais');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEnvironment = async () => {
    try {
      const endpoints: Record<string, string> = {
        getnet: '/api/payments/getnet/environment',
        pagseguro: '/api/payments/pagseguro/environment',
        fitbank: '/api/payments/fitbank/environment',
        itau: '/api/payments/itau/environment',
        sicoob: '/api/payments/sicoob/environment',
        mercadopago: '/api/payments/mercadopago/environment',
      };
      
      const endpoint = endpoints[config.activeProvider] || '/api/payments/getnet/environment';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment }),
      });

      if (res.ok) {
        toast.success('Ambiente atualizado com sucesso!');
        checkStatus();
      } else {
        toast.error('Erro ao atualizar ambiente');
      }
    } catch (error) {
      toast.error('Erro ao atualizar ambiente');
    }
  };

  const getWebhookProvider = (provider: string) => {
    const webhookProviders: Record<string, string> = {
      getnet: 'getnet',
      pagseguro: 'pagseguro',
      fitbank: 'fitbank',
      itau: 'itau',
      sicoob: 'sicoob',
      mercadopago: 'mercadopago',
    };
    return webhookProviders[provider] || 'getnet';
  };

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook/${getWebhookProvider(config.activeProvider)}`
    : `https://universal.abacusai.app/api/webhook/${getWebhookProvider(config.activeProvider)}`;

  const providers = [
    { id: 'getnet', name: 'Getnet', logo: '🏦', description: 'Santander', hasCard: true },
    { id: 'pagseguro', name: 'PagSeguro', logo: '🟢', description: 'PIX e Cartão', hasCard: true },
    { id: 'fitbank', name: 'FitBank', logo: '🔵', description: 'PIX Automático', hasCard: false },
    { id: 'itau', name: 'Itaú', logo: '🧡', description: 'PIX Itaú', hasCard: false },
    { id: 'sicoob', name: 'Sicoob', logo: '💚', description: 'PIX Sicoob', hasCard: false },
    { id: 'mercadopago', name: 'Mercado Pago', logo: '💙', description: 'PIX e Cartão', hasCard: true },
  ];

  const getProviderDescription = (provider: (typeof providers)[0]) =>
    provider.id === 'mercadopago' ? 'PIX e Cartão' : provider.description;

  const currentProvider = providers.find(p => p.id === config.activeProvider);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações de Pagamento</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie PIX manual, automático, cartão e integrações com bancos
        </p>
      </div>

      <Tabs defaultValue="pix" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="pix">PIX</TabsTrigger>
          <TabsTrigger value="card">Cartão</TabsTrigger>
          <TabsTrigger value="gateway">Gateway</TabsTrigger>
          <TabsTrigger value="credentials">Credenciais</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
        </TabsList>

        {/* PIX Settings */}
        <TabsContent value="pix" className="space-y-6">
          {/* PIX Manual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-green-500" />
                PIX Manual
              </CardTitle>
              <CardDescription>
                Configure uma chave PIX fixa para receber pagamentos manualmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Ativar PIX Manual</p>
                  <p className="text-sm text-muted-foreground">
                    Exibir chave PIX fixa quando o automático falhar ou estiver desativado
                  </p>
                </div>
                <Switch
                  checked={config.pixManualEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, pixManualEnabled: checked })}
                />
              </div>

              {config.pixManualEnabled && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>Chave PIX</Label>
                    <Input
                      placeholder="CPF, CNPJ, Email, Telefone ou Chave Aleatória"
                      value={config.pixKey}
                      onChange={(e) => setConfig({ ...config, pixKey: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Recebedor</Label>
                    <Input
                      placeholder="Nome que aparecerá para o cliente"
                      value={config.pixName}
                      onChange={(e) => setConfig({ ...config, pixName: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PIX Automático */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                PIX Automático (API)
              </CardTitle>
              <CardDescription>
                Gera QR Code automaticamente e confirma pagamento em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Ativar PIX Automático</p>
                  <p className="text-sm text-muted-foreground">
                    Usa a API do banco selecionado: <strong>{currentProvider?.name || 'Getnet'}</strong>
                  </p>
                </div>
                <Switch
                  checked={config.pixAutoEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, pixAutoEnabled: checked })}
                />
              </div>

              {config.pixAutoEnabled && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-700">PIX Automático Ativo</span>
                  </div>
                  <p className="text-sm text-green-600">
                    Banco: <strong>{currentProvider?.name}</strong>
                    <br/>
                    Status: {status?.configured ? 'Credenciais configuradas ✓' : 'Configure as credenciais na aba "Credenciais"'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={saveConfig} disabled={saving} className="w-full md:w-auto">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações PIX'}
          </Button>
        </TabsContent>

        {/* Card Settings */}
        <TabsContent value="card" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-500" />
                Pagamento com Cartão de Crédito
              </CardTitle>
              <CardDescription>
                Aceite pagamentos via cartão de crédito (requer gateway compatível)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Ativar Cartão de Crédito</p>
                  <p className="text-sm text-muted-foreground">
                    Exibir opção de pagamento com cartão no bot
                  </p>
                </div>
                <Switch
                  checked={config.cardEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, cardEnabled: checked })}
                />
              </div>

              {/* Seleção de provedor de cartão */}
              {config.cardEnabled && (
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Selecione o Gateway de Cartão:</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {providers.filter(p => p.hasCard).map((provider) => (
                      <div
                        key={provider.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          config.activeProvider === provider.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-muted hover:border-blue-300'
                        }`}
                        onClick={() => handleSelectProvider(provider.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{provider.logo}</span>
                          <div>
                            <p className="font-semibold">{provider.name}</p>
                            <p className="text-xs text-muted-foreground">{getProviderDescription(provider)}</p>
                          </div>
                          {config.activeProvider === provider.id && (
                            <Badge className="ml-auto bg-blue-500">Ativo</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {config.cardEnabled && !currentProvider?.hasCard && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-700">Gateway sem suporte a cartão</span>
                  </div>
                  <p className="text-sm text-yellow-600">
                    O banco <strong>{currentProvider?.name}</strong> não suporta pagamentos com cartão. Selecione um gateway com suporte acima.
                  </p>
                </div>
              )}

              {config.cardEnabled && currentProvider?.hasCard && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-700">Cartão de Crédito Ativo</span>
                  </div>
                  <p className="text-sm text-blue-600">
                    Usando <strong>{currentProvider?.name}</strong> para processar cartões.
                    {status?.configured ? ' Credenciais OK ✓' : ' Configure as credenciais na aba "Credenciais"'}
                  </p>
                </div>
              )}

              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-semibold">Informações sobre Cartão:</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Taxa: varia conforme gateway (geralmente 2-4%)</li>
                  <li>Parcelamento: configurado no painel do gateway</li>
                  <li>Antifraude: incluído no gateway</li>
                  <li>Prazo de recebimento: D+30 (ou conforme contrato)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Button onClick={saveConfig} disabled={saving} className="w-full md:w-auto">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações de Cartão'}
          </Button>
        </TabsContent>

        {/* Gateway Selection */}
        <TabsContent value="gateway" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-500" />
                Selecione o Banco/Gateway
              </CardTitle>
              <CardDescription>
                Escolha qual API será usada para processar pagamentos PIX e Cartão
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      config.activeProvider === provider.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-muted hover:border-primary/50 hover:shadow-sm'
                    }`}
                    onClick={() => handleSelectProvider(provider.id)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{provider.logo}</span>
                      <div>
                        <p className="font-semibold">{provider.name}</p>
                        <p className="text-xs text-muted-foreground">{getProviderDescription(provider)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {config.activeProvider === provider.id && (
                        <Badge className="bg-primary">Selecionado</Badge>
                      )}
                      <Badge variant="outline">PIX</Badge>
                      {provider.hasCard && <Badge variant="outline">Cartão</Badge>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">📋 Como obter credenciais - {currentProvider?.name}:</h4>
                {config.activeProvider === 'getnet' && (
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Acesse <a href="https://developers.getnet.com.br" target="_blank" className="text-primary underline">developers.getnet.com.br</a></li>
                    <li>Crie uma conta ou faça login</li>
                    <li>Vá em &quot;Minhas Aplicações&quot;</li>
                    <li>Copie o <strong>Client ID</strong>, <strong>Client Secret</strong> e <strong>Seller ID</strong></li>
                  </ol>
                )}
                {config.activeProvider === 'itau' && (
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Acesse <a href="https://developer.itau.com.br" target="_blank" className="text-primary underline">developer.itau.com.br</a></li>
                    <li>Crie sua aplicação com escopo PIX</li>
                    <li>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong></li>
                    <li>Informe sua <strong>Chave PIX</strong> cadastrada no Itaú</li>
                  </ol>
                )}
                {config.activeProvider === 'sicoob' && (
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Acesse <a href="https://developers.sicoob.com.br" target="_blank" className="text-primary underline">developers.sicoob.com.br</a></li>
                    <li>Solicite acesso à API PIX</li>
                    <li>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong></li>
                    <li>Informe sua <strong>Chave PIX</strong> cadastrada no Sicoob</li>
                  </ol>
                )}
                {config.activeProvider === 'pagseguro' && (
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Acesse <a href="https://dev.pagseguro.uol.com.br" target="_blank" className="text-primary underline">dev.pagseguro.uol.com.br</a></li>
                    <li>Faça login com sua conta PagSeguro</li>
                    <li>Vá em &quot;Minha conta&quot; &gt; &quot;Integrações&quot; &gt; &quot;Chaves de API&quot;</li>
                    <li>Copie o <strong>Token</strong> (chave de API)</li>
                    <li>Anote seu <strong>Email</strong> cadastrado no PagSeguro</li>
                  </ol>
                )}
                {config.activeProvider === 'fitbank' && (
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Acesse <a href="https://dev.fitbank.com.br" target="_blank" className="text-primary underline">dev.fitbank.com.br</a></li>
                    <li>Faça login ou solicite acesso</li>
                    <li>Vá em &quot;Configurações&quot; &gt; &quot;API&quot;</li>
                    <li>Copie o <strong>Username</strong>, <strong>Password</strong> e <strong>Partner ID</strong></li>
                    <li>Anote também <strong>Mkt Place ID</strong> e <strong>Business Unit ID</strong></li>
                  </ol>
                )}
                {config.activeProvider === 'mercadopago' && (
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Acesse <a href="https://www.mercadopago.com.br/developers" target="_blank" className="text-primary underline">mercadopago.com.br/developers</a></li>
                    <li>Faça login com sua conta Mercado Pago</li>
                    <li>Vá em &quot;Suas integrações&quot;</li>
                    <li>Copie o <strong>Access Token</strong> de produção</li>
                  </ol>
                )}
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                ✓ Clique em um banco para selecioná-lo. A seleção é salva automaticamente.
              </p>
            </CardContent>
          </Card>

          {/* Environment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-500" />
                Ambiente da API
              </CardTitle>
              <CardDescription>
                Alterne entre ambiente de teste e produção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecione o Ambiente</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">🧪 Sandbox (Teste)</SelectItem>
                    <SelectItem value="production">🚀 Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {environment === 'sandbox' && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-700">Modo Sandbox</span>
                  </div>
                  <p className="text-sm text-yellow-600">
                    Pagamentos são simulados. Nenhuma cobrança real será feita.
                  </p>
                </div>
              )}

              {environment === 'production' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-700">Modo Produção</span>
                  </div>
                  <p className="text-sm text-green-600">
                    Pagamentos reais serão processados.
                  </p>
                </div>
              )}

              <Button onClick={handleSaveEnvironment}>Salvar Ambiente</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credentials */}
        <TabsContent value="credentials" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-orange-500" />
                Credenciais - {currentProvider?.name}
              </CardTitle>
              <CardDescription>
                Configure as chaves de API do banco selecionado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              {loading ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </div>
              ) : status?.configured ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <div>
                    <p className="font-semibold text-green-700">Credenciais Configuradas ✓</p>
                    <p className="text-sm text-green-600">Pagamentos estão ativos.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-500" />
                  <div>
                    <p className="font-semibold text-red-700">Credenciais Não Configuradas</p>
                    <p className="text-sm text-red-600">Preencha os campos abaixo.</p>
                  </div>
                </div>
              )}

              {/* Credential Fields */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Atualizar Credenciais</Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)}>
                    {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showSecrets ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>

                {/* Getnet */}
                {config.activeProvider === 'getnet' && (
                  <>
                    <div className="space-y-2">
                      <Label>Client ID</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Cole seu Client ID aqui"
                        value={credentials.clientId}
                        onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Cole seu Client Secret aqui"
                        value={credentials.clientSecret}
                        onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Seller ID</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Cole seu Seller ID aqui"
                        value={credentials.sellerId}
                        onChange={(e) => setCredentials({ ...credentials, sellerId: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* PagSeguro */}
                {config.activeProvider === 'pagseguro' && (
                  <>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>PagSeguro:</strong> Use o Token de API e o Email da sua conta.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Token de API</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Cole seu Token de API aqui"
                        value={credentials.clientId}
                        onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email da Conta</Label>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={credentials.clientSecret}
                        onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* FitBank */}
                {config.activeProvider === 'fitbank' && (
                  <>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>FitBank:</strong> Configure as credenciais do painel FitBank.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Username do FitBank"
                        value={credentials.clientId}
                        onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Password do FitBank"
                        value={credentials.clientSecret}
                        onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Partner ID</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Partner ID"
                        value={credentials.sellerId}
                        onChange={(e) => setCredentials({ ...credentials, sellerId: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Itaú / Sicoob */}
                {(config.activeProvider === 'itau' || config.activeProvider === 'sicoob') && (
                  <>
                    <div className="space-y-2">
                      <Label>Client ID</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Cole seu Client ID aqui"
                        value={credentials.clientId}
                        onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret</Label>
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder="Cole seu Client Secret aqui"
                        value={credentials.clientSecret}
                        onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Chave PIX (cadastrada no banco)</Label>
                      <Input
                        placeholder="Sua chave PIX: CPF, CNPJ, email ou aleatória"
                        value={credentials.chavePix}
                        onChange={(e) => setCredentials({ ...credentials, chavePix: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Mercado Pago */}
                {config.activeProvider === 'mercadopago' && (
                  <div className="space-y-2">
                    <Label>Access Token</Label>
                    <Input
                      type={showSecrets ? 'text' : 'password'}
                      placeholder="APP_USR-xxxx (Produção) ou TEST-xxxx (Sandbox)"
                      value={credentials.clientId}
                      onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obtenha em developers.mercadopago.com. Use token de teste para sandbox.
                    </p>
                  </div>
                )}

                <Button onClick={saveCredentials} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar Credenciais'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook */}
        <TabsContent value="webhook" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                Webhook de Notificação
              </CardTitle>
              <CardDescription>
                Configure este webhook no painel do banco para receber confirmações automáticas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-100 rounded-lg">
                <Label className="text-sm text-muted-foreground">URL do Webhook</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-white border rounded text-sm break-all">{webhookUrl}</code>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success('URL copiada!');
                  }}>Copiar</Button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-700 mb-2">💡 O que é um Webhook?</h4>
                <p className="text-sm text-blue-600">
                  O webhook avisa automaticamente quando um PIX for pago. O sistema envia o código ao cliente instantaneamente.
                </p>
              </div>

              {config.activeProvider === 'mercadopago' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-semibold text-amber-800 mb-2">⚠️ Mercado Pago: Configure o Webhook</h4>
                  <p className="text-sm text-amber-700 mb-2">
                    Acesse <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer" className="underline">developers.mercadopago.com</a> → Sua aplicação → Webhooks.
                  </p>
                  <p className="text-sm text-amber-700">
                    Adicione a URL acima e selecione o evento <strong>Pagamentos</strong>. Sem isso, o código não será enviado automaticamente após o pagamento.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
