import React from "react";
import { Link, useLocation } from "wouter";
import { Zap, LayoutDashboard, Users, FileText, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEnrichAllPendingLeads, getListLeadsQueryKey, getGetLeadStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function Navbar() {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const enrichAll = useEnrichAllPendingLeads();

  const handleEnrichAll = () => {
    enrichAll.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Enrichment complete`, {
          description: `Processed ${data.processed} leads. ${data.succeeded} succeeded, ${data.failed} failed.`,
        });
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
      },
      onError: (err) => {
        toast.error("Failed to run enrichment", {
          description: err instanceof Error ? err.message : "Unknown error occurred",
        });
      },
    });
  };

  const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leads", label: "Leads", icon: Users },
    { href: "/leads/new", label: "Add Leads", icon: PlusCircle },
    { href: "/plan", label: "Plan", icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm h-14">
      <div className="flex h-full items-center justify-between px-4 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 mr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <span className="font-bold text-lg hidden sm:inline-block tracking-tight text-foreground">
              EliseAI
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
              
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={`gap-2 ${isActive ? "font-semibold bg-secondary/80" : "text-muted-foreground"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            size="sm" 
            onClick={handleEnrichAll} 
            disabled={enrichAll.isPending}
            className="gap-2 shadow-sm font-medium"
          >
            <Zap className={`h-4 w-4 ${enrichAll.isPending ? "animate-pulse" : "fill-current"}`} />
            {enrichAll.isPending ? "Enriching..." : "Run Enrichment"}
          </Button>
        </div>
      </div>
    </header>
  );
}
