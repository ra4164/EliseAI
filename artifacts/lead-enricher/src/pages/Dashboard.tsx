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
  AlertTriangle,
  Send,
  MessageSquare,
  PhoneCall,
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
    <div
      className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl text-sm flex-wrap"
      style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#E8F0FE" }}>
            <Clock className="h-4 w-4" style={{ color: "#4880FF" }} />
          </div>
          <div>
            <span className="font-semibold" style={{ color: "#202224" }}>
              Auto-enriches {schedule.friendlySchedule}
            </span>
            <span className="ml-1 hidden sm:inline" style={{ color: "#898989" }}>
              — scores leads, drafts outreach &amp; sales insights
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ color: "#898989" }}>
          <span>Next run:</span>
          <span className="font-semibold ml-1" style={{ color: "#202224" }}>{formatNextRun(schedule.nextRunAt)}</span>
        </div>
        {schedule.lastRunAt && (
          <div className="flex items-center gap-1" style={{ color: "#898989" }}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#22C55E" }} />
            <span>Last run {formatRelativeTime(schedule.lastRunAt)}</span>
            {schedule.lastRunSucceeded !== null && (
              <span>— {schedule.lastRunSucceeded} enriched{schedule.lastRunFailed ? `, ${schedule.lastRunFailed} failed` : ""}</span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={handleTrigger}
        disabled={trigger.isPending || schedule.isRunning}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 shrink-0"
        style={{ background: "#4880FF" }}
      >
        {trigger.isPending || schedule.isRunning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Zap className="h-3.5 w-3.5" />
            Run Now
          </>
        )}
      </button>
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
      <div className="p-8 space-y-6">
        <ScheduleBanner onTrigger={refreshStats} />
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-2xl border-dashed bg-card">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 text-white"
            style={{ background: "#4880FF" }}
          >
            <Database className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: "#202224" }}>No leads yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mt-1 text-sm">
            Stats appear here as you upload and enrich leads. Add a single lead
            manually, or upload a CSV to start a batch.
          </p>
          <Link href="/leads/new">
            <Button style={{ background: "#4880FF" }} className="text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Add Leads
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <ScheduleBanner onTrigger={refreshStats} />

      {/* Stale leads alert */}
      {stats.staleLeads.length > 0 && (
        <div
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl flex-wrap"
          style={{ background: "#FFF8E6", border: "1px solid #FDECC0" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FEF3C7" }}>
              <AlertTriangle className="h-4 w-4" style={{ color: "#D97706" }} />
            </div>
            <div>
              <span className="font-semibold text-sm" style={{ color: "#92400E" }}>
                {stats.staleLeads.length} stale lead{stats.staleLeads.length > 1 ? "s" : ""} — no reply in 3+ days
              </span>
              <span className="ml-2 text-sm" style={{ color: "#B45309" }}>
                {stats.staleLeads.slice(0, 3).map((l) => l.name).join(", ")}
                {stats.staleLeads.length > 3 ? ` +${stats.staleLeads.length - 3} more` : ""}
              </span>
            </div>
          </div>
          <Link href="/outreach">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border shrink-0"
              style={{ background: "#FEF3C7", color: "#92400E", borderColor: "#FDECC0" }}
            >
              <Send className="h-3.5 w-3.5" />
              Review in Outreach
            </button>
          </Link>
        </div>
      )}

      {/* Stat Cards — DashStack style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Leads */}
        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "#898989" }}>Total Leads</p>
            <p className="text-[32px] font-bold leading-none mb-2" style={{ color: "#202224" }}>{stats.total}</p>
            <p className="text-xs" style={{ color: "#898989" }}>{stats.pendingCount} pending enrichment</p>
          </div>
          <div className="shrink-0 h-[52px] w-[52px] rounded-xl flex items-center justify-center" style={{ background: "#E8F0FE" }}>
            <Activity className="h-6 w-6" style={{ color: "#4880FF" }} />
          </div>
        </div>

        {/* Hot Leads */}
        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "#898989" }}>Hot Leads</p>
            <p className="text-[32px] font-bold leading-none mb-2" style={{ color: "#202224" }}>{stats.hotCount}</p>
            <p className="text-xs" style={{ color: "#898989" }}>Score ≥ 75</p>
          </div>
          <div className="shrink-0 h-[52px] w-[52px] rounded-xl flex items-center justify-center" style={{ background: "#FFF0E6" }}>
            <Flame className="h-6 w-6" style={{ color: "#FF6B35" }} />
          </div>
        </div>

        {/* Warm Leads */}
        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "#898989" }}>Warm Leads</p>
            <p className="text-[32px] font-bold leading-none mb-2" style={{ color: "#202224" }}>{stats.warmCount}</p>
            <p className="text-xs" style={{ color: "#898989" }}>Score 50–74</p>
          </div>
          <div className="shrink-0 h-[52px] w-[52px] rounded-xl flex items-center justify-center" style={{ background: "#FFF9E6" }}>
            <ThermometerSun className="h-6 w-6" style={{ color: "#FFC107" }} />
          </div>
        </div>

        {/* Cold Leads */}
        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "#898989" }}>Cold Leads</p>
            <p className="text-[32px] font-bold leading-none mb-2" style={{ color: "#202224" }}>{stats.coldCount}</p>
            <p className="text-xs" style={{ color: "#898989" }}>Score &lt; 50</p>
          </div>
          <div className="shrink-0 h-[52px] w-[52px] rounded-xl flex items-center justify-center" style={{ background: "#E8F5FF" }}>
            <ThermometerSnowflake className="h-6 w-6" style={{ color: "#2196F3" }} />
          </div>
        </div>
      </div>

      {/* Funnel Pipeline Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "#898989" }}>Contacted</p>
            <p className="text-[32px] font-bold leading-none mb-2" style={{ color: "#202224" }}>{stats.funnelContactedCount}</p>
            <p className="text-xs" style={{ color: "#898989" }}>Awaiting reply</p>
          </div>
          <div className="shrink-0 h-[52px] w-[52px] rounded-xl flex items-center justify-center" style={{ background: "#E8F0FE" }}>
            <Send className="h-6 w-6" style={{ color: "#4880FF" }} />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "#898989" }}>Replied</p>
            <p className="text-[32px] font-bold leading-none mb-2" style={{ color: "#202224" }}>{stats.funnelRepliedCount}</p>
            <p className="text-xs" style={{ color: "#898989" }}>Engaged prospects</p>
          </div>
          <div className="shrink-0 h-[52px] w-[52px] rounded-xl flex items-center justify-center" style={{ background: "#FFF9E6" }}>
            <MessageSquare className="h-6 w-6" style={{ color: "#D97706" }} />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "#898989" }}>Call Booked</p>
            <p className="text-[32px] font-bold leading-none mb-2" style={{ color: "#202224" }}>{stats.funnelCallBookedCount}</p>
            <p className="text-xs" style={{ color: "#898989" }}>Ready to close</p>
          </div>
          <div className="shrink-0 h-[52px] w-[52px] rounded-xl flex items-center justify-center" style={{ background: "#E6F9F0" }}>
            <PhoneCall className="h-6 w-6" style={{ color: "#16A34A" }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Distribution Chart */}
        <div
          className="lg:col-span-2 rounded-2xl p-6"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div className="mb-1">
            <h3 className="font-semibold text-base" style={{ color: "#202224" }}>Score Distribution</h3>
            <p className="text-sm mt-0.5" style={{ color: "#898989" }}>
              Lead scores across the pipeline · Avg:{" "}
              <span className="font-semibold" style={{ color: "#202224" }}>
                {stats.averageScore.toFixed(1)}
              </span>
            </p>
          </div>
          <div className="h-[280px] mt-4">
            {stats.enrichedCount === 0 ? (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: "#898989" }}>
                Enrich leads to see the score distribution.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.scoreDistribution}
                  margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                  <XAxis
                    dataKey="bucket"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#898989" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#898989" }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(72,128,255,0.06)" }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#EAECF0",
                      borderRadius: "12px",
                      color: "#202224",
                      fontSize: "13px",
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.scoreDistribution.map((entry, index) => {
                      const bucketValue = parseInt(entry.bucket.split("-")[0]!);
                      let color = "#4880FF";
                      if (bucketValue >= 75) color = "#FF6B35";
                      else if (bucketValue >= 50) color = "#FFC107";
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Leads */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <div className="mb-4">
            <h3 className="font-semibold text-base" style={{ color: "#202224" }}>Top Leads</h3>
            <p className="text-sm mt-0.5" style={{ color: "#898989" }}>Highest scoring prospects</p>
          </div>
          {stats.topLeads.length > 0 ? (
            <div className="space-y-3">
              {stats.topLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between gap-3 group py-2 px-3 rounded-xl transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F5F6FA"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: "#4880FF" }}
                    >
                      {lead.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: "#202224" }}>{lead.name}</p>
                      <p className="text-xs truncate" style={{ color: "#898989" }}>{lead.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "#FFF0E6", color: "#FF6B35" }}
                    >
                      {lead.enrichment?.score}
                    </span>
                    <Link href={`/leads/${lead.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Database className="h-8 w-8 mb-3" style={{ color: "#D0D5DD" }} />
              <p className="text-sm" style={{ color: "#898989" }}>No enriched leads yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
