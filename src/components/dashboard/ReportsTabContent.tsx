import React, { useState } from 'react';
import { useQuery, useMutation, usePaginatedQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, MessageSquare, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { formatPiPrice } from '../../lib/utils';

export function ReportsTabContent({ storeId, onNavigateToChat }: { storeId: Id<"stores">, onNavigateToChat: (id: Id<"conversations">) => void }) {
  const { sessionToken } = useAuth();
  const { results: reports, status, loadMore } = usePaginatedQuery(
    api.reports.getReportsByStore,
    sessionToken ? { tokenIdentifier: sessionToken, storeId } : "skip",
    { initialNumItems: 10 }
  );
  const resolveReport = useMutation(api.reports.resolveReport);
  const findOrCreateChat = useMutation(api.chat.findOrCreateConversationForOrder);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  const handleChat = async (orderId: Id<"orders">) => {
    if (!sessionToken) return;
    try {
      const conversationId = await findOrCreateChat({ tokenIdentifier: sessionToken, orderId });
      onNavigateToChat(conversationId);
    } catch (error) {
      toast.error("Failed to open chat.");
    }
  };

  const handleResolve = async (resolution: 'refund' | 'dismiss') => {
    if (!sessionToken || !selectedReport) return;
    setIsSubmitting(true);
    try {
      await resolveReport({
        tokenIdentifier: sessionToken,
        reportId: selectedReport._id,
        resolution,
        note: resolutionNote,
      });
      toast.success(resolution === 'refund' ? "Order refunded and report resolved." : "Report dismissed and payout released.");
      setSelectedReport(null);
      setResolutionNote("");
    } catch (error) {
      toast.error("Failed to resolve report.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (reports === undefined) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="text-yellow-400" /> Disputes & Reports
          </CardTitle>
          <CardDescription className="text-gray-400">
            Manage customer reports and disputes. Open disputes hold payouts until resolved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No reports found. Great job!</div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report._id} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={report.status === 'open' ? 'destructive' : report.status === 'resolved' ? 'default' : 'secondary'}>
                          {report.status.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-400">Order #{report.orderNumber}</span>
                      </div>
                      <h4 className="font-semibold text-white">{report.reason}</h4>
                      <p className="text-sm text-gray-400">by {report.reporterName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-white">{formatPiPrice(report.orderTotal || 0)}</p>
                      <p className="text-xs text-gray-500">{new Date(report._creationTime).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="bg-gray-800 p-3 rounded-lg mb-4 text-sm text-gray-300">
                    "{report.description}"
                  </div>

                  {report.imageUrls.length > 0 && (
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                      {report.imageUrls.map((url: string, idx: number) => (
                        <div key={idx} onClick={() => setZoomedImageUrl(url)} className="flex-shrink-0 cursor-pointer">
                          <img src={url} alt="Evidence" className="h-20 w-20 object-cover rounded-lg border border-gray-700 hover:opacity-80 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}

                  {report.status === 'open' && (
                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleChat(report.orderId)} className="gap-2 w-full sm:w-auto">
                        <MessageSquare size={14} /> Chat with Customer
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)} className="w-full sm:w-auto">Resolve Dispute</Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-900 border-gray-700 text-white">
                          <DialogHeader>
                            <DialogTitle>Resolve Dispute for Order #{report.orderNumber}</DialogTitle>
                            <DialogDescription className="text-gray-400">
                              Choose an action. This will affect the order status and payout.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <textarea
                              className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-white text-sm"
                              placeholder="Add a note about the resolution..."
                              value={resolutionNote}
                              onChange={(e) => setResolutionNote(e.target.value)}
                              rows={3}
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <Button 
                                variant="destructive" 
                                onClick={() => handleResolve('refund')} 
                                disabled={isSubmitting}
                                className="flex flex-col h-auto py-4 gap-1"
                              >
                                <span className="font-bold">Accept & Refund</span>
                                <span className="text-xs opacity-80 font-normal">Return funds to customer</span>
                              </Button>
                              <Button 
                                variant="default" 
                                onClick={() => handleResolve('dismiss')} 
                                disabled={isSubmitting}
                                className="flex flex-col h-auto py-4 gap-1 bg-green-600 hover:bg-green-700"
                              >
                                <span className="font-bold">Reject & Payout</span>
                                <span className="text-xs opacity-80 font-normal">Dismiss report, release funds</span>
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                  {report.resolution && (
                    <div className="mt-2 text-xs text-gray-500 border-t border-gray-800 pt-2">
                      Resolution: {report.resolution}
                    </div>
                  )}
                </div>
              ))}
              {status === "CanLoadMore" && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={() => loadMore(10)}>Load More</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {zoomedImageUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] animate-fade-in flex items-center justify-center p-4" onClick={() => setZoomedImageUrl(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomedImageUrl} 
              alt="Zoomed evidence" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button onClick={() => setZoomedImageUrl(null)} className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}