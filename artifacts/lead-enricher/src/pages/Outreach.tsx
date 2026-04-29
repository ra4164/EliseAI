import { useState } from "react";
import {
  useListLeads,
  getListLeadsQueryKey,
  useUpdateLead,
  useUpdateAdditionalContact,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Mail,
  Send,
  CheckCircle2,
  Flame,
  ThermometerSun,
  ThermometerSnowflake,
  ExternalLink,
  RotateCcw,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Lead, AdditionalContact, FunnelStatus } from "@workspace/api-client-react";

type Tier = "hot" | "warm" | "cold";

const TIER_META: Record<
  Tier,
  { label: string; icon: React.ReactNode; hint: string; color: string }
> = {
  hot: {
    label: "Hot",
    icon: <Flame className="h-4 w-4 text-orange-500" />,
    hint: "Score ≥ 70 — Direct & urgent tone. Reference growth signals and recent news. Propose a specific demo time.",
    color: "text-orange-600",
  },
  warm: {
    label: "Warm",
    icon: <ThermometerSun className="h-4 w-4 text-yellow-500" />,
    hint: "Score 50–74 — Value-focused. Lead with market data and RMA ROI. Invite a 15-minute discovery call.",
    color: "text-yellow-600",
  },
  cold: {
    label: "Cold",
    icon: <ThermometerSnowflake className="h-4 w-4 text-blue-400" />,
    hint: "Score < 50 — Soft intro & awareness. Educational angle, no pressure. Plant the seed.",
    color: "text-blue-600",
  },
};

function buildMailtoUrl(lead: Lead, overrideEmail?: string): string {
  const to = overrideEmail ?? lead.email;
  if (!lead.enrichment?.outreachEmail) return `mailto:${to}`;
  const subject = encodeURIComponent(lead.enrichment.outreachEmail.subject);
  const body = encodeURIComponent(lead.enrichment.outreachEmail.body);
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

function AdditionalContactRow({
  lead,
  contact,
}: {
  lead: Lead;
  contact: AdditionalContact;
}) {
  const queryClient = useQueryClient();
  const updateContact = useUpdateAdditionalContact();
  const isSent = !!contact.outreachSentAt;

  const handleSend = () => {
    window.location.href = buildMailtoUrl(lead, contact.email);
    setTimeout(() => {
      updateContact.mutate(
        {
          leadId: lead.id,
          data: { email: contact.email, outreachSentAt: new Date().toISOString() },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
            toast.success(`Outreach opened for ${contact.name}`);
          },
        },
      );
    }, 1000);
  };

  const handleMarkUnsent = () => {
    updateContact.mutate(
      { leadId: lead.id, data: { email: contact.email, outreachSentAt: null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          toast("Marked as unsent");
        },
      },
    );
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-muted/30 border border-muted">
      <div className="flex items-center gap-2 min-w-0">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{contact.name}</span>
        <span className="text-xs text-muted-foreground font-mono truncate">
          {contact.email}
        </span>
        {isSent && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-[11px] px-1.5 h-5">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Sent {contact.outreachSentAt ? format(new Date(contact.outreachSentAt), "MMM d") : ""}
          </Badge>
        )}
      </div>
      <div className="shrink-0">
        {isSent ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground gap-1"
            onClick={handleMarkUnsent}
          >
            <RotateCcw className="h-3 w-3" /> Unsend
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 px-2 text-xs gap-1 bg-primary/80 hover:bg-primary text-white"
            onClick={handleSend}
            disabled={updateContact.isPending}
          >
            <Send className="h-3 w-3" />
            Send to this contact
          </Button>
        )}
      </div>
    </div>
  );
}

const FUNNEL_OPTIONS: Array<{ value: FunnelStatus | ""; label: string }> = [
  { value: "", label: "— No status —" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "ghosted", label: "Ghosted" },
  { value: "call_booked", label: "Call Booked" },
  { value: "lost", label: "Lost" },
];

const FUNNEL_PILL_STYLE: Record<string, { bg: string; color: string }> = {
  contacted: { bg: "#E8F0FE", color: "#1D4ED8" },
  replied: { bg: "#FEF3C7", color: "#92400E" },
  ghosted: { bg: "#FEE2E2", color: "#991B1B" },
  call_booked: { bg: "#DCFCE7", color: "#166534" },
  lost: { bg: "#F1F5F9", color: "#475569" },
};

