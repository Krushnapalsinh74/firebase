import React from "react";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    </div>
  );
}

export function SubjectSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {[1,2,3].map(i => (
        <div key={i} className="border border-border rounded-xl p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1,2,3].map(j => <Skeleton key={j} className="h-16" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuestionSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="space-y-3 mt-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    </div>
  );
}

export function TestCardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-6">
      {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}
