import { useState, useEffect } from 'react';
import { usePi } from '../hooks/usePi'; 
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { PaymentMetadata } from '../types';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface PiPaymentProps {
  amount: number;
  memo: string;
  metadata: PaymentMetadata; // Use the specific type instead of 'any'
  onPaymentSuccess?: (paymentId: string, txid: string) => void;
  onPaymentCancel?: (paymentId: string) => void;
  onPaymentError?: (error: Error) => void;
  disabled?: boolean;
  children: React.ReactNode;
} 

export function PiPayment({
  amount,
  memo,
  metadata,
  onPaymentSuccess,
  onPaymentCancel,
  onPaymentError,
  disabled = false,
  children,
}: PiPaymentProps) {
  const { isInitialized, user: piUser, createPayment, authenticate, isLoading: piLoading } = usePi(); // أضف authenticate و isLoading
  const { sessionToken, user: authUser } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);  // NEW: Track SDK timeout
  const [isConfirming, setIsConfirming] = useState(false);      // NEW: For optimistic confirmation UI
  
  // Polling for payment status as a fallback for webhook delays.
  const paymentStatus = useQuery(
    api.paymentsQueries.getPaymentById,
    activePaymentId ? { paymentId: activePaymentId } : "skip"
  );
  
  useEffect(() => {
    if (paymentStatus?.status === 'completed' && activePaymentId) {
      console.log(`[Polling] Payment ${activePaymentId} confirmed as completed.`);
      toast.success('Payment confirmed! Your order is being processed.');
      onPaymentSuccess?.(activePaymentId, paymentStatus.txid!);
      setActivePaymentId(null); // Stop polling
      setIsProcessing(false);
      setPaymentTimedOut(false);
      setIsConfirming(false);
    }
  }, [paymentStatus, activePaymentId, onPaymentSuccess]);

  // NEW: Timer to handle the 60s SDK timeout gracefully
  useEffect(() => {
    if (activePaymentId && !paymentTimedOut && isProcessing) {
      const timeoutId = setTimeout(() => {
        setPaymentTimedOut(true);
        setIsConfirming(true); // Start optimistic confirmation
        toast.warning('Payment submitted to blockchain. Awaiting final confirmation (may take up to 5 minutes)...');
      }, 60000); // 60 seconds
      return () => clearTimeout(timeoutId);
    }
  }, [activePaymentId, paymentTimedOut, isProcessing]);

  useEffect(() => { 
    if (!isInitialized && piUser) {  // If user exists but init failed
      console.error('[PiPayment] Pi SDK not initialized, but user exists. Check Pi Browser/Mainnet setup.');
      
      // اختياري: إعادة تحميل الصفحة إذا لزم
    }
    if (!piUser) {
      console.log('[PiPayment] No Pi user on load.'); // Log للتشخيص
    }
    if (!authUser) {
      console.log('[PiPayment] No authUser on load.'); // Log للتشخيص
    }
  }, [isInitialized, piUser, authUser]);

  // دالة مساعدة للـ re-auth تلقائي لـ Pi إذا كان authUser موجود لكن piUser لا
  const ensurePiAuthenticated = async () => { 
    if (!authUser) {
      throw new Error('Please sign in first.');
    }
    // If not authenticated with Pi at all, do a full auth request.
    if (!piUser && isInitialized && !piLoading) { 
      console.log('[PiPayment] Auto-authenticating Pi user...');
      toast.info('Connecting Pi Wallet...');
      try {
        // Request all necessary scopes at once to avoid multiple popups.
        await authenticate(['username', 'payments']);
        console.log('[PiPayment] Pi auto-auth success.');
      } catch (error) {
        console.error('[PiPayment] Pi auto-auth failed:', error);
        throw error;
      }
    }
    
  };

  const handlePayment = async () => { 
    
    try {
      // التحقق الأول: إذا لم يكن authUser، خطأ عام
      if (!authUser) {
        toast.error('Please sign in first.');
        return;
      }
      
      // إذا لم يكن piUser، حاول auto-auth
      await ensurePiAuthenticated();
      
      // الآن، يجب أن يكون piUser موجود
      if (!piUser) {
        throw new Error('Pi Wallet connection failed. Please try again.');
      }
      
      // باقي الكود كما هو...
      setIsProcessing(true);
      setPaymentTimedOut(false);
      setIsConfirming(false);
      
      await createPayment(
        {
          amount,
          memo,
          metadata: {
            ...metadata,
            timestamp: Date.now(),
          },
        },
        {
          onReadyForServerApproval: (paymentId: string) => {
            console.log('Payment ready for server approval:', paymentId);
            setActivePaymentId(paymentId); // Start polling
            toast.info('Payment approved by server. Please confirm in your wallet.');
          },
          onReadyForServerCompletion: (paymentId: string, txid: string) => {
            // Optimistic success: UI shows confirmation, but polling is the source of truth.
            console.log('Payment completed via client-side callback:', paymentId, txid);
            if (activePaymentId === paymentId) { // Ensure we don't double-fire
              setPaymentTimedOut(false); // Prevent timeout from firing
              setIsConfirming(true);     // Show "Finalizing..."
              toast.success('Payment completed! Finalizing order...');
              // Do NOT call onPaymentSuccess here; let the polling `useEffect` handle it for DB sync.
            }
          },
          onCancel: (paymentId: string) => {
            console.log('Payment cancelled:', paymentId);
            toast.info('Payment cancelled');
            onPaymentCancel?.(paymentId);
            setActivePaymentId(null); // Stop polling
            setIsProcessing(false);
            setPaymentTimedOut(false);
          },
          onError: (error: Error, payment?: any) => {
            console.error('Payment error:', error, payment);
            if (error.message.includes('pending payment') || error.message.includes('needs an action from the developer')) {
              toast.warning('Pending payment detected. Reconnecting wallet to resolve...');
              // Re-authenticate to trigger the automatic resolution flow
              authenticate([]);
              setIsProcessing(false);
              return;
            }
            if (error.message.includes('Payment Expired') || (error.message && error.message.includes("timed out"))) {
              console.log('SDK timeout, but continuing polling for blockchain confirmation.');
              setPaymentTimedOut(true);
              setIsConfirming(true);
              toast.warning("Payment timeout reached, but submitted to blockchain. We'll notify you once confirmed (up to 5 min). Don't close the page!");
              // Continue polling; do NOT set isProcessing to false.
              return;
            } else if (error.message && error.message.includes("Could not verify access token")) {
              toast.error("Cannot connect to Pi Network", { description: "Please check your internet connection and try again." });
              onPaymentError?.(error);
              setActivePaymentId(null); // Stop polling
              setIsProcessing(false);
              setPaymentTimedOut(false);
            } else {
              toast.error(error.message || 'Payment failed');
              onPaymentError?.(error);
              setActivePaymentId(null); // Stop polling
              setIsProcessing(false);
              setPaymentTimedOut(false);
            }
          },
        },
        sessionToken // Pass the session token explicitly
      );
    } catch (error) {
      console.error("Error initiating payment:", error);
      toast.error((error as Error).message || "Could not start payment process.");
      setIsProcessing(false);
    }
  };

  // Be less strict: allow payment if user exists, even if SDK is not yet initialized.
  const isButtonDisabled = disabled || isProcessing || (!isInitialized && !piUser && !authUser) || piLoading;

  return (
    <div className="space-y-2">
      <button
        onClick={handlePayment}
        disabled={isButtonDisabled || paymentTimedOut} // Disable button after timeout
        className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing 
          ? (isConfirming ? 'Finalizing...' : 'Processing...') 
          : (piLoading ? 'Connecting...' : children)
        }
      </button>
      {paymentTimedOut && (
        <p className="text-sm text-yellow-400 text-center animate-pulse">⏳ Awaiting blockchain confirmation...</p>
      )}
    </div>
  );
}