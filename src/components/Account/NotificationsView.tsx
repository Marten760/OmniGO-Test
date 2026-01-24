import { useMemo, useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { ArrowLeft, CheckCheck, Package, TicketPercent, Settings, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={`bg-gray-800 border border-gray-700 rounded-2xl ${className}`}>{children}</div>
);
const CardContent = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={className}>{children}</div>
);

function NotificationList({ notifications, icon: Icon }: { notifications: any[], icon: React.ElementType }) {
    if (notifications.length === 0) {
        return <p className="text-center text-gray-500 py-10">No notifications here.</p>;
    }
    return (
        <div className="space-y-3">
            {notifications.map(n => (
                <div key={n._id} className={`flex items-start gap-4 p-4 rounded-lg ${n.isRead ? 'bg-gray-800/50' : 'bg-gray-700'}`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${n.isRead ? 'bg-gray-700' : 'bg-purple-600/30'}`}>
                        <Icon size={16} className={n.isRead ? 'text-gray-500' : 'text-purple-400'} />
                    </div>
                    <div className="flex-1">
                        {n.storeName && (
                            <p className="text-xs font-semibold text-purple-400 mb-1">{n.storeName}</p>
                        )}
                        <p className={`text-sm ${n.isRead ? 'text-gray-400' : 'text-white'}`}>{n.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(n._creationTime).toLocaleString()}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function NotificationSettings({ onBack }: { onBack: () => void }) {
    return (
        <div className="animate-fade-in">
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-bold text-white">Notification Settings</h3>
            </div>
            <Card>
                <CardContent className="p-6 space-y-4 divide-y divide-gray-700">
                    <div className="flex items-center justify-between pt-4 first:pt-0">
                        <div>
                            <h5 className="font-medium text-white">Push Notifications</h5>
                            <p className="text-sm text-gray-400">Receive updates on your device.</p>
                        </div>
                        <Switch defaultChecked onCheckedChange={() => toast.info("Push notification settings coming soon!")} />
                    </div>
                    <div className="flex items-center justify-between pt-4 first:pt-0">
                        <div>
                            <h5 className="font-medium text-white">Order Updates</h5>
                            <p className="text-sm text-gray-400">Get notified about your order status.</p>
                        </div>
                        <Switch defaultChecked onCheckedChange={() => toast.info("Customization coming soon!")} />
                    </div>
                    <div className="flex items-center justify-between pt-4 first:pt-0">
                        <div>
                            <h5 className="font-medium text-white">Special Offers</h5>
                            <p className="text-sm text-gray-400">Receive promotions and discounts.</p>
                        </div>
                        <Switch defaultChecked onCheckedChange={() => toast.info("Customization coming soon!")} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function NotificationsView({ onBack, defaultTab = "orders" }: { onBack: () => void, defaultTab?: "orders" | "promotions" }) {
    const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
    const { results: notifications, status, loadMore } = usePaginatedQuery(
        api.notifications.getNotifications,
        sessionToken ? { tokenIdentifier: sessionToken } : "skip",
        { initialNumItems: 20 }
    );
    const markAllAsRead = useMutation(api.notifications.markAllAsRead);

    const handleMarkAllRead = () => {
        if (!sessionToken) return;
        toast.promise(markAllAsRead({ tokenIdentifier: sessionToken }), {
            loading: 'Marking all as read...',
            success: 'All notifications marked as read.',
            error: 'Failed to mark notifications.',
        });
    };

    const orderNotifications = useMemo(() => notifications?.filter(n => n.type !== 'promotion') || [], [notifications]);
    const promotionNotifications = useMemo(() => notifications?.filter(n => n.type === 'promotion') || [], [notifications]);

    const [isSettingsView, setIsSettingsView] = useState(false);

    if (isSettingsView) {
        return <NotificationSettings onBack={() => setIsSettingsView(false)} />;
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h3 className="text-xl font-bold text-white">Notifications</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleMarkAllRead} className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <CheckCheck size={16} />
                        Mark all as read
                    </button>
                    <button onClick={() => setIsSettingsView(true)} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            <Tabs defaultValue={defaultTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-gray-800/70 rounded-xl p-1 h-auto">
                    <TabsTrigger value="orders" className="rounded-lg text-gray-300 font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg">Orders</TabsTrigger>
                    <TabsTrigger value="promotions" className="rounded-lg text-gray-300 font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg">Promotions</TabsTrigger>
                </TabsList>

                <TabsContent value="orders">
                    <NotificationList notifications={orderNotifications} icon={Package} />
                </TabsContent>
                <TabsContent value="promotions">
                    <NotificationList notifications={promotionNotifications} icon={TicketPercent} />
                </TabsContent>
            </Tabs>

            {status === "CanLoadMore" && (
                <div className="flex justify-center py-4">
                    <Button variant="outline" onClick={() => loadMore(10)} className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10">
                        Load More
                    </Button>
                </div>
            )}
            {status === "LoadingMore" && (
                <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                </div>
            )}
        </div>
    );
}