import React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { useStudentStore } from '@/hooks/use-student-store';

export default function StudentDashboard() {
  const { student, token, selectedBoardName, selectedStandardName } = useStudentStore();
  
  const { data: statsData } = useQuery({
    queryKey: ['student', 'stats', student?.id],
    queryFn: async () => {
      const res = await fetch(`/api/student/stats?userId=${student?.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!token && !!student?.id,
  });

  const realSolved = statsData?.totalAttempted ?? 0;
  const realAccuracy = statsData?.accuracy ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back, {student?.name}!</h2>
        <p className="text-muted-foreground text-sm">
          Here is your learning overview for {selectedBoardName} • {selectedStandardName}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Questions Practiced</span>
          <p className="text-2xl font-bold mt-1 text-foreground">{realSolved}</p>
        </Card>

        <Card className="p-4 rounded-xl border bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Real Accuracy</span>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{realAccuracy}%</p>
          <Progress value={realAccuracy} className="h-1.5 mt-2" />
        </Card>
      </div>
    </div>
  );
}
