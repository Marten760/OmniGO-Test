import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '@/hooks/useAuth';
import { usePi } from '@/hooks/usePi';
import { Id } from '../../../convex/_generated/dataModel';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface PayoutsTabContentProps {
  storeId: Id<'stores'>;
}

export function PayoutsTabContent({ storeId }: PayoutsTabContentProps) {
  const { sessionToken, user } = useAuth();
  const { authenticate } = usePi();
    const payouts = useQuery(
    api.payouts.getPayoutsByStore, 
    sessionToken ? { storeId, tokenIdentifier: sessionToken } : 'skip'
  );
  const retryPayout = useAction(api.paymentsActions.retryFailedPayout);

  const handleRetryPayout = async (payout: { orderId: Id<"orders">, amount: number }) => {
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    const promise = retryPayout({
      tokenIdentifier: sessionToken,
      storeId,
      orderId: payout.orderId,
      amount: payout.amount,
    });

    toast.promise(promise, {
      loading: 'Retrying payout...',
      success: 'Payout successfully re-initiated!',
      error: (err) => `Payout failed: ${err.message}`,
    });
  };

    const failedPayouts = payouts?.filter(p => p.status === 'failed' || p.status === 'pending');
  const linkPiAccount = useMutation(api.auth.linkPiAccount);



  if (payouts === undefined) {
    return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (payouts.length === 0) {
    return <p className="text-center text-gray-400">No payout history found.</p>;
  }

  return (
    <div className="space-y-8">
      {/* Failed Payouts Section */}
      {failedPayouts && failedPayouts.length > 0 && (
        <div>
            <h3 className="text-lg font-semibold text-yellow-400 mb-4">Action Required</h3>
          <div className="space-y-4">
            {failedPayouts.map(payout => {
              const isUidError = payout.failureReason?.includes("Pi UID");
              return (
              <Alert key={payout._id} variant={isUidError ? "default" : "destructive"} className={isUidError ? "bg-blue-900/30 border-blue-500/50" : "bg-red-900/30 border-red-500/50"}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <AlertCircle className={`h-4 w-4 mt-1 ${isUidError ? "text-blue-400" : "text-red-400"}`} />
                    <div className="ml-3">
                      <AlertTitle>{isUidError ? "Action Needed" : "Payout Failed"} on {format(payout._creationTime, 'MMM d, yyyy')}</AlertTitle>
                      <AlertDescription>
                        The payout of <strong>π{payout.amount.toFixed(4)}</strong> for order <strong>#{payout.orderId.slice(-6)}</strong> is {payout.status}.
                        <br />
                        <span className="text-xs text-gray-400">{payout.failureReason}</span>
                      </AlertDescription>
                    </div>
                  </div>
                  {isUidError ? (
                    <button 
                      onClick={async () => {
                        try {
                          const piUser = await authenticate(['username', 'payments']);
                          if (piUser.uid && sessionToken) {
                            await linkPiAccount({ tokenIdentifier: sessionToken, piUid: piUser.uid, piUsername: piUser.username, walletAddress: piUser.walletAddress });
                            toast.success("Pi Account linked! The payout will be retried automatically.");
                          }
                        } catch (error) {
                          toast.error("Failed to link Pi Account. Please try again.");
                        }
                      }} 
                      className="p-2 text-blue-300 hover:text-white hover:bg-blue-700 rounded-full transition-colors" title="Link Pi Account">
                      Link Pi Account
                    </button>
                  ) : (
                    <button onClick={() => handleRetryPayout(payout)} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full transition-colors" title="Retry Payout"><RefreshCw className="h-4 w-4" /></button>
                  )}
                </div>
              </Alert>
            )})}
          </div>
        </div>
      )}

      {/* Payout History Section */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Payout History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Date</th>
                <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Order ID</th>
                <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Amount</th>
                <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Status</th>
                <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {payouts.map(payout => (
                <tr key={payout._id}>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-400">{format(payout._creationTime, 'PPp')}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-400">#{payout.orderId.slice(-6)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-300">π{payout.amount.toFixed(4)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm">
                    {payout.status === 'completed' ? (
                      <span className="inline-flex items-center gap-x-1.5 rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400"><CheckCircle2 className="h-3 w-3" />Completed</span>
                    ) : (
                      <span className="inline-flex items-center gap-x-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400"><AlertCircle className="h-3 w-3" />Failed</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-400">
                    {payout.txid ? <a href={`https://pi-blockchain.net/tx/${payout.txid}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-purple-400 hover:text-purple-300">View <ExternalLink className="h-3 w-3" /></a> : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}