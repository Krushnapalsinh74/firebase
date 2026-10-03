import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStudentStore } from '@/hooks/use-student-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Award, ArrowRight } from 'lucide-react';
import { MathText } from '@/lib/math-text';
import { useToast } from '@/hooks/use-toast';

export default function StudentMockTests() {
  const { token, student, selectedBoardId, selectedStandardId, selectedBoardName, selectedStandardName } = useStudentStore();
  const { toast } = useToast();

  const [activeMockTest, setActiveMockTest] = useState<any | null>(null);
  const [mockCurrentIndex, setMockCurrentIndex] = useState(0);
  const [mockAnswers, setMockAnswers] = useState<Record<number, string>>({});
  const [mockTimeRemaining, setMockTimeRemaining] = useState<number>(0);
  const [mockFinished, setMockFinished] = useState(false);

  const { data: mockTestsData } = useQuery({
    queryKey: ['student', 'mock-tests', selectedBoardId, selectedStandardId],
    queryFn: async () => {
      const res = await fetch(
        `/api/student/mock-tests?boardId=${selectedBoardId || ''}&standardId=${selectedStandardId || ''}`
      );
      if (!res.ok) throw new Error('Failed to fetch mock tests');
      return (await res.json()) as { data: any[] };
    },
    enabled: !!token && !!student && !!selectedBoardId && !!selectedStandardId,
  });

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
  }, [activeMockTest, mockFinished, mockTimeRemaining, toast]);

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

  return (
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
              mockTestsData.data.map((paper: any) => (
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
  );
}
