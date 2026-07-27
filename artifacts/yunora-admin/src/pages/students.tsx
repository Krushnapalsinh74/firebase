import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useListStudents, StudentWithPlan } from '@workspace/api-client-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function StudentsPage() {
  const { data: studentsData, isLoading } = useListStudents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">
            View registered students, their active plans, and usage.
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Active Plan</TableHead>
              <TableHead>Questions Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading students...
                </TableCell>
              </TableRow>
            ) : !studentsData?.data || studentsData.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No students found.
                </TableCell>
              </TableRow>
            ) : (
              studentsData.data.map((student: StudentWithPlan) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      {student.name}
                    </div>
                  </TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>
                    {student.planName ? (
                      <Badge variant="secondary">{student.planName}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No Plan</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{student.questionsUsed}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${student.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {student.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(student.createdAt).toLocaleDateString()}
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
