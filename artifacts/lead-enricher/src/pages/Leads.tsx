import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListLeads,
  getListLeadsQueryKey,
  useEnrichLead,
  useDeleteLead,
  useTriggerEnrichment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  MoreHorizontal,
  Zap,
  Trash2,
  ExternalLink,
  Filter,
  Users,
  Download,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadEnrichedCsv } from "@/lib/csv";
import { getEffectiveScore, getFunnelPrediction, getEffectiveTier } from "@/lib/funnelPrediction";

const FUNNEL_PILL: Record<string, { label: string; bg: string; color: string }> = {
  contacted: { label: "Contacted", bg: "#E8F0FE", color: "#1D4ED8" },
  replied: { label: "Replied", bg: "#FEF3C7", color: "#92400E" },
  ghosted: { label: "Ghosted", bg: "#FEE2E2", color: "#991B1B" },
  call_booked: { label: "Call Booked", bg: "#DCFCE7", color: "#166534" },
  lost: { label: "Lost", bg: "#F1F5F9", color: "#475569" },
};

function FunnelPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const meta = FUNNEL_PILL[status];
  if (!meta) return <span className="text-muted-foreground text-xs">{status}</span>;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

const BATCH_COLORS = [
  "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300 border-lime-200 dark:border-lime-800",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800",
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export default function Leads() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListLeads({
    query: { queryKey: getListLeadsQueryKey() },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");

  const enrichLead = useEnrichLead();
  const deleteLead = useDeleteLead();
  const enrichAll = useTriggerEnrichment();

  const handleEnrich = (id: string) => {
    enrichLead.mutate(
      { leadId: id },
      {
        onSuccess: () => {
          toast.success("Enrichment complete");
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        },
        onError: (err) => {
          toast.error("Failed to enrich lead", {
            description: err instanceof Error ? err.message : "Unknown error",
          });
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteLead.mutate(
      { leadId: id },
      {
        onSuccess: () => {
          toast.success("Lead deleted");
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        },
        onError: () => {
          toast.error("Failed to delete lead");
        },
      },
    );
  };

  const handleEnrichAll = () => {
    enrichAll.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(
          `Enrichment complete: ${res.succeeded} succeeded, ${res.failed} failed.`,
        );
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      },
      onError: (err) => {
        toast.error("Failed to run enrichment", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      },
    });
  };

  const leads = data?.leads || [];

  const batches = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of leads) {
      if (l.batchId && !map.has(l.batchId)) {
        map.set(l.batchId, l.batchLabel || l.batchId.slice(0, 8));
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [leads]);

  const filteredLeads = leads
    .filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier =
        tierFilter === "all" || lead.enrichment?.tier === tierFilter;
      const matchesStatus =
        statusFilter === "all" || lead.status === statusFilter;
      const matchesBatch =
        batchFilter === "all" || (lead.batchId ?? "") === batchFilter;
      return matchesSearch && matchesTier && matchesStatus && matchesBatch;
    })
    .sort((a, b) => {
      const scoreA = a.enrichment?.score || 0;
      const scoreB = b.enrichment?.score || 0;
      return scoreB - scoreA;
    });

  const enrichedCount = leads.filter(
    (l) => l.status === "enriched" && l.enrichment,
  ).length;
  const pendingCount = leads.filter(
    (l) => l.status === "pending" || l.status === "failed",
  ).length;

  const handleDownload = () => {
    const enriched = leads.filter((l) => l.status === "enriched" && l.enrichment);
    if (enriched.length === 0) {
      toast.error("No enriched leads to export yet");
      return;
    }
    downloadEnrichedCsv(enriched);
    toast.success(`Exported ${enriched.length} enriched leads`);
  };

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case "hot":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">
            Hot
          </Badge>
        );
      case "warm":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
            Warm
          </Badge>
        );
      case "cold":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            Cold
          </Badge>
        );
      default:
        return <Badge variant="outline">Unscored</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "enriched":
        return (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
          >
            Enriched
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
          >
            Pending
          </Badge>
        );
      case "enriching":
        return (
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary animate-pulse"
          >
            Enriching...
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const getBatchBadge = (batchId: string | null, batchLabel: string | null) => {
    if (!batchId) return null;
    const colorClass = BATCH_COLORS[hashString(batchId) % BATCH_COLORS.length];
    return (
      <Badge
        variant="outline"
        className={`${colorClass} text-xs font-medium gap-1`}
        title={batchLabel || ""}
      >
        <Layers className="h-3 w-3" />
        {batchLabel?.split(" (")[0] || batchId.slice(0, 8)}
      </Badge>
    );
  };

  return (
    <div className="p-8 space-y-5">
      {/* Page action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm" style={{ color: "#898989" }}>
          {leads.length > 0
            ? `${enrichedCount} enriched · ${pendingCount} pending`
            : "Manage and enrich your inbound pipeline."}
        </p>
        <div className="flex items-center gap-2.5 flex-wrap">
          {pendingCount > 0 && (
            <button
              onClick={handleEnrichAll}
              disabled={enrichAll.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 disabled:opacity-60"
              style={{ background: "#F5F6FA", color: "#202224", borderColor: "#EAECF0" }}
            >
              <Zap className={`h-4 w-4 ${enrichAll.isPending ? "animate-pulse" : ""}`} style={{ color: "#4880FF" }} />
              {enrichAll.isPending ? "Enriching..." : `Enrich Pending (${pendingCount})`}
            </button>
          )}
          {enrichedCount > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-80"
              style={{ background: "#F5F6FA", color: "#202224", borderColor: "#EAECF0" }}
            >
              <Download className="h-4 w-4" style={{ color: "#4880FF" }} />
              Download CSV
            </button>
          )}
          <Link href="/leads/new">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "#4880FF" }}
            >
              <Plus className="h-4 w-4" />
              Add Leads
            </button>
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl"
        style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
      >
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="all">All Tiers</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
          </div>

          <div className="h-4 w-px bg-border" />

          <select
            className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="enriching">Enriching</option>
            <option value="enriched">Enriched</option>
            <option value="failed">Failed</option>
          </select>

          {batches.length > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <select
                  className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer"
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                >
                  <option value="all">All Batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Funnel</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-10 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : leads.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border-2 border-dashed"
          style={{ borderColor: "#EAECF0", background: "#ffffff" }}
        >
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 text-white"
            style={{ background: "#4880FF" }}
          >
            <Users className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: "#202224" }}>No leads found</h3>
          <p className="text-sm mb-6 max-w-sm mt-1" style={{ color: "#898989" }}>
            Get started by adding a lead manually or uploading a CSV.
          </p>
          <Link href="/leads/new">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#4880FF" }}
            >
              <Plus className="h-4 w-4" />
              Add Leads
            </button>
          </Link>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#ffffff", boxShadow: "0px 4px 20px 0px rgba(0,0,0,0.06)" }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ background: "#F5F6FA" }}>
                <TableHead style={{ color: "#898989" }}>Lead</TableHead>
                <TableHead style={{ color: "#898989" }}>Location</TableHead>
                <TableHead style={{ color: "#898989" }}>Batch</TableHead>
                <TableHead style={{ color: "#898989" }}>Status</TableHead>
                <TableHead style={{ color: "#898989" }}>Score</TableHead>
                <TableHead style={{ color: "#898989" }}>Funnel</TableHead>
                <TableHead className="text-right" style={{ color: "#898989" }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredLeads.map((lead, index) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="group hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {lead.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {lead.company}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {lead.city}, {lead.state}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getBatchBadge(
                        lead.batchId ?? null,
                        lead.batchLabel ?? null,
                      ) || (
                        <span className="text-muted-foreground text-xs">
                          Single
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(lead.status)}</TableCell>
                    <TableCell>
                      {lead.status === "enriched" && lead.enrichment ? (() => {
                        const base = lead.enrichment.score;
                        const effective = getEffectiveScore(base, lead.funnelStatus);
                        const delta = effective - base;
                        const pred = getFunnelPrediction(lead.funnelStatus);
                        const tier = pred ? getEffectiveTier(effective) : lead.enrichment.tier;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-lg">{effective}</span>
                            {pred && delta !== 0 && (
                              <span
                                className="text-xs font-semibold"
                                style={{ color: delta > 0 ? "#16A34A" : "#DC2626" }}
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            )}
                            {getTierBadge(tier)}
                          </div>
                        );
                      })() : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <FunnelPill status={lead.funnelStatus ?? null} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <Link href={`/leads/${lead.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open details
                            </DropdownMenuItem>
                          </Link>
                          {(lead.status === "pending" ||
                            lead.status === "failed") && (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                handleEnrich(lead.id);
                              }}
                            >
                              <Zap className="h-4 w-4 mr-2 text-primary" />
                              Enrich now
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDelete(lead.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete lead
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>

          {filteredLeads.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No leads match your current filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
