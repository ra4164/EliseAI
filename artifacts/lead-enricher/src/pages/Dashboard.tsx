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
} from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  ArrowRight,
  Activity,
  Flame,
  ThermometerSnowflake,
  ThermometerSun,
  Database,
  Plus,
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

export default function Dashboard() {
  const { data: stats, isLoading } = useGetLeadStats({
    query: { queryKey: getGetLeadStatsQueryKey() },
  });

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingCount} pending enrichment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.hotCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Score &gt;= 75</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warm Leads</CardTitle>
            <ThermometerSun className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.warmCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Score 50-74</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cold Leads</CardTitle>
            <ThermometerSnowflake className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.coldCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Score &lt; 50</p>
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
