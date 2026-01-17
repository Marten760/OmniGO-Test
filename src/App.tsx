import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeProvider";
import { AppContent } from "./AppContent";
import { PiProvider } from "./context/PiContext";
import { useAuth } from "./hooks/useAuth";
import { usePi } from "./hooks/usePi";
import { ErrorBoundary } from "./components/ErrorBoundary";


// Initialize the client outside the component to prevent re-creation on re-renders.
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function AppWithAuth() {
  const { sessionToken, setToken } = useAuth();
  const { signOut: piSignOut } = usePi(); // Get the signOut function from our Pi hook
  const navigate = useNavigate();

  const handleLoginSuccess = (token: string) => {
    setToken(token);
  };

  const handleLogout = () => {
    piSignOut(); // Clear Pi user from state and localStorage
    setToken(null);
  };

  useEffect(() => {
    if (sessionToken) {
      convex.setAuth(async () => sessionToken);
    } else {
      // When logging out, clear the auth token.
      convex.clearAuth();
    }
  }, [sessionToken]); // This effect now correctly handles both login and logout.

  return (
    <ErrorBoundary>
      <AppContent
        sessionToken={sessionToken} 
        onLoginSuccess={handleLoginSuccess} 
        onLogout={handleLogout} 
        navigate={navigate}
      />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ConvexProvider client={convex}>
        <ThemeProvider defaultTheme="dark" storageKey="OmniGo-ui-theme">
          <AuthProvider>
            <CartProvider>
              <PiProvider>
                <AppWithAuth />
              </PiProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="top-right" />
      </ConvexProvider>
    </BrowserRouter>
  );
}