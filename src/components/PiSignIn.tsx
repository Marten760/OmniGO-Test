import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { usePi } from "../context/PiContext";
import { toast } from "sonner";
import { Loader2, Pi, Shield, CreditCard } from "lucide-react";
import { useState, useMemo } from "react";

interface PiSignInProps {
  onLoginSuccess?: (token: string) => void;
  onAuthSuccess?: (user: { uid: string; username: string }) => void;
  onShowLegal: (view: 'privacy' | 'terms') => void;
}

export function PiSignIn({ onLoginSuccess, onAuthSuccess, onShowLegal }: PiSignInProps) {
  const {
    isInitialized,
    isLoading,
    isAuthenticated,
    authenticate,
    authError,
    retryAuthenticate,
  } = usePi();
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const currentUser = useQuery(
    api.auth.getUserFromToken,
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  );
  const piSignIn = useAction(api.auth.piSignIn);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleAuth = async () => {
    if (isSigningIn) return;
    
    const isSandbox = process.env.NODE_ENV === 'development' || import.meta.env.VITE_PI_SANDBOX === 'true';
    console.log(`[PiSignIn] Starting auth. Environment: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);

    setIsSigningIn(true);
    console.log('[PiSignIn] Attempting auth. SDK initialized?', isInitialized, 'User:', currentUser);

    // Timeout to handle cases where the Pi dialog doesn't appear or hangs
    const authTimeout = setTimeout(() => {
      setIsSigningIn(false);
      toast.error("Authentication timed out.", {
        description: "Please ensure you are in Pi Browser and have completed KYC. Try restarting the app.",
      });
    }, 20000); // 20 seconds

    authenticate(['username', 'payments', 'wallet_address'])
      .then(async (piAuthResult) => {
        clearTimeout(authTimeout); // Clear the timeout on success
        if (piAuthResult && piAuthResult.uid) {
          const result = await piSignIn({
            piUserId: piAuthResult.uid,
            piUsername: piAuthResult.username,
            walletAddress: piAuthResult.walletAddress,
          });
          if (result.success && result.tokenIdentifier) {
            onLoginSuccess?.(result.tokenIdentifier);
            onAuthSuccess?.(piAuthResult);
            toast.success(`Connected to Pi welcome @${piAuthResult.username}`);
          } else {
            toast.error("Sign-in failed after authentication. Please try again.");
          }
        }
      })
      .catch((error: any) => {
        clearTimeout(authTimeout); // Clear the timeout on error
        console.error("PiSignIn - Authentication error:", error);
        let errorMessage = error.data?.message || error.message || "An unknown error occurred.";

        if (error.message?.includes("User declined")) {
          errorMessage = "Authentication cancelled.";
        } else if (error.message?.includes("unsuccessful tunnel") || error.message?.includes("Connect")) {
          errorMessage = "Network issue. Please check your connection and try again.";
        } else if (error.message?.includes("Pi SDK is not initialized")) {
          errorMessage = "Pi SDK failed to load. Please ensure you are in Pi Browser.";
        }

        toast.error(errorMessage);
      })
      .finally(() => {
        // This will run after .then() or .catch()
        if (isSigningIn) {
          setIsSigningIn(false);
        }
      });
  };

  if (!isInitialized) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 max-w-md mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center space-x-2 text-yellow-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading Pi SDK...</span>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-yellow-400 text-sm mb-2">
              Pi Browser not detected. Please open this app in Pi Browser.
            </p>
            <button
              onClick={() => window.open("https://minepi.com/download", "_blank")}
              className="text-yellow-400 hover:text-yellow-300 text-xs underline"
            >
              Download Pi Browser
            </button>
          </div>
        )}
      </div>
    );
  }

  if (authError) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 max-w-md mx-auto text-center">
        <p className="text-red-400 text-sm mb-2">{authError}</p>
        <button
          onClick={async () => {
            setIsSigningIn(true);
            await retryAuthenticate(['username', 'payments']);
            setIsSigningIn(false);
          }}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
        >
          Retry Authentication
        </button>
      </div>
    );
  }

  // Show a loading state while Convex is verifying the user's session token
  if (currentUser === undefined && sessionToken) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 max-w-md mx-auto text-center">
        <Loader2 className="h-6 w-6 text-purple-400 animate-spin mx-auto mb-2" />
        <p className="text-gray-400 text-sm">Verifying login session... (may take a few seconds in sandbox mode)</p>
      </div>
    );
  }

  // Scenario: User is logged in and their Pi account is linked
  if (currentUser?.profile?.piUid) {
    return (
      <>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Pi size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-green-300">Pi Account Linked</p>
                <p className="text-sm text-green-400">@{currentUser.profile.piUsername}</p>
                {currentUser.profile.walletAddress && (
                  <p className="text-xs text-green-500 font-mono">
                    {currentUser.profile.walletAddress.slice(0, 8)}...
                    {currentUser.profile.walletAddress.slice(-6)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Scenario: User is not logged in, show the main sign-in form
  return (
    <>
      <div className="w-full space-y-6 max-w-md mx-auto p-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ring-purple-500/20">
            <Pi size={40} className="text-white" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white mb-2">Welcome to OmniGo</h3>
            <p className="text-gray-400 text-sm">Secure campus delivery with Pi Network</p>
          </div>
        </div>

        <button
          onClick={handleAuth}
          disabled={isLoading || !!sessionToken || isSigningIn}
          className="w-full flex items-center justify-center space-x-3 p-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
        >
          {isLoading || isSigningIn ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Pi size={24} className="text-white" />}
          <span className="text-white font-semibold text-lg">
            {isLoading ? "Initializing Pi SDK..." : isSigningIn ? "Connecting..." : "Login with Pi"}
          </span>
        </button>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h4 className="font-semibold text-gray-300 text-sm mb-3 text-center">Why Connect with Pi?</h4>
          <div className="space-y-3 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center"><Shield className="h-3 w-3 text-green-400" /></div>
              <span className="text-gray-400">Secure authentication with your Pi identity</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center"><CreditCard className="h-3 w-3 text-blue-400" /></div>
              <span className="text-gray-400">Seamless and fast payments with Pi coins</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center leading-relaxed">
          By continuing, you agree to our{" "}
          <button onClick={() => onShowLegal('terms')} className="underline hover:text-gray-300">
            Terms of Service
          </button>{" "}
          and{" "}
          <button onClick={() => onShowLegal('privacy')} className="underline hover:text-gray-300">
            Privacy Policy
          </button>.
        </p>
      </div>
    </>
  );
}