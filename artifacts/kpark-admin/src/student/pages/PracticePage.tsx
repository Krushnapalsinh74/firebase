
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight, Loader2, Filter } from 'lucide-react';
import { studentApi } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';

interface PracticePageProps {
  onStartPractice: (config: PracticeConfig) => void;
  initialSubjectId?: number;
  initialChapterId?: number;
  initialTopicId?: number;
}

export interface PracticeConfig {
  subjectId?: number;
  subjectName?: string;
  chapterId?: number;
  chapterName?: string;
  topicId?: number;
  topicName?: string;
  difficulty?: string;
  questionType?: string;
  lang: string;
  limit: number;
}

const DIFFICULTIES = [
  { value: '', label: 'All Levels' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

const QTYPES = [
  { value: '', label: 'All Types' },
  { value: 'SINGLE_CHOICE', label: 'Single Correct' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Correct' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'NUMERICAL', label: 'Numerical' },
];

const LANGS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'mr', label: 'Marathi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
];

const COUNTS = [5, 10, 20, 30, 50];

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function PracticePage({ onStartPractice, initialSubjectId, initialChapterId, initialTopicId }: PracticePageProps) {
  const { selectedBoardId, selectedStandardId, preferredLanguage } = useStudentStore();

  const { data: curriculum } = useQuery({
    queryKey: ['curriculum', selectedBoardId, selectedStandardId],
    queryFn: () => studentApi.getCurriculum({ boardId: selectedBoardId ?? undefined, standardId: selectedStandardId ?? undefined }),
    staleTime: 60_000,
  });

  const subjects = curriculum?.data ?? [];

  const [subjectId, setSubjectId] = useState(initialSubjectId ? String(initialSubjectId) : '');
  const [chapterId, setChapterId] = useState(initialChapterId ? String(initialChapterId) : '');
  const [topicId, setTopicId] = useState(initialTopicId ? String(initialTopicId) : '');
  const [difficulty, setDifficulty] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [lang, setLang] = useState(preferredLanguage ?? 'en');
  const [limit, setLimit] = useState(20);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const selectedSubject = subjects.find((s) => String(s.id) === subjectId);
  const chapters = selectedSubject?.chapters ?? [];
  const selectedChapter = chapters.find((c) => String(c.id) === chapterId);
  const topics = selectedChapter?.topics ?? [];

  useEffect(() => { setChapterId(''); setTopicId(''); }, [subjectId]);
  useEffect(() => { setTopicId(''); }, [chapterId]);

  const handleStart = async () => {
    if (!subjectId) { setError('Please select a subject.'); return; }
    setError('');
    setStarting(true);
    try {
      onStartPractice({
        subjectId: subjectId ? Number(subjectId) : undefined,
        subjectName: selectedSubject?.name,
        chapterId: chapterId ? Number(chapterId) : undefined,
        chapterName: selectedChapter?.name,
        topicId: topicId ? Number(topicId) : undefined,
        topicName: topics.find((t) => String(t.id) === topicId)?.name,
        difficulty: difficulty || undefined,
        questionType: questionType || undefined,
        lang,
        limit,
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Practice Questions</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your practice session</p>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        <div className="p-5 space-y-5">
          {/* Subject */}
          <SelectRow
            label="Subject"
            value={subjectId}
            options={[{ value: '', label: 'Select Subject' }, ...subjects.map((s) => ({ value: String(s.id), label: s.name }))]}
            onChange={setSubjectId}
          />

          {/* Chapter */}
          <SelectRow
            label="Chapter"
            value={chapterId}
            options={[{ value: '', label: subjectId ? 'All Chapters' : 'Select Subject first' }, ...chapters.map((c) => ({ value: String(c.id), label: c.name }))]}
            onChange={setChapterId}
          />

          {/* Topic */}
          <SelectRow
            label="Topic"
            value={topicId}
            options={[{ value: '', label: chapterId ? 'All Topics' : 'Select Chapter first' }, ...topics.map((t) => ({ value: String(t.id), label: t.name }))]}
            onChange={setTopicId}
          />
        </div>

        <div className="p-5 space-y-5">
          <SelectRow label="Difficulty" value={difficulty} options={DIFFICULTIES} onChange={setDifficulty} />
          <SelectRow label="Question Type" value={questionType} options={QTYPES} onChange={setQuestionType} />
          <SelectRow label="Language" value={lang} options={LANGS} onChange={setLang} />
        </div>

        <div className="p-5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-3">Number of Questions</label>
          <div className="flex gap-2 flex-wrap">
            {COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => setLimit(c)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${limit === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:border-primary/40'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      {subjectId && (
        <div className="mt-5 p-5 bg-primary/5 border border-primary/20 rounded-xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Practice Summary</p>
          <p className="font-semibold text-foreground">{selectedSubject?.name ?? 'All Subjects'}</p>
          {selectedChapter && <p className="text-sm text-muted-foreground">{selectedChapter.name}</p>}
          {topicId && <p className="text-sm text-muted-foreground">{topics.find((t) => String(t.id) === topicId)?.name}</p>}
          <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
            <span>{limit} Questions</span>
            {difficulty && <span>· {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}</span>}
            {questionType && <span>· {QTYPES.find((q) => q.value === questionType)?.label}</span>}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}

      <button
        onClick={handleStart}
        disabled={!subjectId || starting}
        className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {starting ? 'Loading Questions...' : 'Start Practice →'}
      </button>
    </div>
  );
}
