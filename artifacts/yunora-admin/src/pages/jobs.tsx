import React from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import { 
  useListGenerationJobs,
  useGetGenerationJob,
  getGetGenerationJobQueryKey,
  customFetch
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { Loader2, CheckCircle2, XCircle, Clock, StopCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  easy:     { label: 'Easy',     color: 'bg-green-100 text-green-800 border-green-200' },
  medium:   { label: 'Medium',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  hard:     { label: 'Hard',     color: 'bg-orange-100 text-orange-800 border-orange-200' },
  advanced: { label: 'Advanced', color: 'bg-red-100 text-red-800 border-red-200' },
};

export default function JobsPage() {
  const { data, isLoading } = useListGenerationJobs({ limit: 50 });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Badge>;
      case 'processing': return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'failed': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      default: return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generation Jobs</h1>
        <p className="text-muted-foreground">Monitor AI processing queues and historical tasks.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((job) => (
                  <JobRow key={job.jobId} job={job} badge={getStatusBadge(job.status)} />
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No jobs found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobRow({ job, badge }: { job: any, badge: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-mono text-xs">{job.jobId.substring(0, 8)}...</TableCell>
          <TableCell>
            <div className="flex flex-col">
              <span className="font-medium truncate max-w-[200px]">{job.topicName || 'Unknown Topic'}</span>
              <span className="text-xs text-muted-foreground">{job.subjectName}</span>
            </div>
          </TableCell>
          <TableCell>
            {job.difficulty && (() => {
              const meta = DIFFICULTY_META[job.difficulty] ?? { label: job.difficulty, color: 'bg-muted text-muted-foreground border-border' };
              return <Badge variant="outline" className={`text-xs capitalize ${meta.color}`}>{meta.label}</Badge>;
            })()}
          </TableCell>
          <TableCell className="text-sm">{job.model}</TableCell>
          <TableCell>
            <div className="text-sm">
              <span className={job.totalGenerated === job.totalRequested ? "text-green-600 font-medium" : ""}>
                {job.totalGenerated || 0}
              </span>
              <span className="text-muted-foreground"> / {job.totalRequested}</span>
            </div>
          </TableCell>
          <TableCell>{badge}</TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {format(parseISO(job.createdAt), 'MMM d, h:mm a')}
          </TableCell>
        </TableRow>
      </DialogTrigger>
      {/* Wider dialog, full height flex column */}
      <DialogContent className="max-w-4xl w-[92vw] max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>Job Details</DialogTitle>
          <div className="flex items-center gap-2 pt-1">
            {badge}
            <span className="text-sm text-muted-foreground font-mono">{job.jobId}</span>
          </div>
        </DialogHeader>
        {/* Scrollable body takes all remaining height */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <JobDetailsContent jobId={job.jobId} open={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JobDetailsContent({ jobId, open }: { jobId: string, open: boolean }) {
  const logRef = React.useRef<HTMLPreElement>(null);
  const [elapsed, setElapsed] = React.useState(0);

  const isProcessing = (status: string) => status === 'processing' || status === 'pending';

  // Poll every 2 seconds while job is still running
  const { data, isLoading } = useGetGenerationJob(jobId, {
    query: {
      queryKey: getGetGenerationJobQueryKey(jobId),
      enabled: open,
      refetchInterval: (query) => {
        const status = (query.state.data as any)?.status;
        return isProcessing(status) ? 2000 : false;
      },
    }
  });

  const handleCancel = async () => {
    try {
      await customFetch(`/api/generation/jobs/${jobId}/cancel`, { 
        method: 'POST'
      });
      // the polling will pick up the failed status shortly
    } catch (err) {
      console.error(err);
    }
  };

  // Live elapsed timer shown while processing
  React.useEffect(() => {
    if (!open || !isProcessing(data?.status ?? '')) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [open, data?.status]);

  // Auto-scroll to bottom on every log update
  React.useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [data?.agentLogs]);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data available</div>;

  return (
    <div className="space-y-6 p-6">
      {data.errorMessage && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm border border-destructive/20">
          <strong>Error:</strong> {data.errorMessage}
        </div>
      )}

      {(data.agentLogs || isProcessing(data.status)) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">Pipeline Logs</h4>
              {isProcessing(data.status) && (
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-blue-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    LIVE · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed
                  </span>
                  <Button variant="destructive" size="sm" onClick={handleCancel} className="h-6 text-xs px-2">
                    <StopCircle className="h-3 w-3 mr-1" />
                    Stop
                  </Button>
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {data.agentLogs ? `${data.agentLogs.split('\n').length} lines` : 'waiting...'}
            </span>
          </div>
          {/* Fixed-height scrollable terminal — auto-scrolls to bottom */}
          <pre
            ref={logRef}
            className="bg-zinc-950 text-zinc-300 p-4 rounded-md text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-y-auto"
            style={{ height: '400px', scrollBehavior: 'smooth' }}
          >
            {data.agentLogs}
          </pre>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold mb-3">
          Generated Questions ({data.questions?.length || 0})
        </h4>
        <div className="space-y-3">
          {data.questions?.map((q: any, i: number) => (
            <Card key={q.id || i} className="p-4 bg-muted/30">
              <p className="font-medium text-sm mb-2">{i + 1}. {q.question}</p>
              {q.options && (
                <p className="text-xs text-muted-foreground mb-1 whitespace-pre-line">{q.options}</p>
              )}
              <div className="text-xs text-muted-foreground">
                <strong>Answer:</strong> {q.correctAnswer}
              </div>
              {q.difficulty && (
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>
                  {q.questionType && <Badge variant="outline" className="text-xs">{q.questionType}</Badge>}
                </div>
              )}
            </Card>
          ))}
          {(!data.questions || data.questions.length === 0) && (
            <p className="text-sm text-muted-foreground italic">No questions generated yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
