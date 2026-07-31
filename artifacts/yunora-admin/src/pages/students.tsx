import React from 'react';
import { useListStudents } from '@workspace/api-client-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Users, Mail, Phone, Chrome } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'phone') return <Phone className="h-3 w-3" />;
  if (provider === 'google.com') return <Chrome className="h-3 w-3" />;
  return <Mail className="h-3 w-3" />;
}

export default function StudentsPage() {
  const { data: studentsData, isLoading } = useListStudents();
  const students = (studentsData as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">
            All registered users from Firebase Authentication.
          </p>
        </div>
        <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
          {isLoading ? '...' : `${students.length} users`}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / Identifier</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Active Plan</TableHead>
              <TableHead>Questions Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Sign In</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading students...
                </TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No students found.
                </TableCell>
              </TableRow>
            ) : (
              students.map((student: any) => (
                <TableRow key={student.uid || student.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate max-w-[180px]">{student.name}</span>
                        {student.phone && (
                          <span className="text-xs text-muted-foreground">{student.phone}</span>
                        )}
                        {student.email && student.name !== student.email && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">{student.email}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ProviderIcon provider={student.provider} />
                      <span className="capitalize">{student.provider === 'google.com' ? 'Google' : student.provider}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {student.planName ? (
                      <Badge variant="secondary">{student.planName}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No Plan</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{student.questionsUsed ?? 0}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      student.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {student.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-IN') : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {student.lastSignIn ? new Date(student.lastSignIn).toLocaleDateString('en-IN') : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
