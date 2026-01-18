import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, MessageSquare } from 'lucide-react';
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
  const reports = useQuery(api.reports.getReportsByStore, sessionToken ? { tokenIdentifier: sessionToken, storeId } : "skip");
  const resolveReport = useMutation(api.reports.resolveReport);
  const getOrCreateConversation = useMutation(api.reports.getOrCreateReportConversation);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChat = async (orderId: Id<"orders">) => {
    if (!sessionToken) return;
    try {
      const conversationId = await getOrCreateConversation({ tokenIdentifier: sessionToken, orderId });
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
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img src={url} alt="Evidence" className="h-20 w-20 object-cover rounded-lg border border-gray-700 hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}

                  {report.status === 'open' && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleChat(report.orderId)} className="gap-2">
                        <MessageSquare size={14} /> Chat with Customer
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>Resolve Dispute</Button>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}