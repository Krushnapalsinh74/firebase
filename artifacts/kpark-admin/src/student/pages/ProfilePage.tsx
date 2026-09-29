
import React from 'react';
import { User, Mail, BookOpen, Globe, LogOut, Settings } from 'lucide-react';
import { useStudentStore } from '@/hooks/use-student-store';

interface ProfilePageProps {
  onLogout: () => void;
  onNavigate: (view: string) => void;
}

export function ProfilePage({ onLogout, onNavigate }: ProfilePageProps) {
  const { student, selectedBoardName, selectedStandardName, preferredLanguage } = useStudentStore();

  const LANG_MAP: Record<string, string> = {
    en: 'English', hi: 'Hindi', gu: 'Gujarati', mr: 'Marathi', ta: 'Tamil', te: 'Telugu'
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-foreground">Profile</h1>

      {/* Avatar + Name */}
      <div className="flex items-center gap-4 p-5 border border-border rounded-xl bg-card">
        {student?.photoUrl ? (
          <img src={student.photoUrl} alt={student.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-border" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
            <User className="w-8 h-8 text-primary" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-foreground">{student?.name ?? 'Student'}</h2>
          <p className="text-sm text-muted-foreground">{student?.email}</p>
          <span className="inline-block mt-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">NEET Student</span>
        </div>
      </div>

      {/* Details */}
      <div className="border border-border rounded-xl bg-card divide-y divide-border">
        {[
          { icon: Mail, label: 'Email', value: student?.email ?? '—' },
          { icon: BookOpen, label: 'Board', value: selectedBoardName ?? '—' },
          { icon: BookOpen, label: 'Class', value: selectedStandardName ?? '—' },
          { icon: Globe, label: 'Language', value: LANG_MAP[preferredLanguage] ?? 'English' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-4">
            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => onNavigate('onboarding')}
          className="w-full flex items-center gap-3 p-4 border border-border rounded-xl bg-card hover:bg-muted transition-colors text-left"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Edit Preferences</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 p-4 border border-red-200 dark:border-red-800 rounded-xl bg-red-50 dark:bg-red-950/20 hover:bg-red-100 transition-colors text-left"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-red-600">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
