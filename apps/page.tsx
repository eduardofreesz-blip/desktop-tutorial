'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Smartphone,
  Plus,
  Edit,
  Trash2,
  Upload,
  Package,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';

interface App {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  videoUrl: string | null;
  isActive: boolean;
  _count?: {
    codes: number;
  };
}

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    videoUrl: '',
    isActive: true,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const { toast } = useToast();

  const fetchApps = async () => {
    try {
      const res = await fetch('/api/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar apps',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleOpenDialog = (app?: App) => {
    if (app) {
      setEditingApp(app);
      setFormData({
        name: app.name,
        description: app.description || '',
        logoUrl: app.logoUrl || '',
        bannerUrl: app.bannerUrl || '',
        videoUrl: app.videoUrl || '',
        isActive: app.isActive,
      });
    } else {
      setEditingApp(null);
      setFormData({
        name: '',
        description: '',
        logoUrl: '',
        bannerUrl: '',
        videoUrl: '',
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem',
        variant: 'destructive',
      });
      return;
    }

    if (field === 'logoUrl') {
      setUploading(true);
    } else {
      setUploadingBanner(true);
    }

    try {
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          isPublic: true,
        }),
      });

      if (!presignedRes.ok) {
        throw new Error('Erro ao gerar URL de upload');
      }

      const { uploadUrl, cloud_storage_path } = await presignedRes.json();

      // Check if Content-Disposition is in signed headers
      const hasContentDisposition = uploadUrl.includes('content-disposition');
      
      const headers: Record<string, string> = {
        'Content-Type': file.type,
      };
      
      // If Content-Disposition is signed, must include it
      if (hasContentDisposition) {
        headers['Content-Disposition'] = 'attachment';
      }

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error('Upload error:', uploadRes.status, errorText);
        throw new Error('Erro ao fazer upload');
      }

      const bucketName = process.env.NEXT_PUBLIC_AWS_BUCKET_NAME;
      const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-west-2';
      const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;

      setFormData((prev) => ({ ...prev, [field]: publicUrl }));

      toast({
        title: 'Sucesso',
        description: field === 'logoUrl' ? 'Logo enviado com sucesso' : 'Banner enviado com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao fazer upload',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingApp ? `/api/apps/${editingApp.id}` : '/api/apps';
      const method = editingApp ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast({
          title: 'Sucesso',
          description: `App ${editingApp ? 'atualizado' : 'criado'} com sucesso`,
        });
        setIsDialogOpen(false);
        fetchApps();
      } else {
        throw new Error();
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar app',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este app?')) return;

    try {
      const res = await fetch(`/api/apps/${id}`, { method: 'DELETE' });

      if (res.ok) {
        toast({
          title: 'Sucesso',
          description: 'App deletado com sucesso',
        });
        fetchApps();
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao deletar app',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (app: App) => {
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !app.isActive }),
      });

      if (res.ok) {
        toast({
          title: 'Sucesso',
          description: `App ${!app.isActive ? 'ativado' : 'desativado'} com sucesso`,
        });
        fetchApps();
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status do app',
        variant: 'destructive',
      });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Apps</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os apps e serviços disponíveis
          </p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo App
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <Card key={app.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {app.logoUrl ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={app.logoUrl}
                        alt={app.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-green-400 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {app._count?.codes || 0} códigos disponíveis
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(app)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {app.isActive ? (
                    <Eye className="w-4 h-4 text-green-500" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {app.description || 'Sem descrição'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenDialog(app)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleDelete(app.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {apps.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum app cadastrado</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro App
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingApp ? 'Editar App' : 'Novo App'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do app/serviço
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="Ex: Unitv"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Breve descrição do serviço"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo (ícone do app)</Label>
              {formData.logoUrl && (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 mb-2">
                  <Image
                    src={formData.logoUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'logoUrl')}
                  disabled={uploading}
                  className="flex-1"
                />
              </div>
              {uploading && (
                <p className="text-xs text-muted-foreground">Enviando...</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner">Banner WhatsApp (imagem atrativa)</Label>
              {formData.bannerUrl && (
                <div className="relative w-full h-24 rounded-lg overflow-hidden bg-gray-100 mb-2">
                  <Image
                    src={formData.bannerUrl}
                    alt="Banner Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  id="banner"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'bannerUrl')}
                  disabled={uploadingBanner}
                  className="flex-1"
                />
              </div>
              {uploadingBanner && (
                <p className="text-xs text-muted-foreground">Enviando...</p>
              )}
              <p className="text-xs text-muted-foreground">
                Imagem enviada no WhatsApp quando cliente escolhe o app
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoUrl">URL do Vídeo Tutorial</Label>
              <Input
                id="videoUrl"
                value={formData.videoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, videoUrl: e.target.value })
                }
                placeholder="https://youtube.com/... ou link direto"
              />
              <p className="text-xs text-muted-foreground">
                Link do vídeo ensinando como instalar o app
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="active">Ativo</Label>
              <Switch
                id="active"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
              >
                {editingApp ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
