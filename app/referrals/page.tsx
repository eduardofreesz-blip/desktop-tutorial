'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Users, DollarSign, Gift, Copy, Check, Wallet, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface ReferredUser {
  id: string;
  clientPhone: string;
  clientName: string | null;
  commission: number;
  status: string;
  createdAt: string;
}

interface Referral {
  id: string;
  referrerPhone: string;
  referrerName: string | null;
  referralCode: string;
  commission: number;
  totalReferrals: number;
  totalEarnings: number;
  pendingPayout: number;
  isActive: boolean;
  createdAt: string;
  referredUsers: ReferredUser[];
  _count: { referredUsers: number; payouts: number };
}

interface Stats {
  totalReferrers: number;
  totalReferrals: number;
  totalEarnings: number;
  pendingPayouts: number;
}

const initialFormData = {
  referrerPhone: '',
  referrerName: '',
  commission: '10'
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<Stats>({ totalReferrers: 0, totalReferrals: 0, totalEarnings: 0, pendingPayouts: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [pixKey, setPixKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/referrals');
      const data = await res.json();
      setReferrals(data.referrals || []);
      setStats(data.stats || { totalReferrers: 0, totalReferrals: 0, totalEarnings: 0, pendingPayouts: 0 });
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.referrerPhone) {
      toast.error('Informe o telefone do indicador');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao criar');
      }

      toast.success('Indicador cadastrado!');
      setDialogOpen(false);
      setFormData(initialFormData);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cadastrar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (referral: Referral) => {
    try {
      await fetch(`/api/referrals/${referral.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !referral.isActive })
      });
      toast.success(referral.isActive ? 'Indicador desativado' : 'Indicador ativado');
      fetchData();
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const handlePayout = async () => {
    if (!selectedReferral) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/referrals/${selectedReferral.id}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixKey })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao processar');
      }

      toast.success('Pagamento registrado!');
      setPayoutDialogOpen(false);
      setSelectedReferral(null);
      setPixKey('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar pagamento');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success('Código copiado!');
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Programa de Indicação</h1>
          <p className="text-muted-foreground">Gerencie seus indicadores e comissões</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Indicador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Indicador</DialogTitle>
              <DialogDescription>
                Adicione um novo parceiro ao programa de indicação
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Telefone (WhatsApp)</Label>
                <Input
                  placeholder="5511999999999"
                  value={formData.referrerPhone}
                  onChange={(e) => setFormData({ ...formData, referrerPhone: e.target.value.replace(/\D/g, '') })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome (opcional)</Label>
                <Input
                  placeholder="Nome do indicador"
                  value={formData.referrerName}
                  onChange={(e) => setFormData({ ...formData, referrerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={formData.commission}
                  onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Cadastrando...' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicadores</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrers}</div>
            <p className="text-xs text-muted-foreground">Parceiros ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicações</CardTitle>
            <Gift className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">Clientes indicados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalEarnings - stats.pendingPayouts)}</div>
            <p className="text-xs text-muted-foreground">Em comissões</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{formatCurrency(stats.pendingPayouts)}</div>
            <p className="text-xs text-muted-foreground">Saldo pendente</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Indicadores</CardTitle>
          <CardDescription>Lista de todos os parceiros do programa</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum indicador cadastrado</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Cadastrar Primeiro Indicador
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Indicações</TableHead>
                  <TableHead>Total Ganho</TableHead>
                  <TableHead>A Receber</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{referral.referrerName || 'Sem nome'}</p>
                        <p className="text-sm text-muted-foreground">{referral.referrerPhone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded font-mono">{referral.referralCode}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyCode(referral.referralCode)}
                        >
                          {copiedCode === referral.referralCode ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{referral.commission}%</Badge>
                    </TableCell>
                    <TableCell>{referral.totalReferrals}</TableCell>
                    <TableCell>{formatCurrency(referral.totalEarnings)}</TableCell>
                    <TableCell>
                      {referral.pendingPayout > 0 ? (
                        <span className="text-orange-500 font-medium">
                          {formatCurrency(referral.pendingPayout)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={referral.isActive}
                        onCheckedChange={() => handleToggleActive(referral)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {referral.pendingPayout > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedReferral(referral);
                            setPayoutDialogOpen(true);
                          }}
                        >
                          <Wallet className="h-4 w-4 mr-1" />
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de Pagamento */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Confirme o pagamento da comissão para {selectedReferral?.referrerName || selectedReferral?.referrerPhone}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Valor a pagar</p>
              <p className="text-2xl font-bold">{formatCurrency(selectedReferral?.pendingPayout || 0)}</p>
            </div>
            <div className="space-y-2">
              <Label>Chave PIX (opcional)</Label>
              <Input
                placeholder="CPF, E-mail ou Telefone"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handlePayout} disabled={saving}>
              {saving ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
