import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Mail,
  Building2,
  Plus,
  Settings,
  ChevronRight,
} from "lucide-react";
import { useListLeads, getListLeadsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

function UnsentBadge() {
  const { data } = useListLeads({ query: { queryKey: getListLeadsQueryKey() } });
  const count = (data?.leads ?? []).filter(
    (l) => l.status === "enriched" && l.enrichment && !l.outreachSentAt,
  ).length;
  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
      {count}
    </span>
  );
}

const NAV_MAIN = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/leads", label: "Leads", icon: Users, exact: false },
  { href: "/sales-data", label: "Sales Data", icon: BarChart3, exact: false },
  {
    href: "/outreach",
    label: "Outreach",
    icon: Mail,
    exact: false,
    badge: <UnsentBadge />,
  },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="flex flex-col w-[220px] shrink-0 border-r border-border bg-card h-screen sticky top-0 overflow-y-auto z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight text-foreground">RMA</span>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Lead Enricher</p>
        </div>
      </div>

      {/* Add Leads shortcut */}
      <div className="px-3 pt-4 pb-2">
        <Link href="/leads/new">
          <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            Add Leads
            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70" />
          </button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Menu
        </p>
        {NAV_MAIN.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location === item.href
            : location === item.href || location.startsWith(item.href + "/");

          return (
            <Link key={item.href} href={item.href}>
              <button
                className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {item.label}
                {item.badge}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 border-t border-border mt-auto shrink-0">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground font-medium transition-all">
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </button>
        <div className="mt-3 px-3">
          <p className="text-[10px] text-muted-foreground">RMA Lead Enricher</p>
          <p className="text-[10px] text-muted-foreground/60">Internal Sales Tool</p>
        </div>
      </div>
    </aside>
  );
}
