'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Users,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  Send,
  RefreshCw,
  Search,
  Filter,
  Phone,
  MessageCircle,
  Loader2,
  Heart,
  AlertTriangle,
} from 'lucide-react';

interface Customer {
  phone: string;
  name: string;
  lastOrderDate: string;
  totalOrders: number;
  totalSpent: number;
  lastPlanType: string;
  status: 'active' | 'expiring' | 'expired' | 'inactive';
  daysInactive?: number;
}

interface CustomerStats {
  total: number;
  mensal: number;
  trimestral: number;
  anual: number;
  inactive: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats>({ total: 0, mensal: 0, trimestral: 0, anual: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data.customers || []);
      setStats(data.stats || { total: 0, mensal: 0, trimestral: 0, anual: 0, inactive: 0 });
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    let filtered = customers;

    // Filtrar por tab
    if (activeTab === 'mensal') {
      filtered = filtered.filter((c) => c.lastPlanType === 'mensal' || c.lastPlanType === 'monthly');
    } else if (activeTab === 'trimestral') {
      filtered = filtered.filter((c) => c.lastPlanType === 'trimestral' || c.lastPlanType === 'quarterly');
    } else if (activeTab === 'anual') {
      filtered = filtered.filter((c) => c.lastPlanType === 'anual' || c.lastPlanType === 'annual');
    } else if (activeTab === 'inactive') {
      filtered = filtered.filter((c) => c.status === 'inactive');
    }

    // Filtrar por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) => c.name.toLowerCase().includes(term) || c.phone.includes(term)
      );
    }

    setFilteredCustomers(filtered);
  }, [customers, activeTab, searchTerm]);

  const handleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map((c) => c.phone));
    }
  };

  const handleSelectCustomer = (phone: string) => {
    if (selectedCustomers.includes(phone)) {
      setSelectedCustomers(selectedCustomers.filter((p) => p !== phone));
    } else {
      setSelectedCustomers([...selectedCustomers, phone]);
    }
  };

  const handleSendMessage = async (type: 'miss_you' | 'promo' | 'custom', customMessage?: string) => {
    if (selectedCustomers.length === 0) {
      toast.error('Selecione pelo menos um cliente');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/customers/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phones: selectedCustomers,
          messageType: type,
          customMessage,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Mensagem enviada para ${data.sent} cliente(s)`);
        setSelectedCustomers([]);
      } else {
        toast.error(data.error || 'Erro ao enviar mensagens');
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagens');
    } finally {
      setSending(false);
    }
  };

  const getPlanBadge = (planType: string) => {
    const type = planType.toLowerCase();
    if (type === 'mensal' || type === 'monthly') {
      return <Badge className="bg-blue-500">Mensal</Badge>;
    } else if (type === 'trimestral' || type === 'quarterly') {
      return <Badge className="bg-purple-500">Trimestral</Badge>;
    } else if (type === 'anual' || type === 'annual') {
      return <Badge className="bg-green-500">Anual</Badge>;
    }
    return <Badge>{planType}</Badge>;
  };

  const getStatusBadge = (status: string, daysInactive?: number) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativo</Badge>;
      case 'expiring':
        return <Badge className="bg-yellow-500">Vencendo</Badge>;
      case 'expired':
        return <Badge className="bg-orange-500">Vencido</Badge>;
      case 'inactive':
        return <Badge className="bg-red-500">Inativo {daysInactive ? `(${daysInactive}d)` : ''}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">
            Gerencie seus clientes por tipo de plano
          </p>
        </div>
        <Button onClick={fetchCustomers} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensal</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.mensal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trimestral</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">{stats.trimestral}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anual</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.anual}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Ações em Massa */}
      {selectedCustomers.length > 0 && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <span className="font-medium">{selectedCustomers.length} cliente(s) selecionado(s)</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendMessage('miss_you')}
                  disabled={sending}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4 mr-1" />}
                  Sentimos Sua Falta
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendMessage('promo')}
                  disabled={sending}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Enviar Promo
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSelectedCustomers([])}
                  variant="ghost"
                >
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs e Lista */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Clientes</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos ({stats.total})</TabsTrigger>
              <TabsTrigger value="mensal">Mensal ({stats.mensal})</TabsTrigger>
              <TabsTrigger value="trimestral">Trimestral ({stats.trimestral})</TabsTrigger>
              <TabsTrigger value="anual">Anual ({stats.anual})</TabsTrigger>
              <TabsTrigger value="inactive">
                <AlertTriangle className="w-4 h-4 mr-1 text-red-500" />
                Inativos ({stats.inactive})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum cliente encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg font-medium text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">Cliente</div>
                    <div className="w-24 text-center">Plano</div>
                    <div className="w-24 text-center">Status</div>
                    <div className="w-24 text-center">Pedidos</div>
                    <div className="w-28 text-right">Total Gasto</div>
                  </div>

                  {/* Lista */}
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.phone}
                      className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                        selectedCustomers.includes(customer.phone) ? 'bg-primary/5 border-primary' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCustomers.includes(customer.phone)}
                        onChange={() => handleSelectCustomer(customer.phone)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{customer.name || 'Cliente'}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </p>
                      </div>
                      <div className="w-24 text-center">
                        {getPlanBadge(customer.lastPlanType)}
                      </div>
                      <div className="w-24 text-center">
                        {getStatusBadge(customer.status, customer.daysInactive)}
                      </div>
                      <div className="w-24 text-center">
                        {customer.totalOrders}
                      </div>
                      <div className="w-28 text-right font-medium">
                        R$ {customer.totalSpent.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dicas para Clientes Inativos */}
      {activeTab === 'inactive' && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <Heart className="w-5 h-5" />
              Recupere Seus Clientes!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-4">
              Esses clientes não compram há mais de 30 dias. Envie uma mensagem carinhosa para trazê-los de volta!
            </p>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setSelectedCustomers(filteredCustomers.map((c) => c.phone));
                handleSendMessage('miss_you');
              }}
              disabled={sending || filteredCustomers.length === 0}
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Heart className="w-4 h-4 mr-2" />}
              Enviar "Sentimos Sua Falta" para Todos
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
