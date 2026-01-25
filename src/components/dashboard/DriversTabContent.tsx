import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, User, Check, X, UserX, UserCheck, Briefcase, UserPlus, MessageSquare, AlertTriangle, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

// Extend the profile type to include the generated URL from the backend
type ProfileWithImage = Doc<"userProfiles"> & { profileImageUrl: string | null };

type DriverWithProfile = Doc<"storeDrivers"> & { profile: ProfileWithImage | null; name: string; };

interface DriverCardProps {
  driver: DriverWithProfile;
  onManage: (linkId: Id<"storeDrivers">, action: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'fire') => void;
  onStartChat: (driverId: Id<"users">) => void;
  isLoading: boolean;
}

function DriverCard({ driver, onManage, onStartChat, isLoading }: DriverCardProps) {
  const { status, profile } = driver;

  // Construct the full name from the profile, falling back to the user's name
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || driver.name;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
          {/* Correctly use the profile image URL from the profile object */}
          {profile?.profileImageUrl ? (
            <img 
              src={profile.profileImageUrl} 
              alt={fullName} 
              className="w-full h-full object-cover rounded-full" 
            />
          ) : (
            <User size={24} className="text-gray-400" />
          )}
        </div>
        <div>
          <p className="font-semibold text-white">{fullName}</p>
          <p className="text-sm text-gray-400">{profile?.piUsername ? `@${profile.piUsername}` : 'No Pi username'}</p>
          {profile?.phone && (
            <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
              <Phone className="h-3 w-3" />
              <a href={`tel:${profile.phone}`} className="hover:text-purple-400 transition-colors">{profile.phone}</a>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
        <Button size="sm" variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300" onClick={() => onStartChat(driver.driverId)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Chat
        </Button>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <>
            {status === 'pending' && (
              <div className="flex gap-2 w-full">
                <Button size="sm" variant="outline" className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10" onClick={() => onManage(driver._id, 'reject')}><X className="h-4 w-4 mr-1" /> Reject</Button>
                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => onManage(driver._id, 'approve')}><Check className="h-4 w-4 mr-1" /> Approve</Button>
              </div>
            )}
            {status === 'active' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10" onClick={() => onManage(driver._id, 'deactivate')}><UserX className="h-4 w-4 mr-1" /> Deactivate</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive"><UserX className="h-4 w-4 mr-1" /> Fire</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-gray-900 border-red-500/50">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                        Fire Driver?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="mt-2 text-gray-400 pl-8">
                        Are you sure you want to permanently fire {fullName}? This will remove them from your store and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 sm:justify-end space-x-2">
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onManage(driver._id, 'fire')} className="bg-red-600 hover:bg-red-700 text-white">Yes, Fire Driver</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            {status === 'inactive' && (
              <Button size="sm" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" onClick={() => onManage(driver._id, 'reactivate')}><UserCheck className="h-4 w-4 mr-1" /> Reactivate</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, description, icon: Icon }: { title: string, description: string, icon: React.ElementType }) {
  return (
    <div className="text-center py-10 px-4 bg-gray-800/30 border-2 border-dashed border-gray-700/80 rounded-xl">
      <Icon size={32} className="mx-auto text-gray-500 mb-3" />
      <h4 className="text-md font-semibold text-white mb-1">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}


export function DriversTabContent({ store, onNavigateToChat }: { store: Doc<"stores"> & { profileImageUrl?: string | null }, onNavigateToChat: (conversationId: Id<"conversations">) => void }) {
  const { sessionToken } = useAuth();
  const drivers = useQuery(
    api.drivers.getDriversForStore,
    sessionToken ? { storeId: store._id, tokenIdentifier: sessionToken } : "skip"
  );
  const toggleRecruitment = useMutation(api.stores.toggleDriverRecruitment);
  const manageDriver = useMutation(api.drivers.manageDriverStatus);
  const findOrCreateChat = useMutation(api.chat.findOrCreateDirectConversation);
  const [loadingDriver, setLoadingDriver] = useState<Id<"storeDrivers"> | null>(null);

  const handleStartChat = async (driverId: Id<"users">) => {
    if (!sessionToken) {
      toast.error("Authentication error.");
      return;
    }
    try {
      const conversationId = await findOrCreateChat({ tokenIdentifier: sessionToken, otherUserId: driverId });
      onNavigateToChat(conversationId);
    } catch (error: any) {
      toast.error("Failed to start chat.", {
        description: error.data?.message || "An unexpected error occurred.",
      });
    }
  };

  const handleManageDriver = async (linkId: Id<"storeDrivers">, action: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'fire') => {
    if (!sessionToken) return;
    setLoadingDriver(linkId);
    try {
      await manageDriver({ tokenIdentifier: sessionToken, driverLinkId: linkId, action });
      toast.success(`Driver status updated to ${action}.`);
    } catch (error: any) {
      toast.error("Operation failed", { description: error.data?.message || error.message });
    } finally {
      setLoadingDriver(null);
    }
  };

  const handleRecruitmentToggle = async (isRecruiting: boolean) => {
    if (!sessionToken) return;
    const promise = toggleRecruitment({
      tokenIdentifier: sessionToken,
      storeId: store._id,
      isRecruiting,
    });
    toast.promise(promise, {
      loading: 'Updating status...',
      success: `Driver applications are now ${isRecruiting ? 'open' : 'closed'}.`,
      error: 'Failed to update status.',
    });
  };

  const pendingDrivers = drivers?.filter(d => d.status === 'pending') ?? [];
  const activeDrivers = drivers?.filter(d => d.status === 'active') ?? [];
  const inactiveDrivers = drivers?.filter(d => d.status === 'inactive') ?? [];

  if (drivers === undefined) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 border-gray-700/60 rounded-2xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-3 text-white"><Briefcase /> Driver Management</CardTitle>
            <div className="flex items-center space-x-3 bg-gray-900/50 border border-gray-700 rounded-full p-1 pl-3">
              <Label htmlFor="recruiting-switch" className="text-sm font-medium text-gray-300">
                Accepting Applications
              </Label>
              <Switch
                id="recruiting-switch"
                checked={!!store.isRecruitingDrivers}
                onCheckedChange={handleRecruitmentToggle}
                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-600"
              />
            </div>
          </div>
          <CardDescription className="text-gray-400 pt-1">Approve new driver applications and manage your active delivery team.</CardDescription>
        </CardHeader>
      </Card>

      {/* Pending Applications */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-yellow-400">Pending Applications ({pendingDrivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingDrivers.length > 0 ? (
            <div className="space-y-3">
              {pendingDrivers.map(driver => (
                <DriverCard key={driver._id} driver={driver} onManage={handleManageDriver} onStartChat={handleStartChat} isLoading={loadingDriver === driver._id} />
              ))}
            </div>
          ) : <EmptyState title="No Pending Applications" description="New applications from drivers will appear here." icon={UserPlus} />}
        </CardContent>
      </Card>

      {/* Active Drivers */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-green-400">Active Drivers ({activeDrivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {activeDrivers.length > 0 ? (
            <div className="space-y-3">
              {activeDrivers.map(driver => (
                <DriverCard key={driver._id} driver={driver} onManage={handleManageDriver} onStartChat={handleStartChat} isLoading={loadingDriver === driver._id} />
              ))}
            </div>
          ) : <EmptyState title="No Active Drivers" description="Approved drivers will be listed here." icon={UserCheck} />}
        </CardContent>
      </Card>

      {/* Inactive Drivers */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-500">Inactive Drivers ({inactiveDrivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {inactiveDrivers.length > 0 ? (
            <div className="space-y-3">
              {inactiveDrivers.map(driver => (
                <DriverCard key={driver._id} driver={driver} onManage={handleManageDriver} onStartChat={handleStartChat} isLoading={loadingDriver === driver._id} />
              ))}
            </div>
          ) : <EmptyState title="No Inactive Drivers" description="Deactivated drivers will be shown here." icon={UserX} />}
        </CardContent>
      </Card>
    </div>
  );
}