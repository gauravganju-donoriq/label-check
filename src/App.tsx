import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewCheck from "./pages/NewCheck";
import Results from "./pages/Results";
import History from "./pages/History";
import ManageRules from "./pages/admin/ManageRules";
import ManageStates from "./pages/admin/ManageStates";
import RuleUpdates from "./pages/admin/RuleUpdates";
import AuditLog from "./pages/admin/AuditLog";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/new-check" element={<ProtectedRoute><NewCheck /></ProtectedRoute>} />
      <Route path="/results/:id" element={<ProtectedRoute><Results /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/admin/rules" element={<ProtectedRoute><ManageRules /></ProtectedRoute>} />
      <Route path="/admin/states" element={<ProtectedRoute><ManageStates /></ProtectedRoute>} />
      <Route path="/admin/rule-updates" element={<ProtectedRoute><RuleUpdates /></ProtectedRoute>} />
      <Route path="/admin/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
