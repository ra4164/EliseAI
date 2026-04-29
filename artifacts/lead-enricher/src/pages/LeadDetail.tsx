import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  useGetLead,
  getGetLeadQueryKey,
  useEnrichLead,
  useUpdateLead,
  getListLeadsQueryKey,
  getGetLeadStatsQueryKey,
  type FunnelStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Zap,
  MapPin,
  Building2,
  TrendingUp,
  Users,
  Copy,
  AlertCircle,
  CheckCircle2,
  Newspaper,
  Send,
  Mail,
  Check,
  Flame,
  ThermometerSun,
  ThermometerSnowflake,
  RotateCcw,
  Database,
  FileText,
  BarChart3,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

function detectNewsSignal(
  title: string,
  description: string | null,
  city: string,
  state: string,
): { label: string; color: string } | null {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  const cityL = (city ?? "").toLowerCase();
  const stateL = (state ?? "").toLowerCase();
  const isLocal = (cityL && text.includes(cityL)) || (stateL && text.includes(stateL));
  if (!isLocal) return null;
  if (/\b(fund|funding|funded|raises|raised|series [a-d]|venture|ipo|going public|backed|capital raise)\b/.test(text))
    return { label: "Funding", color: "bg-emerald-100 text-emerald-700" };
  if (/\b(hiring|hires|hired|jobs|workforce|headcount|talent|recrui)\b/.test(text))
    return { label: "Hiring", color: "bg-blue-100 text-blue-700" };
  if (/\b(layoff|layoffs|cutting|cuts|reduction|downsiz|let go|job loss)\b/.test(text))
    return { label: "Layoffs", color: "bg-red-100 text-red-700" };
  if (/\b(acqui|merger|merges|joint venture|partnership|deal)\b/.test(text))
    return { label: "Deal", color: "bg-amber-100 text-amber-700" };
  if (/\b(expan|grow|growth|opening|opens|launch|new community|new property|groundbreak|breaks ground)\b/.test(text))
    return { label: "Growth", color: "bg-purple-100 text-purple-700" };
  if (/\b(rent|rental|housing|multifamily|apartment|vacancy|demand|leasing|reit)\b/.test(text))
    return { label: "Market", color: "bg-slate-100 text-slate-600" };
  return null;
}

function buildMailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = score >= 75 ? "bg-orange-500" : score >= 50 ? "bg-yellow-400" : "bg-blue-400";
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Lead detail page showing enrichment data, score breakdown, news, outreach email editor, and funnel controls. */
export default function LeadDetail() {
  const { leadId } = useParams();
  const queryClient = useQueryClient();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [notes, setNotes] = useState<string>("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [showSentConfirm, setShowSentConfirm] = useState(false);

  const { data: lead, isLoading, isError } = useGetLead(leadId || "", {
    query: {
      enabled: !!leadId,
      queryKey: getGetLeadQueryKey(leadId || ""),
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.status === "enriching" ? 2000 : false;
      },
    },
  });

  const enrichLeadMut = useEnrichLead();
  const updateLeadMut = useUpdateLead();

  // Sync notes from server
  useEffect(() => {
    if (lead?.notes != null) setNotes(lead.notes);
  }, [lead?.notes]);

  // Sync editable email content when enrichment loads
  useEffect(() => {
    if (lead?.enrichment?.outreachEmail) {
      setEditedSubject(lead.enrichment.outreachEmail.subject);
      setEditedBody(lead.enrichment.outreachEmail.body);
    }
  }, [lead?.enrichment?.outreachEmail]);

  const handleEnrich = () => {
    if (!leadId) return;
    enrichLeadMut.mutate({ leadId }, {
      onSuccess: () => {
        toast.success("Enrichment complete");
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
      },
      onError: (err) => {
        toast.error("Enrichment failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      },
    });
  };

  const handleCopyEmail = () => {
    if (!lead?.enrichment?.outreachEmail) return;
    const text = `Subject: ${lead.enrichment.outreachEmail.subject}\n\n${lead.enrichment.outreachEmail.body}`;
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    toast.success("Email copied to clipboard");
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleApproveAndSend = () => {
    if (!lead?.enrichment?.outreachEmail || !leadId) return;
    window.location.href = buildMailtoUrl(lead.email, editedSubject, editedBody);
    setTimeout(() => setShowSentConfirm(true), 800);
  };

  const handleConfirmSent = () => {
    if (!leadId) return;
    setShowSentConfirm(false);
    updateLeadMut.mutate(
      { leadId, data: { outreachSentAt: new Date().toISOString(), funnelStatus: "contacted" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
          toast.success("Status updated to Contacted");
        },
      },
    );
  };

  const handleUnsend = () => {
    if (!leadId) return;
    updateLeadMut.mutate(
      { leadId, data: { outreachSentAt: null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          toast("Marked as unsent");
        },
      },
    );
  };

  const handleFunnelStatusChange = (val: string) => {
    if (!leadId) return;
    const funnelStatus = val === "" ? null : (val as FunnelStatus);
    updateLeadMut.mutate(
      { leadId, data: { funnelStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
        },
      },
    );
  };

  const saveNotes = useCallback(() => {
    if (!leadId) return;
    updateLeadMut.mutate(
      { leadId, data: { notes } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
          setNotesSaved(true);
          setTimeout(() => setNotesSaved(false), 2000);
        },
      },
    );
  }, [leadId, notes, updateLeadMut, queryClient]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-[1200px] mx-auto space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-24">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Lead Not Found</h2>
        <p className="text-muted-foreground mb-6">This lead may have been deleted or doesn't exist.</p>
        <Link href="/leads"><Button>Back to Leads</Button></Link>
      </div>
    );
  }

  const e = lead.enrichment;
  const isEnriched = lead.status === "enriched" && !!e;
  const isSent = !!lead.outreachSentAt;

  return (
    <div className="p-4 sm:p-8 max-w-[1200px] mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/leads">
          <Button variant="ghost" size="icon" className="rounded-full mt-1 shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{lead.name}</h1>
              {lead.status === "pending" && <Badge variant="secondary">Pending</Badge>}
              {lead.status === "enriching" && <Badge className="bg-primary/10 text-primary animate-pulse">Enriching...</Badge>}
              {lead.status === "failed" && <Badge variant="destructive">Failed</Badge>}
              {isSent && <Badge className="bg-emerald-100 text-emerald-700 gap-1 border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Outreach Sent</Badge>}
            </div>
            <div className="flex items-center gap-4 text-muted-foreground mt-1.5 flex-wrap text-sm">
              <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{lead.company}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{lead.city}, {lead.state}</span>
              <span className="border-l pl-3 border-border">Added {format(new Date(lead.createdAt), "MMM d, yyyy")}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Funnel:</span>
              <select
                value={lead.funnelStatus ?? ""}
                onChange={(e) => handleFunnelStatusChange(e.target.value)}
                disabled={updateLeadMut.isPending}
                className="text-xs font-semibold rounded-full px-2.5 py-1 border-0 outline-none cursor-pointer appearance-none transition-all"
                style={(() => {
                  const styles: Record<string, { bg: string; color: string }> = {
                    contacted: { bg: "#E8F0FE", color: "#1D4ED8" },
                    replied: { bg: "#FEF3C7", color: "#92400E" },
                    ghosted: { bg: "#FEE2E2", color: "#991B1B" },
                    call_booked: { bg: "#DCFCE7", color: "#166534" },
                    lost: { bg: "#F1F5F9", color: "#475569" },
                  };
                  const s = lead.funnelStatus ? styles[lead.funnelStatus] : null;
                  return s ? { background: s.bg, color: s.color } : { background: "#F1F5F9", color: "#64748B" };
                })()}
              >
                <option value="">— No status —</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="ghosted">Ghosted</option>
                <option value="call_booked">Call Booked</option>
                <option value="lost">Lost</option>
              </select>
              {lead.funnelStatusUpdatedAt && (
                <span className="text-xs" style={{ color: "#6B6580" }}>
                  Updated {format(new Date(lead.funnelStatusUpdatedAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isEnriched ? (
              <div className="bg-card border rounded-lg px-4 py-2.5 shadow-sm flex items-center gap-4">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Lead Score</div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black font-mono leading-none">{e.score}</span>
                    {e.tier === "hot" && <Badge className="bg-orange-100 text-orange-800 border-none"><Flame className="h-3 w-3 mr-1" />HOT</Badge>}
                    {e.tier === "warm" && <Badge className="bg-yellow-100 text-yellow-800 border-none"><ThermometerSun className="h-3 w-3 mr-1" />WARM</Badge>}
                    {e.tier === "cold" && <Badge className="bg-blue-100 text-blue-800 border-none"><ThermometerSnowflake className="h-3 w-3 mr-1" />COLD</Badge>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enrichLeadMut.isPending} className="text-xs gap-1.5">
                  <RotateCcw className={`h-3 w-3 ${enrichLeadMut.isPending ? "animate-spin" : ""}`} />
                  Re-enrich
                </Button>
              </div>
            ) : (
              <Button size="lg" onClick={handleEnrich} disabled={enrichLeadMut.isPending || lead.status === "enriching"} className="shadow-sm gap-2">
                <Zap className={`h-5 w-5 ${enrichLeadMut.isPending ? "animate-pulse" : "fill-current"}`} />
                {enrichLeadMut.isPending || lead.status === "enriching" ? "Enriching..." : "Enrich Now"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {lead.errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Enrichment failed</p>
            <p className="text-sm opacity-90">{lead.errorMessage}</p>
          </div>
        </div>
      )}

      {isEnriched && e ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
          <TabsList className="h-10 w-full justify-start rounded-none border-b bg-transparent p-0 gap-0">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-5 h-10 gap-2"
            >
              <BarChart3 className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-5 h-10 gap-2"
            >
              <Mail className="h-4 w-4" /> Draft Email
              {isSent && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-5 h-10 gap-2"
            >
              <TrendingUp className="h-4 w-4" /> Sales Insights
            </TabsTrigger>
            <TabsTrigger
              value="data"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-5 h-10 gap-2"
            >
              <Database className="h-4 w-4" /> Enriched Data
            </TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Score Breakdown</CardTitle>
                  <CardDescription>What's driving this lead's score</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-3">
                    <span className="text-5xl font-black font-mono leading-none">{e.score}</span>
                    <div className="mb-1">
                      {e.tier === "hot" && <Badge className="bg-orange-100 text-orange-800 border-none text-sm px-3"><Flame className="h-3.5 w-3.5 mr-1.5" />HOT</Badge>}
                      {e.tier === "warm" && <Badge className="bg-yellow-100 text-yellow-800 border-none text-sm px-3"><ThermometerSun className="h-3.5 w-3.5 mr-1.5" />WARM</Badge>}
                      {e.tier === "cold" && <Badge className="bg-blue-100 text-blue-800 border-none text-sm px-3"><ThermometerSnowflake className="h-3.5 w-3.5 mr-1.5" />COLD</Badge>}
                    </div>
                  </div>
                  <ScoreBar score={e.score} />
                  <Separator />
                  <ul className="space-y-2.5">
                    {e.scoreReasons.map((r, i) => (
                      <li key={i} className="text-sm flex items-start gap-2 text-muted-foreground">
                        <span className="text-primary font-bold shrink-0 mt-[-2px]">•</span>
                        <span className="leading-snug">{r}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Market Snapshot
                  </CardTitle>
                  <CardDescription>{e.census.placeName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    ["Renter Occupied", e.census.renterOccupiedPct != null ? `${e.census.renterOccupiedPct.toFixed(1)}%` : "—"],
                    ["Median Rent", e.census.medianGrossRent ? `$${e.census.medianGrossRent.toLocaleString()}` : "—"],
                    ["Median Income", e.census.medianHouseholdIncome ? `$${e.census.medianHouseholdIncome.toLocaleString()}` : "—"],
                    ["Population", e.census.totalPopulation ? e.census.totalPopulation.toLocaleString() : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-start py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {e.news && e.news.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Newspaper className="h-4 w-4" /> Recent News
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {e.news.slice(0, 4).map((item, i) => {
                    const signal = detectNewsSignal(item.title, item.description, lead.city, lead.state);
                    return (
                      <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                        <Card className="h-full transition-colors group-hover:border-primary/50">
                          <CardContent className="p-4 space-y-1.5">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.source}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(item.publishedAt), "MMM d")}</span>
                            </div>
                            <p className="font-medium text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">{item.title}</p>
                            {signal && (
                              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${signal.color}`}>
                                {signal.label}
                              </span>
                            )}
                          </CardContent>
                        </Card>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── DRAFT EMAIL ── */}
          <TabsContent value="email" className="pt-6 space-y-6">
            <Card className="border-primary/20 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <CardHeader className="pb-4 bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary fill-primary/20" />
                      Draft Outreach Email
                    </CardTitle>
                    <CardDescription>AI-generated, personalized for {lead.name} at {lead.company}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingEmail((v) => !v)}>
                      {editingEmail ? <><X className="h-4 w-4 mr-1.5" />Cancel</> : <><Pencil className="h-4 w-4 mr-1.5" />Edit</>}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopyEmail}>
                      {copiedEmail ? <Check className="h-4 w-4 mr-1.5 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1.5" />}
                      {copiedEmail ? "Copied" : "Copy"}
                    </Button>
                    {isSent ? (
                      <Button variant="outline" size="sm" onClick={handleUnsend} className="gap-1.5 text-muted-foreground">
                        <RotateCcw className="h-3.5 w-3.5" /> Unsend
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleApproveAndSend} className="gap-2 shadow-sm">
                        <Send className="h-4 w-4" />
                        Approve &amp; Send
                      </Button>
                    )}
                  </div>
                </div>
                {isSent && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-md px-3 py-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Sent on {format(new Date(lead.outreachSentAt!), "MMMM d, yyyy 'at' h:mm a")}
                  </div>
                )}
                {showSentConfirm && (
                  <div className="mt-3 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
                    <span className="text-sm font-medium text-amber-800">Did you send it?</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setShowSentConfirm(false)}>
                        No
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={handleConfirmSent}>
                        Yes — mark as contacted
                      </Button>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                {editingEmail ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Subject</label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Body</label>
                      <Textarea
                        className="w-full min-h-[280px] text-sm font-serif leading-relaxed resize-y"
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditingEmail(false)}>
                      <Check className="h-4 w-4 mr-1.5 text-emerald-500" /> Done editing
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-black border rounded-md p-6 font-serif text-base leading-relaxed shadow-sm">
                    <div className="mb-6 pb-4 border-b border-border/50">
                      <span className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-widest mr-3">To:</span>
                      <span className="text-sm text-muted-foreground">{lead.email}</span>
                    </div>
                    <div className="mb-6 pb-4 border-b border-border/50">
                      <span className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-widest mr-3">Subject:</span>
                      <span className="font-bold text-foreground">{editedSubject || e.outreachEmail.subject}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-foreground/90">{editedBody || e.outreachEmail.body}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground flex items-start gap-2 bg-muted/30 rounded-lg p-4 border">
              <Mail className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <p>
                <strong>Approve &amp; Send</strong> opens your default email client (Gmail, Outlook, Apple Mail) with To, Subject, and Body pre-filled. One click to send.
                You can also go to the <Link href="/outreach" className="text-primary underline">Outreach Queue</Link> to see all draft emails at once.
              </p>
            </div>
          </TabsContent>

          {/* ── SALES INSIGHTS ── */}
          <TabsContent value="insights" className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Sales Insights
                  </CardTitle>
                  <CardDescription>Facts a rep should know before calling</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {e.salesInsights.map((insight, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground leading-snug">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Talking Points
                  </CardTitle>
                  <CardDescription>Specific things to mention on a call</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {e.talkingPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground leading-snug">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Rep Notes
                </CardTitle>
                <CardDescription>
                  Add any custom context, CRM notes, deal stage, or info you want the AI to factor in next time you re-enrich.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Met at NMHC conference. Decision maker is the VP of Operations. Currently using Funnel CRM. Evaluating AI tools for Q3..."
                  className="min-h-[120px] resize-y font-sans text-sm"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Notes are saved per lead and will be sent to Gemini when you re-enrich.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveNotes}
                    disabled={updateLeadMut.isPending}
                    className="gap-2"
                  >
                    {notesSaved ? (
                      <><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</>
                    ) : (
                      <><FileText className="h-3.5 w-3.5" /> Save Notes</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ENRICHED DATA ── */}
          <TabsContent value="data" className="pt-6 space-y-6">
            <div>
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" /> Demographics
                  </CardTitle>
                  <CardDescription>{e.census.placeName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      ["Total Population", e.census.totalPopulation?.toLocaleString()],
                      ["Median Household Income", e.census.medianHouseholdIncome ? `$${e.census.medianHouseholdIncome.toLocaleString()}` : null],
                      ["Median Gross Rent", e.census.medianGrossRent ? `$${e.census.medianGrossRent.toLocaleString()}` : null],
                      ["Median Home Value", e.census.medianHomeValue ? `$${e.census.medianHomeValue.toLocaleString()}` : null],
                      ["Renter Occupied", e.census.renterOccupiedPct != null ? `${e.census.renterOccupiedPct.toFixed(1)}%` : null],
                      ["Bachelor's Degree+", e.census.bachelorsOrHigherPct != null ? `${e.census.bachelorsOrHigherPct.toFixed(1)}%` : null],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium">{value ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>

            {e.news && e.news.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Newspaper className="h-4 w-4" /> Recent Company News
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {e.news.map((item, i) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                      <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/20">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.source}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(item.publishedAt), "MMM d, yyyy")}</span>
                          </div>
                          <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">{item.title}</p>
                          {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                        </CardContent>
                      </Card>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground text-right">
              Enriched {format(new Date(e.enrichedAt), "MMM d, yyyy 'at' h:mm a")}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="border border-dashed rounded-xl p-12 text-center bg-card/30 flex flex-col items-center max-w-2xl mx-auto mt-8">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Ready to Enrich</h3>
          <p className="text-muted-foreground mb-2 text-balance">
            Enrichment pulls Census demographics, recent company news, and uses AI to generate a <strong>lead score</strong>, <strong>sales insights</strong>, <strong>talking points</strong>, and a <strong>personalized outreach email</strong>.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Runs automatically at <strong>9:00 AM daily</strong> — or trigger it now.
          </p>
          <Button size="lg" onClick={handleEnrich} disabled={enrichLeadMut.isPending || lead.status === "enriching"} className="w-full sm:w-auto gap-2">
            <Zap className={`h-5 w-5 ${enrichLeadMut.isPending || lead.status === "enriching" ? "animate-pulse" : "fill-current"}`} />
            {enrichLeadMut.isPending || lead.status === "enriching" ? "Enriching (takes ~15s)..." : "Enrich Now"}
          </Button>
        </div>
      )}
    </div>
  );
}
