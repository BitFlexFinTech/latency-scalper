import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Setup from "./pages/Setup";
import UserSettings from "./pages/UserSettings";
import { ErrorBoundaryWrapper } from "./components/ErrorBoundary";
import { initializeAppStore, useAppStore } from "@/store/useAppStore";
import { useCrossTabSync } from "@/hooks/useCrossTabSync";

const queryClient = new QueryClient();

function AppContent() {
  // Cross-tab sync only - realtime handled by initializeAppStore (SSOT)
  useCrossTabSync();
  
  // Apply saved theme on mount
  const theme = useAppStore((s) => s.theme);
  
  useEffect(() => {
    // Remove all theme classes and data-theme attributes first
    document.documentElement.classList.remove('theme-bw', 'theme-light', 'theme-flat');
    document.documentElement.removeAttribute('data-theme');
    
    // Add the appropriate theme class
    if (theme === 'bw') {
      document.documentElement.classList.add('theme-bw');
    } else if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else if (theme === 'flat') {
      // "flat" = black background + vibrant flat colors (no glow effects)
      document.documentElement.classList.add('theme-flat');
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/settings" element={<UserSettings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => {
  // Initialize global store and realtime subscriptions on mount
  useEffect(() => {
    console.log('[App] Initializing app store and realtime subscriptions...');
    const cleanup = initializeAppStore();
    return cleanup;
  }, []);

  return (
    <ErrorBoundaryWrapper>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundaryWrapper>
  );
};

export default App;
