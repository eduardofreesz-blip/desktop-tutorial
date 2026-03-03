'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, RefreshCw, Clock, Calendar, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PendingReminder {
  id: string;
  clientPhone: string;
  clientName: string | null;
  app: string;
  plan: string;
  expiresAt: string;
  daysLeft: number;
}

interface ReminderResult {
  orderId: string;
  success: boolean;
  error?: string;
}

export default function RemindersPage() {
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastResults, setLastResults] = useState<ReminderResult[]>([]);

  const fetchPendingReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders/check');
      const data = await res.json();
      setPendingReminders(data.orders || []);
    } catch (error) {
      console.error('Erro ao buscar lembretes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingReminders();
    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchPendingReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPendingReminders]);

  const handleSendReminders = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/reminders/check', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        toast.success(`${data.sent} lembrete(s) enviado(s) de ${data.total}`);
        setLastResults(data.results || []);
        fetchPendingReminders();
      } else {
        toast.error(data.error || 'Erro ao enviar lembretes');
      }
    } catch (error) {
      toast.error('Erro ao enviar lembretes');
    } finally {
      setSending(false);
    }
  };

  const getPlanName = (type: string) => {
    switch (type) {
      case 'monthly':
        return 'Mensal';
      case 'quarterly':
        return 'Trimestral';
      case 'annual':
        return 'Anual';
      default:
        return type;
    }
  };

  const getDaysLeftBadge = (days: number) => {
    if (days <= 1) {
      return <Badge className="bg-red-500">Vence amanhã!</Badge>;
    } else if (days <= 2) {
      return <Badge className="bg-orange-500">{days} dias</Badge>;
    } else {
      return <Badge className="bg-yellow-500">{days} dias</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Lembretes de Vencimento</h2>
          <p className="text-muted-foreground">
            Envie lembretes para clientes com planos próximos do vencimento
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchPendingReminders} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={handleSendReminders} disabled={sending || pendingReminders.length === 0}>
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Enviar Lembretes ({pendingReminders.length})
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lembretes Pendentes</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReminders.length}</div>
            <p className="text-xs text-muted-foreground">
              Clientes com plano vencendo em até 3 dias
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo Amanhã</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {pendingReminders.filter((r) => r.daysLeft <= 1).length}
            </div>
            <p className="text-xs text-muted-foreground">Urgência máxima</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Envio</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastResults.filter((r) => r.success).length}/
              {lastResults.length || '-'}
            </div>
            <p className="text-xs text-muted-foreground">Enviados com sucesso</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Lembretes Pendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Planos Próximos do Vencimento
          </CardTitle>
          <CardDescription>
            Clientes que receberão lembrete quando você clicar em "Enviar Lembretes"
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingReminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum lembrete pendente</p>
              <p className="text-sm">Todos os clientes estão com planos em dia!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {reminder.clientName || reminder.clientPhone}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {reminder.app} • {getPlanName(reminder.plan)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm">
                        Vence em{' '}
                        {new Date(reminder.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                      {getDaysLeftBadge(reminder.daysLeft)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>📖 Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">1️⃣ Monitoramento</h4>
              <p className="text-sm text-muted-foreground">
                O sistema identifica automaticamente planos que vão vencer nos próximos 3 dias.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">2️⃣ Envio de Lembrete</h4>
              <p className="text-sm text-muted-foreground">
                Clique em "Enviar Lembretes" para notificar todos os clientes via WhatsApp.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">3️⃣ Renovação</h4>
              <p className="text-sm text-muted-foreground">
                O cliente pode renovar digitando "menu" no bot e fazendo um novo pedido.
              </p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">💡 Dica</h4>
            <p className="text-sm text-blue-700">
              Verifique esta página diariamente e envie os lembretes. Isso aumenta a taxa de
              renovação dos seus clientes!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
