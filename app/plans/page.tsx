'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package, DollarSign, Save, Check, Calendar, RefreshCw } from 'lucide-react';

interface Plan {
  id: string;
  type: string;
  price: number;
  isActive: boolean;
}

interface App {
  id: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  plans: Plan[];
}

const PLAN_TYPES = [
  { type: 'MONTHLY', label: 'Mensal', icon: '📅', description: '30 dias' },
  { type: 'QUARTERLY', label: 'Trimestral', icon: '📆', description: '90 dias' },
  { type: 'ANNUAL', label: 'Anual', icon: '🗓️', description: '365 dias' },
];

export default function PlansPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedPlans, setEditedPlans] = useState<Record<string, Record<string, { price: number; isActive: boolean }>>>({});

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch('/api/plans');
      if (res.ok) {
        const data = await res.json();
        setApps(data);
        
        // Inicializar editedPlans com os dados atuais
        const initial: Record<string, Record<string, { price: number; isActive: boolean }>> = {};
        data.forEach((app: App) => {
          initial[app.id] = {};
          PLAN_TYPES.forEach(pt => {
            const existingPlan = app.plans.find(p => p.type === pt.type);
            initial[app.id][pt.type] = {
              price: existingPlan?.price || 0,
              isActive: existingPlan?.isActive ?? true,
            };
          });
        });
        setEditedPlans(initial);
      }
    } catch (error) {
      toast.error('Erro ao carregar apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handlePriceChange = (appId: string, planType: string, price: string) => {
    const numPrice = parseFloat(price) || 0;
    setEditedPlans(prev => ({
      ...prev,
      [appId]: {
        ...prev[appId],
        [planType]: {
          ...prev[appId]?.[planType],
          price: numPrice,
        },
      },
    }));
  };

  const handleActiveChange = (appId: string, planType: string, isActive: boolean) => {
    setEditedPlans(prev => ({
      ...prev,
      [appId]: {
        ...prev[appId],
        [planType]: {
          ...prev[appId]?.[planType],
          isActive,
        },
      },
    }));
  };

  const handleSave = async (appId: string) => {
    setSaving(appId);
    try {
      const plans = PLAN_TYPES.map(pt => ({
        type: pt.type,
        price: editedPlans[appId]?.[pt.type]?.price || 0,
        isActive: editedPlans[appId]?.[pt.type]?.isActive ?? true,
      }));

      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, plans }),
      });

      if (res.ok) {
        toast.success('Preços salvos com sucesso!');
        fetchApps();
      } else {
        const data = await res.json();
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar preços');
    } finally {
      setSaving(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Planos e Preços</h1>
        <p className="text-muted-foreground mt-1">
          Configure os valores para cada plano de cada app
        </p>
      </div>

      {/* Legenda */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="font-medium">Tipos de Plano:</span>
            </div>
            {PLAN_TYPES.map(pt => (
              <div key={pt.type} className="flex items-center gap-2">
                <span>{pt.icon}</span>
                <span className="font-medium">{pt.label}</span>
                <span className="text-muted-foreground">({pt.description})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {apps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum app cadastrado. Vá em Apps para adicionar um novo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <div className="flex items-center gap-3">
                  {app.logoUrl ? (
                    <img
                      src={app.logoUrl}
                      alt={app.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {app.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                    <CardDescription>Configure os preços</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {PLAN_TYPES.map((pt) => {
                  const planData = editedPlans[app.id]?.[pt.type] || { price: 0, isActive: true };
                  const existingPlan = app.plans.find(p => p.type === pt.type);
                  
                  return (
                    <div key={pt.type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <span>{pt.icon}</span>
                          <span className="font-medium">{pt.label}</span>
                          {existingPlan && (
                            <Badge variant="outline" className="text-xs">
                              Atual: {formatCurrency(existingPlan.price)}
                            </Badge>
                          )}
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Ativo</span>
                          <Switch
                            checked={planData.isActive}
                            onCheckedChange={(checked) => handleActiveChange(app.id, pt.type, checked)}
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={planData.price || ''}
                          onChange={(e) => handlePriceChange(app.id, pt.type, e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  );
                })}

                <Button
                  onClick={() => handleSave(app.id)}
                  disabled={saving === app.id}
                  className="w-full mt-4 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                >
                  {saving === app.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Preços
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Configure o preço para cada tipo de plano (Mensal, Trimestral, Anual)</li>
            <li>• Use o switch para ativar/desativar um plano específico</li>
            <li>• Planos desativados não aparecem para os clientes no WhatsApp</li>
            <li>• Os preços são usados automaticamente pelo bot ao gerar o PIX</li>
            <li>• Não se esqueça de clicar em "Salvar Preços" após fazer alterações</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
