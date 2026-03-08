'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, MessageSquare, Settings2, Save, RotateCcw, Sparkles, 
  List, Image, Clock, CheckCircle2, AlertCircle, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface BotConfig {
  // Menu Principal
  menu_title: string;
  menu_option_1: string;
  menu_option_2: string;
  menu_option_3: string;
  menu_option_4: string;
  menu_option_5: string;
  menu_footer: string;
  
  // Mensagens Personalizadas
  welcome_message: string;
  welcome_image: string;
  about_us_text: string;
  installation_text: string;
  code_delivery_text: string;
  human_mode_message: string;
  
  // Configurações
  ai_auto_response: string;
  auto_greeting: string;
  working_hours_start: string;
  working_hours_end: string;
  out_of_hours_message: string;
}

const defaultConfig: BotConfig = {
  menu_title: '📱 *UNIVERSAL RECARGAS*',
  menu_option_1: '🎁 COMPRAR',
  menu_option_2: '🧑 SUPORTE',
  menu_option_3: '📲 INSTALAÇÃO',
  menu_option_4: '📝 MEUS PEDIDOS',
  menu_option_5: 'ℹ️ SOBRE NÓS',
  menu_footer: '🛒 Universal Recargas - Sua Loja de Confiança',
  welcome_message: 'Olá! Bem-vindo à Universal Recargas! 🎉',
  welcome_image: '',
  about_us_text: 'Somos especialistas em recargas de apps de streaming!',
  installation_text: 'Após o pagamento, você receberá o código automaticamente.',
  code_delivery_text: 'Aqui está seu código de ativação! 🎁',
  human_mode_message: 'Você será atendido por um de nossos atendentes em breve.',
  ai_auto_response: 'false',
  auto_greeting: 'true',
  working_hours_start: '08:00',
  working_hours_end: '22:00',
  out_of_hours_message: 'Estamos fora do horário de atendimento. Deixe sua mensagem!',
};

