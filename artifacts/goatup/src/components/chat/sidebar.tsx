import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListConversations, useGetMe, getListConversationsQueryKey, User, ConversationSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/lib/socket";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MoreVertical, LogOut, Settings, Users, Moon, Sun } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useThemeStore } from "@/lib/theme";
import { clearAuthData } from "@/lib/auth";
import { format, isToday, isYesterday } from "date-fns";
import { NewDmDialog } from "./new-dm-dialog";
import { NewGroupDialog } from "./new-group-dialog";
import { ProfileSettingsDialog } from "./profile-settings-dialog";

export function Sidebar({ activeId, currentUser }: { activeId: number | null, currentUser: User }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { theme, setTheme } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState("");
  
  const [dmDialogOpen, setDmDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const { data: conversations = [], isLoading } = useListConversations();

  const handleLogout = () => {
    clearAuthData();
    if (socket) socket.disconnect();
    queryClient.clear();
    setLocation("/login");
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const name = c.type === 'dm' ? c.otherUser?.username : c.group?.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <>
      <div className="h-16 border-b px-4 flex items-center justify-between bg-sidebar-primary text-sidebar-primary-foreground sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-transparent hover:border-white/20 transition-colors cursor-pointer" onClick={() => setProfileDialogOpen(true)}>
            <AvatarImage src={currentUser.profilePicUrl || undefined} />
            <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground">{currentUser.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="font-semibold text-sm truncate">{currentUser.username}</div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-primary-foreground hover:bg-black/10 hover:text-white rounded-full" onClick={() => setGroupDialogOpen(true)} title="New Group">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-primary-foreground hover:bg-black/10 hover:text-white rounded-full" onClick={() => setDmDialogOpen(true)} title="New Chat">
            <Plus className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-primary-foreground hover:bg-black/10 hover:text-white rounded-full">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
                <Settings className="w-4 h-4 mr-2" /> Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-3 border-b border-border bg-sidebar">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            className="pl-9 bg-accent/50 border-none h-9 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50" 
            placeholder="Search or start new chat" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-sidebar">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-muted"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-3">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            {searchQuery ? "No chats found" : "No active conversations. Start one!"}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredConversations.map(conversation => (
              <ConversationItem 
                key={conversation.id} 
                conversation={conversation} 
                isActive={activeId === conversation.id} 
              />
            ))}
          </div>
        )}
      </div>

      <NewDmDialog open={dmDialogOpen} onOpenChange={setDmDialogOpen} />
      <NewGroupDialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} />
      <ProfileSettingsDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} user={currentUser} />
    </>
  );
}

function ConversationItem({ conversation, isActive }: { conversation: ConversationSummary, isActive: boolean }) {
  const isGroup = conversation.type === 'group';
  const name = isGroup ? conversation.group?.name : conversation.otherUser?.username;
  const avatarUrl = isGroup ? conversation.group?.iconUrl : conversation.otherUser?.profilePicUrl;
  const isOnline = !isGroup && conversation.otherUser?.onlineStatus;
  
  const lastMessage = conversation.lastMessage;
  
  let timeString = "";
  if (lastMessage?.createdAt) {
    const date = new Date(lastMessage.createdAt);
    if (isToday(date)) timeString = format(date, "HH:mm");
    else if (isYesterday(date)) timeString = "Yesterday";
    else timeString = format(date, "dd/MM/yy");
  }

  let messagePreview = "";
  if (lastMessage) {
    if (lastMessage.isDeletedForEveryone) messagePreview = "This message was deleted";
    else if (lastMessage.messageType === 'image') messagePreview = "Photo";
    else if (lastMessage.messageType === 'voice') messagePreview = "Voice message";
    else messagePreview = lastMessage.content || "";
  }

  return (
    <Link href={`/chat/${conversation.id}`}>
      <div className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${isActive ? 'bg-accent/80' : 'hover:bg-accent/40'}`}>
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback>{name?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-sidebar rounded-full"></span>
          )}
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex justify-between items-baseline mb-0.5">
            <h3 className="font-medium text-foreground truncate text-[15px]">{name}</h3>
            {timeString && <span className={`text-[11px] whitespace-nowrap ml-2 ${conversation.unreadCount ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{timeString}</span>}
          </div>
          <div className="flex justify-between items-center">
            <p className={`truncate text-sm pr-2 ${lastMessage?.isDeletedForEveryone ? 'italic text-muted-foreground/70' : 'text-muted-foreground'}`}>
              {lastMessage?.senderUsername && isGroup && !lastMessage.isDeletedForEveryone && (
                <span className="text-foreground/70 mr-1">{lastMessage.senderUsername}:</span>
              )}
              {messagePreview}
            </p>
            {!!conversation.unreadCount && conversation.unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
