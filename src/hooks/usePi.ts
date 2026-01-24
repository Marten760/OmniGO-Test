import { useState, useEffect, useCallback } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { PaymentMetadata } from '../types';
import { toast } from 'sonner';

declare global {
  interface Window {
    Pi: any;
    piSdkInitialized?: boolean;
  }
}

export interface PiUser {
  uid: string;
  username: string;
  walletAddress?: string;
}

export const usePi = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<PiUser | null>(() => {
    try {
      const storedUser = localStorage.getItem('piUser');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error('Failed to load piUser from localStorage:', error);
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Convex actions and mutations
  const approvePaymentAction = useAction(api.paymentsActions.approvePiPayment);
  const completePiPayment = useAction(api.paymentsActions.completePiPayment);
  const reportCancelledPayment = useAction(api.paymentsActions.reportCancelledPayment);
  const handleIncompletePaymentAction = useAction(api.paymentsActions.handleIncompletePaymentAction);

  const loadPiSdk = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Ensure Pi.init() is called only once in the app's lifecycle.
      if (window.piSdkInitialized) {
        if (!isInitialized) setIsInitialized(true); // Sync local state if it gets out of sync
        resolve();
        return;
      }

      // If script tag exists but our flag is not set, it's a weird state.
      // We'll just proceed with loading a new script to be safe.
      const existingScript = document.getElementById('pi-sdk-script');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'pi-sdk-script';
      script.src = 'https://sdk.minepi.com/pi-sdk.js';
      script.async = true;
      script.onload = () => {
        if (window.Pi) {
          try {
            const isSandbox = process.env.NODE_ENV === 'development' || import.meta.env.VITE_PI_SANDBOX === 'true';
            const config: { version: string, sandbox?: boolean } = { version: "2.0" };
            if (isSandbox) config.sandbox = true;
            window.Pi.init(config);
            window.piSdkInitialized = true; // Set global flag
            setIsInitialized(true);
            resolve();
          } catch (error) {
            console.error('Pi SDK initialization error:', error);
            reject(new Error('Failed to initialize Pi SDK'));
          }
        } else {
          reject(new Error('Pi SDK failed to load: window.Pi not found.'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load Pi SDK script'));
      };
      document.body.appendChild(script);
    });
  }, [isInitialized]); // Keep dependency to sync state correctly if hook re-mounts.

  const onIncompletePaymentFound = useCallback(async (payment: any) => { // `payment` is the incomplete payment object from Pi SDK
    console.log('[usePi] Incomplete payment found:', payment.identifier);
    toast.info('Clearing previous pending payment...');
    try {
      const result = await handleIncompletePaymentAction({ paymentId: payment.identifier });
      if (result.success) {
        if (result.action === 'completed') {
          toast.success('Previous payment completed! Your order has been created.');
        } else {
          toast.success('Previous pending payment has been cleared.');
        }
      } else {
        throw new Error(result.reason || 'Failed to resolve pending payment.');
      }
    } catch (error: any) {
      console.error('[usePi] Failed to clear pending payment:', error);
      toast.error('Could not resolve the previous payment.', {
        description: error.message,
      });
    }
  }, [handleIncompletePaymentAction]);

  useEffect(() => {
    loadPiSdk().catch(err => {
      setAuthError(err.message);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [loadPiSdk]);

  // Add this useEffect to detect changes in localStorage (for reloads)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'piUser') {
        const newUser = e.newValue ? JSON.parse(e.newValue) : null;
        console.log('[usePi] localStorage piUser changed (reload?):', newUser ? newUser.uid : 'null');
        setUser(newUser);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const authenticate = useCallback(async (scopes: string[] = []): Promise<PiUser> => {
    if (!isInitialized) {
      console.error('[Pi Auth] SDK not initialized, cannot authenticate');
      throw new Error('Pi SDK is not initialized. Please wait for initialization.');
    }

    console.log('[Pi Auth] Starting direct authentication with scopes:', scopes);

    try {
      const authResult = await window.Pi.authenticate(scopes, onIncompletePaymentFound); // Pass the callback here

      // Add validation for the UID as you suggested.
      if (!authResult.user.uid || authResult.user.uid.trim() === '') {
        console.error('[Pi Auth] Invalid Pi UID received from SDK:', authResult.user.uid);
        throw new Error('Invalid Pi User ID from SDK. Please ensure your Pi account is fully verified and try again.');
      }

      const updatedUser: PiUser = {
        uid: authResult.user.uid,
        username: authResult.user.username,
        walletAddress: authResult.user.walletAddress || user?.walletAddress, // Keep old address if new one is null
      };

      console.log('[Pi Auth] Obtained walletAddress:', updatedUser.walletAddress ? `${updatedUser.walletAddress.slice(0, 8)}...` : 'null/undefined');
      if (!updatedUser.walletAddress) {
        console.warn('[Pi Auth] Wallet address not available. Ensure KYC and wallet activation in Pi App.');
        toast.warning('Wallet address not detected. Complete KYC and activate your Pi Wallet for full features.');
      }

      setUser(updatedUser);
      localStorage.setItem('piUser', JSON.stringify(updatedUser)); // Save immediately to localStorage
      console.log('[usePi] Auth success, wallet:', updatedUser.walletAddress ? 'saved' : 'still missing');

      // The original authResult is returned, but the internal state is updated.
      return authResult.user;
    } catch (error: any) {
      console.error('Pi authentication failed:', error);
      setAuthError(error.message || 'Authentication failed');
      throw error; // Re-throw the error to be caught by the caller
    }
  }, [isInitialized, user, onIncompletePaymentFound]);

  const retryAuthenticate = useCallback(async (scopes: string[] = ['username', 'payments', 'wallet_address']): Promise<PiUser> => {
    setAuthError(null);
    return authenticate(scopes);
  }, [authenticate]);

  const reauthenticateForPayment = useCallback(async (): Promise<string | null> => {
    if (!isInitialized || !user) {
      console.error("[Pi Auth] SDK not initialized or user not available for re-authentication.");
      return null;
    }
    try {
      console.log('[Pi Auth] Re-authenticating for payment...'); // Log
      // This will likely not show a popup if the user is already authenticated.
      // It will just get a fresh, short-lived access token.
      // Note: wallet_address not needed here, but included for consistency.
      const authResult = await window.Pi.authenticate(['username', 'payments', 'wallet_address'], onIncompletePaymentFound); // Also pass here
      // Update user walletAddress if changed (rare, but possible).
      if (authResult.user.walletAddress && authResult.user.walletAddress !== user.walletAddress) {
        const updatedUser = { ...user, walletAddress: authResult.user.walletAddress };
        setUser(updatedUser);
        localStorage.setItem('piUser', JSON.stringify(updatedUser));
      }
      console.log('[Pi Auth] Re-auth success, token length:', authResult.accessToken ? authResult.accessToken.length : 'null');
      return authResult.accessToken;
    } catch (error) {
      console.error("Re-authentication for payment failed:", error);
      // Optionally, inform the user that they need to re-authenticate.
      // toast.error("Authentication session expired. Please try again.");
      return null;
    }
  }, [isInitialized, user, onIncompletePaymentFound]);

  const createPayment = useCallback(async (paymentData: { amount: number; memo: string; metadata: PaymentMetadata }, callbacks: any, tokenIdentifier: string | null) => {
    if (!isInitialized) {
      throw new Error("Pi SDK is not initialized.");
    }
    if (!user) {
      throw new Error("Pi user not found. Cannot create payment.");
    }

    if (!tokenIdentifier) {
      const authError = new Error("User is not authenticated. Cannot create payment.");
      console.error(authError.message);
      callbacks.onError?.(authError);
      return;
    }

    // Get a fresh access token before creating the payment.
    const accessToken = await reauthenticateForPayment();
    if (!accessToken) {
      const authError = new Error("Could not get a valid payment session. Please try again.");
      console.error(authError.message);
      callbacks.onError?.(authError);
      return;
    }

    const enhancedCallbacks = {
      ...callbacks,
      onReadyForServerApproval: async (paymentId: string) => {
        if (!tokenIdentifier) {
          const authError = new Error("User is not authenticated. Cannot approve payment.");
          console.error(authError.message);
          callbacks.onError?.(authError, { identifier: paymentId });
          return;
        }
        try {
          await approvePaymentAction({
            tokenIdentifier,
            paymentId,
            accessToken, // Pass the fresh access token to the backend for verification.
            ...paymentData,
          });
          callbacks.onReadyForServerApproval?.(paymentId);
        } catch (error) {
          console.error("Server approval failed:", error);
          callbacks.onError?.(error instanceof Error ? error : new Error(String(error)), { identifier: paymentId });
        }
      },
      // The webhook is the single source of truth for completion.
      // This callback can be used for optimistic UI updates if needed, but should not create the order.
      onReadyForServerCompletion: async (paymentId: string, txid: string) => {        // This is now the PRIMARY way to complete the payment, providing a fast confirmation.
        console.log(`[usePi] Payment completed on client. Triggering synchronous server completion for paymentId: ${paymentId}`);
        // Remove await to fire-and-forget (polling/webhook handle UI sync)
        completePiPayment({ paymentId, txid }).catch(error => {
          console.error(`[usePi] Async completion failed for ${paymentId}:`, error);
          // No user-facing error—fallback to polling
        });
        console.log(`[usePi] Completion triggered async for ${paymentId}`);
        // We still call the original callback if it exists, for any other UI logic.
        callbacks.onReadyForServerCompletion?.(paymentId, txid);      
      },
    };


    window.Pi.createPayment(paymentData, enhancedCallbacks);
  }, [isInitialized, user, approvePaymentAction, reauthenticateForPayment, completePiPayment]);

  const signOut = useCallback(() => {
    setUser(null);
    setAuthError(null);
    try {
      localStorage.removeItem('piUser');
    } catch (error) {
      console.error('Failed to remove piUser from localStorage:', error);
    }
  }, []);

  const shareApp = useCallback((title: string, text: string) => {
    if (!isInitialized) {
      throw new Error("Pi SDK is not initialized.");
    }
    if (window.Pi.share) {
      window.Pi.share({ title, text });
    } else {
      console.warn('Pi share function not available');
    }
  }, [isInitialized]);

  return {
    isInitialized,
    user,
    isLoading,
    isAuthenticated: !!user,
    authenticate,
    retryAuthenticate,
    createPayment,
    reauthenticateForPayment,
    signOut,
    shareApp,
    authError,
  };
};