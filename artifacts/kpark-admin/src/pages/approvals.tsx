import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/hooks/use-auth';
import { MathText } from '@/lib/math-text';
import { format, parseISO } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  FileUp,
  Sparkles,
  LibraryBig,
  FileText,
  Layers,
  Loader2,
  ShieldCheck,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';

export interface ApprovalRequest {
  id: number;
  subAdminId: number;
  subAdminName: string;
  subAdminEmail: string;
  actionType: string;
  entityType: string;
  payload: any;
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: number | null;
  reviewedByName?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export default function ApprovalsPage() {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [inspectRequest, setInspectRequest] = useState<ApprovalRequest | null>(null);
  const [rejectDialogReq, setRejectDialogReq] = useState<ApprovalRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Fetch Approval Requests
  const { data, isLoading } = useQuery({
    queryKey: ['approvals', activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/approvals?status=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load approval requests');
      return res.json() as Promise<{ requests: ApprovalRequest[]; total: number; pendingCount: number }>;
    },
  });

  // Approve Request Mutation
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/approvals/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to approve request');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Request Approved & Applied',
        description: 'The staged changes have been successfully committed to the database.',
      });
      setInspectRequest(null);
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Approval Failed', description: err.message });
    },
  });

  // Reject Request Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await fetch(`/api/approvals/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to reject request');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Request Rejected',
        description: 'The sub-admin change request has been marked as rejected.',
      });
      setRejectDialogReq(null);
      setInspectRequest(null);
      setRejectNote('');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Rejection Failed', description: err.message });
    },
  });

  const requests = data?.requests || [];
  const pendingCount = data?.pendingCount || 0;

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'IMPORT_PDF_EXTRACT':
        return <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200"><FileUp className="h-3 w-3" /> PDF Import</Badge>;
      case 'CREATE_QUESTIONS':
        return <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200"><Sparkles className="h-3 w-3" /> AI Questions</Badge>;
      case 'CREATE_PAPER':
        return <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200"><FileText className="h-3 w-3" /> Test Paper</Badge>;
      case 'CREATE_HIERARCHY':
        return <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200"><Layers className="h-3 w-3" /> Curriculum</Badge>;
      default:
        return <Badge variant="outline">{actionType}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-primary" /> Approvals & Change Requests Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin
              ? 'Review, inspect, and approve content additions and modifications submitted by sub-admins before they go live.'
              : 'Track the real-time approval status of your submitted question extractions and curriculum updates.'}
          </p>
        </div>
      </div>

      {/* Tabs Filter */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px] rounded-full">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4 text-destructive" /> Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading change requests...</span>
            </div>
          ) : requests.length === 0 ? (
            <Card className="py-16 text-center">
              <div className="max-w-md mx-auto space-y-2">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <h3 className="text-base font-semibold">No {activeTab} requests found</h3>
                <p className="text-xs text-muted-foreground">
                  {activeTab === 'pending'
                    ? 'All sub-admin submissions have been reviewed and applied.'
                    : `There are currently no ${activeTab} change requests.`}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {requests.map((req) => (
                <Card
                  key={req.id}
                  className={`border transition-all hover:shadow-sm ${req.status === 'pending'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : req.status === 'approved'
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-destructive/20 bg-destructive/5'
                    }`}
                >
                  <CardHeader className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/40">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {getActionBadge(req.actionType)}
                      <span className="text-sm font-semibold text-foreground">{req.summary}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-primary" /> {req.subAdminName} ({req.subAdminEmail})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {req.createdAt ? format(parseISO(req.createdAt), 'MMM d, yyyy h:mm a') : 'Recent'}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                        {req.payload?.questions && (
                          <span>📦 <strong>{req.payload.questions.length}</strong> Questions</span>
                        )}
                        {req.payload?.chapters && (
                          <span>📚 <strong>{req.payload.chapters.length}</strong> Chapters</span>
                        )}
                        {req.payload?.topics && (
                          <span>📑 <strong>{req.payload.topics.length}</strong> Topics</span>
                        )}
                        {req.payload?.modelUsed && (
                          <span>🤖 Model: <strong>{req.payload.modelUsed}</strong></span>
                        )}
                      </div>

                      {req.reviewNote && (
                        <div className="mt-2 text-xs p-2 rounded bg-destructive/10 text-destructive border border-destructive/20 flex items-start gap-1.5">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>Reviewer Note:</strong> {req.reviewNote}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setInspectRequest(req)}
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" /> Inspect Payload
                      </Button>

                      {isSuperAdmin && req.status === 'pending' && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => approveMutation.mutate(req.id)}
                            disabled={approveMutation.isPending}
                          >
                            {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve & Publish
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => setRejectDialogReq(req)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Inspect Staged Payload Modal */}
      {inspectRequest && (
        <Dialog open={!!inspectRequest} onOpenChange={(open) => !open && setInspectRequest(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" /> Inspect Staged Change Request
              </DialogTitle>
              <DialogDescription>
                Submitted by <strong>{inspectRequest.subAdminName}</strong> ({inspectRequest.subAdminEmail}) on{' '}
                {inspectRequest.createdAt ? format(parseISO(inspectRequest.createdAt), 'PPpp') : 'Recent'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 py-2">
              {/* Summary metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 rounded-lg border bg-muted/20">
                <div>
                  <span className="text-muted-foreground block">Action Type</span>
                  <span className="font-semibold">{inspectRequest.actionType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Status</span>
                  <span className="font-semibold capitalize">{inspectRequest.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Questions</span>
                  <span className="font-semibold">{inspectRequest.payload?.questions?.length ?? 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Model Used</span>
                  <span className="font-semibold">{inspectRequest.payload?.modelUsed || 'AI Extractor'}</span>
                </div>
              </div>

              {/* Questions preview */}
              {Array.isArray(inspectRequest.payload?.questions) && inspectRequest.payload.questions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Staged Questions Preview ({inspectRequest.payload.questions.length} items)
                  </h4>
                  <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                    {inspectRequest.payload.questions.map((q: any, qIdx: number) => (
                      <div key={qIdx} className="p-3 rounded-lg border bg-background space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            Q{qIdx + 1} • {q.difficulty || 'medium'} • {q.questionType || 'single_choice'}
                          </Badge>
                          {q.chapterName && (
                            <span className="text-[11px] text-muted-foreground">{q.chapterName} &gt; {q.topicName}</span>
                          )}
                        </div>

                        <div className="font-medium text-foreground">
                          <MathText text={q.question || q.questionText || ''} />
                        </div>

                        {q.imageUrl && (
                          <div className="p-1 border rounded inline-block bg-white">
                            <img src={q.imageUrl} alt="Figure" className="max-h-36 object-contain" />
                          </div>
                        )}

                        {Array.isArray(q.options) && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.options.map((opt: any, oIdx: number) => {
                              const optText = typeof opt === 'string' ? opt : opt.text;
                              const optId = typeof opt === 'string' ? String.fromCharCode(65 + oIdx) : opt.id;
                              const isCorrect = q.correctAnswer === optId;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-1.5 rounded border text-[11px] flex items-center justify-between ${isCorrect ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold' : 'bg-muted/10'
                                    }`}
                                >
                                  <span>{optId}. {optText}</span>
                                  {isCorrect && <span className="text-[9px] text-emerald-600 font-bold">✓ Correct</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="p-2 rounded bg-muted/20 text-muted-foreground text-[11px] border">
                            <span className="font-semibold text-foreground">Solution: </span>
                            <MathText text={q.explanation} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setInspectRequest(null)}>
                Close
              </Button>
              {isSuperAdmin && inspectRequest.status === 'pending' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRejectDialogReq(inspectRequest);
                    }}
                  >
                    Reject Request
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate(inspectRequest.id)}
                    disabled={approveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve & Apply to Database
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Reason Dialog */}
      {rejectDialogReq && (
        <Dialog open={!!rejectDialogReq} onOpenChange={(open) => !open && setRejectDialogReq(null)}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Reject Change Request
              </DialogTitle>
              <DialogDescription>
                Provide feedback to <strong>{rejectDialogReq.subAdminName}</strong> explaining why this change was rejected.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-2">
              <Textarea
                placeholder="e.g. Please check questions #2 and #4 for incorrect formula values before resubmitting."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogReq(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={rejectMutation.isPending}
                onClick={() =>
                  rejectMutation.mutate({
                    id: rejectDialogReq.id,
                    note: rejectNote,
                  })
                }
              >
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
