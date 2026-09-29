
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, ChevronRight, Globe, BookOpen, Loader2 } from 'lucide-react';
import { studentApi } from '../api/studentApi';
import { useStudentStore } from '@/hooks/use-student-store';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
];

interface OnboardingPageProps {
  onComplete: () => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(1);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardName, setBoardName] = useState('');
  const [standardId, setStandardId] = useState<number | null>(null);
  const [standardName, setStandardName] = useState('');
  const [lang, setLang] = useState('en');
  const [saving, setSaving] = useState(false);
  const { setBoardAndStandard, setPreferredLanguage, token } = useStudentStore();

  const { data: bootstrap } = useQuery({
    queryKey: ['student-bootstrap'],
    queryFn: () => studentApi.bootstrap(),
  });

  const boards = bootstrap?.boards ?? [];
  const standards = (bootstrap?.standards ?? []).filter(
    (s) => !boardId || s.boardId === boardId
  );

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (boardId && standardId) {
        setBoardAndStandard(boardId, boardName, standardId, standardName);
      }
      setPreferredLanguage(lang);
      if (token) {
        await studentApi.savePreferences({ boardId, standardId, preferredLanguage: lang });
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
      onComplete();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 mb-4">
            <GraduationCap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-white">Quick Setup</h1>
          <p className="text-slate-400 text-sm mt-1">Let's personalise your experience</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="text-white font-semibold">Select Board & Class</h2>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Board</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {boards.length === 0 && (
                    <div className="col-span-2 text-slate-500 text-sm py-4 text-center">Loading boards...</div>
                  )}
                  {boards.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => { setBoardId(b.id); setBoardName(b.name); setStandardId(null); setStandardName(''); }}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${boardId === b.id ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-slate-300 hover:border-white/25'}`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
              {boardId && (
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Class</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {standards.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setStandardId(s.id); setStandardName(s.name); }}
                        className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${standardId === s.id ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-slate-300 hover:border-white/25'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors mt-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={onComplete} className="w-full text-slate-500 text-xs hover:text-slate-300 transition-colors">
                Skip for now
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-primary" />
                <h2 className="text-white font-semibold">Preferred Language</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${lang === l.code ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-slate-300 hover:border-white/25'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Saving...' : 'Start Preparing →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
