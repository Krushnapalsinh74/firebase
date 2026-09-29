
import React, { useState, useCallback, useRef } from 'react';
import { Search, BookOpen, Hash, ChevronRight, AlertCircle } from 'lucide-react';
import { studentApi, Question } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';

interface SearchPageProps {
  onNavigate: (view: string, params?: Record<string, any>) => void;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

const DIFF_COLORS: Record<string, string> = {
  EASY: 'text-green-600 bg-green-50',
  MEDIUM: 'text-amber-600 bg-amber-50',
  HARD: 'text-red-600 bg-red-50',
};

export function SearchPage({ onNavigate }: SearchPageProps) {
  const { selectedBoardId, selectedStandardId, preferredLanguage } = useStudentStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const total = useRef(0);

  const search = useCallback(
    debounce(async (q: string) => {
      if (!q.trim() || q.length < 3) { setResults([]); setSearched(false); return; }
      setLoading(true); setError(''); setSearched(true);
      try {
        const res = await studentApi.getQuestions({
          search: q,
          boardId: selectedBoardId ?? undefined,
          standardId: selectedStandardId ?? undefined,
          lang: preferredLanguage,
          limit: 20,
        });
        setResults(res.data);
        total.current = res.total;
      } catch (e: any) {
        setError(e.message ?? 'Search failed.');
      } finally {
        setLoading(false);
      }
    }, 400),
    [selectedBoardId, selectedStandardId, preferredLanguage]
  );

  const handleChange = (val: string) => {
    setQuery(val);
    search(val);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Search Questions</h1>
        <p className="text-sm text-muted-foreground mt-1">Search the question bank</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search questions, topics, concepts..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          autoFocus
        />
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <div className="text-center py-10 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No questions found for "<span className="font-medium">{query}</span>"</p>
          <p className="text-xs mt-1">Try a different keyword or topic name.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{total.current} questions found</p>
          {results.map((q) => (
            <div key={q.id} className="border border-border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors space-y-2">
              <p className="text-sm font-medium text-foreground line-clamp-3">{q.question?.replace(/$[^$]+$/g, '[eq]').slice(0, 200)}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {q.subjectName && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BookOpen className="w-3 h-3" /> {q.subjectName}
                  </span>
                )}
                {q.chapterName && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Hash className="w-3 h-3" /> {q.chapterName}
                  </span>
                )}
                {q.difficulty && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFF_COLORS[q.difficulty] ?? 'text-muted-foreground bg-muted'}`}>
                    {q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => onNavigate('practice', { subjectId: q.subjectId, chapterId: q.chapterId, topicId: q.topicId })}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                Practice this chapter <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-10 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Type at least 3 characters to search</p>
        </div>
      )}
    </div>
  );
}
