import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  BookOpen, 
  Layers, 
  Award,
  BarChart3,
  User,
  LogOut,
  Menu,
  Sun,
  Moon,
  GraduationCap
} from 'lucide-react';
import { useStudentStore } from '@/hooks/use-student-store';
import { useThemeStore } from '@/hooks/use-theme';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

const isStudentDomain = typeof window !== 'undefined' && window.location.hostname.includes('student');
const basePath = isStudentDomain ? '' : '/student';

const studentNavItems = [
  { href: `${basePath}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
  { href: `${basePath}/curriculum`, label: 'My Curriculum', icon: BookOpen },
  { href: `${basePath}/tests`, label: 'Mock Exams', icon: Award },
  { href: `${basePath}/performance`, label: 'Performance', icon: BarChart3 },
  { href: `${basePath}/profile`, label: 'Profile Settings', icon: User },
];

function NavLinks() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col gap-1 w-full">
      {studentNavItems.map(({ href, label, icon: Icon }) => {
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
            </Button>
          </Link>
        );
      })}
    </div>
  );
}

export function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student, logoutStudent } = useStudentStore();
  const { theme, toggle } = useThemeStore();
  const [location, setLocation] = useLocation();

  React.useEffect(() => {
    if (!student) {
      setLocation(isStudentDomain ? '/login' : '/student/login', { replace: true });
    }
  }, [student, isStudentDomain, setLocation]);

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {}
    }
    logoutStudent();
    setLocation(isStudentDomain ? '/login' : '/student/login', { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Student Portal</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] flex flex-col">
            <div className="flex h-14 items-center px-2">
              <span className="font-semibold tracking-tight text-lg">Student Portal</span>
            </div>
            <Separator className="mb-4" />
            <div className="flex-1 overflow-auto">
              <NavLinks />
            </div>
            <div className="mt-auto p-4 border-t flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{student?.name || 'Student'}</span>
                <span className="text-xs text-muted-foreground">{student?.email}</span>
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
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-base leading-tight">Knowledge Park</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-primary">
              Student Portal
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto px-3 py-4 space-y-3">
          <NavLinks />
        </div>
        
        <div className="mt-auto border-t p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{student?.name || 'Student Name'}</span>
              <span className="text-xs text-muted-foreground truncate">{student?.email || 'student@example.com'}</span>
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
      <main className="flex-1 flex flex-col min-w-0 h-[calc(100vh-3.5rem)] md:h-screen overflow-auto bg-muted/10">
        <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
