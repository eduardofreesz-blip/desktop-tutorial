'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface ReportData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageTicket: number;
    conversionRate: number;
    topApp: string;
    topPlan: string;
  };
  dailyData: Array<{ date: string; orders: number; revenue: number }>;
  appData: Array<{ name: string; orders: number; revenue: number }>;
  planData: Array<{ type: string; count: number; percentage: number }>;
  orders: Array<{
    id: string;
    clientName: string;
    clientPhone: string;
    appName: string;
    planType: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PLAN_COLORS = { mensal: '#3b82f6', trimestral: '#10b981', anual: '#f59e0b' };

const planLabels: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  annual: 'Anual',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual'
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appFilter, setAppFilter] = useState('all');
  const [apps, setApps] = useState<Array<{ id: string; name: string }>>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (appFilter && appFilter !== 'all') params.set('appId', appFilter);

      const [reportRes, appsRes] = await Promise.all([
        fetch(`/api/reports?${params.toString()}`),
        fetch('/api/apps')
      ]);

      const reportData = await reportRes.json();
      const appsData = await appsRes.json();

      setData(reportData);
      setApps(Array.isArray(appsData) ? appsData : []);
    } catch (error) {
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Definir período padrão: últimos 30 dias
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchData();
    }
  }, [dateFrom, dateTo, appFilter]);

  const exportCSV = () => {
    if (!data?.orders) return;

    const headers = ['Data', 'Cliente', 'Telefone', 'App', 'Plano', 'Valor', 'Status'];
    const rows = data.orders.map(o => [
      new Date(o.createdAt).toLocaleDateString('pt-BR'),
      o.clientName,
      o.clientPhone,
      o.appName,
      planLabels[o.planType] || o.planType,
      o.amount.toFixed(2),
      o.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado!');
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { summary, dailyData, appData, planData, orders } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada de vendas e performance</p>
        </div>
        <Button onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>App</Label>
              <Select value={appFilter} onValueChange={setAppFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos os apps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os apps</SelectItem>
                  {apps.map((app) => (
                    <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.averageTicket)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.conversionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Dia</CardTitle>
            <CardDescription>Evolução de receita no período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendas por App</CardTitle>
            <CardDescription>Performance de cada aplicativo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={appData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value: number, name: string) => [
                  name === 'revenue' ? formatCurrency(value) : value,
                  name === 'revenue' ? 'Receita' : 'Pedidos'
                ]} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Plano */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Plano</CardTitle>
          <CardDescription>Tipos de planos mais vendidos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ type, percentage }) => `${planLabels[type] || type}: ${percentage}%`}
                >
                  {planData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string, props: any) => [
                  `${value} pedidos (${props.payload.percentage}%)`,
                  planLabels[props.payload.type] || props.payload.type
                ]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Pedidos */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos no Período</CardTitle>
          <CardDescription>Lista detalhada de todas as vendas</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pedido no período selecionado
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.clientName}</p>
                          <p className="text-xs text-muted-foreground">{order.clientPhone}</p>
                        </div>
                      </TableCell>
                      <TableCell>{order.appName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {planLabels[order.planType] || order.planType}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(order.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'code_sent' ? 'default' : 'secondary'}>
                          {order.status === 'code_sent' ? 'Enviado' : order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
