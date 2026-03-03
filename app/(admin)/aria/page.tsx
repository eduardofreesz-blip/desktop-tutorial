'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Bot,
  Send,
  Sparkles,
  Zap,
  Database,
  MessageSquare,
  Settings,
  ShoppingCart,
  Users,
  BarChart,
  Loader2,
  Lightbulb,
  Globe,
  Download,
  Upload,
  ExternalLink,
  HelpCircle,
  BookOpen,
  Video,
  FileText,
  Link2,
  Search,
  Copy,
  CheckCircle,
  AlertCircle,
  Smartphone,
  CreditCard,
  Key,
  Rocket,
  LifeBuoy,
  MessageCircle
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{ tool: string; result: any }>;
  timestamp: Date;
}

interface AgentInfo {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  toolsCount: number;
  tools: Array<{ name: string; description: string }>;
}

// Comandos rápidos organizados por categoria
const quickCommandsCategories = [
  {
    category: '📊 Vendas & Relatórios',
    commands: [
      { label: 'Relatório de Vendas', command: 'Gere um relatório de vendas da semana', icon: BarChart },
      { label: 'Faturamento Mensal', command: 'Qual foi o faturamento do mês atual?', icon: CreditCard },
      { label: 'Produtos Mais Vendidos', command: 'Quais são os apps mais vendidos?', icon: Rocket },
    ]
  },
  {
    category: '📦 Estoque & Códigos',
    commands: [
      { label: 'Verificar Estoque', command: 'Verifique o estoque de todos os apps', icon: Key },
      { label: 'Códigos Baixos', command: 'Quais apps estão com estoque baixo?', icon: AlertCircle },
      { label: 'Adicionar Códigos', command: 'Como adicionar códigos ao estoque?', icon: Upload },
    ]
  },
  {
    category: '👥 Clientes',
    commands: [
      { label: 'Clientes VIP', command: 'Liste os clientes VIP com mais compras', icon: Users },
      { label: 'Clientes Inativos', command: 'Quais clientes estão inativos há mais de 30 dias?', icon: Users },
      { label: 'Vencimentos Próximos', command: 'Quais planos vencem nos próximos 3 dias?', icon: AlertCircle },
    ]
  },
  {
    category: '🎫 Promoções',
    commands: [
      { label: 'Criar Cupom 10%', command: 'Crie um cupom PROMO10 com 10% de desconto', icon: Sparkles },
      { label: 'Cupons Ativos', command: 'Liste todos os cupons ativos', icon: FileText },
      { label: 'Enviar Promoção', command: 'Envie uma mensagem promocional para clientes inativos', icon: MessageCircle },
    ]
  }
];

// Links úteis externos
const usefulLinks = [
  {
    category: '🔧 Ferramentas Úteis',
    links: [
      { name: 'WhatsApp Web', url: 'https://web.whatsapp.com', desc: 'Acesse o WhatsApp pelo navegador' },
      { name: 'Gerador de QR Code', url: 'https://www.qr-code-generator.com', desc: 'Crie QR codes para pagamentos' },
      { name: 'Encurtador de Links', url: 'https://bitly.com', desc: 'Encurte links longos' },
      { name: 'Canva', url: 'https://canva.com', desc: 'Crie imagens e banners' },
    ]
  },
  {
    category: '💳 Pagamentos',
    links: [
      { name: 'Dashboard Getnet', url: 'https://portal.getnet.com.br', desc: 'Painel Getnet' },
      { name: 'PagSeguro', url: 'https://pagseguro.uol.com.br', desc: 'Painel PagSeguro' },
      { name: 'FitBank', url: 'https://fitbank.com.br', desc: 'Painel FitBank' },
      { name: 'Mercado Pago', url: 'https://mercadopago.com.br', desc: 'Painel Mercado Pago' },
    ]
  },
  {
    category: '📱 Apps de Streaming',
    links: [
      { name: 'Netflix Redeem', url: 'https://netflix.com/redeem', desc: 'Ativar códigos Netflix' },
      { name: 'Spotify Redeem', url: 'https://spotify.com/redeem', desc: 'Ativar códigos Spotify' },
      { name: 'Disney+ Redeem', url: 'https://disneyplus.com/redeem', desc: 'Ativar códigos Disney+' },
      { name: 'HBO Max', url: 'https://hbomax.com/redeem', desc: 'Ativar códigos HBO Max' },
    ]
  },
  {
    category: '📚 Documentação',
    links: [
      { name: 'API WhatsApp Business', url: 'https://developers.facebook.com/docs/whatsapp', desc: 'Docs oficiais' },
      { name: 'Baileys Wiki', url: 'https://github.com/WhiskeySockets/Baileys', desc: 'Biblioteca WhatsApp' },
      { name: 'Prisma Docs', url: 'https://prisma.io/docs', desc: 'ORM do banco de dados' },
      { name: 'Next.js Docs', url: 'https://nextjs.org/docs', desc: 'Framework web' },
    ]
  }
];

