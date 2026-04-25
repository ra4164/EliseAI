import React, { useState } from "react";
import { Link } from "wouter";
import { 
  useListLeads, 
  getListLeadsQueryKey, 
  useEnrichLead, 
  useDeleteLead,
  useDeleteAllLeads,
  useSeedSampleLeads,
  useEnrichAllPendingLeads
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Zap, 
  Trash2, 
  ExternalLink,
  Filter,
  Database
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
import type { LeadStatus, LeadEnrichmentTier } from "@workspace/api-client-react";

export default function Leads() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListLeads({
    query: {
      queryKey: getListLeadsQueryKey()
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const enrichLead = useEnrichLead();
  const deleteLead = useDeleteLead();
  const enrichAll = useEnrichAllPendingLeads();
  const seedMutation = useSeedSampleLeads();
  const deleteAll = useDeleteAllLeads();

  const handleEnrich = (id: string) => {
    enrichLead.mutate({ leadId: id }, {
      onSuccess: () => {
        toast.success("Enrichment started");
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      },
      onError: (err) => {
        toast.error("Failed to enrich lead", {
          description: err instanceof Error ? err.message : "Unknown error"
        });
      }
    });
  };

  const handleDelete = (id: string) => {
    deleteLead.mutate({ leadId: id }, {
      onSuccess: () => {
        toast.success("Lead deleted");
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      },
      onError: (err) => {
        toast.error("Failed to delete lead");
      }
    });
  };

  const handleEnrichAll = () => {
    enrichAll.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`Enrichment complete: ${res.succeeded} succeeded, ${res.failed} failed.`);
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      }
    });
  };

  const handleSeed = () => {
    seedMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Sample leads loaded successfully");
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      }
    });
  };

  const leads = data?.leads || [];

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTier = tierFilter === "all" || lead.enrichment?.tier === tierFilter;
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesTier && matchesStatus;
  }).sort((a, b) => {
    const scoreA = a.enrichment?.score || 0;
    const scoreB = b.enrichment?.score || 0;
    return scoreB - scoreA;
  });

  const getTierBadge = (tier?: string) => {
    switch(tier) {
      case 'hot': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">Hot</Badge>;
      case 'warm': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Warm</Badge>;
      case 'cold': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">Cold</Badge>;
      default: return <Badge variant="outline">Unscored</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'enriched': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Enriched</Badge>;
      case 'pending': return <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">Pending</Badge>;
      case 'enriching': return <Badge variant="secondary" className="bg-primary/10 text-primary animate-pulse">Enriching...</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return null;
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage and enrich your inbound pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {leads.length > 0 && (
            <Button variant="outline" onClick={handleEnrichAll} disabled={enrichAll.isPending}>
              <Zap className={`h-4 w-4 mr-2 ${enrichAll.isPending ? 'animate-pulse' : ''}`} />
              Enrich Pending
            </Button>
          )}
          <Link href="/leads/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Leads
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
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
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg border-dashed bg-card/50">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">No leads found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Get started by adding some leads manually, or load our curated sample dataset to see EliseAI in action.
          </p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleSeed} disabled={seedMutation.isPending}>
              <Database className="h-4 w-4 mr-2" />
              Load Sample Leads
            </Button>
            <Link href="/leads/new">
              <Button>Add Leads Manually</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Lead</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                        <span className="font-semibold text-foreground">{lead.name}</span>
                        <span className="text-sm text-muted-foreground">{lead.company}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{lead.city}, {lead.state}</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(lead.status)}
                    </TableCell>
                    <TableCell>
                      {lead.status === 'enriched' ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-lg">{lead.enrichment?.score}</span>
                          {getTierBadge(lead.enrichment?.tier)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
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
                          {(lead.status === 'pending' || lead.status === 'failed') && (
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={(e) => { e.preventDefault(); handleEnrich(lead.id); }}
                            >
                              <Zap className="h-4 w-4 mr-2 text-primary" />
                              Enrich now
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:bg-destructive/10 cursor-pointer"
                            onClick={(e) => { e.preventDefault(); handleDelete(lead.id); }}
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

// Add a quick fix for missing Users icon
import { Users } from "lucide-react";
