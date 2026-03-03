'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  Search,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Order {
  id: string;
  clientPhone: string;
  clientName: string | null;
  status: string;
  amount: number;
  createdAt: string;
  paidAt: string | null;
  codeSentAt: string | null;
  app: {
    name: string;
  };
  plan: {
    type: string;
  };
  code?: {
    code: string;
  };
}

export default function SalesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    let filtered = orders;

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.clientPhone.includes(searchTerm) ||
          order.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.app?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [searchTerm, statusFilter, orders]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        setFilteredOrders(data);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar vendas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      PENDING_PAYMENT: { label: 'Pendente', variant: 'outline' },
      PAID: { label: 'Pago', variant: 'default' },
      CODE_SENT: { label: 'Concluído', variant: 'default' },
      CANCELLED: { label: 'Cancelado', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const getPlanLabel = (type: string) => {
    const labels: Record<string, string> = {
      MONTHLY: 'Mensal',
      QUARTERLY: 'Trimestral',
      ANNUAL: 'Anual',
    };
    return labels[type] || type;
  };

  const totalRevenue = filteredOrders
    .filter((o) => ['PAID', 'CODE_SENT'].includes(o.status))
    .reduce((sum, o) => sum + o.amount, 0);

  const completedSales = filteredOrders.filter((o) => o.status === 'CODE_SENT').length;

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
        <h1 className="text-3xl font-bold">Vendas</h1>
        <p className="text-muted-foreground mt-1">
          Histórico completo de vendas realizadas
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedSales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Histórico de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, WhatsApp ou app..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {['', 'PENDING_PAYMENT', 'CODE_SENT', 'CANCELLED'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className={statusFilter === status ? 'bg-gradient-to-r from-blue-500 to-green-500' : ''}
                >
                  {status === '' && 'Todos'}
                  {status === 'PENDING_PAYMENT' && 'Pendentes'}
                  {status === 'CODE_SENT' && 'Concluídos'}
                  {status === 'CANCELLED' && 'Cancelados'}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma venda encontrada
              </p>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{order.app?.name}</p>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">
                        {getPlanLabel(order.plan?.type)}
                      </span>
                      {' • '}
                      <span>{order.clientName || order.clientPhone}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.codeSentAt
                        ? `Concluído em ${format(
                            new Date(order.codeSentAt),
                            "dd/MM/yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}`
                        : `Criado em ${format(
                            new Date(order.createdAt),
                            "dd/MM/yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}`}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-lg font-bold text-green-600">
                      R$ {order.amount.toFixed(2)}
                    </p>
                    {order.code && (
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {order.code.code}
                      </code>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
