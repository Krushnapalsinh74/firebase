
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Clock, BookOpen, ChevronRight, AlertCircle } from 'lucide-react';
import { studentApi, MockTest } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';
import { TestCardSkeleton } from '../components/SkeletonLoaders';

interface TestsPageProps {
  onSelectTest: (test: MockTest) => void;
}

function TestCard({ test, onSelect }: { test: MockTest; onSelect: () => void }) {
  const title = test.title ?? test.name ?? `Test #${test.id}`;
  const qCount = test.questionCount ?? test.questions?.length ?? 0;
  const marks = test.totalMarks ?? (qCount * 4);
  const duration = test.durationMinutes ?? Math.ceil(qCount * 1.5);

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground border border-border px-2 py-1 rounded-full">
            Full Test
          </span>
        </div>
        <h3 className="font-semibold text-foreground text-base mb-1 leading-tight">{title}</h3>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {qCount > 0 && (
            <div className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{qCount} Questions</span>
            </div>
          )}
          {marks > 0 && <span>{marks} Marks</span>}
          {duration > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{duration} min</span>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border px-5 py-3">
        <button
          onClick={onSelect}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          View Test <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function TestsPage({ onSelectTest }: TestsPageProps) {
  const { selectedBoardId, selectedStandardId } = useStudentStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mock-tests', selectedBoardId, selectedStandardId],
    queryFn: () => studentApi.getMockTests({
      boardId: selectedBoardId ?? undefined,
      standardId: selectedStandardId ?? undefined,
    }),
    staleTime: 60_000,
  });

  const tests = data?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Mock Tests</h1>
        <p className="text-sm text-muted-foreground mt-1">Full-length NEET practice tests</p>
      </div>

      {isLoading && <TestCardSkeleton />}
      {isError && (
        <div className="text-center py-16 space-y-3">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Unable to load tests.</p>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Try Again</button>
        </div>
      )}
      {!isLoading && !isError && tests.length === 0 && (
        <div className="text-center py-16 space-y-2 border border-dashed border-border rounded-xl">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-foreground font-medium">No mock tests available</p>
          <p className="text-sm text-muted-foreground">Tests will appear here when created by the admin.</p>
        </div>
      )}
      {!isLoading && tests.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tests.map((test) => (
            <TestCard key={test.id} test={test} onSelect={() => onSelectTest(test)} />
          ))}
        </div>
      )}
    </div>
  );
}
