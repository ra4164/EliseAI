import { useState } from "react";
import { Link } from "wouter";
import {
  useListLeads,
  getListLeadsQueryKey,
  useUpdateLead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Flame,
  ThermometerSun,
  ThermometerSnowflake,
  ExternalLink,
  Send,
  CheckCircle2,
  BarChart3,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Lead } from "@workspace/api-client-react";

type TierFilter = "all" | "hot" | "warm" | "cold";

function TierBadge({ tier }: { tier?: string }) {
  if (tier === "hot")
    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1">
        <Flame className="h-3 w-3" /> Hot
      </Badge>
    );
  if (tier === "warm")
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
        <ThermometerSun className="h-3 w-3" /> Warm
      </Badge>
    );
  return (
    <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
      <ThermometerSnowflake className="h-3 w-3" /> Cold
    </Badge>
  );
}

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 75 ? "bg-orange-400" : value >= 50 ? "bg-yellow-400" : "bg-blue-400";
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono font-bold text-base w-8 text-right">{value}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function WalkBar({ value, label }: { value: number | null | undefined; label?: string | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-sm font-semibold">{value}</span>
      {label && <span className="text-[10px] text-muted-foreground leading-tight line-clamp-1 max-w-[90px]">{label}</span>}
    </div>
  );
}

function buildMailtoUrl(lead: Lead): string {
  if (!lead.enrichment?.outreachEmail) return `mailto:${lead.email}`;
  const subject = encodeURIComponent(lead.enrichment.outreachEmail.subject);
  const body = encodeURIComponent(lead.enrichment.outreachEmail.body);
  return `mailto:${lead.email}?subject=${subject}&body=${body}`;
}

function SendEmailCell({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const updateLead = useUpdateLead();
  const isSent = !!lead.outreachSentAt;

  const handleSend = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = buildMailtoUrl(lead);
    setTimeout(() => {
      updateLead.mutate(
        { leadId: lead.id, data: { outreachSentAt: new Date().toISOString() } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
            toast.success(`Email opened for ${lead.name}`);
          },
        },
      );
    }, 1000);
  };

  if (isSent) {
    return (
      <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" /> Sent
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5 h-7 text-xs"
      onClick={handleSend}
      disabled={updateLead.isPending}
    >
      <Send className="h-3 w-3" />
      Send Email
    </Button>
  );
}

export default function SalesData() {
  const { data, isLoading } = useListLeads({
    query: { queryKey: getListLeadsQueryKey() },
  });
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const allLeads = data?.leads ?? [];
  const enrichedLeads = allLeads
    .filter((l) => l.status === "enriched" && l.enrichment)
    .sort((a, b) => (b.enrichment?.score ?? 0) - (a.enrichment?.score ?? 0));

  const hotCount = enrichedLeads.filter((l) => l.enrichment?.tier === "hot").length;
  const warmCount = enrichedLeads.filter((l) => l.enrichment?.tier === "warm").length;
  const coldCount = enrichedLeads.filter((l) => l.enrichment?.tier === "cold").length;

  const filtered =
    tierFilter === "all"
      ? enrichedLeads
      : enrichedLeads.filter((l) => l.enrichment?.tier === tierFilter);

  const tierButtons: { key: TierFilter; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "all", label: "All", count: enrichedLeads.length, icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { key: "hot", label: "Hot", count: hotCount, icon: <Flame className="h-3.5 w-3.5 text-orange-500" /> },
    { key: "warm", label: "Warm", count: warmCount, icon: <ThermometerSun className="h-3.5 w-3.5 text-yellow-500" /> },
    { key: "cold", label: "Cold", count: coldCount, icon: <ThermometerSnowflake className="h-3.5 w-3.5 text-blue-400" /> },
  ];

  return (
    <div className="p-8 space-y-5">
      {/* Subtitle + filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm" style={{ color: "#898989" }}>
          Enriched lead metrics — scores, location signals, and market data at a glance.
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-4 w-4 shrink-0" style={{ color: "#898989" }} />
          {tierButtons.map(({ key, label, count, icon }) => (
            <button
              key={key}
              onClick={() => setTierFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={
                tierFilter === key
                  ? { background: "#4880FF", color: "#ffffff" }
                  : { background: "#F5F6FA", color: "#898989" }
              }
            >
              {icon}
              {label}
              <span className="text-xs opacity-70">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}>
          <Table>
            <TableHeader>
              <TableRow>
                {[...Array(8)].map((_, i) => (
                  <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : enrichedLeads.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border-2 border-dashed"
          style={{ borderColor: "#EAECF0", background: "#ffffff" }}
        >
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 text-white" style={{ background: "#4880FF" }}>
            <BarChart3 className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: "#202224" }}>No enriched leads yet</h3>
          <p className="text-sm mb-6 max-w-sm mt-1" style={{ color: "#898989" }}>
            Add leads and enrich them to see their sales data here.
          </p>
          <Link href="/leads">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#4880FF" }}
            >
              Go to Leads
            </button>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}>
          <Table>
            <TableHeader>
              <TableRow style={{ background: "#F5F6FA" }}>
                <TableHead className="min-w-[180px]" style={{ color: "#898989" }}>Lead</TableHead>
                <TableHead style={{ color: "#898989" }}>Location</TableHead>
                <TableHead style={{ color: "#898989" }}>Score</TableHead>
                <TableHead style={{ color: "#898989" }}>Tier</TableHead>
                <TableHead className="min-w-[90px]" style={{ color: "#898989" }}>Walk Score</TableHead>
                <TableHead className="min-w-[90px]" style={{ color: "#898989" }}>Transit</TableHead>
                <TableHead style={{ color: "#898989" }}>Renter %</TableHead>
                <TableHead style={{ color: "#898989" }}>Median Rent</TableHead>
                <TableHead style={{ color: "#898989" }}>News</TableHead>
                <TableHead className="text-right min-w-[120px]" style={{ color: "#898989" }}>Outreach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => {
                const e = lead.enrichment!;
                const renterPct = e.census.renterOccupiedPct != null
                  ? `${(e.census.renterOccupiedPct * 100).toFixed(0)}%`
                  : "—";
                const medianRent = e.census.medianGrossRent != null
                  ? `$${e.census.medianGrossRent.toLocaleString()}`
                  : "—";
                return (
                  <TableRow
                    key={lead.id}
                    className="group hover:bg-muted/40 cursor-pointer"
                  >
                    <TableCell>
                      <Link href={`/leads/${lead.id}`}>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                            {lead.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                          </span>
                          <span className="text-xs text-muted-foreground">{lead.company}</span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {lead.city}, {lead.state}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={e.score} />
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={e.tier} />
                    </TableCell>
                    <TableCell>
                      <WalkBar value={e.walkScore.walk} label={e.walkScore.walkDescription} />
                    </TableCell>
                    <TableCell>
                      <WalkBar value={e.walkScore.transit} label={e.walkScore.transitDescription} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{renterPct}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{medianRent}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {e.news.length > 0 ? (
                          <Badge variant="outline" className="gap-1 font-mono text-xs">
                            {e.news.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <SendEmailCell lead={lead} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No {tierFilter} leads enriched yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
