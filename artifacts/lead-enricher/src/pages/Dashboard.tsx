import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  useGetLeadStats,
  getGetLeadStatsQueryKey,
  useGetScheduleStatus,
  getGetScheduleStatusQueryKey,
  useTriggerEnrichment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  Activity,
  Flame,
  ThermometerSnowflake,
  ThermometerSun,
  Database,
  Plus,
  Clock,
  Zap,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatNextRun(iso: string | null): string {
  if (!iso) return "Unknown";
  const next = new Date(iso);
  const now = new Date();
  // Compare calendar dates in UTC (server cron runs in server-local UTC)
  const nextDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()));
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isToday = nextDay.getTime() === todayUTC.getTime();
  // Always show 9:00 AM — the cron is defined as server-local 9 AM, don't re-convert to local tz
  return isToday ? "Today at 9:00 AM" : "Tomorrow at 9:00 AM";
}

function ScheduleBanner({ onTrigger }: { onTrigger: () => void }) {
  const queryClient = useQueryClient();
  const { data: schedule, isLoading } = useGetScheduleStatus({
    query: {
      queryKey: getGetScheduleStatusQueryKey(),
      refetchInterval: 30_000,
    },
  });
  const trigger = useTriggerEnrichment();

  const handleTrigger = () => {
    trigger.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(
          res.processed === 0
            ? "No pending leads to enrich"
            : `Enrichment complete — ${res.succeeded} succeeded, ${res.failed} failed`,
        );
        queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetScheduleStatusQueryKey() });
        onTrigger();
      },
      onError: (err) => {
        toast.error("Enrichment failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      },
    });
  };

  if (isLoading || !schedule) return null;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border bg-card text-sm flex-wrap">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium text-foreground">Auto-enriches {schedule.friendlySchedule}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">— scores leads, drafts outreach emails &amp; sales insights</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span>Next run:</span>
          <span className="font-medium text-foreground">{formatNextRun(schedule.nextRunAt)}</span>
        </div>
        {schedule.lastRunAt && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Last run {formatRelativeTime(schedule.lastRunAt)}</span>
            {schedule.lastRunSucceeded !== null && (
              <span>
                — {schedule.lastRunSucceeded} enriched
                {schedule.lastRunFailed ? `, ${schedule.lastRunFailed} failed` : ""}
              </span>
            )}
          </div>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleTrigger}
        disabled={trigger.isPending || schedule.isRunning}
        className="shrink-0"
      >
        {trigger.isPending || schedule.isRunning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Zap className="h-3.5 w-3.5 mr-2" />
            Run Now
          </>
        )}
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading } = useGetLeadStats({
    query: { queryKey: getGetLeadStatsQueryKey() },
  });

  const refreshStats = () => {
    queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 w-full lg:col-span-2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Empty state — no leads uploaded yet, show real "0" stats only.
  if (stats.total === 0) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Pipeline Overview
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload leads to start seeing real enrichment stats.
          </p>
        </div>

        <ScheduleBanner onTrigger={refreshStats} />

        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg border-dashed bg-card/50">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Database className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">No leads yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Stats appear here as you upload and enrich leads. Add a single lead
            manually, or upload a CSV to start a batch.
          </p>
          <Link href="/leads/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Leads
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Pipeline Overview
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Monitor enrichment status and lead quality distribution.
          </p>
        </div>
      </div>

      <ScheduleBanner onTrigger={refreshStats} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total Leads</span>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {stats.pendingCount} pending enrichment
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Hot Leads</span>
              <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{stats.hotCount}</div>
            <p className="text-xs text-muted-foreground mt-1.5">Score ≥ 75</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Warm Leads</span>
              <div className="h-8 w-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                <ThermometerSun className="h-4 w-4 text-yellow-500" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{stats.warmCount}</div>
            <p className="text-xs text-muted-foreground mt-1.5">Score 50–74</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cold Leads</span>
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <ThermometerSnowflake className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{stats.coldCount}</div>
            <p className="text-xs text-muted-foreground mt-1.5">Score &lt; 50</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <CardDescription>
              Breakdown of lead scores across the pipeline. Average score:{" "}
              <span className="font-semibold text-foreground">
                {stats.averageScore.toFixed(1)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0 h-[300px]">
            {stats.enrichedCount === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Enrich leads to see the score distribution.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.scoreDistribution}
                  margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="bucket"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.scoreDistribution.map((entry, index) => {
                      const bucketValue = parseInt(entry.bucket.split("-")[0]!);
                      let color = "hsl(var(--chart-5))";
                      if (bucketValue >= 75) color = "hsl(var(--chart-3))";
                      else if (bucketValue >= 50) color = "hsl(var(--chart-4))";
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Leads</CardTitle>
            <CardDescription>
              Highest scoring prospects in the pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topLeads.length > 0 ? (
              <div className="space-y-4">
                {stats.topLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium truncate">{lead.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {lead.company}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="font-mono bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-none"
                      >
                        {lead.enrichment?.score}
                      </Badge>
                      <Link href={`/leads/${lead.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12 text-muted-foreground">
                <Database className="h-8 w-8 opacity-20" />
                <p className="text-sm">No enriched leads yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
