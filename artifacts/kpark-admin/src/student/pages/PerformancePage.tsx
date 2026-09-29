
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target, BookOpen, Flame, BarChart3, TrendingUp, AlertCircle } from 'lucide-react';
import { studentApi } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';
import { StatsSkeleton } from '../components/SkeletonLoaders';

export function PerformancePage() {
  const { student } = useStudentStore();

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['student-stats', student?.id],
    queryFn: () => studentApi.getStats(student?.id),
    staleTime: 30_000,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Your NEET preparation analytics</p>
      </div>

      {isLoading && <StatsSkeleton />}
      {isError && (
        <div className="text-center py-12 space-y-3">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Unable to load performance data.</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Retry</button>
        </div>
      )}

      {!isLoading && !isError && stats && (
        <>
          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Questions Attempted', value: stats.totalAttempted, icon: BookOpen, color: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 border-blue-200 dark:border-blue-800' },
              { label: 'Correct Answers', value: stats.correctCount, icon: Target, color: 'bg-green-50 dark:bg-green-950/30 text-green-600 border-green-200 dark:border-green-800' },
              { label: 'Accuracy', value: `${stats.accuracy}%`, icon: BarChart3, color: 'bg-purple-50 dark:bg-purple-950/30 text-primary border-purple-200 dark:border-purple-800' },
              { label: 'Day Streak', value: `${stats.streakDays}d`, icon: Flame, color: 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 border-orange-200 dark:border-orange-800' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className={`p-5 rounded-xl border ${color.split(' ').slice(2).join(' ')}`}>
                <Icon className={`w-5 h-5 mb-3 ${color.split(' ')[0] === 'bg-blue-50' ? 'text-blue-600' : color.split(' ')[0] === 'bg-green-50' ? 'text-green-600' : color.split(' ')[0] === 'bg-purple-50' ? 'text-primary' : 'text-orange-500'}`} />
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Accuracy bar */}
          {stats.totalAttempted > 0 && (
            <div className="border border-border rounded-xl p-5 bg-card space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">Overall Accuracy</h2>
              </div>
              <div>
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>{stats.correctCount} correct</span>
                  <span>{stats.totalAttempted - stats.correctCount} incorrect</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stats.accuracy >= 70 ? 'bg-green-500' : stats.accuracy >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${stats.accuracy}%` }}
                  />
                </div>
                <p className="text-right text-sm font-medium text-foreground mt-1">{stats.accuracy}%</p>
              </div>
            </div>
          )}

          {stats.totalAttempted === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">No practice data yet</p>
              <p className="text-sm text-muted-foreground mt-1">Start practicing to see your performance analytics here.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
