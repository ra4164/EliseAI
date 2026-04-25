import { useState } from "react";
import {
  useListLeads,
  getListLeadsQueryKey,
  useUpdateLead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Mail,
  Send,
  CheckCircle2,
  Clock,
  Flame,
  ThermometerSun,
  ThermometerSnowflake,
  ExternalLink,
  RotateCcw,
  Plus,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Lead } from "@workspace/api-client-react";

type FilterMode = "all" | "ready" | "sent";

function TierIcon({ tier }: { tier?: string }) {
  if (tier === "hot") return <Flame className="h-4 w-4 text-orange-500" />;
  if (tier === "warm") return <ThermometerSun className="h-4 w-4 text-yellow-500" />;
  return <ThermometerSnowflake className="h-4 w-4 text-blue-400" />;
}

function TierBadge({ tier, score }: { tier?: string; score?: number }) {
  const base = "flex items-center gap-1.5 font-mono text-sm font-bold px-2 py-0.5 rounded border";
  if (tier === "hot") return <span className={`${base} bg-orange-50 text-orange-700 border-orange-200`}><TierIcon tier={tier} />{score} HOT</span>;
  if (tier === "warm") return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}><TierIcon tier={tier} />{score} WARM</span>;
  return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}><TierIcon tier={tier} />{score} COLD</span>;
}

function buildMailtoUrl(lead: Lead): string {
  if (!lead.enrichment?.outreachEmail) return `mailto:${lead.email}`;
  const subject = encodeURIComponent(lead.enrichment.outreachEmail.subject);
  const body = encodeURIComponent(lead.enrichment.outreachEmail.body);
  return `mailto:${lead.email}?subject=${subject}&body=${body}`;
}

function OutreachCard({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const updateLead = useUpdateLead();
  const [expanded, setExpanded] = useState(false);

  const isSent = !!lead.outreachSentAt;
  const email = lead.enrichment?.outreachEmail;

  const handleSend = () => {
    window.location.href = buildMailtoUrl(lead);
    // After opening the email client, mark as sent
    setTimeout(() => {
      updateLead.mutate(
        { leadId: lead.id, data: { outreachSentAt: new Date().toISOString() } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
            toast.success(`Outreach opened for ${lead.name}`);
          },
        },
      );
    }, 1000);
  };

  const handleMarkUnsent = () => {
    updateLead.mutate(
      { leadId: lead.id, data: { outreachSentAt: null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          toast("Marked as unsent");
        },
      },
    );
  };

  return (
    <Card className={`transition-colors ${isSent ? "opacity-60 bg-muted/30" : "bg-card hover:border-primary/40"}`}>
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <TierBadge tier={lead.enrichment?.tier} score={lead.enrichment?.score} />
              {isSent && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Sent {lead.outreachSentAt ? format(new Date(lead.outreachSentAt), "MMM d") : ""}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-semibold text-base text-foreground truncate">{lead.name}</span>
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-sm text-muted-foreground truncate">{lead.company}</span>
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-sm text-muted-foreground">{lead.city}, {lead.state}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link href={`/leads/${lead.id}`}>
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Details
              </Button>
            </Link>
            {isSent ? (
              <Button variant="ghost" size="sm" onClick={handleMarkUnsent} className="gap-1.5 text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Unsend
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={updateLead.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 shadow-sm"
              >
                <Send className="h-4 w-4" />
                Approve &amp; Send
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {email && (
        <CardContent className="px-5 pb-4 pt-0 space-y-3">
          <div className="bg-muted/40 rounded-md px-4 py-3 text-sm border">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Subject</span>
              <span className="font-semibold text-foreground">{email.subject}</span>
            </div>
            <p className="text-muted-foreground leading-relaxed line-clamp-2">
              {email.body.split("\n").filter(Boolean)[1] || email.body.slice(0, 200)}
            </p>
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-primary hover:underline"
          >
            {expanded ? "Hide full email ↑" : "Preview full email ↓"}
          </button>
          {expanded && (
            <div className="bg-white dark:bg-black border rounded-md px-5 py-4 font-serif text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {email.body}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function Outreach() {
  const { data, isLoading } = useListLeads({
    query: { queryKey: getListLeadsQueryKey() },
  });
  const [filter, setFilter] = useState<FilterMode>("all");

  const allLeads = data?.leads ?? [];
  const enrichedLeads = allLeads
    .filter((l) => l.status === "enriched" && l.enrichment)
    .sort((a, b) => (b.enrichment?.score ?? 0) - (a.enrichment?.score ?? 0));

  const readyCount = enrichedLeads.filter((l) => !l.outreachSentAt).length;
  const sentCount = enrichedLeads.filter((l) => !!l.outreachSentAt).length;

  const visibleLeads =
    filter === "ready"
      ? enrichedLeads.filter((l) => !l.outreachSentAt)
      : filter === "sent"
      ? enrichedLeads.filter((l) => !!l.outreachSentAt)
      : enrichedLeads;

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Outreach Queue</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            AI-drafted emails ready to approve and send. Opens your email client pre-filled.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center py-4">
          <div className="text-2xl font-bold">{enrichedLeads.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Enriched</div>
        </Card>
        <Card className="text-center py-4 border-primary/30 bg-primary/5">
          <div className="text-2xl font-bold text-primary">{readyCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> Ready to Send
          </div>
        </Card>
        <Card className="text-center py-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <div className="text-2xl font-bold text-emerald-600">{sentCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Sent
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(["all", "ready", "sent"] as FilterMode[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f === "all" ? "All" : f === "ready" ? `Ready (${readyCount})` : `Sent (${sentCount})`}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted" />
          ))}
        </div>
      ) : enrichedLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg border-dashed bg-card/50">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Mail className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">No enriched leads yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Add leads and enrich them (or wait for the 9 AM auto-run) to generate draft outreach emails.
          </p>
          <Link href="/leads/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Leads
            </Button>
          </Link>
        </div>
      ) : visibleLeads.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card/30">
          {filter === "sent" ? "No emails sent yet." : "No emails in this category."}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleLeads.map((lead) => (
            <OutreachCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
