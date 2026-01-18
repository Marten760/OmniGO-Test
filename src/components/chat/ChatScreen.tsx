import React, { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft, Send, Paperclip, Loader2, MessageSquareReply, X, Trash2, Pencil, AlertTriangle, Copy, Image as ImageIcon, Video, FileText } from "lucide-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { motion, useAnimation } from "framer-motion";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../hooks/useAuth";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
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

interface ChatScreenProps {
  conversationId: Id<"conversations">;
  onBack: () => void;
}

export function ChatScreen({ conversationId, onBack }: ChatScreenProps) {
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<Doc<"messages"> | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<Id<"messages">>>(new Set());
  const [editingMessage, setEditingMessage] = useState<Doc<"messages"> | null>(null);
  const [imagesToSend, setImagesToSend] = useState<File[]>([]);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const { sessionToken, user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controls = useAnimation();

  const messages = useQuery(
    api.chat.getMessages,
    sessionToken ? { tokenIdentifier: sessionToken, conversationId } : "skip"
  );

  const conversationDetails = useQuery(
    api.chat.getConversationDetails,
    sessionToken ? { tokenIdentifier: sessionToken, conversationId } : "skip"
  );
  const sendMessage = useMutation(api.chat.sendMessage);
  const markAsRead = useMutation(api.chat.markAsRead);
  const updateTypingStatus = useMutation(api.chat.updateTypingStatus);
  const editMessageMutation = useMutation(api.chat.editMessage);
  const deleteMessagesMutation = useMutation(api.chat.deleteMessages);
  const generateUploadUrl = useMutation(api.stores.generateUploadUrl);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (sessionToken) {
      markAsRead({ tokenIdentifier: sessionToken, conversationId });
    }
  }, [sessionToken, conversationId, markAsRead, messages?.length]);

  // Reset selection when leaving the chat screen
  useEffect(() => {
    return () => {
      setSelectionMode(false);
      setSelectedMessages(new Set());
    };
  }, [conversationId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    if (!sessionToken) return;

    // User starts typing
    if (!typingTimeoutRef.current) {
      updateTypingStatus({ tokenIdentifier: sessionToken, conversationId, typing: true });
    } else {
      clearTimeout(typingTimeoutRef.current);
    }

    // User stops typing
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus({ tokenIdentifier: sessionToken, conversationId, typing: false });
      typingTimeoutRef.current = null;
    }, 2000); // 2 seconds timeout
  };

  const isOtherUserTyping = useMemo(() => {
    const typingStatus = conversationDetails?.typingStatus;
    const otherUserId = conversationDetails?.otherUserId;
    if (!typingStatus || !otherUserId) return false;

    const otherUserTimestamp = typingStatus[otherUserId];
    // Check if the timestamp is recent (e.g., within the last 5 seconds)
    return otherUserTimestamp && Date.now() - otherUserTimestamp < 5000;
  }, [conversationDetails]);

  const onlineStatusText = useMemo(() => {
    if (isOtherUserTyping) {
      return <span className="text-xs text-purple-400 animate-pulse">is typing...</span>;
    }
    if (conversationDetails?.isOnline) {
      return <span className="text-xs text-green-400">Online</span>;
    }
    if (conversationDetails?.lastSeen) {
      return <span className="text-xs text-gray-400">Last seen {formatDistanceToNow(new Date(conversationDetails.lastSeen), { addSuffix: true })}</span>;
    }
    return <span className="text-xs text-gray-500">Offline</span>;
  }, [isOtherUserTyping, conversationDetails]);

  const handleSend = async () => {
    if ((!input.trim() && imagesToSend.length === 0) || !sessionToken) return;
    
    const text = input;
    const repliedToMessageId = replyingTo?._id;

    // Optimistically clear inputs
    setInput("");
    setReplyingTo(null); // Reset reply state immediately
    setEditingMessage(null); // Reset editing state
    const tempImageFiles = imagesToSend;
    setImagesToSend([]);

    try {
      if (editingMessage) {
        await editMessageMutation({ tokenIdentifier: sessionToken, messageId: editingMessage._id, newText: text });
      } else if (tempImageFiles.length > 0) {
        // 1. Upload all images in parallel
        const imageIds = await Promise.all(tempImageFiles.map(async (file) => {
          const uploadUrl = await generateUploadUrl();
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          const { storageId } = await result.json();
          return storageId;
        }));
        // 2. Send one message with all imageIds
        await sendMessage({
          tokenIdentifier: sessionToken,
          conversationId,
          text: text || "", // Use caption or empty string
          imageIds: imageIds,
          repliedToMessageId,
        });
      } else {
        await sendMessage({ tokenIdentifier: sessionToken, conversationId, text, repliedToMessageId });
      }
    } catch (error) {
      toast.error("Failed to send message.");
      setInput(text); // Restore input on failure
      setImagesToSend(tempImageFiles); // Restore images on failure
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Message copied to clipboard!");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center gap-4 p-3 bg-gray-800/80 backdrop-blur-md border-b border-gray-700 flex-shrink-0 z-10">
        {selectionMode ? (
          <div className="flex items-center justify-between w-full animate-fade-in-sm">
            <div className="flex items-center gap-2">
              <button onClick={() => {
                setSelectionMode(false);
                setSelectedMessages(new Set());
              }} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700">
                <X size={20} />
              </button>
              <span className="text-lg font-semibold text-white">{selectedMessages.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
            {selectedMessages.size === 1 && (
                <button onClick={() => {
                  const msgToCopy = messages?.find(m => m._id === Array.from(selectedMessages)[0]);
                  if (msgToCopy) {
                    handleCopyToClipboard(msgToCopy.text)
                  }
                }} className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-gray-700" title="Copy"><Copy size={20} /></button>
              )}

              {selectedMessages.size === 1 && (
                <button onClick={() => {
                  const msgToEdit = messages?.find(m => m._id === Array.from(selectedMessages)[0]);
                  if (msgToEdit) {
                    setEditingMessage(msgToEdit);
                    setInput(msgToEdit.text);
                    setSelectionMode(false);
                    setSelectedMessages(new Set());
                    textareaRef.current?.focus();
                  }
                }} className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-gray-700" title="Edit">
                  <Pencil size={20} />
                </button>
              )}
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
                      Delete Message(s)?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="mt-2 text-gray-400 pl-8">
                      Are you sure you want to delete {selectedMessages.size} message(s)? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-4 sm:justify-end space-x-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                      if (!sessionToken || selectedMessages.size === 0) return;
                      const promise = deleteMessagesMutation({ tokenIdentifier: sessionToken, messageIds: Array.from(selectedMessages) });
                      toast.promise(promise, {
                        loading: "Deleting...",
                        success: "Message(s) deleted.",
                        error: "Failed to delete.",
                      });
                      setSelectionMode(false);
                      setSelectedMessages(new Set());
                    }} className="bg-red-600 hover:bg-red-700 text-white">Yes, Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <>
            <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700">
              <ArrowLeft />
            </button>
            {conversationDetails === undefined ? (
              <div className="w-10 h-10 bg-gray-700 rounded-full animate-pulse"></div>
            ) : (
              <img
                src={conversationDetails?.otherUserAvatar || `https://ui-avatars.com/api/?name=${conversationDetails?.otherUserName.replace(' ', '+')}&background=random`}
                alt={conversationDetails?.otherUserName || "Chat Partner"}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <h2 className="font-semibold">{conversationDetails?.otherUserName || "Chat Partner"}</h2>
              {onlineStatusText}
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages === undefined && <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>}
        {messages?.map((msg) => {
          const isSelected = selectedMessages.has(msg._id);
          const handlePress = () => {
            if (!selectionMode) {
              setSelectionMode(true);
              setSelectedMessages(new Set([msg._id]));
            }
          };
          const handleClick = () => {
            if (selectionMode) {
              setSelectedMessages(prev => {
                const newSet = new Set(prev);
                if (newSet.has(msg._id)) {
                  newSet.delete(msg._id);
                  if (newSet.size === 0) setSelectionMode(false);
                } else {
                  newSet.add(msg._id);
                }
                return newSet;
              });
            }
          };

          return (
            <div
              key={msg._id}
              className={`flex w-full select-none ${msg.senderId === user?._id ? "justify-end" : "justify-start"}`}
              onClick={handleClick}
              onMouseDown={(e) => { longPressTimerRef.current = setTimeout(() => { e.preventDefault(); handlePress(); }, 500); }}
              onMouseUp={() => clearTimeout(longPressTimerRef.current!)}
              onMouseLeave={() => clearTimeout(longPressTimerRef.current!)}
              onTouchStart={(e) => { longPressTimerRef.current = setTimeout(() => { e.preventDefault(); handlePress(); }, 500); }}
              onTouchEnd={() => clearTimeout(longPressTimerRef.current!)}
            >
              <motion.div
                drag={!selectionMode ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}                
                onDragEnd={(event, info) => {
                  if (!selectionMode && info.offset.x > 50) { // Swipe right to reply
                    setReplyingTo(msg);
                    controls.start({ x: 0 }); // Reset position after drag
                  }
                }}
                animate={controls}                
                className="relative w-full"
              >
                <div className={`flex items-end gap-2 ${msg.senderId === user?._id ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`max-w-xs md:max-w-md px-4 py-2.5 rounded-2xl ${
                    msg.senderId === user?._id
                      ? "bg-purple-600 text-white rounded-br-none"
                      : "bg-gray-700 text-gray-200 rounded-bl-none"
                  } ${isSelected ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900' : ''} transition-all duration-200`}>
                    {/* Render replied-to message snippet */}
                    {msg.repliedToMessageText && (
                      <div className="border-l-2 border-purple-300 pl-2 mb-2 opacity-80">
                        <p className="text-xs font-semibold text-purple-200">{msg.repliedToMessageSender === user?.name ? "You" : msg.repliedToMessageSender}</p>
                        <p className="text-sm text-gray-200 truncate">{msg.repliedToMessageText}</p>
                      </div>
                    )}
                    {msg.type === 'image' && (msg as any).imageUrls && ((msg as any).imageUrls.length > 0) && (
                      <div className={`grid gap-1.5 mt-2 ${ (msg as any).imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1' }`}>
                        {(msg as any).imageUrls.map((url: string | null, index: number) => (
                          url && <img
                            key={index}
                            src={url}
                            alt={`Sent image ${index + 1}`}
                            className="rounded-lg w-full h-auto max-h-[400px] cursor-pointer object-cover"
                            onClick={() => setZoomedImageUrl(url)}
                          />
                        ))}
                      </div>
                    )}
                    {/* Only show text if it exists and the message is not just an image */}
                    {(msg.text || msg.type !== 'image') && <p className={`text-sm break-words mt-1 ${msg.isDeleted ? 'italic text-gray-400' : ''}`}>{msg.text}</p>}
                    <span className={`block text-[10px] mt-1 text-right ${
                      msg.senderId === user?._id ? "text-purple-200" : "text-gray-400"
                    }`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!selectionMode && (
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-500">
                      <MessageSquareReply className="opacity-0" /> {/* Hidden icon for spacing */}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {(replyingTo || editingMessage || imagesToSend.length > 0) && (
        <div className="p-3 bg-gray-800/70 border-t border-gray-700 flex items-center justify-between animate-fade-in-sm">
          {imagesToSend.length > 0 ? (
            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {imagesToSend.map((file, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img src={URL.createObjectURL(file)} alt="Preview" className="h-14 w-14 object-cover rounded-lg" />
                  <button onClick={() => setImagesToSend(prev => prev.filter((_, i) => i !== index))} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <p className="text-xs text-purple-400 font-semibold">
                {editingMessage ? "Editing message" : `Replying to ${replyingTo?.senderId === user?._id ? "yourself" : conversationDetails?.otherUserName}`}
              </p>
              <p className="text-sm text-gray-300 truncate">{editingMessage?.text || replyingTo?.text}</p>
            </div>
          )}
          <button onClick={() => { setReplyingTo(null); setEditingMessage(null); setInput(""); setImagesToSend([]); }} className="p-2 text-gray-400 hover:text-white flex-shrink-0 ml-2">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex items-end p-3 bg-gray-800 border-t border-gray-700 gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="p-2 text-gray-400 hover:text-white">
              <Paperclip size={20} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 bg-gray-800 border-gray-700 text-white p-2 mb-2" side="top" align="start">
            <div className="space-y-1">
              <label htmlFor="image-upload" className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-purple-500/20 cursor-pointer">
                <ImageIcon size={18} className="text-purple-400" />
                <span>Image</span>
              </label>
              <input id="image-upload" type="file" accept="image/*" multiple className="hidden" onChange={(e) => setImagesToSend(prev => [...prev, ...Array.from(e.target.files || [])])} />
              
              <button onClick={() => toast.info("Video attachments coming soon!")} className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-purple-500/20">
                <Video size={18} className="text-purple-400" />
                <span>Video</span>
              </button>
              <button onClick={() => toast.info("File attachments coming soon!")} className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-purple-500/20">
                <FileText size={18} className="text-purple-400" />
                <span>File</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <textarea
          ref={textareaRef}
          placeholder={imagesToSend.length > 0 ? "Add a caption..." : "Type a message..."}
          className="flex-1 bg-gray-700 border-gray-600 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-white resize-none max-h-32"
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
        />
        <button onClick={handleSend} className="bg-purple-600 text-white p-3 rounded-full hover:bg-purple-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed self-end" disabled={!input.trim() && imagesToSend.length === 0}>
          <Send size={18} />
        </button>
      </div>

      {/* Zoomed Image Modal */}
      {zoomedImageUrl && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" 
          onClick={() => setZoomedImageUrl(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomedImageUrl} 
              alt="Zoomed chat image" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button onClick={() => setZoomedImageUrl(null)} className="absolute -top-3 -right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}