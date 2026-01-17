import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Bell, CheckCheck, Package, Truck, Megaphone, ShoppingCart } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Id, Doc } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';

export function NotificationBell() {
  const getNotificationIcon = (type: Doc<"notifications">["type"]) => {
    switch (type) {
      case 'new_order':
        return <ShoppingCart className="h-4 w-4 text-purple-400" />;
      case "status_update":
        return <Truck className="h-4 w-4 text-blue-400" />;
      case "promotion":
        return <Megaphone className="h-4 w-4 text-yellow-400" />;
      default:
        return <Bell className="h-4 w-4 text-gray-400" />;
    }
  };

  const { sessionToken } = useAuth();
  const notifications = useQuery(api.notifications.getUnreadNotifications, 
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  );
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const markAsRead = useMutation(api.notifications.markAsRead);

  const handleMarkAllAsRead = async () => {
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    try {
      await markAllAsRead({ tokenIdentifier: sessionToken });
      toast.success('All notifications marked as read.');
    } catch (error) {
      toast.error('Failed to mark notifications as read.');
    }
  };

  const handleNotificationClick = async (notificationId: Id<"notifications">) => {
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    try {
      await markAsRead({ notificationId, tokenIdentifier: sessionToken });
      // You can add navigation to the specific order page here
      toast.info('Notification marked as read.');
    } catch (error) {
      toast.error('Failed to mark notification as read.');
    }
  };

  const notificationCount = notifications?.length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {notificationCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-gray-800/90 backdrop-blur-sm border-gray-700 text-gray-200">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {notificationCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="h-auto p-1 text-xs text-purple-400 hover:bg-purple-500/10 hover:text-purple-300">
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications && notifications.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notif) => (
              <DropdownMenuItem key={notif._id} className="cursor-pointer flex items-start gap-3 p-3 whitespace-normal focus:bg-gray-700/80" onClick={() => handleNotificationClick(notif._id)}>
                <div className="w-8 h-8 rounded-full bg-gray-900/50 flex-shrink-0 flex items-center justify-center mt-1 border border-gray-700">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-100">{notif.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(notif._creationTime, { addSuffix: true })}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">No new notifications</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}