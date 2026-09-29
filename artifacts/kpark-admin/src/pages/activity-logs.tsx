import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthStore } from '@/hooks/use-auth';
import { format, parseISO } from 'date-fns';
import { 
  ScrollText, 
  Search, 
  User, 
  Calendar, 
  FileUp, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Eye, 
  Loader2, 
  RefreshCw,
  Activity
} from 'lucide-react';

export interface ActivityLog {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export default function ActivityLogsPage() {
  const token = useAuthStore((s) => s.token);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['activity-logs', actionFilter],
    queryFn: async () => {
      const url = actionFilter && actionFilter !== 'all'
        ? `/api/activity-logs?action=${actionFilter}&limit=100`
        : '/api/activity-logs?limit=100';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load activity logs');
      return res.json() as Promise<{ logs: ActivityLog[]; total: number }>;
    },
  });

  const logs = data?.logs || [];

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.userName?.toLowerCase().includes(q) ||
      l.userEmail?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q)
    );
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Login</Badge>;
      case 'SUBMIT_APPROVAL_REQUEST':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Approval Submitted</Badge>;
      case 'APPROVE_CHANGE_REQUEST':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">Approved by Admin</Badge>;
      case 'REJECT_CHANGE_REQUEST':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Rejected by Admin</Badge>;
      case 'CREATE_SUBADMIN':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">Sub-Admin Created</Badge>;
      case 'UPDATE_SUBADMIN':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Sub-Admin Updated</Badge>;
      case 'DELETE_SUBADMIN':
        return <Badge variant="destructive">Sub-Admin Deleted</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <ScrollText className="h-6 w-6 text-primary" /> Activity Tracker & Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time audit logging of all sub-admin actions, question submissions, logins, and approvals.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-primary' : ''}`} />
          Refresh Activity
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user name, email, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="SUBMIT_APPROVAL_REQUEST">Approval Submissions</SelectItem>
            <SelectItem value="APPROVE_CHANGE_REQUEST">Approvals</SelectItem>
            <SelectItem value="REJECT_CHANGE_REQUEST">Rejections</SelectItem>
            <SelectItem value="CREATE_SUBADMIN">Sub-Admin Created</SelectItem>
            <SelectItem value="LOGIN">User Logins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Timeline List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Recent System Activity</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {filteredLogs.length} events
            </Badge>
          </CardTitle>
          <CardDescription>
            Chronological audit log of operations across all admin and sub-admin accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading activity logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <div className="text-base font-medium">No activity events found</div>
              <p className="text-xs">Events will be logged automatically as sub-admins perform actions.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="py-3.5 px-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors rounded-lg"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 shrink-0">{getActionBadge(log.action)}</div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="text-xs font-semibold flex items-center gap-2 flex-wrap">
                        <span className="text-foreground">{log.userName || log.userEmail}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 px-1">
                          {log.userRole}
                        </Badge>
                        <span className="text-muted-foreground font-normal">({log.userEmail})</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {log.details ? JSON.stringify(log.details) : 'Operation performed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {log.createdAt ? format(parseISO(log.createdAt), 'MMM d, h:mm:ss a') : 'Recent'}
                    </span>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Details
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Audit Event #{selectedLog.id}
              </DialogTitle>
              <DialogDescription>
                Logged on {selectedLog.createdAt ? format(parseISO(selectedLog.createdAt), 'PPpp') : 'Recent'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border bg-muted/20">
                <div>
                  <span className="text-muted-foreground block">Action</span>
                  <span className="font-semibold">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">User Role</span>
                  <span className="font-semibold uppercase">{selectedLog.userRole}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">User Email</span>
                  <span className="font-semibold">{selectedLog.userEmail}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">IP Address</span>
                  <span className="font-semibold">{selectedLog.ipAddress || 'Internal'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold uppercase text-[10px] block">
                  Event Details (JSON Payload)
                </span>
                <pre className="p-3 rounded-lg bg-muted/40 border text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
