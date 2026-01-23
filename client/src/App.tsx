import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Contracts from "./pages/Contracts";
import ContractDetail from "./pages/ContractDetail";
import Payments from "./pages/Payments";
import TaxSchedule from "./pages/TaxSchedule";
import Documentation from "./pages/Documentation";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/contracts"} component={Contracts} />
      <Route path={"/contracts/:id"} component={ContractDetail} />
      <Route path={"/payments"} component={Payments} />
      <Route path={"/tax-schedule"} component={TaxSchedule} />
      <Route path={"/documentation"} component={Documentation} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
