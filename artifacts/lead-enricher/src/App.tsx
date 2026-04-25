import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/Navbar";

// Pages
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import AddLeads from "@/pages/AddLeads";
import LeadDetail from "@/pages/LeadDetail";
import Outreach from "@/pages/Outreach";
import SalesData from "@/pages/SalesData";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
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
