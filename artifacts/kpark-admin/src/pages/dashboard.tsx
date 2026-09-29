import React from 'react';
import { 
  useGetDashboardStats, 
  useGetRecentActivity,
  useGetQuestionsByDifficulty,
  useGetModelUsage,
  useGetMonthlyReport,
  useGetQuestionsBySubject
} from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Activity, BookOpen, Layers, Target, LibraryBig, Sparkles, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useGetDashboardStats();
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity({ limit: 5 });
  const { data: difficultyData, isLoading: difficultyLoading } = useGetQuestionsByDifficulty();
  const { data: monthlyData, isLoading: monthlyLoading } = useGetMonthlyReport();
  const { data: subjectData, isLoading: subjectLoading } = useGetQuestionsBySubject();
  const { data: modelData, isLoading: modelLoading } = useGetModelUsage();

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
  const DIFFICULTY_COLORS = {
    easy: 'hsl(var(--chart-3))', // green
    medium: 'hsl(var(--chart-4))', // yellow/amber
    hard: 'hsl(var(--chart-5))', // red
  };

  if (statsError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load dashboard data. Please try again later.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">Your daily snapshot of generation activity.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Questions" 
          value={stats?.totalQuestions} 
          icon={<LibraryBig className="h-4 w-4 text-muted-foreground" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="Questions Today" 
          value={stats?.questionsToday} 
          icon={<Sparkles className="h-4 w-4 text-primary" />} 
          loading={statsLoading} 
          highlight
        />
        <StatCard 
          title="Active Subjects" 
          value={stats?.totalSubjects} 
          icon={<BookOpen className="h-4 w-4 text-muted-foreground" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="Generated Papers" 
          value={stats?.totalPapers} 
          icon={<Layers className="h-4 w-4 text-muted-foreground" />} 
          loading={statsLoading} 
        />
      </div>

      {/* AI Usage Grid */}
      <h2 className="text-xl font-semibold tracking-tight mt-8 mb-4">AI Usage & Cost</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Input Tokens" 
          value={(stats as any)?.totalInputTokens?.toLocaleString() ?? 0} 
          icon={<Activity className="h-4 w-4 text-muted-foreground" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="Output Tokens" 
          value={(stats as any)?.totalOutputTokens?.toLocaleString() ?? 0} 
          icon={<Target className="h-4 w-4 text-muted-foreground" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="Total Cost (INR)" 
          value={`₹${((stats as any)?.totalCostInr ?? 0).toFixed(2)}`} 
          icon={<Sparkles className="h-4 w-4 text-green-500" />} 
          loading={statsLoading} 
          highlight
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Generation Trend</CardTitle>
            <CardDescription>Questions generated over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                {monthlyData && monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Line type="monotone" dataKey="count" name="Questions" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--background))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Difficulty Donut */}
        <Card>
          <CardHeader>
            <CardTitle>Difficulty Split</CardTitle>
            <CardDescription>Distribution of question complexity</CardDescription>
          </CardHeader>
          <CardContent>
            {difficultyLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                {difficultyData && difficultyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={difficultyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="difficulty"
                      >
                        {difficultyData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={DIFFICULTY_COLORS[entry.difficulty as keyof typeof DIFFICULTY_COLORS] || COLORS[index % COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest generation jobs and events</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-6">
                {recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4">
                      <div className="mt-0.5 bg-muted p-2 rounded-full">
                        <Activity className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{activity.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(parseISO(activity.createdAt), 'MMM d, h:mm a')}</span>
                          {activity.model && (
                            <>
                              <span>•</span>
                              <span>{activity.model}</span>
                            </>
                          )}
                          {activity.questionsGenerated && (
                            <>
                              <span>•</span>
                              <span className="text-primary font-medium">{activity.questionsGenerated} Qs</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">No recent activity</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model Usage / Providers */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Model Performance</CardTitle>
            <CardDescription>Usage and average quality scores by model</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {modelLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {modelData && modelData.length > 0 ? (
                  modelData.map((model) => (
                    <div key={model.model} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{model.model}</p>
                        <p className="text-xs text-muted-foreground">{model.provider || 'AI Provider'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{model.count.toLocaleString()} Qs</p>
                        <div className="flex items-center gap-1 justify-end">
                          <Target className="h-3 w-3 text-primary" />
                          <span className="text-xs text-muted-foreground">{model.avgQualityScore.toFixed(1)}/10 avg</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">No model data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, loading, highlight = false }: { title: string, value?: string | number, icon: React.ReactNode, loading: boolean, highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/50 shadow-sm" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className={`text-sm font-medium ${highlight ? "text-primary" : "text-muted-foreground"}`}>{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value !== undefined ? value.toLocaleString() : '0'}</div>
        )}
      </CardContent>
    </Card>
  );
}