// Tutoriais e guias
const helpGuides = [
  {
    title: 'Como Conectar o WhatsApp',
    icon: MessageCircle,
    steps: [
      '1. Vá para a página WhatsApp no menu lateral',
      '2. Clique em "Conectar WhatsApp"',
      '3. Escaneie o QR Code com seu celular',
      '4. Abra WhatsApp > Menu > Aparelhos conectados > Conectar um aparelho',
      '5. Aguarde a confirmação de conexão'
    ]
  },
  {
    title: 'Como Adicionar Códigos',
    icon: Key,
    steps: [
      '1. Vá para a página Códigos no menu lateral',
      '2. Selecione o App e o Plano',
      '3. Cole os códigos (um por linha)',
      '4. Clique em "Adicionar Códigos"',
      '5. Verifique se foram adicionados corretamente'
    ]
  },
  {
    title: 'Como Configurar Pagamentos',
    icon: CreditCard,
    steps: [
      '1. Vá para Configurações > Pagamentos',
      '2. Escolha o Gateway (Getnet, PagSeguro, FitBank)',
      '3. Preencha as credenciais da API',
      '4. Configure o ambiente (Sandbox/Produção)',
      '5. Teste com um pagamento pequeno'
    ]
  },
  {
    title: 'Como Criar um App',
    icon: Smartphone,
    steps: [
      '1. Vá para a página Apps no menu lateral',
      '2. Clique em "Adicionar App"',
      '3. Preencha nome, descrição e logo',
      '4. Adicione os planos (Mensal, Trimestral, Anual)',
      '5. Ative o app quando estiver pronto'
    ]
  }
];

