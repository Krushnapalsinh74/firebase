import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Layers, 
  Sparkles, 
  LibraryBig, 
  History, 
  Cpu, 
  FileText, 
  BarChart3,
  LogOut,
  Menu,
  Sun,
  Moon
} from 'lucide-react';
import { useAuthStore } from '@/hooks/use-auth';
import { useThemeStore } from '@/hooks/use-theme';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hierarchy', label: 'Hierarchy', icon: Layers },
  { href: '/generate', label: 'Generate', icon: Sparkles },
  { href: '/questions', label: 'Questions', icon: LibraryBig },
  { href: '/jobs', label: 'Jobs', icon: History },
  { href: '/providers', label: 'Providers', icon: Cpu },
  { href: '/papers', label: 'Papers', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

function NavLinks() {
  const [location] = useLocation();
  return (
    <div className="flex flex-col gap-1 w-full">
      {navItems.map((item) => {
        const isActive = location.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              className={`w-full justify-start ${isActive ? 'bg-secondary font-medium' : 'font-normal'}`}
            >
              <item.icon className={`mr-2 h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuthStore();
  const { theme, toggle } = useThemeStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="font-bold">Y</span>
          </div>
          <span className="font-semibold tracking-tight">Yunora</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] flex flex-col">
            <div className="flex h-14 items-center px-2">
              <span className="font-semibold tracking-tight text-lg">Yunora</span>
            </div>
            <Separator className="mb-4" />
            <div className="flex-1 overflow-auto">
              <NavLinks />
            </div>
            <div className="mt-auto p-4 border-t flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name || 'Admin'}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card min-h-screen sticky top-0 h-screen">
        <div className="flex h-16 items-center gap-2 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="font-bold">Y</span>
          </div>
          <span className="font-bold tracking-tight text-lg">Yunora</span>
        </div>
        
        <div className="flex-1 overflow-auto px-3 py-4">
          <NavLinks />
        </div>
        
        <div className="mt-auto border-t p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{user?.name || 'Admin'}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email || 'admin@yunora.com'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="icon" onClick={toggle} title="Toggle theme">
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[calc(100vh-3.5rem)] md:h-screen overflow-auto">
        <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav (Optional, maybe for top actions but let's stick to the sheet for now for cleaner UI given 8 routes) */}
    </div>
  );
}
