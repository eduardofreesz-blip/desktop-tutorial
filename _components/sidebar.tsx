'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Smartphone,
  Key,
  ShoppingCart,
  BarChart3,
  Settings,
  MessageCircle,
  Bell,
  CreditCard,
  Users,
  Send,
  Ticket,
  Gift,
  FileText,
  DollarSign,
  Bot,
  Sparkles,
} from 'lucide-react';

// Ícone do Telegram personalizado
const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/aria', label: 'ARIA IA', icon: Sparkles, special: true },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/telegram', label: 'Telegram', icon: TelegramIcon },
  { href: '/bot-config', label: 'Config. Bot', icon: Bot },
  { href: '/apps', label: 'Apps', icon: Smartphone },
  { href: '/plans', label: 'Planos', icon: DollarSign },
  { href: '/codes', label: 'Códigos', icon: Key },
  { href: '/orders', label: 'Pedidos', icon: ShoppingCart },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/coupons', label: 'Cupons', icon: Ticket },
  { href: '/referrals', label: 'Indicações', icon: Gift },
  { href: '/reminders', label: 'Lembretes', icon: Bell },
  { href: '/reports', label: 'Relatórios', icon: FileText },
  { href: '/panels', label: 'Painéis', icon: LayoutDashboard },
  { href: '/openclaw', label: 'OpenClaw', icon: Bot, special: true },
  { href: '/settings/payments', label: 'Pagamentos', icon: CreditCard },
  { href: '/profile', label: 'Meu Perfil', icon: Users },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-card border-r h-screen sticky top-0">
      <div className="p-6 border-b flex-shrink-0">
        <h1 className="text-xl font-bold text-primary">
          🎯 Universal Recargas
        </h1>
        <p className="text-xs text-muted-foreground">Painel Administrativo</p>
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : (item as any).special
                        ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-200 dark:border-purple-800'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className={cn('w-5 h-5', (item as any).special && !isActive && 'text-purple-500')} />
                  {item.label}
                  {(item as any).special && !isActive && (
                    <span className="ml-auto text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
