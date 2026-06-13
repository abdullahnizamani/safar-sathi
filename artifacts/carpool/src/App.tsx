import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";

import Layout from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Home from "@/pages/home";
import PostRide from "@/pages/post-ride";
import RideDetail from "@/pages/ride-detail";
import MyRides from "@/pages/my-rides";
import MyRequests from "@/pages/my-requests";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {!isAuthenticated ? (
        <Route path="*">
          <Redirect to="/login" />
        </Route>
      ) : (
        <Route path="*">
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/rides/new" component={PostRide} />
              <Route path="/rides/:id" component={RideDetail} />
              <Route path="/my-rides" component={MyRides} />
              <Route path="/my-requests" component={MyRequests} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/profile" component={Profile} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppContent />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
