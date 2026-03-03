'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Check, X, Clock, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Order {
  id: string;
  clientPhone: string;
  clientName: string | null;
  status: string;
  amount: number;
  createdAt: string;
  app: {
    id: string;
    name: string;
  };
  plan: {
    id: string;
    type: string;
  };
  code?: {
    code: string;
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING_PAYMENT');
  const [confirming, setConfirming] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    try {
      const url = filter
        ? `/api/orders?status=${filter}`
        : '/api/orders';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar pedidos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = async (orderId: string) => {
    setConfirming(orderId);

    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Sucesso!',
          description: `Código ${data.code} enviado ao cliente`,
        });
        fetchOrders();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Erro ao confirmar pagamento',
        variant: 'destructive',
      });
    } finally {
      setConfirming(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      PENDING_PAYMENT: { label: 'Aguardando', variant: 'outline' },
      PAID: { label: 'Pago', variant: 'default' },
      CODE_SENT: { label: 'Enviado', variant: 'default' },
      CANCELLED: { label: 'Cancelado', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return (
      <Badge variant={config.variant as any} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const getPlanLabel = (type: string) => {
    const labels: Record<string, string> = {
      MONTHLY: 'Mensal',
      QUARTERLY: 'Trimestral',
      ANNUAL: 'Anual',
    };
    return labels[type] || type;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="text-muted-foreground mt-1">
            Confirme pagamentos e gerencie pedidos
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'PENDING_PAYMENT', label: 'Pendentes', icon: Clock },
          { value: 'CODE_SENT', label: 'Enviados', icon: Check },
          { value: 'CANCELLED', label: 'Cancelados', icon: X },
          { value: '', label: 'Todos', icon: ShoppingCart },
        ].map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(tab.value)}
            className={filter === tab.value ? 'bg-gradient-to-r from-blue-500 to-green-500' : ''}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum pedido encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{order.app?.name}</h3>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Plano:</span>
                        <span>{getPlanLabel(order.plan?.type)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Cliente:</span>
                        <span>{order.clientName || order.clientPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">WhatsApp:</span>
                        <span>{order.clientPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Valor:</span>
                        <span className="text-green-600 font-semibold">
                          R$ {order.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Solicitado:</span>
                        <span>
                          {formatDistanceToNow(new Date(order.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      {order.code && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Código:</span>
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                            {order.code.code}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {order.status === 'PENDING_PAYMENT' && (
                      <Button
                        onClick={() => handleConfirmPayment(order.id)}
                        disabled={confirming === order.id}
                        className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                        size="sm"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {confirming === order.id
                          ? 'Confirmando...'
                          : 'Confirmar Pagamento'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
