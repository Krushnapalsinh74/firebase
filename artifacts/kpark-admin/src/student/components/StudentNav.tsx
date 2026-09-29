
import React from 'react';
import { Home, BookOpen, FileText, BarChart3, User, Search, GraduationCap } from 'lucide-react';

export type StudentView = 'home' | 'practice' | 'subjects' | 'tests' | 'performance' | 'profile' | 'search' |
  'onboarding' | 'login' | 'practice-session' | 'practice-result' | 'test-instructions' | 'test-exam' | 'test-result' | 'test-review';

interface StudentNavProps {
  current: StudentView;
  onNavigate: (view: StudentView) => void;
  studentName?: string;
}

const NAV_ITEMS: { id: StudentView; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'practice', label: 'Practice', icon: BookOpen },
  { id: 'tests', label: 'Tests', icon: FileText },
  { id: 'performance', label: 'Progress', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

const EXAM_VIEWS: StudentView[] = ['practice-session', 'test-exam'];

export function StudentNav({ current, onNavigate, studentName }: StudentNavProps) {
  // Hide nav during exam
  if (EXAM_VIEWS.includes(current)) return null;

  // Hide nav on full-screen pages
  if (['login', 'onboarding'].includes(current)) return null;

  const activeMain = NAV_ITEMS.find((n) => n.id === current)?.id ?? 'home';

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm leading-tight">Knowledge Park</p>
            <p className="text-xs text-muted-foreground">NEET Platform</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = id === current || (id === 'home' && !NAV_ITEMS.find((n) => n.id === current));
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Search */}
        <div className="px-3 pb-4">
          <button
            onClick={() => onNavigate('search')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${current === 'search' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            Search
          </button>
        </div>

        {/* Student name at bottom */}
        {studentName && (
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground truncate">{studentName}</p>
          </div>
        )}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm safe-area-pb">
        <div className="flex items-center">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = id === current;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
