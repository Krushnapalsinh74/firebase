import React from 'react';
import { 
  useGetDashboardStats,
  useGetQuestionsByDifficulty,
  useGetModelUsage,
  useGetMonthlyReport,
  useGetQuestionsBySubject
} from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle2, MinusCircle, TrendingUp } from 'lucide-react';

interface TopicCoverageRow {
  topicId: number;
  topicName: string;
  chapterName: string;
  subjectName: string;
  total: number;
  easy: number;
  medium: number;
  hard: number;
  advanced: number;
  avgQuality: number;
}

interface QualityBand { band: string; count: number; }

function CoverageBadge({ total }: { total: number }) {
  if (total === 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      <AlertCircle className="h-3 w-3" /> None
    </span>
  );
  if (total < 5) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
      <MinusCircle className="h-3 w-3" /> Low ({total})
    </span>
  );
  if (total < 10) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
      <TrendingUp className="h-3 w-3" /> OK ({total})
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
      <CheckCircle2 className="h-3 w-3" /> Good ({total})
    </span>
  );
}

function DiffPill({ n, color }: { n: number; color: string }) {
  if (n === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className={`text-xs font-semibold ${color}`}>{n}</span>;
}

export default function AnalyticsPage() {
  const { data: difficultyData, isLoading: difficultyLoading } = useGetQuestionsByDifficulty();
  const { data: monthlyData, isLoading: monthlyLoading } = useGetMonthlyReport();
  const { data: subjectData, isLoading: subjectLoading } = useGetQuestionsBySubject();
  const { data: modelData, isLoading: modelLoading } = useGetModelUsage();

  const { data: coverageData, isLoading: coverageLoading } = useQuery<TopicCoverageRow[]>({
    queryKey: ['analytics', 'topic-coverage'],
    queryFn: () => customFetch<TopicCoverageRow[]>('/api/analytics/topic-coverage'),
    staleTime: 30_000,
  });

  const { data: qualityData, isLoading: qualityLoading } = useQuery<QualityBand[]>({
    queryKey: ['analytics', 'quality-distribution'],
    queryFn: () => customFetch<QualityBand[]>('/api/analytics/quality-distribution'),
    staleTime: 30_000,
  });

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
  const QUALITY_COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626'];

  const coverageSummary = coverageData ? {
    total: coverageData.length,
    none: coverageData.filter(r => r.total === 0).length,
    low: coverageData.filter(r => r.total > 0 && r.total < 5).length,
    ok: coverageData.filter(r => r.total >= 5 && r.total < 10).length,
    good: coverageData.filter(r => r.total >= 10).length,
  } : null;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Deep dive into generation metrics, quality scores, and coverage gaps.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Questions by Subject ── */}
        <Card>
          <CardHeader>
            <CardTitle>Questions by Subject</CardTitle>
            <CardDescription>Volume of generated content per subject</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectLoading ? <Skeleton className="h-[350px] w-full" /> : (
              <div className="h-[350px] w-full">
                {subjectData && subjectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="subjectName" type="category" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} width={100} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                      <Bar dataKey="count" name="Questions" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Monthly Generation ── */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Generation Output</CardTitle>
            <CardDescription>Historical trend of generated questions</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? <Skeleton className="h-[350px] w-full" /> : (
              <div className="h-[350px] w-full">
                {monthlyData && monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                      <Bar dataKey="count" name="Questions" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Difficulty Distribution ── */}
        <Card>
          <CardHeader>
            <CardTitle>Difficulty Distribution</CardTitle>
            <CardDescription>Breakdown by question complexity</CardDescription>
          </CardHeader>
          <CardContent>
            {difficultyLoading ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full flex items-center justify-center">
                {difficultyData && difficultyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={difficultyData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="count" nameKey="difficulty" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {difficultyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Quality Score Distribution ── */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Score Distribution</CardTitle>
            <CardDescription>How AI-rated quality is spread across all questions</CardDescription>
          </CardHeader>
          <CardContent>
            {qualityLoading ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full flex items-center justify-center">
                {qualityData && qualityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={qualityData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="band" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} angle={-15} textAnchor="end" interval={0} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                      <Bar dataKey="count" name="Questions" radius={[4, 4, 0, 0]}>
                        {qualityData.map((_, i) => <Cell key={i} fill={QUALITY_COLORS[i % QUALITY_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Model Quality Performance ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Model Quality Performance</CardTitle>
            <CardDescription>Average quality scores and usage volume per model</CardDescription>
          </CardHeader>
          <CardContent>
            {modelLoading ? <Skeleton className="h-[200px] w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Questions</TableHead>
                    <TableHead className="text-right">Avg Quality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelData?.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{m.model}</TableCell>
                      <TableCell>{m.provider}</TableCell>
                      <TableCell className="text-right">{m.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-primary">{m.avgQualityScore.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {(!modelData || modelData.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No data available</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Topic Coverage Report ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Topic Coverage Report</CardTitle>
              <CardDescription>Question count per topic — identify gaps at a glance</CardDescription>
            </div>
            {coverageSummary && (
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="text-green-600 font-medium">{coverageSummary.good} good</span>
                <span className="text-blue-600 font-medium">{coverageSummary.ok} ok</span>
                <span className="text-amber-600 font-medium">{coverageSummary.low} low</span>
                <span className="text-red-600 font-medium">{coverageSummary.none} none</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {coverageLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : coverageData && coverageData.length > 0 ? (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead className="hidden md:table-cell">Chapter</TableHead>
                    <TableHead className="hidden lg:table-cell">Subject</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center text-green-600">Easy</TableHead>
                    <TableHead className="text-center text-amber-600">Med</TableHead>
                    <TableHead className="text-center text-red-600">Hard</TableHead>
                    <TableHead className="text-center text-purple-600">Adv</TableHead>
                    <TableHead className="text-right">Avg Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coverageData.map((row) => (
                    <TableRow key={row.topicId} className={row.total === 0 ? 'bg-red-500/5' : ''}>
                      <TableCell className="font-medium max-w-[200px] truncate">{row.topicName}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{row.chapterName}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{row.subjectName}</TableCell>
                      <TableCell className="text-center"><CoverageBadge total={row.total} /></TableCell>
                      <TableCell className="text-center"><DiffPill n={row.easy} color="text-green-600" /></TableCell>
                      <TableCell className="text-center"><DiffPill n={row.medium} color="text-amber-600" /></TableCell>
                      <TableCell className="text-center"><DiffPill n={row.hard} color="text-red-600" /></TableCell>
                      <TableCell className="text-center"><DiffPill n={row.advanced} color="text-purple-600" /></TableCell>
                      <TableCell className="text-right text-sm">
                        {row.total > 0 ? (
                          <span className={row.avgQuality >= 0.8 ? 'text-green-600 font-medium' : row.avgQuality >= 0.6 ? 'text-amber-600' : 'text-red-600'}>
                            {row.avgQuality.toFixed(2)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No topics found. Add topics in the Hierarchy section.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
