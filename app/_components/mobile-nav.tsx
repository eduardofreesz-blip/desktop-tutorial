'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Smartphone,
  Key,
  ShoppingCart,
  Settings,
  MessageCircle,
  Bell,
  CreditCard,
  Users,
  Ticket,
  Gift,
  FileText,
  DollarSign,
  Bot,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/aria', label: 'ARIA IA', icon: Sparkles, special: true },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
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
  { href: '/settings/payments', label: 'Pagamentos', icon: CreditCard },
  { href: '/profile', label: 'Meu Perfil', icon: Users },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-left">
            <span className="text-xl font-bold text-primary">🎯 Universal Recargas</span>
            <p className="text-xs text-muted-foreground font-normal">Painel Administrativo</p>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-base',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : (item as any).special
                          ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
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
      </SheetContent>
    </Sheet>
  );
}
