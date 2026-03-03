'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Settings, Smartphone, MessageSquare, FileText, Save } from 'lucide-react';

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [configs, setConfigs] = useState({
    pix_key: '',
    pix_name: '',
    welcome_message: '',
    payment_instructions: '',
    instructions_unitv: '',
    instructions_xprime: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfigs((prev) => ({ ...prev, ...data }));
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar configurações',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs }),
      });

      if (res.ok) {
        toast({
          title: 'Sucesso',
          description: 'Configurações salvas com sucesso',
        });
      } else {
        throw new Error();
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Configure dados PIX e mensagens do sistema
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-500" />
              Dados PIX
            </CardTitle>
            <CardDescription>
              Configure a chave PIX para receber pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pix_key">Chave PIX *</Label>
                <Input
                  id="pix_key"
                  value={configs.pix_key}
                  onChange={(e) =>
                    setConfigs({ ...configs, pix_key: e.target.value })
                  }
                  placeholder="email@exemplo.com ou CPF/CNPJ"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pix_name">Nome do Titular</Label>
                <Input
                  id="pix_name"
                  value={configs.pix_name}
                  onChange={(e) =>
                    setConfigs({ ...configs, pix_name: e.target.value })
                  }
                  placeholder="Nome completo"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              Mensagens do Bot
            </CardTitle>
            <CardDescription>
              Personalize as mensagens enviadas pelo WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="welcome_message">Mensagem de Boas-Vindas</Label>
              <Textarea
                id="welcome_message"
                value={configs.welcome_message}
                onChange={(e) =>
                  setConfigs({ ...configs, welcome_message: e.target.value })
                }
                placeholder="Mensagem inicial do bot"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_instructions">
                Instruções de Pagamento
              </Label>
              <Textarea
                id="payment_instructions"
                value={configs.payment_instructions}
                onChange={(e) =>
                  setConfigs({ ...configs, payment_instructions: e.target.value })
                }
                placeholder="Use {PIX_KEY}, {PIX_NAME}, {AMOUNT} como variáveis"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{'}PIX_KEY{'}'}, {'{'}PIX_NAME{'}'},{' '}
                {'{'}AMOUNT{'}'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              Instruções de Ativação
            </CardTitle>
            <CardDescription>
              Como ativar os códigos em cada app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instructions_unitv">
                <Smartphone className="w-4 h-4 inline mr-1" />
                Instruções Unitv
              </Label>
              <Textarea
                id="instructions_unitv"
                value={configs.instructions_unitv}
                onChange={(e) =>
                  setConfigs({ ...configs, instructions_unitv: e.target.value })
                }
                placeholder="Passo a passo para ativar no Unitv"
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions_xprime">
                <Smartphone className="w-4 h-4 inline mr-1" />
                Instruções Xprime
              </Label>
              <Textarea
                id="instructions_xprime"
                value={configs.instructions_xprime}
                onChange={(e) =>
                  setConfigs({ ...configs, instructions_xprime: e.target.value })
                }
                placeholder="Passo a passo para ativar no Xprime"
                rows={6}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
