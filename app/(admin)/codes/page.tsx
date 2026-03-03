'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Plus, Package, Upload } from 'lucide-react';

interface App {
  id: string;
  name: string;
  plans: Plan[];
}

interface Plan {
  id: string;
  type: string;
}

interface CodeStats {
  appId: string;
  appName: string;
  plans: {
    planId: string;
    planType: string;
    available: number;
  }[];
}

export default function CodesPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [stats, setStats] = useState<CodeStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [codesText, setCodesText] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [appsRes, statsRes] = await Promise.all([
        fetch('/api/apps'),
        fetch('/api/codes/stats'),
      ]);

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApps(appsData.filter((app: any) => app.isActive));
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCodes = async () => {
    if (!selectedApp || !selectedPlan || !codesText.trim()) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    setAdding(true);

    try {
      const codes = codesText
        .split('\n')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codes,
          appId: selectedApp,
          planId: selectedPlan,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Sucesso!',
          description: data.message,
        });
        setCodesText('');
        setSelectedApp('');
        setSelectedPlan('');
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Erro ao adicionar códigos',
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const getPlanLabel = (type: string) => {
    const normalized = type.toUpperCase();
    const labels: Record<string, string> = {
      MONTHLY: 'Mensal',
      QUARTERLY: 'Trimestral',
      ANNUAL: 'Anual',
      MENSAL: 'Mensal',
      TRIMESTRAL: 'Trimestral',
      ANUAL: 'Anual',
    };
    return labels[normalized] || type;
  };
  
  // Filtrar para mostrar apenas os 3 tipos principais
  const filterPlans = (plans: Plan[]) => {
    const validTypes = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'MENSAL', 'TRIMESTRAL', 'ANUAL'];
    return plans.filter(p => validTypes.includes(p.type.toUpperCase()));
  };

  const selectedAppData = apps.find((a) => a.id === selectedApp);

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
        <h1 className="text-3xl font-bold">Códigos</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie o estoque de códigos de recarga
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-500" />
              Adicionar Códigos
            </CardTitle>
            <CardDescription>
              Adicione múltiplos códigos de uma vez (um por linha)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app">App *</Label>
              <Select value={selectedApp} onValueChange={setSelectedApp}>
                <SelectTrigger id="app">
                  <SelectValue placeholder="Selecione o app" />
                </SelectTrigger>
                <SelectContent>
                  {apps.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plano *</Label>
              <Select
                value={selectedPlan}
                onValueChange={setSelectedPlan}
                disabled={!selectedApp}
              >
                <SelectTrigger id="plan">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {filterPlans(selectedAppData?.plans || []).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {getPlanLabel(plan.type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="codes">Códigos (um por linha) *</Label>
              <Textarea
                id="codes"
                value={codesText}
                onChange={(e) => setCodesText(e.target.value)}
                placeholder="ABC123XYZ456\nDEF789GHI012\n..."
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {codesText.split('\n').filter((c) => c.trim().length > 0).length}{' '}
                códigos
              </p>
            </div>

            <Button
              onClick={handleAddCodes}
              disabled={adding || !selectedApp || !selectedPlan || !codesText.trim()}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
            >
              <Upload className="w-4 h-4 mr-2" />
              {adding ? 'Adicionando...' : 'Adicionar Códigos'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Estoque por App/Plano
            </CardTitle>
            <CardDescription>
              Códigos disponíveis para cada serviço
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.map((appStat) => (
                <div key={appStat.appId} className="space-y-2">
                  <h4 className="font-semibold text-sm">{appStat.appName}</h4>
                  <div className="space-y-1">
                    {appStat.plans.map((plan) => (
                      <div
                        key={plan.planId}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                      >
                        <span className="text-muted-foreground">
                          {getPlanLabel(plan.planType)}
                        </span>
                        <span
                          className={`font-semibold ${
                            plan.available < 5
                              ? 'text-red-600'
                              : plan.available < 20
                              ? 'text-orange-600'
                              : 'text-green-600'
                          }`}
                        >
                          {plan.available} códigos
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {stats.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum dado disponível
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
