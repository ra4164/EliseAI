import React from "react";
import { useParams, Link } from "wouter";
import { 
  useGetLead, 
  getGetLeadQueryKey, 
  useEnrichLead,
  getListLeadsQueryKey,
  getGetLeadStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ChevronLeft, 
  Zap, 
  MapPin, 
  Building2, 
  TrendingUp,
  Briefcase,
  Users,
  Copy,
  AlertCircle,
  CheckCircle2,
  Newspaper,
  Train,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function LeadDetail() {
  const { leadId } = useParams();
  const queryClient = useQueryClient();
  const [copied, setCopied] = React.useState(false);

  const { data: lead, isLoading, isError } = useGetLead(leadId || "", {
    query: {
      enabled: !!leadId,
      queryKey: getGetLeadQueryKey(leadId || "")
    }
  });

  const enrichLead = useEnrichLead();

  const handleEnrich = () => {
    if (!leadId) return;
    enrichLead.mutate({ leadId }, {
      onSuccess: () => {
        toast.success("Enrichment complete");
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
      },
      onError: (err) => {
        toast.error("Enrichment failed", {
          description: err instanceof Error ? err.message : "Unknown error"
        });
      }
    });
  };

  const copyEmail = () => {
    if (!lead?.enrichment?.outreachEmail) return;
    const text = `Subject: ${lead.enrichment.outreachEmail.subject}\n\n${lead.enrichment.outreachEmail.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Email copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-[1200px] mx-auto space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-24">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Lead Not Found</h2>
        <p className="text-muted-foreground mb-6">This lead may have been deleted or doesn't exist.</p>
        <Link href="/leads">
          <Button>Back to Leads</Button>
        </Link>
      </div>
    );
  }

  const e = lead.enrichment!;
  const isEnriched = lead.status === "enriched" && !!lead.enrichment;

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-8 pb-24">
      <div className="flex items-start gap-4">
        <Link href="/leads">
          <Button variant="ghost" size="icon" className="rounded-full mt-1 shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-bold tracking-tight">{lead.name}</h1>
              {lead.status === 'pending' && <Badge variant="secondary">Pending</Badge>}
              {lead.status === 'enriching' && <Badge className="bg-primary/10 text-primary animate-pulse">Enriching...</Badge>}
              {lead.status === 'failed' && <Badge variant="destructive">Failed</Badge>}
            </div>
            <div className="flex items-center gap-4 text-muted-foreground mt-2 flex-wrap">
              <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {lead.company}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {lead.city}, {lead.state}</span>
              <span className="text-sm border-l pl-4 border-border ml-2">Added {format(new Date(lead.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {isEnriched ? (
              <div className="flex flex-col items-end bg-card p-3 rounded-lg border shadow-sm min-w-[140px]">
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Lead Score</div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black font-mono leading-none tracking-tighter">{e.score}</span>
                  {e.tier === 'hot' && <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-none text-sm px-2">HOT</Badge>}
                  {e.tier === 'warm' && <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-none text-sm px-2">WARM</Badge>}
                  {e.tier === 'cold' && <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-none text-sm px-2">COLD</Badge>}
                </div>
              </div>
            ) : (
              <Button 
                size="lg" 
                onClick={handleEnrich} 
                disabled={enrichLead.isPending || lead.status === 'enriching'}
                className="shadow-sm"
              >
                <Zap className={`mr-2 h-5 w-5 ${enrichLead.isPending || lead.status === 'enriching' ? 'animate-pulse' : 'fill-current'}`} />
                {enrichLead.isPending || lead.status === 'enriching' ? "Enriching..." : "Enrich Lead Now"}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Outreach Email */}
            <Card className="border-primary/20 shadow-md overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <CardHeader className="pb-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary fill-primary/20" />
                      Draft Outreach
                    </CardTitle>
                    <CardDescription>AI-generated personalized email</CardDescription>
                  </div>
                  <Button variant="secondary" onClick={copyEmail} size="sm" className="font-medium">
                    {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? "Copied" : "Copy Email"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="bg-white dark:bg-black border rounded-md p-6 font-serif text-base leading-relaxed shadow-sm">
                  <div className="mb-6 pb-4 border-b border-border/50">
                    <span className="text-sm font-sans font-semibold text-muted-foreground uppercase tracking-widest mr-3">Subject:</span>
                    <span className="font-bold text-foreground">{e.outreachEmail.subject}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-foreground/90">{e.outreachEmail.body}</div>
                </div>
              </CardContent>
            </Card>

            {/* Strategy & Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sales Insights</CardTitle>
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
                  <CardTitle className="text-lg">Talking Points</CardTitle>
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

            {/* Recent News */}
            {e.news && e.news.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Newspaper className="h-5 w-5" /> Recent Company News
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {e.news.map((item, i) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                      <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/20">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.source}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(item.publishedAt), 'MMM d, yyyy')}</span>
                          </div>
                          <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">{item.title}</p>
                        </CardContent>
                      </Card>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / Context */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Score Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {e.scoreReasons.map((reason, i) => (
                    <li key={i} className="text-sm flex items-start gap-2 text-muted-foreground border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <span className="text-primary font-bold mt-[-2px]">•</span>
                      <span className="leading-tight">{reason}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location Context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Walk Score</span>
                    <span className="text-sm font-bold">{e.walkScore.walk || 'N/A'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.walkScore.walkDescription}</p>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Transit Score</span>
                    <span className="text-sm font-bold">{e.walkScore.transit || 'N/A'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.walkScore.transitDescription}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4" /> Demographics
                </CardTitle>
                <CardDescription>{e.census.placeName}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">Population</span>
                    <span className="text-sm font-medium">{e.census.totalPopulation?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">Median Income</span>
                    <span className="text-sm font-medium">${e.census.medianHouseholdIncome?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">Median Rent</span>
                    <span className="text-sm font-medium">${e.census.medianGrossRent?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">Renter Occupied</span>
                    <span className="text-sm font-medium">{e.census.renterOccupiedPct?.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">Bachelor's+</span>
                    <span className="text-sm font-medium">{e.census.bachelorsOrHigherPct?.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="border border-dashed rounded-xl p-12 text-center bg-card/30 flex flex-col items-center max-w-2xl mx-auto mt-12">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Ready to Enrich</h3>
          <p className="text-muted-foreground mb-2 text-balance">
            Enrichment pulls Census demographics, WalkScore, recent company news, and uses AI to generate a <strong>lead score</strong>, <strong>sales insights</strong>, <strong>talking points</strong>, and a <strong>personalized outreach email</strong>.
          </p>
          <p className="text-muted-foreground mb-8 text-sm">
            This will run automatically at <strong>9:00 AM daily</strong> — or trigger it now.
          </p>
          <Button 
            size="lg" 
            onClick={handleEnrich} 
            disabled={enrichLead.isPending || lead.status === 'enriching'}
            className="w-full sm:w-auto"
          >
            <Zap className={`mr-2 h-5 w-5 ${enrichLead.isPending || lead.status === 'enriching' ? 'animate-pulse' : 'fill-current'}`} />
            {enrichLead.isPending || lead.status === 'enriching' ? "Enriching (takes ~15s)..." : "Enrich Now"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Quick fix for missing database icon
import { Database } from "lucide-react";
