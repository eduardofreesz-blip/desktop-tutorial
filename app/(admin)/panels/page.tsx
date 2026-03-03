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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  LayoutGrid, Plus, Copy, ExternalLink, Settings, Trash2, Users, 
  Calendar, Link2, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Panel {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  expiresAt: string | null;
  maxApps: number;
  maxCodes: number;
  commission: number;
  createdAt: string;
  owner: {
    name: string;
    email: string;
  };
}

interface Invite {
  id: string;
  code: string;
  email: string | null;
  role: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function PanelsPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'panels' | 'invites'>('panels');
  
  // Form states
  const [showPanelDialog, setShowPanelDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [panelForm, setPanelForm] = useState({
    name: '',
    slug: '',
    maxApps: 5,
    maxCodes: 1000,
    commission: 0,
    expiresAt: '',
  });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user',
    maxUses: 1,
    expiresAt: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [panelsRes, invitesRes] = await Promise.all([
        fetch('/api/panels'),
        fetch('/api/invites'),
      ]);
      const panelsData = await panelsRes.json();
      const invitesData = await invitesRes.json();
      
      if (panelsData.success) setPanels(panelsData.panels);
      if (invitesData.success) setInvites(invitesData.invites);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePanel = async () => {
    if (!panelForm.name || !panelForm.slug) {
      toast.error('Nome e slug são obrigatórios');
      return;
    }
    
    setCreating(true);
    try {
      const res = await fetch('/api/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(panelForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Painel criado com sucesso!');
        setShowPanelDialog(false);
        setPanelForm({ name: '', slug: '', maxApps: 5, maxCodes: 1000, commission: 0, expiresAt: '' });
        fetchData();
      } else {
        toast.error(data.error || 'Erro ao criar painel');
      }
    } catch (error) {
      toast.error('Erro ao criar painel');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateInvite = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Convite criado com sucesso!');
        setShowInviteDialog(false);
        setInviteForm({ email: '', role: 'user', maxUses: 1, expiresAt: '' });
        fetchData();
        
        // Copiar link automaticamente
        const inviteLink = `${window.location.origin}/register?invite=${data.invite.code}`;
        navigator.clipboard.writeText(inviteLink);
        toast.info('Link copiado para a área de transferência!');
      } else {
        toast.error(data.error || 'Erro ao criar convite');
      }
    } catch (error) {
      toast.error('Erro ao criar convite');
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePanel = async (panelId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/panels/${panelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isActive ? 'Painel ativado' : 'Painel desativado');
        fetchData();
      }
    } catch (error) {
      toast.error('Erro ao atualizar painel');
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm('Tem certeza que deseja excluir este convite?')) return;
    
