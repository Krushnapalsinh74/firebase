import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStudentStore, StudentUser } from '@/hooks/use-student-store';
import { MathText } from '@/lib/math-text';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  Award,
  Globe,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  SlidersHorizontal,
  Bookmark,
  Share2,
  ExternalLink,
  Lock,
  ArrowLeft,
  PlayCircle,
  ListOrdered,
  BookCheck,
  Target,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LoginPage } from '@/student/pages/LoginPage';

interface Board {
  id: number;
  name: string;
  code?: string;
  description?: string;
}

interface Standard {
  id: number;
  name: string;
  boardId?: number;
  description?: string;
}

interface TopicItem {
  id: number;
  name: string;
}

interface ChapterItem {
  id: number;
  name: string;
  description?: string | null;
  questionCount: number;
  topics: TopicItem[];
}

interface SubjectItem {
  id: number;
  name: string;
  code?: string | null;
  totalQuestions: number;
  chaptersCount: number;
  chapters: ChapterItem[];
}

interface Question {
  id: number;
  question: string;
  difficulty: string;
  questionType: string;
  marks?: number;
  options?: string | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  imageUrl?: string | null;
  subjectName?: string | null;
  chapterName?: string | null;
  topicName?: string | null;
}

interface MockPaper {
  id: number;
  title: string;
  totalMarks?: number;
  durationMinutes?: number;
  subjectName?: string;
  questions?: any[];
  difficulty?: string;
  createdAt?: string;
}

