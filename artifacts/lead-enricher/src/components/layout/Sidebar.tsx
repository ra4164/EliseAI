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

function UnsentBadge() {
  const { data } = useListLeads({ query: { queryKey: getListLeadsQueryKey() } });
  const count = (data?.leads ?? []).filter(
    (l) => l.status === "enriched" && l.enrichment && !l.outreachSentAt,
  ).length;
  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#4880FF] text-[10px] font-bold text-white px-1">
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
    <aside
      className="flex flex-col w-[260px] shrink-0 h-screen sticky top-0 overflow-y-auto z-30"
      style={{ background: "#202224" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-[70px] shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: "#4880FF" }}
        >
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <span className="font-bold text-[15px] text-white tracking-tight">EliseAI</span>
          <p className="text-[11px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Lead Enricher</p>
        </div>
      </div>

      {/* Add Leads shortcut */}
      <div className="px-4 pt-5 pb-2">
        <Link href="/leads/new">
          <button
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "#4880FF" }}
          >
            <Plus className="h-4 w-4" />
            Add Leads
            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70" />
          </button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-0.5">
        <p
          className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
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
                className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "text-white font-semibold" : "hover:opacity-90"
                }`}
                style={
                  isActive
                    ? { background: "#4880FF", color: "#ffffff" }
                    : { color: "rgba(255,255,255,0.6)" }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)";
                  }
                }}
              >
                <Icon
                  className="h-[18px] w-[18px] shrink-0"
                  style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.6)" }}
                />
                {item.label}
                {item.badge}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-4 pb-5 pt-3 mt-auto shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: "rgba(255,255,255,0.6)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)";
          }}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" style={{ color: "rgba(255,255,255,0.6)" }} />
          Settings
        </button>
        <div className="mt-3 px-3 flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-white text-[11px] font-bold shrink-0"
            style={{ background: "#4880FF" }}
          >
            R
          </div>
          <div>
            <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>Rupa</p>
            <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>GTM Engineer · EliseAI</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
