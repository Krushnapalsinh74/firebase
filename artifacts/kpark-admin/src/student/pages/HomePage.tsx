
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, Target, Flame, ChevronRight, BarChart3, Search, FileText, Zap } from 'lucide-react';
import { studentApi } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';
import { useExamStore } from '../store/examStore';
import { StatsSkeleton, DashboardSkeleton } from '../components/SkeletonLoaders';

interface HomePageProps {
  onNavigate: (view: string, params?: Record<string, any>) => void;
}

const SUBJECT_COLORS: Record<string, { bg: string; icon: string; emoji: string }> = {
  Physics: { bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800', icon: 'text-blue-600', emoji: '⚛️' },
  Chemistry: { bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800', icon: 'text-emerald-600', emoji: '🧪' },
  Biology: { bg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800', icon: 'text-rose-600', emoji: '🧬' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { student, selectedBoardId, selectedStandardId } = useStudentStore();
  const session = useExamStore((s) => s.session);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['student-stats', student?.id],
    queryFn: () => studentApi.getStats(student?.id),
    staleTime: 30_000,
  });

  const { data: curriculum, isLoading: currLoading } = useQuery({
    queryKey: ['curriculum', selectedBoardId, selectedStandardId],
    queryFn: () => studentApi.getCurriculum({
      boardId: selectedBoardId ?? undefined,
      standardId: selectedStandardId ?? undefined,
    }),
    staleTime: 60_000,
  });

  const subjects = curriculum?.data ?? [];
  const firstName = student?.name?.split(' ')[0] ?? 'Student';

  const hasActiveSession = session && session.isActive && !session.isSubmitted;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{getGreeting()},</p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">{firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1">NEET Preparation</p>
        </div>
        <button
          onClick={() => onNavigate('search')}
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Continue Practice Banner */}
      {hasActiveSession ? (
        <div
          onClick={() => onNavigate(session.sessionType === 'mock' ? 'test-exam' : 'practice-session')}
          className="relative overflow-hidden rounded-xl bg-primary p-5 cursor-pointer hover:bg-primary/90 transition-colors"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider">Continue where you left off</p>
          <h3 className="text-primary-foreground text-lg font-bold mt-1">{session.testTitle ?? 'Practice Session'}</h3>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-primary-foreground/80 text-sm">{session.questions.length} Questions</span>
            <span className="text-primary-foreground/80 text-sm">•</span>
            <span className="text-primary-foreground/80 text-sm">{Object.keys(session.answers).length} Answered</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/15 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg">
            Resume <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      ) : (
        <div
          onClick={() => onNavigate('practice')}
          className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 p-5 cursor-pointer hover:bg-muted/50 hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ready to study?</p>
              <h3 className="text-foreground text-lg font-bold mt-1">Start Your Preparation</h3>
              <p className="text-muted-foreground text-sm mt-1">Select a topic and begin practicing</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Zap className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg">
            Start Practice <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'practice', label: 'Practice', icon: BookOpen, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
            { id: 'tests', label: 'Mock Tests', icon: FileText, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
            { id: 'subjects', label: 'Subjects', icon: Target, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
            { id: 'performance', label: 'Performance', icon: BarChart3, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
          ].map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/40 transition-all text-center"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Performance Stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Performance</h2>
        {statsLoading ? <StatsSkeleton /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Attempted', value: stats?.totalAttempted ?? 0, icon: BookOpen, color: 'text-blue-600' },
              { label: 'Correct', value: stats?.correctCount ?? 0, icon: Target, color: 'text-green-600' },
              { label: 'Accuracy', value: `${stats?.accuracy ?? 0}%`, icon: BarChart3, color: 'text-primary' },
              { label: 'Streak', value: `${stats?.streakDays ?? 0}d`, icon: Flame, color: 'text-orange-500' },
            ].map(({ label, value, icon: Icon, color }, i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-card">
                <Icon className={`w-4 h-4 ${color} mb-2`} />
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subjects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Subjects</h2>
          <button onClick={() => onNavigate('subjects')} className="text-xs text-primary font-medium hover:underline">
            View all
          </button>
        </div>
        {currLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No subjects found. Complete onboarding to see your curriculum.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {subjects.slice(0, 6).map((sub) => {
              const cfg = SUBJECT_COLORS[sub.name] ?? { bg: 'bg-muted border-border', icon: 'text-primary', emoji: '📚' };
              return (
                <button
                  key={sub.id}
                  onClick={() => onNavigate('subjects', { subjectId: sub.id })}
                  className={`p-4 rounded-xl border text-left hover:scale-[1.02] transition-all ${cfg.bg}`}
                >
                  <div className="text-2xl mb-2">{cfg.emoji}</div>
                  <p className="font-semibold text-foreground text-sm">{sub.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sub.totalQuestions} questions · {sub.chaptersCount} chapters</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommended */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommended Practice</h2>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-sm">Daily Practice</p>
              <p className="text-xs text-muted-foreground mt-0.5">Solve 20 questions daily to stay on track</p>
            </div>
            <button onClick={() => onNavigate('practice')} className="flex items-center gap-1 text-primary text-sm font-medium hover:underline">
              Start <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
