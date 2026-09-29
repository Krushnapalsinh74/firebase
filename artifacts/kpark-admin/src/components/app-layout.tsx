import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Layers, 
  Sparkles, 
  FileUp,
  LibraryBig, 
  History, 
  Cpu, 
  FileText, 
  BarChart3,
  LogOut,
  Menu,
  Sun,
  Moon,
  Globe,
  IndianRupee,
  Users,
  Settings,
  MonitorPlay,
  UserCheck,
  CheckCircle2,
  ScrollText
} from 'lucide-react';
import { useAuthStore } from '@/hooks/use-auth';
import { useThemeStore } from '@/hooks/use-theme';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';

interface NavItemDef {
  href: string;
  label: string;
  icon: any;
  permKey?: string;
  superAdminOnly?: boolean;
  isApprovalTab?: boolean;
}

const allNavItems: NavItemDef[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/approvals', label: 'Approvals', icon: CheckCircle2, isApprovalTab: true },
  { href: '/sub-admins', label: 'Sub-Admins', icon: UserCheck, superAdminOnly: true },
  { href: '/activity-logs', label: 'Activity Logs', icon: ScrollText, superAdminOnly: true },
  { href: '/hierarchy', label: 'Hierarchy', icon: Layers, permKey: 'hierarchy' },
  { href: '/generate', label: 'Generate', icon: Sparkles, permKey: 'generate' },
  { href: '/pdf-extractor', label: 'PDF AI Extractor', icon: FileUp, permKey: 'pdf-extractor' },
  { href: '/questions', label: 'Questions', icon: LibraryBig, permKey: 'questions' },
  { href: '/jobs', label: 'Jobs', icon: History, permKey: 'generate' },
  { href: '/providers', label: 'Providers', icon: Cpu, superAdminOnly: true },
  { href: '/browser', label: 'AI Browser & Images', icon: MonitorPlay, permKey: 'generate' },
  { href: '/papers', label: 'Papers', icon: FileText, permKey: 'papers' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, permKey: 'analytics' },
  { href: '/translate', label: 'Translate', icon: Globe, permKey: 'translate' },
  { href: '/plans', label: 'Plans & Pricing', icon: IndianRupee, superAdminOnly: true },
  { href: '/students', label: 'Students', icon: Users, superAdminOnly: true },
  { href: '/settings', label: 'Settings', icon: Settings, superAdminOnly: true },
];

function NavLinks() {
  const [location] = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const userPerms = (user as any)?.permissions || [];

  // Fetch pending count for approvals badge
  const { data: approvalsData } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: async () => {
      const res = await fetch('/api/approvals?status=pending&limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { pendingCount: 0 };
      return res.json() as Promise<{ pendingCount: number }>;
    },
    refetchInterval: 15000,
  });

  const pendingCount = approvalsData?.pendingCount || 0;

  // Filter navigation items
  const visibleNavItems = allNavItems.filter((item) => {
    if (isSuperAdmin) return true;
    if (item.superAdminOnly) return false;
    if (item.href === '/dashboard' || item.href === '/approvals') return true;
    if (item.permKey) return userPerms.includes(item.permKey);
    return false;
  });

  return (
    <div className="flex flex-col gap-1 w-full">
      {visibleNavItems.map(({ href, label, icon: Icon, isApprovalTab }) => {
        const isActive = location.startsWith(href);
        return (
          <Link key={href} href={href}>
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              className={`w-full justify-between ${isActive ? 'bg-secondary font-medium' : 'font-normal'}`}
            >
              <div className="flex items-center">
                <Icon className={`mr-2 h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {label}
              </div>
              {isApprovalTab && pendingCount > 0 && isSuperAdmin && (
                <Badge variant="destructive" className="h-4 px-1.5 text-[10px] rounded-full">
                  {pendingCount}
                </Badge>
              )}
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
  const isSubAdmin = user?.role === 'subadmin';

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="font-bold">K</span>
          </div>
          <span className="font-semibold tracking-tight">Knowledge Park</span>
          {isSubAdmin && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
              Sub-Admin
            </Badge>
          )}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] flex flex-col">
            <div className="flex h-14 items-center px-2">
              <span className="font-semibold tracking-tight text-lg">Knowledge Park</span>
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
            <span className="font-bold">K</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-base leading-tight">Knowledge Park</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              {isSubAdmin ? (
                <Badge variant="outline" className="text-[9px] py-0 px-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Sub-Admin Mode
                </Badge>
              ) : (
                'Super Administrator'
              )}
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto px-3 py-2 space-y-3">
          <NavLinks />
          <div className="pt-2 border-t border-border/60">
            <Link href="/student">
              <Button
                variant="outline"
                className="w-full justify-start text-xs font-semibold bg-gradient-to-r from-primary/10 to-blue-500/10 text-primary border-primary/30 hover:bg-primary/20 gap-2 shadow-xs"
              >
                <Globe className="h-4 w-4 text-primary" />
                <span>Open Student App</span>
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="mt-auto border-t p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{user?.name || 'Admin'}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email || 'admin@knowledgepark.edu'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
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
    </div>
  );
}
