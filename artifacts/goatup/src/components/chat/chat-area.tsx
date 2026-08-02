import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListMessages, getListMessagesQueryKey, getListConversationsQueryKey,
  useSendMessage, useDeleteMessageForMe, useUnsendMessage,
  User, Message, ConversationSummary, useListConversations
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Image as ImageIcon, Mic, MoreVertical, ArrowLeft, Loader2, Square, SquarePlay } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { format, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { GroupDetailDialog } from "./group-detail-dialog";

export function ChatArea({ conversationId, currentUser }: { conversationId: number, currentUser: User }) {
  const [, setLocation] = useLocation();
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [content, setContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUsersTyping, setOtherUsersTyping] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [groupDetailOpen, setGroupDetailOpen] = useState(false);

  const { data: messages = [], isLoading: loadingMessages } = useListMessages(conversationId, {
    query: {
      queryKey: getListMessagesQueryKey(conversationId),
      enabled: !!conversationId,
      // Refetch on focus or reconnect to ensure we don't miss anything while away
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }
  });

  const { data: conversations = [] } = useListConversations();
  const conversation = conversations.find(c => c.id === conversationId);
  const isGroup = conversation?.type === 'group';
  const name = isGroup ? conversation?.group?.name : conversation?.otherUser?.username;
  const avatarUrl = isGroup ? conversation?.group?.iconUrl : conversation?.otherUser?.profilePicUrl;
  const isOnline = !isGroup && conversation?.otherUser?.onlineStatus;

  const sendMessage = useSendMessage();

  // Socket setup and cleanup
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("join:conversation", conversationId);

    const handleNewMessage = (payload: { message: Message, conversationId: number }) => {
      if (payload.conversationId === conversationId) {
        // Optimistic update of messages
        queryClient.setQueryData(getListMessagesQueryKey(conversationId), (oldData: Message[] | undefined) => {
          if (!oldData) return [payload.message];
          // Prevent duplicates
          if (oldData.some(m => m.id === payload.message.id)) return oldData;
          return [payload.message, ...oldData]; // new messages are at the beginning (descending order usually for chat logs, but API returns DESC so index 0 is newest)
        });
        
        // Mark as read in conversation list (by invalidating)
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }
    };

    const handleMessageDeleted = (payload: { messageId: number }) => {
      queryClient.setQueryData(getListMessagesQueryKey(conversationId), (oldData: Message[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(m => m.id === payload.messageId ? { ...m, isDeletedForEveryone: true, content: null, fileUrl: null } : m);
      });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    };

    const handleUserTyping = (payload: { userId: number, conversationId: number, isTyping: boolean, username: string }) => {
      if (payload.conversationId === conversationId && payload.userId !== currentUser.id) {
        setOtherUsersTyping(prev => {
          if (payload.isTyping) {
            if (!prev.includes(payload.username)) return [...prev, payload.username];
            return prev;
          } else {
            return prev.filter(u => u !== payload.username);
          }
        });
      }
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("user:typing", handleUserTyping);

    return () => {
      socket.emit("leave:conversation", conversationId);
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("user:typing", handleUserTyping);
      setOtherUsersTyping([]);
    };
  }, [socket, isConnected, conversationId, queryClient, currentUser.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Typing debounce
  useEffect(() => {
    if (!socket) return;
    
    if (content.length > 0 && !isTyping) {
      setIsTyping(true);
      socket.emit("typing:start", { conversationId });
    }
    
    const timer = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socket.emit("typing:stop", { conversationId });
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [content, socket, conversationId, isTyping]);

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || uploadingFile) return;

    sendMessage.mutate({
      conversationId,
      data: {
        messageType: 'text',
        content: content.trim(),
        fileUrl: null
      }
    }, {
      onSuccess: () => {
        setContent("");
        if (socket && isTyping) {
          setIsTyping(false);
          socket.emit("typing:stop", { conversationId });
        }
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({ variant: "destructive", title: "File too large", description: "Limit is 10MB" });
      return;
    }

    setUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileType", "image");

    try {
      const res = await fetch("/api/files/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("goatup_token")}`
        },
        body: formData
      }).then(r => {
        if (!r.ok) throw new Error("Upload failed");
        return r.json();
      });

      sendMessage.mutate({
        conversationId,
        data: {
          messageType: 'image',
          content: null,
          fileUrl: res.url
        }
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setUploadingFile(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        setUploadingFile(true);
        const formData = new FormData();
        formData.append("file", audioBlob, "voice-message.webm");
        formData.append("fileType", "voice");

        try {
          const res = await fetch("/api/files/upload", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("goatup_token")}`
            },
            body: formData
          }).then(r => {
            if (!r.ok) throw new Error("Upload failed");
            return r.json();
          });

          sendMessage.mutate({
            conversationId,
            data: {
              messageType: 'voice',
              content: null,
              fileUrl: res.url
            }
          });
        } catch (err) {
          toast({ variant: "destructive", title: "Upload failed" });
        } finally {
          setUploadingFile(false);
          setIsRecording(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast({ variant: "destructive", title: "Microphone access denied" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  // Group messages by date
  const groupedMessages = messages.slice().reverse().reduce((acc, msg) => {
    const date = format(new Date(msg.createdAt), 'MMMM d, yyyy');
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, Message[]>);

  if (!conversation && !loadingMessages) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <h2 className="text-xl font-medium text-foreground mb-2">Conversation not found</h2>
        <Button onClick={() => setLocation("/chat")} variant="outline" className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#E5E5E5] dark:bg-[#0B141A]">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between bg-card border-b z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden -ml-2 text-muted-foreground" onClick={() => setLocation("/chat")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="relative cursor-pointer" onClick={() => isGroup && setGroupDetailOpen(true)}>
            <Avatar>
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>{name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full"></span>
            )}
          </div>
          
          <div className="flex flex-col cursor-pointer" onClick={() => isGroup && setGroupDetailOpen(true)}>
            <h2 className="font-semibold text-[15px]">{name}</h2>
            {otherUsersTyping.length > 0 ? (
              <span className="text-[13px] text-primary italic">
                {otherUsersTyping.length === 1 
                  ? `${isGroup ? otherUsersTyping[0] + ' is ' : ''}typing...` 
                  : `${otherUsersTyping.length} people are typing...`}
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                {isGroup ? `${conversation?.group?.memberCount || 0} members` : (isOnline ? 'Online' : 'Offline')}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 text-muted-foreground">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isGroup && (
                <DropdownMenuItem onClick={() => setGroupDetailOpen(true)}>
                  Group Info
                </DropdownMenuItem>
              )}
              {!isGroup && (
                <>
                  <DropdownMenuItem>View Profile</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Block User</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-6 relative chat-bg" 
        ref={scrollRef}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='currentColor' fill-opacity='0.03' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}
      >
        {loadingMessages && (
          <div className="flex justify-center p-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date} className="space-y-4">
            <div className="flex justify-center sticky top-2 z-10">
              <span className="bg-card text-card-foreground/80 text-xs px-3 py-1 rounded-full shadow-sm border">
                {date}
              </span>
            </div>
            {msgs.map((msg, idx) => {
              const isMine = msg.senderId === currentUser.id;
              const showSender = isGroup && !isMine && (!msgs[idx-1] || msgs[idx-1].senderId !== msg.senderId);
              
              return (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isMine={isMine} 
                  showSender={showSender} 
                  conversationId={conversationId} 
                />
              );
            })}
          </div>
        ))}
        {/* Invisible div to pad bottom so last message isn't hidden behind input */}
        <div className="h-2" />
      </div>

      {/* Input Area */}
      <div className="bg-card p-3 border-t shrink-0">
        <form onSubmit={handleSendText} className="flex items-end gap-2 max-w-4xl mx-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileUpload}
          />
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="rounded-full shrink-0 h-10 w-10 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
          >
            {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
          </Button>

          <div className="flex-1 bg-accent/50 rounded-2xl border border-transparent focus-within:border-border transition-colors">
            <Input
              ref={inputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type a message"
              className="border-none bg-transparent h-10 shadow-none focus-visible:ring-0 px-4"
              autoComplete="off"
            />
          </div>

          {content.trim() ? (
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full shrink-0 h-10 w-10"
              disabled={uploadingFile}
            >
              <Send className="w-5 h-5 ml-1" />
            </Button>
          ) : (
            <Button 
              type="button" 
              size="icon" 
              variant={isRecording ? "destructive" : "ghost"}
              className="rounded-full shrink-0 h-10 w-10 text-muted-foreground"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
            >
              {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            </Button>
          )}
        </form>
      </div>

      {isGroup && (
        <GroupDetailDialog 
          open={groupDetailOpen} 
          onOpenChange={setGroupDetailOpen} 
          conversationId={conversationId} 
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

function MessageBubble({ message, isMine, showSender, conversationId }: { message: Message, isMine: boolean, showSender: boolean, conversationId: number }) {
  const time = format(new Date(message.createdAt), 'HH:mm');
  const deleteForMe = useDeleteMessageForMe();
  const unsendMessage = useUnsendMessage();
  const queryClient = useQueryClient();

  const handleDeleteForMe = () => {
    deleteForMe.mutate({ messageId: message.id }, {
      onSuccess: () => {
        // Optimistically hide from view
        queryClient.setQueryData(getListMessagesQueryKey(conversationId), (oldData: Message[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter(m => m.id !== message.id);
        });
      }
    });
  };

  const handleUnsend = () => {
    unsendMessage.mutate({ messageId: message.id }, {
      onSuccess: () => {
        // Optimistically mark as deleted
        queryClient.setQueryData(getListMessagesQueryKey(conversationId), (oldData: Message[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map(m => m.id === message.id ? { ...m, isDeletedForEveryone: true, content: null, fileUrl: null } : m);
        });
      }
    });
  };

  if (message.isDeletedForEveryone) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className={`px-3 py-1.5 rounded-xl max-w-[85%] text-[15px] italic text-muted-foreground border border-border/50 bg-card/50`}>
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1 group`}>
      <ContextMenu>
        <ContextMenuTrigger>
          <div 
            className={`
              relative px-3 py-1.5 rounded-2xl max-w-[85%] sm:max-w-md shadow-sm text-[15px]
              ${isMine 
                ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                : 'bg-card text-card-foreground border rounded-tl-sm'
              }
              ${message.messageType === 'image' ? 'p-1' : ''}
            `}
          >
            {showSender && !isMine && (
              <div className="text-[13px] font-semibold text-primary mb-0.5 ml-1 leading-tight">
                {message.senderUsername}
              </div>
            )}
            
            {message.messageType === 'text' && (
              <div className="break-words whitespace-pre-wrap pr-12 pb-1 leading-relaxed">
                {message.content}
              </div>
            )}
            
            {message.messageType === 'image' && message.fileUrl && (
              <div className="relative">
                <img 
                  src={message.fileUrl} 
                  alt="Attached image" 
                  className="rounded-xl max-w-[250px] max-h-[300px] object-cover" 
                  loading="lazy"
                />
              </div>
            )}

            {message.messageType === 'voice' && message.fileUrl && (
              <div className="flex items-center gap-3 pr-10 min-w-[200px] py-1 pl-1">
                <Button variant="secondary" size="icon" className="w-8 h-8 rounded-full shrink-0" onClick={() => {
                  const audio = new Audio(message.fileUrl!);
                  audio.play();
                }}>
                  <SquarePlay className="w-4 h-4" />
                </Button>
                <div className="flex-1 h-2 bg-primary-foreground/30 dark:bg-muted rounded-full overflow-hidden">
                  <div className="w-full h-full bg-primary-foreground/50 dark:bg-primary/50" />
                </div>
              </div>
            )}
            
            <div className={`
              absolute bottom-1 right-2 text-[10px] flex items-center gap-1
              ${isMine 
                ? (message.messageType === 'image' ? 'text-white drop-shadow-md' : 'text-primary-foreground/80') 
                : (message.messageType === 'image' ? 'text-white drop-shadow-md' : 'text-muted-foreground')
              }
            `}>
              {time}
              {isMine && (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                  {message.status === 'read' && <path d="M24 6L13 17l-5-5" />}
                </svg>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleDeleteForMe}>Delete for me</ContextMenuItem>
          {isMine && (
            <ContextMenuItem onClick={handleUnsend} className="text-destructive focus:bg-destructive/10">Unsend</ContextMenuItem>
          )}
          {!isMine && (
             <ContextMenuItem className="text-destructive focus:bg-destructive/10">Report</ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
