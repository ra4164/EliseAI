import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/Sidebar";
import { Bell, Search } from "lucide-react";

// Pages
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import AddLeads from "@/pages/AddLeads";
import LeadDetail from "@/pages/LeadDetail";
import Outreach from "@/pages/Outreach";
import SalesData from "@/pages/SalesData";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/leads/new": "Add Leads",
  "/sales-data": "Sales Data",
  "/outreach": "Outreach",
};

function TopHeader() {
  const [location] = useLocation();
  const isLeadDetail = location.startsWith("/leads/") && location !== "/leads/new";
  const title = isLeadDetail
    ? "Lead Detail"
    : (PAGE_TITLES[location] ?? "Dashboard");

  return (
    <header
      className="flex items-center justify-between px-8 shrink-0"
      style={{
        height: "70px",
        background: "#ffffff",
        borderBottom: "1px solid #E5E0F5",
      }}
    >
      <h2 className="font-semibold text-[18px]" style={{ color: "#181819" }}>
        {title}
      </h2>
      <div className="flex items-center gap-3">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
          style={{ background: "#F4F2FF", color: "#6B7280" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#E5E0F5";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#F4F2FF";
          }}
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
          style={{ background: "#F4F2FF", color: "#6B7280" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#E5E0F5";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#F4F2FF";
          }}
        >
          <Bell className="h-4 w-4" />
          <span
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
            style={{ background: "#7638FA" }}
          />
        </button>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl font-semibold text-sm text-white shrink-0 cursor-pointer"
          style={{ background: "#7638FA" }}
        >
          R
        </div>
      </div>
    </header>
  );
}

function Router() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopHeader />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/leads" component={Leads} />
            <Route path="/leads/new" component={AddLeads} />
            <Route path="/leads/:leadId" component={LeadDetail} />
            <Route path="/sales-data" component={SalesData} />
            <Route path="/outreach" component={Outreach} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