function OutreachCard({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const updateLead = useUpdateLead();
  const [expanded, setExpanded] = useState(false);

  const handleFunnelChange = (val: string) => {
    const funnelStatus = val === "" ? null : (val as FunnelStatus);
    updateLead.mutate(
      { leadId: lead.id, data: { funnelStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        },
      },
    );
  };

  const isSent = !!lead.outreachSentAt;
  const email = lead.enrichment?.outreachEmail;
  const tier = (lead.enrichment?.tier ?? "cold") as Tier;
  const meta = TIER_META[tier];
  const hasAdditional = lead.additionalContacts.length > 0;

  const handleSend = () => {
    window.location.href = buildMailtoUrl(lead);
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
    <Card
      className={`transition-colors ${
        isSent ? "opacity-55 bg-muted/30" : "bg-card hover:border-primary/40"
      }`}
    >
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`flex items-center gap-1 font-mono text-sm font-bold ${meta.color}`}
              >
                {meta.icon}
                {lead.enrichment?.score} {meta.label.toUpperCase()}
              </span>
              {isSent && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Sent{" "}
                  {lead.outreachSentAt
                    ? format(new Date(lead.outreachSentAt), "MMM d")
                    : ""}
                </Badge>
              )}
              {hasAdditional && (
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Users className="h-3 w-3" />
                  {lead.additionalContacts.length + 1} contacts
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-semibold text-base text-foreground">
                {lead.name}
              </span>
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-sm text-muted-foreground">{lead.company}</span>
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-sm text-muted-foreground">
                {lead.city}, {lead.state}
              </span>
            </div>
            <div className="mt-2">
              <select
                value={lead.funnelStatus ?? ""}
                onChange={(e) => handleFunnelChange(e.target.value)}
                disabled={updateLead.isPending}
                className="text-xs font-semibold rounded-full px-2.5 py-1 border-0 outline-none cursor-pointer appearance-none transition-all"
                style={
                  lead.funnelStatus && FUNNEL_PILL_STYLE[lead.funnelStatus]
                    ? {
                        background: FUNNEL_PILL_STYLE[lead.funnelStatus]!.bg,
                        color: FUNNEL_PILL_STYLE[lead.funnelStatus]!.color,
                      }
                    : { background: "#F1F5F9", color: "#64748B" }
                }
              >
                {FUNNEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link href={`/leads/${lead.id}`}>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Details
              </Button>
            </Link>
            {isSent ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkUnsent}
                className="gap-1.5 text-muted-foreground"
              >
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
                {hasAdditional ? `Send to ${lead.name}` : "Approve & Send"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {email && (
        <CardContent className="px-5 pb-4 pt-0 space-y-3">
          <div className="bg-muted/40 rounded-md px-4 py-3 text-sm border">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Subject
              </span>
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

          {hasAdditional && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Additional contacts at this property
              </p>
              {lead.additionalContacts.map((c) => (
                <AdditionalContactRow key={c.email} lead={lead} contact={c} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function TierPanel({ leads, tier }: { leads: Lead[]; tier: Tier }) {
  const meta = TIER_META[tier];
  const unsent = leads.filter((l) => !l.outreachSentAt).length;
  const sent = leads.filter((l) => !!l.outreachSentAt).length;

  if (leads.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground border rounded-lg bg-card/30 border-dashed">
        <div className="flex justify-center mb-3 opacity-50">{meta.icon}</div>
        <p className="text-sm">No {meta.label.toLowerCase()} leads enriched yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground italic max-w-xl">{meta.hint}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{unsent} ready to send</span>
          {sent > 0 && <span className="text-emerald-600">{sent} sent</span>}
        </div>
      </div>
      <div className="space-y-3">
        {leads.map((lead) => (
          <OutreachCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

/** Outreach page listing enriched leads grouped by tier with mailto links and sent-status tracking. */
export default function Outreach() {
  const { data, isLoading } = useListLeads({
    query: { queryKey: getListLeadsQueryKey() },
  });

  const allLeads = data?.leads ?? [];
  const enrichedLeads = allLeads
    .filter((l) => l.status === "enriched" && l.enrichment)
    .sort((a, b) => (b.enrichment?.score ?? 0) - (a.enrichment?.score ?? 0));

  const hotLeads = enrichedLeads.filter((l) => l.enrichment?.tier === "hot");
  const warmLeads = enrichedLeads.filter((l) => l.enrichment?.tier === "warm");
  const coldLeads = enrichedLeads.filter((l) => l.enrichment?.tier === "cold");

  const totalUnsent = enrichedLeads.filter((l) => !l.outreachSentAt).length;

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center gap-2">
        <p className="text-sm" style={{ color: "#6B6580" }}>
          AI-drafted emails organized by tier. Opens your email client pre-filled.
        </p>
        {totalUnsent > 0 && (
          <span
            className="ml-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: "#E8F0FE", color: "#7638FA" }}
          >
            {totalUnsent} ready to send
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted" />
          ))}
        </div>
      ) : enrichedLeads.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border-2 border-dashed"
          style={{ borderColor: "#E5E0F5", background: "#ffffff" }}
        >
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 text-white" style={{ background: "#7638FA" }}>
            <Mail className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: "#181819" }}>No enriched leads yet</h3>
          <p className="text-sm mb-6 max-w-sm mt-1" style={{ color: "#6B6580" }}>
            Add leads and enrich them (or wait for the 9 AM auto-run) to generate
            draft outreach emails.
          </p>
          <Link href="/leads">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#7638FA" }}
            >
              <Plus className="h-4 w-4" />
              Go to Leads
            </button>
          </Link>
        </div>
      ) : (
        <Tabs defaultValue="hot">
          <TabsList className="mb-6 gap-1">
            <TabsTrigger value="hot" className="gap-2">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Hot
              <Badge
                variant="outline"
                className="ml-1 h-5 px-1.5 text-[11px] bg-orange-50 border-orange-200 text-orange-700"
              >
                {hotLeads.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="warm" className="gap-2">
              <ThermometerSun className="h-3.5 w-3.5 text-yellow-500" />
              Warm
              <Badge
                variant="outline"
                className="ml-1 h-5 px-1.5 text-[11px] bg-yellow-50 border-yellow-200 text-yellow-700"
              >
                {warmLeads.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="cold" className="gap-2">
              <ThermometerSnowflake className="h-3.5 w-3.5 text-blue-400" />
              Cold
              <Badge
                variant="outline"
                className="ml-1 h-5 px-1.5 text-[11px] bg-blue-50 border-blue-200 text-blue-700"
              >
                {coldLeads.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hot">
            <TierPanel leads={hotLeads} tier="hot" />
          </TabsContent>
          <TabsContent value="warm">
            <TierPanel leads={warmLeads} tier="warm" />
          </TabsContent>
          <TabsContent value="cold">
            <TierPanel leads={coldLeads} tier="cold" />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
