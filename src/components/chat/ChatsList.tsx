import React, { useState, useRef } from "react"; // أضف useRef لتتبع الضغط المطول
import { Search, Loader2, MessageSquare, Trash2, UserX, Archive, X, MoreVertical, ArrowLeft, ShieldOff, AlertTriangle } from "lucide-react"; // أضف أيقونات الأزرار
import { useQuery, useMutation } from "convex/react"; // أضف useMutation للعمليات
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../hooks/useAuth";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ChatsListProps {
  onSelectConversation: (id: Id<"conversations">) => void;
  setCurrentView: (view: string) => void;
}

export function ChatsList({ onSelectConversation, setCurrentView }: ChatsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [listView, setListView] = useState<'all' | 'archived' | 'blocked'>('all');
  const [selectionMode, setSelectionMode] = useState(false); // حالة التحديد المتعدد
  const [selectedConversations, setSelectedConversations] = useState<Set<Id<"conversations">>>(new Set()); // المحادثات المحددة
  const { sessionToken, user } = useAuth();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null); // لتتبع الضغط المطول

  const conversations = useQuery(
    api.chat.getConversations,
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  );

  const archivedConversations = useQuery(
    api.chat.getArchivedConversations,
    sessionToken && listView === 'archived' ? { tokenIdentifier: sessionToken } : "skip"
  );

  const blockedUsers = useQuery(
    api.chat.getBlockedUsers,
    sessionToken && listView === 'blocked' ? { tokenIdentifier: sessionToken } : "skip"
  );

  // Mutations الجديدة
  const deleteConversationsMutation = useMutation(api.chat.deleteConversations);
  const archiveConversationsMutation = useMutation(api.chat.archiveConversations);
  const blockUsersMutation = useMutation(api.chat.blockUsers);

  const filteredConversations = (listView === 'all' ? conversations : archivedConversations)
    ?.filter((conv): conv is NonNullable<typeof conv> => conv !== null) // Add null check
    .filter(conv =>
      conv.otherUserName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white relative">
      {/* Header with Toolbar */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        {selectionMode ? (
          // Toolbar للتحديد
          <div className="flex items-center justify-between w-full animate-fade-in-sm">
            <div className="flex items-center gap-2">
              <button onClick={() => {
                setSelectionMode(false);
                setSelectedConversations(new Set());
              }} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700">
                <X size={20} />
              </button>
              <span className="text-lg font-semibold text-white">{selectedConversations.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={async () => {
                if (!sessionToken || selectedConversations.size === 0) return;
                await archiveConversationsMutation({ tokenIdentifier: sessionToken, conversationIds: Array.from(selectedConversations) });
                setSelectionMode(false);
                setSelectedConversations(new Set());
              }} className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-gray-700" title="Archive">
                <Archive size={20} />
              </button>
              <button onClick={async () => {
                if (!sessionToken || !conversations || selectedConversations.size === 0) return;
                const userIdsToBlock = Array.from(selectedConversations).map(convId => {
                  const conv = conversations.find(c => c._id === convId);
                  return conv?.otherUserId;
                }).filter((id): id is Id<"users"> => !!id);
                if (userIdsToBlock.length > 0) {
                  await blockUsersMutation({ tokenIdentifier: sessionToken, userIds: userIdsToBlock });
                }
                setSelectionMode(false);
                setSelectedConversations(new Set());
              }} className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-gray-700" title="Block">
                <UserX size={20} />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="p-2 text-red-400 hover:text-red-300 rounded-full hover:bg-gray-700" title="Delete">
                    <Trash2 size={20} />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-900 border-red-500/50">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
                      <AlertTriangle className="h-6 w-6 text-red-400" />
                      Delete Conversation(s)?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="mt-2 text-gray-400 pl-8">
                      Are you sure you want to delete {selectedConversations.size} conversation(s)? This will permanently delete all messages and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-4 sm:justify-end space-x-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                      if (!sessionToken || selectedConversations.size === 0) return;
                      await deleteConversationsMutation({ tokenIdentifier: sessionToken, conversationIds: Array.from(selectedConversations) });
                      setSelectionMode(false);
                      setSelectedConversations(new Set());
                    }} className="bg-red-600 hover:bg-red-700 text-white">Yes, Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          // Normal Header
          <div className="flex items-center justify-between w-full">
            {listView !== 'all' ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setListView('all')} className="rounded-full">
                  <ArrowLeft size={20} />
                </Button>
                <h1 className="text-2xl font-bold text-white capitalize">{listView}</h1>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-white">Chats</h1>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-800 border-gray-700 text-white">
                <DropdownMenuItem onSelect={() => setListView('archived')} className="cursor-pointer">Archived</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setListView('blocked')} className="cursor-pointer">Blocked</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Search (only in 'all' and 'archived' views) */}
      {!selectionMode && (
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {conversations === undefined && listView === 'all' && (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        )}
        {filteredConversations && filteredConversations.length === 0 && !selectionMode && listView === 'all' && (
          <div className="text-center py-20 px-4">
            <div className="flex justify-center items-center mb-4">
              <MessageSquare className="w-12 h-12 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-white">No Conversations Yet</h3>
            <p className="text-gray-500 mt-1">Start a conversation with a store or another user.</p>
          </div>
        )}
        {filteredConversations?.map((chat) => (
          <div // Conversation Item
            key={chat._id}
            className={`flex items-center p-4 border-b border-gray-800 cursor-pointer transition-colors select-none ${
              selectedConversations.has(chat._id)
                ? 'bg-purple-600/20'
                : 'hover:bg-gray-800/50' 
            }`}
            onClick={() => {
              if (selectionMode) {
                setSelectedConversations(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(chat._id)) newSet.delete(chat._id);
                  else newSet.add(chat._id);
                  return newSet;
                });
              } else {
                onSelectConversation(chat._id);
                setCurrentView('chat');
              }
            }}
            onMouseDown={(e) => {
              longPressTimerRef.current = setTimeout(() => {
                if (selectionMode) return;
                e.preventDefault();
                setSelectionMode(true);
                setSelectedConversations(new Set([chat._id]));
              }, 500);
            }}
            onMouseUp={() => {
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            }}
            onMouseLeave={() => {
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            }}
            onTouchStart={(e) => {
              longPressTimerRef.current = setTimeout(() => {
                if (selectionMode) return;
                e.preventDefault();
                setSelectionMode(true);
                setSelectedConversations(new Set([chat._id]));
              }, 500);
            }}
            onTouchEnd={() => {
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            }}
          >
            {selectionMode && (
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 flex-shrink-0 ${selectedConversations.has(chat._id) ? 'bg-purple-600 border-purple-500' : 'border-gray-600'}`}>
                {selectedConversations.has(chat._id) && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            )}
            <img
              src={chat.otherUserAvatar || `https://ui-avatars.com/api/?name=${chat.otherUserName.replace(' ', '+')}&background=random`}
              alt={chat.otherUserName}
              className="w-12 h-12 rounded-full object-cover mr-4"
            />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold truncate">{chat.otherUserName}</h2>
                <span className="text-xs text-gray-400">
                  {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className={`text-sm line-clamp-1 ${chat.unreadCount > 0 ? 'text-white font-medium' : 'text-gray-400'}`}>
                  {chat.lastMessageSenderId === user?._id && "You: "}{chat.lastMessage}
                </p>
                {chat.unreadCount > 0 && (
                  <span className="ml-2 bg-purple-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {chat.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {listView === 'blocked' && (
          <div className="p-4 space-y-3">
            {blockedUsers === undefined && <div className="flex justify-center pt-10"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>}
            {blockedUsers && blockedUsers.length === 0 && (
              <div className="text-center py-20 px-4">
                <ShieldOff className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white">No Blocked Users</h3>
                <p className="text-gray-500 mt-1">You haven't blocked any users.</p>
              </div>
            )}
            {blockedUsers?.map(blockedUser => (
              <div key={blockedUser._id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <img src={blockedUser.avatar || `https://ui-avatars.com/api/?name=${blockedUser.name?.replace(' ', '+')}&background=random`} alt={blockedUser.name} className="w-10 h-10 rounded-full object-cover" />
                  <span className="font-semibold">{blockedUser.name}</span>
                </div>
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!sessionToken) return;
                  // This is a simplified unblock. For a better UX, you might want a dedicated `unblockUser` mutation.
                  const currentBlocked = user?.blockedUsers ?? [];
                  const newBlocked = currentBlocked.filter(id => id !== blockedUser._id);
                  await blockUsersMutation({ tokenIdentifier: sessionToken, userIds: newBlocked });
                }}>Unblock</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}