export default function BotConfigPage() {
  const [config, setConfig] = useState<BotConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data) {
        setConfig(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: keyof BotConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: config }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Configurações salvas com sucesso!');
        setHasChanges(false);
      } else {
        toast.error(data.error || 'Erro ao salvar');
      }
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setHasChanges(true);
    toast.info('Configurações resetadas para o padrão');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" /> Configurações do Bot
          </h2>
          <p className="text-muted-foreground">Personalize as mensagens e comportamento do bot</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" /> Resetar
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Salvando...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Salvar Alterações</>
            )}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <span className="text-sm">Você tem alterações não salvas</span>
        </div>
      )}

      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="menu" className="gap-2">
            <List className="w-4 h-4" /> Menu Principal
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Mensagens
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Sparkles className="w-4 h-4" /> Automação
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <HelpCircle className="w-4 h-4" /> Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Menu Principal do Bot</CardTitle>
              <CardDescription>
                Personalize os textos das opções. A ordem é fixa: 1=Comprar, 2=Suporte, 3=Instalação, 4=Meus Pedidos, 5=Sobre Nós
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título do Menu</Label>
                <Input
                  value={config.menu_title}
                  onChange={(e) => handleChange('menu_title', e.target.value)}
                  placeholder="📱 *UNIVERSAL RECARGAS*"
                />
              </div>

              <div className="space-y-2">
                <Label>Rodapé do Menu</Label>
                <Input
                  value={config.menu_footer || ''}
                  onChange={(e) => handleChange('menu_footer', e.target.value)}
                  placeholder="🛒 Universal Recargas - Sua Loja de Confiança"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="outline">1</Badge> Opção 1
                  </Label>
                  <Input
                    value={config.menu_option_1}
                    onChange={(e) => handleChange('menu_option_1', e.target.value)}
                    placeholder="Ver Apps e Planos"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="outline">2</Badge> Opção 2
                  </Label>
                  <Input
                    value={config.menu_option_2}
                    onChange={(e) => handleChange('menu_option_2', e.target.value)}
                    placeholder="Meus Pedidos"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="outline">3</Badge> Opção 3
                  </Label>
                  <Input
                    value={config.menu_option_3}
                    onChange={(e) => handleChange('menu_option_3', e.target.value)}
                    placeholder="Como Funciona"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="outline">4</Badge> Opção 4
                  </Label>
                  <Input
                    value={config.menu_option_4}
                    onChange={(e) => handleChange('menu_option_4', e.target.value)}
                    placeholder="Falar com Atendente"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="outline">5</Badge> Opção 5
                  </Label>
                  <Input
                    value={config.menu_option_5}
                    onChange={(e) => handleChange('menu_option_5', e.target.value)}
                    placeholder="Ajuda"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagens Personalizadas</CardTitle>
              <CardDescription>Personalize as mensagens enviadas aos clientes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mensagem de Boas-vindas</Label>
                <Textarea
                  value={config.welcome_message}
                  onChange={(e) => handleChange('welcome_message', e.target.value)}
                  placeholder="Olá! Bem-vindo..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" /> URL da Imagem de Boas-vindas
                </Label>
                <Input
                  value={config.welcome_image}
                  onChange={(e) => handleChange('welcome_image', e.target.value)}
                  placeholder="https://i.ytimg.com/vi/pv0grbr92nk/maxresdefault.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label>Sobre Nós</Label>
                <Textarea
                  value={config.about_us_text}
                  onChange={(e) => handleChange('about_us_text', e.target.value)}
                  placeholder="Somos especialistas em..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Como Funciona (Instalação)</Label>
                <Textarea
                  value={config.installation_text}
                  onChange={(e) => handleChange('installation_text', e.target.value)}
                  placeholder="Após o pagamento..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem de Entrega do Código</Label>
                <Textarea
                  value={config.code_delivery_text}
                  onChange={(e) => handleChange('code_delivery_text', e.target.value)}
                  placeholder="Aqui está seu código..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem Modo Humano</Label>
                <Textarea
                  value={config.human_mode_message}
                  onChange={(e) => handleChange('human_mode_message', e.target.value)}
                  placeholder="Você será atendido..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Automação</CardTitle>
              <CardDescription>Configure o comportamento automático do bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Resposta Automática com IA</Label>
                  <p className="text-sm text-muted-foreground">Usar IA para responder mensagens não reconhecidas</p>
                </div>
                <Switch
                  checked={config.ai_auto_response === 'true'}
                  onCheckedChange={(checked) => handleChange('ai_auto_response', checked ? 'true' : 'false')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Saudação Automática</Label>
                  <p className="text-sm text-muted-foreground">Enviar saudação quando cliente iniciar conversa</p>
                </div>
                <Switch
                  checked={config.auto_greeting === 'true'}
                  onCheckedChange={(checked) => handleChange('auto_greeting', checked ? 'true' : 'false')}
                />
              </div>

              <div className="border-t pt-4">
                <Label className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4" /> Horário de Atendimento
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input
                      type="time"
                      value={config.working_hours_start}
                      onChange={(e) => handleChange('working_hours_start', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input
                      type="time"
                      value={config.working_hours_end}
                      onChange={(e) => handleChange('working_hours_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mensagem Fora do Horário</Label>
                <Textarea
                  value={config.out_of_hours_message}
                  onChange={(e) => handleChange('out_of_hours_message', e.target.value)}
                  placeholder="Estamos fora do horário..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Preview do Menu</CardTitle>
              <CardDescription>Veja como o menu aparecerá para os clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-[#075E54] text-white p-4 rounded-lg max-w-md mx-auto">
                <div className="bg-[#DCF8C6] text-black p-3 rounded-lg mb-2">
                  <p className="font-semibold">{config.menu_title}</p>
                  <p className="text-sm mt-2">{config.welcome_message}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>*1* - {config.menu_option_1}</p>
                    <p>*2* - {config.menu_option_2}</p>
                    <p>*3* - {config.menu_option_3}</p>
                    <p>*4* - {config.menu_option_4}</p>
                    <p>*5* - {config.menu_option_5}</p>
                  </div>
                  {config.menu_footer && <p className="text-xs text-gray-500 mt-2">{config.menu_footer}</p>}
                  <p className="text-xs text-gray-600 mt-3">Digite o número da opção desejada</p>
                </div>
                <p className="text-xs text-center text-white/70">Preview - Mensagem do WhatsApp</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