export default function AriaPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgentInfo();
    // Mensagem de boas-vindas
    setMessages([{
      id: '1',
      role: 'assistant',
      content: 'Olá! 👋 Eu sou a **ARIA**, sua Assistente de Recargas Inteligente Avançada!\n\nEu tenho acesso completo ao banco de dados e posso executar qualquer ação para você:\n\n• Criar, editar e gerenciar apps e planos\n• Adicionar códigos ao estoque\n• Confirmar pagamentos e enviar códigos\n• Criar cupons de desconto\n• Gerar relatórios de vendas\n• Enviar mensagens para clientes\n• E muito mais!\n\nUse as **abas acima** para navegar entre:\n🤖 **Chat** - Converse comigo\n🔗 **Links Úteis** - Ferramentas externas\n📚 **Ajuda** - Tutoriais e guias\n\n**Como posso ajudar?** 🚀',
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchAgentInfo = async () => {
    try {
      const response = await fetch('/api/ai/agent');
      if (response.ok) {
        const data = await response.json();
        setAgentInfo(data);
      }
    } catch (error) {
      console.error('Erro ao buscar info do agente:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const openExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setActiveTab('chat'); // Switch to chat tab when sending message
    setLoading(true);

    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          actions: data.actions,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        toast.error(data.error || 'Erro ao processar solicitação');
      }
    } catch (error) {
      toast.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Formatar markdown básico
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  // Filter links based on search
  const filteredLinks = usefulLinks.map(category => ({
    ...category,
    links: category.links.filter(link =>
      link.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.desc.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.links.length > 0);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              ARIA
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </h1>
            <p className="text-sm text-muted-foreground">Assistente de Recargas Inteligente Avançada</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Zap className="w-3 h-3" />
            v{agentInfo?.version || '2.0'}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Database className="w-3 h-3" />
            {agentInfo?.toolsCount || 0} ferramentas
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTools(!showTools)}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="chat" className="gap-2">
            <Bot className="w-4 h-4" />
            Chat IA
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2">
            <Globe className="w-4 h-4" />
            Links Úteis
          </TabsTrigger>
          <TabsTrigger value="help" className="gap-2">
            <LifeBuoy className="w-4 h-4" />
            Ajuda
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex gap-4 min-h-0 mt-0">
          <Card className="flex-1 flex flex-col">
            <CardContent className="flex-1 flex flex-col p-4 min-h-0">
              {/* Messages */}
              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="w-4 h-4" />
                            <span className="text-xs font-medium">ARIA</span>
                          </div>
                        )}
                        <div
                          className="text-sm"
                          dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                        />
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs font-medium mb-1">Ações executadas:</p>
                            {msg.actions.map((action, idx) => (
                              <Badge
                                key={idx}
                                variant={action.result.success ? 'default' : 'destructive'}
                                className="mr-1 mb-1 text-xs"
                              >
                                {action.tool}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs opacity-50 mt-1">
                          {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">ARIA está processando...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Quick Commands Accordion */}
              <div className="mt-4 mb-3">
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex flex-col gap-2">
                    {quickCommandsCategories.map((cat, catIdx) => (
                      <div key={catIdx}>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{cat.category}</p>
                        <div className="flex gap-2 flex-wrap">
                          {cat.commands.map((cmd, idx) => {
                            const Icon = cmd.icon;
                            return (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1"
                                onClick={() => sendMessage(cmd.command)}
                                disabled={loading}
                              >
                                <Icon className="w-3 h-3" />
                                {cmd.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem ou comando para ARIA..."
                  className="min-h-[60px] resize-none"
                  disabled={loading}
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-4"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tools Sidebar */}
          {showTools && (
            <Card className="w-80 flex-shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Ferramentas Disponíveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-350px)]">
                  <div className="space-y-2">
                    {agentInfo?.tools.map((tool, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded border text-xs hover:bg-muted cursor-pointer"
                        onClick={() => setInput(`Use a ferramenta ${tool.name}`)}
                      >
                        <p className="font-mono font-medium text-primary">{tool.name}</p>
                        <p className="text-muted-foreground mt-1">{tool.description}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value="links" className="flex-1 min-h-0 mt-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Links Úteis & Ferramentas
                  </CardTitle>
                  <CardDescription>Acesse rapidamente ferramentas externas e recursos úteis</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar links..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  {filteredLinks.map((category, catIdx) => (
                    <div key={catIdx}>
                      <h3 className="font-medium text-sm mb-3">{category.category}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {category.links.map((link, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border hover:bg-muted/50 transition-colors group cursor-pointer"
                            onClick={() => openExternalLink(link.url)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ExternalLink className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm">{link.name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(link.url);
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{link.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredLinks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum link encontrado para "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Help Tab */}
        <TabsContent value="help" className="flex-1 min-h-0 mt-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Central de Ajuda
              </CardTitle>
              <CardDescription>Tutoriais e guias para usar o sistema</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {helpGuides.map((guide, idx) => {
                    const Icon = guide.icon;
                    const isExpanded = expandedGuide === idx;
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border transition-all ${isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'}`}
                      >
                        <button
                          className="w-full p-4 flex items-center justify-between text-left"
                          onClick={() => setExpandedGuide(isExpanded ? null : idx)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <span className="font-medium">{guide.title}</span>
                          </div>
                          <HelpCircle className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4">
                            <div className="pl-13 space-y-2">
                              {guide.steps.map((step, stepIdx) => (
                                <div key={stepIdx} className="flex items-start gap-2 text-sm">
                                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Quick Tips */}
                  <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800">
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-yellow-500" />
                      Dicas Rápidas
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                        Use comandos naturais como "Liste os apps" ou "Crie um cupom de 10%"
                      </li>
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                        A ARIA pode executar múltiplas ações de uma vez
                      </li>
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                        Use os botões rápidos para tarefas comuns
                      </li>
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                        Os links úteis abrem em nova aba para não perder o contexto
                      </li>
                    </ul>
                  </div>

                  {/* Contact Support */}
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <MessageCircle className="w-4 h-4" />
                      Precisa de Mais Ajuda?
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Use o chat da ARIA para fazer perguntas específicas sobre o sistema.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveTab('chat');
                        setInput('Preciso de ajuda com ');
                      }}
                    >
                      <Bot className="w-4 h-4 mr-2" />
                      Perguntar à ARIA
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Capabilities Footer */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" /> Vendas
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" /> Clientes
        </span>
        <span className="flex items-center gap-1">
          <BarChart className="w-3 h-3" /> Relatórios
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> WhatsApp
        </span>
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3" /> Banco de Dados
        </span>
        <span className="flex items-center gap-1">
          <Globe className="w-3 h-3" /> Links Externos
        </span>
      </div>
    </div>
  );
}