export default function StudentAppPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    token,
    student,
    setStudent,
    setToken,
    selectedBoardId,
    selectedBoardName,
    selectedStandardId,
    selectedStandardName,
    setBoardAndStandard,
    preferredLanguage,
    setPreferredLanguage,
    hasCompletedOnboarding,
    recordAttempt,
    logoutStudent,
  } = useStudentStore();

  const [authChecking, setAuthChecking] = useState(true);

  // ── Firebase Auth State Sync & Verification ──
  useEffect(() => {
    if (!auth) {
      setAuthChecking(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        if (!token || !student) {
          logoutStudent();
        }
        setAuthChecking(false);
      } else {
        if (!token || !student) {
          try {
            const email = fbUser.email || '';
            const name = fbUser.displayName || email.split('@')[0];
            const photoUrl = fbUser.photoURL || null;
            const res = await fetch('/api/student/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name, photoUrl }),
            });
            if (res.ok) {
              const data = await res.json();
              setToken(data.token);
              setStudent(data.user);
            }
          } catch (e) {
            console.error('Auto auth sync failed:', e);
          }
        }
        setAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ── Redirect authenticated users to the new layout ──
  const isStudentDomain = typeof window !== 'undefined' && window.location.hostname.includes('student');
  useEffect(() => {
    if (token && student && !authChecking) {
      setLocation(isStudentDomain ? '/dashboard' : '/student/dashboard', { replace: true });
    }
  }, [token, student, authChecking, isStudentDomain, setLocation]);

  // ── Navigation Views ──
  const [currentView, setCurrentView] = useState<'curriculum' | 'chapter_view' | 'practice_quiz' | 'question_bank' | 'mock_tests'>('curriculum');

  // ── Modals ──
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  // ── Onboarding Temp State ──
  const [tempBoardId, setTempBoardId] = useState<number | null>(null);
  const [tempStandardId, setTempStandardId] = useState<number | null>(null);

  // ── Selected Chapter for Deep Dive ──
  const [activeSubject, setActiveSubject] = useState<SubjectItem | null>(null);
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);

  // ── Practice Quiz Mode State ──
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizShowSolution, setQuizShowSolution] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // ── Question Bank Feed Filters ──
  const [filterSubjectId, setFilterSubjectId] = useState<number | undefined>();
  const [filterChapterId, setFilterChapterId] = useState<number | undefined>();
  const [filterTopicId, setFilterTopicId] = useState<number | undefined>();
  const [filterDifficulty, setFilterDifficulty] = useState<string>('');
  const [filterQuestionType, setFilterQuestionType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [revealedSolutions, setRevealedSolutions] = useState<Record<number, boolean>>({});

  // ── Mock Test State ──
  const [activeMockTest, setActiveMockTest] = useState<MockPaper | null>(null);
  const [mockCurrentIndex, setMockCurrentIndex] = useState(0);
  const [mockAnswers, setMockAnswers] = useState<Record<number, string>>({});
  const [mockTimeRemaining, setMockTimeRemaining] = useState<number>(0);
  const [mockFinished, setMockFinished] = useState(false);

  // ── Search Debounce ──
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── 1. Bootstrap Boards & Standards (Gated by Auth) ──
  const { data: bootstrap } = useQuery({
    queryKey: ['student', 'bootstrap'],
    queryFn: async () => {
      const res = await fetch('/api/student/bootstrap');
      if (!res.ok) throw new Error('Failed to load curriculum');
      return (await res.json()) as {
        boards: Board[];
        standards: Standard[];
        totalQuestions: number;
      };
    },
    enabled: !!token && !!student,
    staleTime: 60_000,
  });

  const boards = bootstrap?.boards ?? [];
  const standards = (bootstrap?.standards ?? []).filter(
    (s) => !tempBoardId || !s.boardId || s.boardId === tempBoardId || s.boardId === selectedBoardId
  );

  // ── Auto-Open Onboarding if not completed ──
  useEffect(() => {
    if (token && student && (!hasCompletedOnboarding || !selectedBoardId || !selectedStandardId)) {
      setOnboardingOpen(true);
    }
  }, [token, student, hasCompletedOnboarding, selectedBoardId, selectedStandardId]);

  // ── 2. Real Structured Curriculum Tree (Gated by Auth) ──
  const { data: curriculumData, isLoading: loadingCurriculum } = useQuery({
    queryKey: ['student', 'curriculum-tree', selectedBoardId, selectedStandardId],
    queryFn: async () => {
      const res = await fetch(
        `/api/student/curriculum-tree?boardId=${selectedBoardId || ''}&standardId=${selectedStandardId || ''}`
      );
      if (!res.ok) throw new Error('Failed to load curriculum tree');
      return (await res.json()) as { data: SubjectItem[] };
    },
    enabled: !!token && !!student && !!selectedBoardId && !!selectedStandardId,
  });

  const subjectsList = curriculumData?.data ?? [];

  // ── 3. Real Student Stats (STRICTLY Gated by Auth & User ID) ──
  const { data: statsData } = useQuery({
    queryKey: ['student', 'stats', student?.id],
    queryFn: async () => {
      if (!student?.id) throw new Error('Unauthenticated stats request blocked');
      const res = await fetch(`/api/student/stats?userId=${student.id}`);
      if (!res.ok) throw new Error('Failed to load stats');
      return (await res.json()) as {
        totalAttempted: number;
        correctCount: number;
        accuracy: number;
        streakDays: number;
      };
    },
    enabled: !!token && !!student && !!student?.id,
    staleTime: 10_000,
  });

  // ── 4. Question Feed for Question Bank & Practice (Gated by Auth) ──
  const activeChapterIdForQuery = currentView === 'practice_quiz' ? activeChapter?.id : filterChapterId;
  const activeSubjectIdForQuery = currentView === 'practice_quiz' ? activeSubject?.id : filterSubjectId;

  const { data: questionsData, isLoading: loadingQuestions } = useQuery({
    queryKey: [
      'student',
      'questions',
      selectedBoardId,
      selectedStandardId,
      activeSubjectIdForQuery,
      activeChapterIdForQuery,
      filterTopicId,
      filterDifficulty,
      filterQuestionType,
      debouncedSearch,
      preferredLanguage,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBoardId) params.set('boardId', String(selectedBoardId));
      if (selectedStandardId) params.set('standardId', String(selectedStandardId));
      if (activeSubjectIdForQuery) params.set('subjectId', String(activeSubjectIdForQuery));
      if (activeChapterIdForQuery) params.set('chapterId', String(activeChapterIdForQuery));
      if (filterTopicId) params.set('topicId', String(filterTopicId));
      if (filterDifficulty) params.set('difficulty', filterDifficulty);
      if (filterQuestionType) params.set('questionType', filterQuestionType);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (preferredLanguage) params.set('lang', preferredLanguage);
      params.set('limit', '60');

      const res = await fetch(`/api/student/questions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch questions');
      return (await res.json()) as { data: Question[]; total: number };
    },
    enabled: !!token && !!student && !!selectedBoardId && !!selectedStandardId,
  });

  const questionsList = questionsData?.data ?? [];

  // ── 5. Mock Tests (Gated by Auth) ──
  const { data: mockTestsData } = useQuery({
    queryKey: ['student', 'mock-tests', selectedBoardId, selectedStandardId],
    queryFn: async () => {
      const res = await fetch(
        `/api/student/mock-tests?boardId=${selectedBoardId || ''}&standardId=${selectedStandardId || ''}`
      );
      if (!res.ok) throw new Error('Failed to fetch mock tests');
      return (await res.json()) as { data: MockPaper[] };
    },
    enabled: !!token && !!student && !!selectedBoardId && !!selectedStandardId,
  });

  // ── Mock Test Countdown Timer ──
  useEffect(() => {
    if (!activeMockTest || mockFinished || mockTimeRemaining <= 0) return;
    const interval = setInterval(() => {
      setMockTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setMockFinished(true);
          toast({ title: 'Time Up!', description: 'Your test has been automatically submitted.' });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeMockTest, mockFinished, mockTimeRemaining]);

  // ── Logout Action ──
  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (_) {}
    }
    logoutStudent();
    queryClient.clear();
    toast({ title: 'Signed Out', description: 'You have been logged out of your session.' });
  };

  // ── AUTH GATE RENDERING ──
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center mx-auto animate-pulse shadow-lg shadow-blue-500/20">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <p className="text-slate-400 text-xs font-semibold tracking-wide">Checking Student Authentication...</p>
        </div>
      </div>
    );
  }

  if (!token || !student) {
    return (
      <LoginPage
        onLoginSuccess={() => {
          queryClient.invalidateQueries();
          setAuthChecking(false);
        }}
      />
    );
  }

  if (token && student) {
    return null;
  }

  // ── Save Onboarding Selection ──
  const handleSaveOnboarding = () => {
    if (!tempBoardId || !tempStandardId) {
      toast({ title: 'Please select both Board and Grade', variant: 'destructive' });
      return;
    }
    const bName = boards.find((b) => b.id === tempBoardId)?.name || 'Board';
    const sName = standards.find((s) => s.id === tempStandardId)?.name || 'Class';

    setBoardAndStandard(tempBoardId, bName, tempStandardId, sName);
    setOnboardingOpen(false);

    toast({
      title: 'Curriculum Loaded! 🎯',
      description: `Active curriculum: ${bName} • ${sName}.`,
    });
  };

  // ── Real Email / Google Auth ──
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) {
      toast({ title: 'Email is required', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/student/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim(),
          name: authName.trim() || authEmail.split('@')[0],
          boardId: selectedBoardId,
          standardId: selectedStandardId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      setToken(data.token);
      setStudent(data.user);
      setLoginModalOpen(false);

      toast({
        title: `Welcome, ${data.user.name}! 🌟`,
        description: 'Successfully signed in to Knowledge Park.',
      });
      queryClient.invalidateQueries({ queryKey: ['student', 'stats'] });
    } catch (err: any) {
      toast({ title: 'Sign-in Failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── Option Selection in Interactive Quiz ──
  const handleQuizAnswer = (q: Question, optionText: string) => {
    if (quizAnswers[q.id]) return; // Already answered

    setQuizAnswers((prev) => ({ ...prev, [q.id]: optionText }));

    const isCorrect = isAnswerMatch(optionText, q.correctAnswer || '');
    if (isCorrect) setQuizScore((s) => s + 1);
    recordAttempt(isCorrect);

    // Save attempt to database
    fetch('/api/student/submit-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: q.id,
        selectedAnswer: optionText,
        isCorrect,
        userId: student?.id || 0,
      }),
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ['student', 'stats'] }))
      .catch(() => {});
  };

  // ── Helper to match option letter or text ──
  const isAnswerMatch = (selected: string, correct: string) => {
    if (!selected || !correct) return false;
    const cleanS = selected.trim().toLowerCase();
    const cleanC = correct.trim().toLowerCase();
    if (cleanS === cleanC) return true;
    const letterS = cleanS.match(/^([a-d])\b/)?.[1];
    const letterC = cleanC.match(/^([a-d])\b/)?.[1];
    if (letterS && letterC && letterS === letterC) return true;
    return cleanC.includes(cleanS) || cleanS.includes(cleanC);
  };

  const parseOptions = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((o) => (typeof o === 'object' && o !== null ? `${o.id ? o.id + '. ' : ''}${o.text || o.value || ''}` : String(o))).filter(Boolean);
    }
    if (typeof raw === 'string') {
      return raw.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  // ── Start Chapter Quiz ──
  const startChapterQuiz = (chapter: ChapterItem, subject: SubjectItem) => {
    setActiveChapter(chapter);
    setActiveSubject(subject);
    setQuizQuestionIndex(0);
    setQuizAnswers({});
    setQuizScore(0);
    setQuizShowSolution(false);
    setQuizFinished(false);
    setCurrentView('practice_quiz');
  };

  // ── Real Metrics ──
  const realSolved = statsData?.totalAttempted ?? 0;
  const realAccuracy = statsData?.accuracy ?? 0;
  const realStreak = statsData?.streakDays ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <button
            type="button"
            onClick={() => {
              setCurrentView('curriculum');
              setActiveSubject(null);
              setActiveChapter(null);
            }}
            className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-white shadow-md shadow-primary/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight block leading-tight">Knowledge Park</span>
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Student Portal</span>
            </div>
          </button>

          {/* Center: Curriculum Pill Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTempBoardId(selectedBoardId);
                setTempStandardId(selectedStandardId);
                setOnboardingOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all text-xs font-bold text-primary shadow-xs"
              title="Click to switch Board or Grade"
            >
              <Award className="h-3.5 w-3.5 text-primary" />
              <span>{selectedBoardName || 'Select Board'} • {selectedStandardName || 'Select Class'}</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {/* Language Switcher */}
            <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
              <SelectTrigger className="h-8 text-xs w-[105px] border-border/80 bg-card">
                <Globe className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="gu">Gujarati</SelectItem>
                <SelectItem value="mr">Marathi</SelectItem>
                <SelectItem value="ta">Tamil</SelectItem>
                <SelectItem value="te">Telugu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Right: Auth, Streak, and Admin Switcher */}
          <div className="flex items-center gap-2.5">
            {realStreak > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 font-bold text-xs">
                <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span>{realStreak}d Streak</span>
              </div>
            )}

            {student ? (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary">
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 text-xs text-muted-foreground">
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setLoginModalOpen(true)}
                className="h-8 text-xs bg-gradient-to-r from-blue-600 to-primary text-white shadow-xs gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" /> Sign In
              </Button>
            )}

          </div>
        </div>
      </header>

      {/* ── Sub Header / Mode Switcher ── */}
      <div className="border-b border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => {
                setCurrentView('curriculum');
                setActiveSubject(null);
                setActiveChapter(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentView === 'curriculum' || currentView === 'chapter_view'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> Curriculum & Chapters
            </button>

            <button
              onClick={() => setCurrentView('question_bank')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentView === 'question_bank'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> Question Bank
            </button>

            <button
              onClick={() => setCurrentView('mock_tests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentView === 'mock_tests'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Award className="h-3.5 w-3.5" /> Mock Exam Simulator
            </button>
          </div>

          {/* Quick Performance summary */}
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            <span>Solved: <strong className="text-foreground">{realSolved}</strong></span>
            <span>Accuracy: <strong className="text-emerald-600">{realAccuracy}%</strong></span>
          </div>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 1: CURRICULUM SUBJECTS & CHAPTERS DRILL-DOWN (LIKE REAL PLATFORMS)
        ══════════════════════════════════════════════════════════════════════ */}
        {currentView === 'curriculum' && (
          <div className="space-y-6">
            {/* Real Stats Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-4 rounded-xl border bg-card">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Questions Practiced</span>
                <p className="text-2xl font-bold mt-1 text-foreground">{realSolved}</p>
                <span className="text-[10px] text-muted-foreground">Real database attempts</span>
              </Card>

              <Card className="p-4 rounded-xl border bg-card">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Real Accuracy</span>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{realAccuracy}%</p>
                <Progress value={realAccuracy} className="h-1.5 mt-2" />
              </Card>

              <Card className="p-4 rounded-xl border bg-card">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Total Subjects</span>
                <p className="text-2xl font-bold mt-1 text-foreground">{subjectsList.length}</p>
                <span className="text-[10px] text-muted-foreground">{selectedStandardName}</span>
              </Card>

              <Card className="p-4 rounded-xl border bg-card">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Questions in Bank</span>
                <p className="text-2xl font-bold mt-1 text-primary">{bootstrap?.totalQuestions || 0}</p>
                <span className="text-[10px] text-muted-foreground">Ready for practice</span>
              </Card>
            </div>

            {/* Structured Subjects & Chapters Tree */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Curriculum & Chapters</h2>
                <p className="text-xs text-muted-foreground">
                  Select a subject below to explore its chapters, topics, and practice questions.
                </p>
              </div>

              {loadingCurriculum ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
                </div>
              ) : subjectsList.length > 0 ? (
                <div className="space-y-6">
                  {subjectsList.map((subject) => (
                    <Card key={subject.id} className="p-6 rounded-2xl border border-border/80 bg-card shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-base text-foreground">{subject.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {subject.chaptersCount} Chapters • {subject.totalQuestions} Questions
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFilterSubjectId(subject.id);
                            setFilterChapterId(undefined);
                            setCurrentView('question_bank');
                          }}
                          className="text-xs gap-1"
                        >
                          View All Questions <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Chapters Grid inside Subject */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {subject.chapters.length > 0 ? (
                          subject.chapters.map((chap, cIdx) => (
                            <div
                              key={chap.id}
                              className="p-4 rounded-xl border border-border/70 bg-muted/20 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Chapter {cIdx + 1}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] bg-background">
                                    {chap.questionCount} Qs
                                  </Badge>
                                </div>
                                <h4 className="font-bold text-sm text-foreground line-clamp-1">{chap.name}</h4>
                                {chap.topics.length > 0 && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                                    Topics: {chap.topics.map((t) => t.name).join(', ')}
                                  </p>
                                )}
                              </div>

                              <div className="pt-3 mt-2 border-t border-border/50 flex items-center justify-between gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => startChapterQuiz(chap, subject)}
                                  className="h-7 text-xs bg-primary text-primary-foreground font-bold flex-1 gap-1"
                                >
                                  <PlayCircle className="h-3.5 w-3.5" /> Practice Quiz
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setActiveSubject(subject);
                                    setActiveChapter(chap);
                                    setCurrentView('chapter_view');
                                  }}
                                  className="h-7 text-xs px-2"
                                  title="View Chapter Details"
                                >
                                  Details
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                            No chapters registered yet under {subject.name}.
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center rounded-2xl border-dashed space-y-3">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
                  <h3 className="font-bold text-base">No subjects found for this grade</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Please click the Board & Class selector at the top to choose your educational board.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 2: CHAPTER VIEW (CHAPTER DETAILS & TOPICS BREAKDOWN)
        ══════════════════════════════════════════════════════════════════════ */}
        {currentView === 'chapter_view' && activeChapter && activeSubject && (
          <div className="space-y-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('curriculum')}
              className="text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Curriculum
            </Button>

            <Card className="p-6 rounded-2xl border bg-card space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <Badge variant="outline" className="mb-2 text-primary">{activeSubject.name}</Badge>
                  <h2 className="text-2xl font-extrabold">{activeChapter.name}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeChapter.questionCount} Verified questions available for practice
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => startChapterQuiz(activeChapter, activeSubject)}
                  className="bg-primary text-primary-foreground font-bold text-xs gap-1.5 shadow-sm h-9"
                >
                  <PlayCircle className="h-4 w-4" /> Start Interactive Quiz
                </Button>
              </div>

              {/* Topics List */}
              {activeChapter.topics.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Topics in this chapter:</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeChapter.topics.map((top) => (
                      <Badge key={top.id} variant="secondary" className="px-3 py-1 text-xs">
                        {top.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Questions preview in this chapter */}
            <div className="space-y-3">
              <h3 className="font-bold text-base">Questions in this Chapter</h3>
              {loadingQuestions ? (
                <Skeleton className="h-40 w-full" />
              ) : questionsList.length > 0 ? (
                <div className="space-y-3">
                  {questionsList.map((q, idx) => (
                    <Card key={q.id} className="p-4 rounded-xl border bg-card space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-bold">Q{idx + 1} • {q.difficulty.toUpperCase()} • {q.questionType}</span>
                        {q.marks && <span>{q.marks} Marks</span>}
                      </div>
                      <div className="text-sm font-medium"><MathText>{q.question}</MathText></div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No questions added yet to this chapter.</p>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 3: INTERACTIVE 1-BY-1 PRACTICE QUIZ ENGINE
        ══════════════════════════════════════════════════════════════════════ */}
        {currentView === 'practice_quiz' && activeChapter && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView('curriculum')}
                className="text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Exit Quiz
              </Button>

              <Badge variant="outline" className="text-xs">
                {activeSubject?.name} • {activeChapter.name}
              </Badge>
            </div>

            {!quizFinished && questionsList.length > 0 ? (
              (() => {
                const q = questionsList[quizQuestionIndex];
                if (!q) {
                  return (
                    <Card className="p-8 text-center">
                      <p>No questions found in this chapter.</p>
                      <Button onClick={() => setCurrentView('curriculum')} className="mt-4">Back</Button>
                    </Card>
                  );
                }

                const optionsList = parseOptions(q.options);
                const selectedOpt = quizAnswers[q.id];
                const hasAnswered = !!selectedOpt;
                const isCorrect = hasAnswered && isAnswerMatch(selectedOpt, q.correctAnswer || '');

                return (
                  <Card className="p-6 rounded-2xl border bg-card shadow-sm space-y-5">
                    {/* Header Progress */}
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="text-xs font-bold text-muted-foreground">
                        Question {quizQuestionIndex + 1} of {questionsList.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                          {q.difficulty}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {q.marks || 1} Marks
                        </Badge>
                      </div>
                    </div>

                    <Progress value={((quizQuestionIndex + 1) / questionsList.length) * 100} className="h-1.5" />

                    {/* Question Statement with LaTeX Math */}
                    <div className="text-base font-semibold leading-relaxed text-foreground">
                      <MathText>{q.question}</MathText>
                    </div>

                    {/* Diagram Figure */}
                    {q.imageUrl && (
                      <div className="inline-block rounded-xl border p-2 bg-background">
                        <img src={q.imageUrl} alt="Diagram" className="max-h-56 object-contain rounded" />
                      </div>
                    )}

                    {/* Options List */}
                    {optionsList.length > 0 && (
                      <div className="grid grid-cols-1 gap-2.5 pt-2">
                        {optionsList.map((opt, oIdx) => {
                          const isThisSelected = selectedOpt === opt;
                          const isThisCorrect = isAnswerMatch(opt, q.correctAnswer || '');

                          let optCls = 'border-border/80 bg-background hover:border-primary/50 hover:bg-muted/30';
                          if (hasAnswered) {
                            if (isThisCorrect) {
                              optCls = 'border-emerald-600 bg-emerald-500/15 text-emerald-950 font-bold';
                            } else if (isThisSelected) {
                              optCls = 'border-red-500 bg-red-500/15 text-red-950 font-bold';
                            } else {
                              optCls = 'opacity-50 border-border/50 bg-background';
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              type="button"
                              disabled={hasAnswered}
                              onClick={() => handleQuizAnswer(q, opt)}
                              className={`p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3 ${optCls}`}
                            >
                              <span className="font-bold shrink-0">{String.fromCharCode(65 + oIdx)}.</span>
                              <div className="flex-1">
                                <MathText>{opt.replace(/^[A-D]\.\s*/, '')}</MathText>
                              </div>
                              {hasAnswered && isThisCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                              {hasAnswered && isThisSelected && !isThisCorrect && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Feedback & Solution Toggle */}
                    {hasAnswered && (
                      <div className="p-4 rounded-xl bg-muted/30 border space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold flex items-center gap-1 ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            {isCorrect ? 'Correct Answer!' : `Correct: ${q.correctAnswer}`}
                          </span>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setQuizShowSolution(!quizShowSolution)}
                            className="h-6 text-[11px] gap-1"
                          >
                            <HelpCircle className="h-3 w-3" />
                            {quizShowSolution ? 'Hide Solution' : 'View Solution'}
                          </Button>
                        </div>

                        {quizShowSolution && q.explanation && (
                          <div className="pt-2 text-xs text-muted-foreground border-t border-border/60 leading-relaxed">
                            <MathText block>{q.explanation}</MathText>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Next / Finish Button */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={quizQuestionIndex === 0}
                        onClick={() => {
                          setQuizQuestionIndex((i) => i - 1);
                          setQuizShowSolution(false);
                        }}
                      >
                        Previous
                      </Button>

                      {quizQuestionIndex < questionsList.length - 1 ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setQuizQuestionIndex((i) => i + 1);
                            setQuizShowSolution(false);
                          }}
                          className="gap-1.5"
                        >
                          Next Question <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setQuizFinished(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          Finish Quiz
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })()
            ) : quizFinished ? (
              /* Quiz Score Result Card */
              <Card className="p-8 text-center rounded-2xl border bg-card shadow-sm space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <Award className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-extrabold">Practice Completed! 🎉</h2>
                <p className="text-sm text-muted-foreground">
                  You scored <strong>{quizScore}</strong> out of <strong>{questionsList.length}</strong> questions correctly.
                </p>
                <div className="flex justify-center gap-3 pt-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuizQuestionIndex(0);
                      setQuizAnswers({});
                      setQuizScore(0);
                      setQuizFinished(false);
                    }}
                  >
                    Retry Practice
                  </Button>
                  <Button onClick={() => setCurrentView('curriculum')}>Back to Curriculum</Button>
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center border-dashed">
                <p className="text-sm text-muted-foreground">No questions available in this chapter.</p>
              </Card>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 4: FULL QUESTION BANK EXPLORER WITH ADVANCED FILTERS
        ══════════════════════════════════════════════════════════════════════ */}
        {currentView === 'question_bank' && (
          <div className="space-y-5">
            {/* Filter Bar */}
            <Card className="p-4 rounded-xl border bg-card space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Filter Questions
                </span>
                {(filterSubjectId || filterChapterId || filterDifficulty || filterQuestionType || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterSubjectId(undefined);
                      setFilterChapterId(undefined);
                      setFilterDifficulty('');
                      setFilterQuestionType('');
                      setSearchQuery('');
                    }}
                    className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Select
                  value={filterSubjectId ? String(filterSubjectId) : '__all__'}
                  onValueChange={(v) => {
                    setFilterSubjectId(v === '__all__' ? undefined : Number(v));
                    setFilterChapterId(undefined);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Subjects</SelectItem>
                    {subjectsList.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select
                  value={filterDifficulty || '__all__'}
                  onValueChange={(v) => setFilterDifficulty(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Difficulty" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Difficulty</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filterQuestionType || '__all__'}
                  onValueChange={(v) => setFilterQuestionType(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Question Types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Types</SelectItem>
                    <SelectItem value="mcq">MCQ</SelectItem>
                    <SelectItem value="true-false">True / False</SelectItem>
                    <SelectItem value="fill-blank">Fill in Blank</SelectItem>
                    <SelectItem value="short-answer">Short Answer</SelectItem>
                    <SelectItem value="numerical">Numerical</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </Card>

            {/* Questions Feed */}
            {loadingQuestions ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
              </div>
            ) : questionsList.length > 0 ? (
              <div className="space-y-4">
                <span className="text-xs text-muted-foreground">{questionsList.length} Questions found</span>

                {questionsList.map((q, idx) => (
                  <Card key={q.id} className="p-5 rounded-xl border bg-card space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-bold">Q{idx + 1} • {q.subjectName} {q.chapterName ? `› ${q.chapterName}` : ''}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">{q.difficulty}</Badge>
                    </div>

                    <div className="text-sm font-medium leading-relaxed text-foreground">
                      <MathText>{q.question}</MathText>
                    </div>

                    {q.imageUrl && (
                      <img src={q.imageUrl} alt="Diagram" className="max-h-48 rounded border object-contain" />
                    )}

                    <div className="pt-2 border-t flex items-center justify-between text-xs">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRevealedSolutions((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        className="h-7 text-xs text-primary hover:bg-primary/10"
                      >
                        {revealedSolutions[q.id] ? 'Hide Answer & Solution' : 'View Answer & Solution'}
                      </Button>
                    </div>

                    {revealedSolutions[q.id] && (
                      <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5 border">
                        <p className="font-bold text-emerald-700">Answer: <MathText>{q.correctAnswer || '—'}</MathText></p>
                        {q.explanation && (
                          <div className="text-muted-foreground"><MathText block>{q.explanation}</MathText></div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center border-dashed">
                <p className="text-sm text-muted-foreground">No questions found matching your filters.</p>
              </Card>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW 5: MOCK EXAM SIMULATOR
        ══════════════════════════════════════════════════════════════════════ */}
        {currentView === 'mock_tests' && (
          <div className="space-y-5">
            {!activeMockTest ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold">Mock Exams & Question Papers</h2>
                  <p className="text-xs text-muted-foreground">
                    Simulate real timed examinations for {selectedBoardName} • {selectedStandardName}.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {mockTestsData?.data && mockTestsData.data.length > 0 ? (
                    mockTestsData.data.map((paper) => (
                      <Card key={paper.id} className="p-5 rounded-2xl border bg-card flex flex-col justify-between shadow-xs">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-primary">{paper.subjectName || 'Exam'}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                              <Clock className="h-3 w-3" /> {paper.durationMinutes || 60}m
                            </span>
                          </div>
                          <h3 className="font-bold text-base">{paper.title}</h3>
                          <p className="text-xs text-muted-foreground">Total Marks: {paper.totalMarks || 80}</p>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveMockTest(paper);
                            setMockCurrentIndex(0);
                            setMockAnswers({});
                            setMockFinished(false);
                            setMockTimeRemaining((paper.durationMinutes || 60) * 60);
                          }}
                          className="mt-4 w-full bg-primary text-primary-foreground font-bold text-xs gap-1.5"
                        >
                          Start Test <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full p-10 text-center border border-dashed rounded-xl">
                      <Award className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-semibold">No published mock exam papers yet</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Live Test Simulator */
              <div className="space-y-4">
                <div className="p-4 rounded-xl border bg-card flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground font-bold">Mock Exam</span>
                    <h3 className="font-extrabold text-base">{activeMockTest.title}</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 font-bold text-sm flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {Math.floor(mockTimeRemaining / 60)}:
                        {String(mockTimeRemaining % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <Button variant="destructive" size="sm" onClick={() => setMockFinished(true)} className="text-xs font-bold">
                      Submit Exam
                    </Button>
                  </div>
                </div>

                {!mockFinished ? (
                  <Card className="p-6 rounded-2xl border bg-card space-y-4">
                    {(() => {
                      const list = activeMockTest.questions || [];
                      const currentQ = list[mockCurrentIndex];

                      if (!currentQ) {
                        return <p>No questions configured in this paper.</p>;
                      }

                      const options = parseOptions(currentQ.options);
                      const currentSelected = mockAnswers[mockCurrentIndex];

                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b pb-3 text-xs text-muted-foreground">
                            <span>Question {mockCurrentIndex + 1} of {list.length}</span>
                            <Badge variant="outline">{currentQ.marks || 1} Marks</Badge>
                          </div>

                          <div className="text-base font-semibold leading-relaxed">
                            <MathText>{currentQ.question}</MathText>
                          </div>

                          {currentQ.imageUrl && (
                            <img src={currentQ.imageUrl} alt="Diagram" className="max-h-56 rounded border" />
                          )}

                          {options.length > 0 && (
                            <div className="grid grid-cols-1 gap-2.5 pt-2">
                              {options.map((opt, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setMockAnswers((prev) => ({ ...prev, [mockCurrentIndex]: opt }))}
                                  className={`p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3 ${
                                    currentSelected === opt
                                      ? 'border-primary bg-primary/10 font-bold text-primary'
                                      : 'border-border/80 bg-background hover:bg-muted/30'
                                  }`}
                                >
                                  <span className="font-bold">{String.fromCharCode(65 + idx)}.</span>
                                  <MathText>{opt.replace(/^[A-D]\.\s*/, '')}</MathText>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={mockCurrentIndex === 0}
                              onClick={() => setMockCurrentIndex((i) => i - 1)}
                            >
                              Previous
                            </Button>
                            <Button
                              size="sm"
                              disabled={mockCurrentIndex >= list.length - 1}
                              onClick={() => setMockCurrentIndex((i) => i + 1)}
                            >
                              Next Question
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                ) : (
                  <Card className="p-8 text-center rounded-2xl border bg-card space-y-4">
                    <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                      <Award className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-extrabold">Exam Submitted!</h2>
                    <p className="text-sm text-muted-foreground">
                      Completed {Object.keys(mockAnswers).length} out of {activeMockTest.questions?.length || 0} questions.
                    </p>
                    <Button onClick={() => setActiveMockTest(null)}>Back to Mock Tests</Button>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          ONBOARDING DIALOG: REAL BOARDS & STANDARDS SELECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="max-w-xl p-6 space-y-5">
          <DialogHeader className="text-center space-y-1">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1">
              <GraduationCap className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold">Choose Your Curriculum</DialogTitle>
            <DialogDescription className="text-xs">
              Select your educational board and class once. All subjects and question banks will align automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Select Education Board
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {boards.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setTempBoardId(b.id);
                      setTempStandardId(null);
                    }}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                      tempBoardId === b.id
                        ? 'border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {tempBoardId && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  2. Select Grade / Class
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {standards.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setTempStandardId(s.id)}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        tempStandardId === s.id
                          ? 'border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              onClick={handleSaveOnboarding}
              disabled={!tempBoardId || !tempStandardId}
              className="w-full bg-primary text-primary-foreground font-bold text-xs gap-1.5 shadow-sm h-10"
            >
              Start Learning <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          REAL AUTH / SIGN IN DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className="max-w-sm p-6 space-y-4">
          <DialogHeader className="text-center space-y-1">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-primary text-white flex items-center justify-center mx-auto shadow-md">
              <UserCheck className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold">
              {authMode === 'login' ? 'Student Sign In' : 'Create Student Account'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save your test scores, practice streaks, and track real learning progress.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAuthSubmit} className="space-y-3 pt-2">
            {authMode === 'register' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name</label>
                <Input
                  placeholder="Your Name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Email Address</label>
              <Input
                type="email"
                placeholder="student@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <Button type="submit" className="w-full h-9 text-xs font-bold bg-primary text-primary-foreground">
              {authMode === 'login' ? 'Continue' : 'Create Account'}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-xs text-primary hover:underline"
              >
                {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