    try {
      const res = await fetch(`/api/invites/${inviteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Convite excluído');
        fetchData();
      }
    } catch (error) {
      toast.error('Erro ao excluir convite');
    }
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/register?invite=${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
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
            <LayoutGrid className="w-6 h-6" /> Painéis e Convites
          </h2>
          <p className="text-muted-foreground">Crie painéis para outros usuários e gerencie convites</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('panels')}
          className={`px-4 py-2 border-b-2 transition-colors ${activeTab === 'panels' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <LayoutGrid className="w-4 h-4 inline mr-2" />
          Painéis ({panels.length})
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`px-4 py-2 border-b-2 transition-colors ${activeTab === 'invites' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Link2 className="w-4 h-4 inline mr-2" />
          Convites ({invites.length})
        </button>
      </div>

      {/* Painéis Tab */}
      {activeTab === 'panels' && (
        <div className="space-y-4">
          <Dialog open={showPanelDialog} onOpenChange={setShowPanelDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Criar Painel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Painel</DialogTitle>
                <DialogDescription>Configure um painel para alugar a outro usuário</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Painel</Label>
                  <Input
                    value={panelForm.name}
                    onChange={(e) => {
                      setPanelForm(prev => ({ 
                        ...prev, 
                        name: e.target.value,
                        slug: generateSlug(e.target.value)
                      }));
                    }}
                    placeholder="Painel do João"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL)</Label>
                  <Input
                    value={panelForm.slug}
                    onChange={(e) => setPanelForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="painel-joao"
                  />
                  <p className="text-xs text-muted-foreground">URL: /panel/{panelForm.slug || 'slug'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Máx. Apps</Label>
                    <Input
                      type="number"
                      value={panelForm.maxApps}
                      onChange={(e) => setPanelForm(prev => ({ ...prev, maxApps: parseInt(e.target.value) || 5 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. Códigos</Label>
                    <Input
                      type="number"
                      value={panelForm.maxCodes}
                      onChange={(e) => setPanelForm(prev => ({ ...prev, maxCodes: parseInt(e.target.value) || 1000 }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Comissão (%)</Label>
                    <Input
                      type="number"
                      value={panelForm.commission}
                      onChange={(e) => setPanelForm(prev => ({ ...prev, commission: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expira em</Label>
                    <Input
                      type="date"
                      value={panelForm.expiresAt}
                      onChange={(e) => setPanelForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPanelDialog(false)}>Cancelar</Button>
                <Button onClick={handleCreatePanel} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Criar Painel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {panels.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <LayoutGrid className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum painel criado ainda</p>
                  <p className="text-sm text-muted-foreground">Crie um painel para alugar a outro usuário</p>
                </CardContent>
              </Card>
            ) : (
              panels.map((panel) => (
                <Card key={panel.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{panel.name}</CardTitle>
                      <Switch
                        checked={panel.isActive}
                        onCheckedChange={(checked) => handleTogglePanel(panel.id, checked)}
                      />
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> /panel/{panel.slug}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={panel.isActive ? 'default' : 'secondary'}>
                        {panel.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Apps / Códigos</span>
                      <span>{panel.maxApps} / {panel.maxCodes}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Comissão</span>
                      <span>{panel.commission}%</span>
                    </div>
                    {panel.expiresAt && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Expira</span>
                        <span>{new Date(panel.expiresAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setPanelForm({
                            name: panel.name,
                            slug: panel.slug,
                            maxApps: panel.maxApps,
                            maxCodes: panel.maxCodes,
                            commission: panel.commission,
                            expiresAt: panel.expiresAt ? new Date(panel.expiresAt).toISOString().split('T')[0] : '',
                          });
                          setShowPanelDialog(true);
                          toast.info('Edição de painel em desenvolvimento');
                        }}
                      >
                        <Settings className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          window.open(`/panel/${panel.slug}`, '_blank');
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Convites Tab */}
      {activeTab === 'invites' && (
        <div className="space-y-4">
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Criar Link de Convite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Link de Teste/Convite</DialogTitle>
                <DialogDescription>Gere um link para novos usuários se cadastrarem</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>E-mail (opcional)</Label>
                  <Input
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">Se informado, apenas este e-mail poderá usar o convite</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Função</Label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. Usos</Label>
                    <Input
                      type="number"
                      value={inviteForm.maxUses}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, maxUses: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Expira em (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={inviteForm.expiresAt}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancelar</Button>
                <Button onClick={handleCreateInvite} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Criar Convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="space-y-3">
            {invites.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Link2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum convite criado ainda</p>
                  <p className="text-sm text-muted-foreground">Crie um link de convite para novos usuários</p>
                </CardContent>
              </Card>
            ) : (
              invites.map((invite) => (
                <Card key={invite.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{invite.code}</code>
                        <Badge variant={invite.isActive ? 'default' : 'secondary'}>
                          {invite.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant="outline">
                          {invite.usedCount}/{invite.maxUses} usos
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {invite.email && <span>Para: {invite.email}</span>}
                        <span>Função: {invite.role === 'admin' ? 'Admin' : 'Usuário'}</span>
                        {invite.expiresAt && (
                          <span>Expira: {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyLink(invite.code)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteInvite(invite.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
