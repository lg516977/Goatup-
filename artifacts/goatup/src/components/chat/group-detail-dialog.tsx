import { useState } from "react";
import { useGetGroup, getGetGroupQueryKey, useUpdateGroup, useAddGroupMember, useRemoveGroupMember, usePromoteGroupMember, useLeaveGroup, useSearchUsers, getSearchUsersQueryKey, User } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, UserMinus, ShieldAlert, LogOut, Edit2, MoreVertical } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export function GroupDetailDialog({ open, onOpenChange, conversationId, currentUser }: { open: boolean, onOpenChange: (open: boolean) => void, conversationId: number, currentUser: User }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  // We find the group ID from the conversation list first
  const convs = queryClient.getQueryData<any[]>(["/api/conversations"]) || [];
  const conv = convs.find(c => c.id === conversationId);
  const groupId = conv?.group?.id;

  const { data: group, isLoading } = useGetGroup(groupId!, {
    query: {
      queryKey: getGetGroupQueryKey(groupId!),
      enabled: !!groupId && open,
    }
  });

  const { data: searchResults, isLoading: searchLoading } = useSearchUsers({ q: debouncedSearch }, {
    query: { queryKey: getSearchUsersQueryKey({ q: debouncedSearch }), enabled: isAdding && debouncedSearch.length > 0 }
  });

  const updateGroup = useUpdateGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();
  const promoteMember = usePromoteGroupMember();
  const leaveGroup = useLeaveGroup();

  const isAdmin = group?.members?.some(m => m.userId === currentUser.id && m.isAdmin);

  const handleUpdateDetails = () => {
    if (!groupId) return;
    updateGroup.mutate({ 
      groupId, 
      data: { name: editName, description: editDesc } 
    }, {
      onSuccess: () => {
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      }
    });
  };

  const handleAddMember = (userId: number) => {
    if (!groupId) return;
    addMember.mutate({ groupId, data: { userId } }, {
      onSuccess: () => {
        setIsAdding(false);
        setSearchQuery("");
        queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
        toast({ title: "Member added" });
      }
    });
  };

  const handleRemoveMember = (userId: number) => {
    if (!groupId) return;
    removeMember.mutate({ groupId, userId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] })
    });
  };

  const handlePromoteMember = (userId: number) => {
    if (!groupId) return;
    promoteMember.mutate({ groupId, userId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] })
    });
  };

  const handleLeaveGroup = () => {
    if (!groupId) return;
    leaveGroup.mutate({ groupId }, {
      onSuccess: () => {
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        setLocation("/chat");
      }
    });
  };

  if (!groupId || isLoading || !group) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-card flex flex-col items-center relative">
          <Avatar className="w-24 h-24 mb-4 shadow-sm border-2">
            <AvatarImage src={group.iconUrl || undefined} />
            <AvatarFallback className="text-2xl">{group.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          
          {isEditing ? (
            <div className="w-full space-y-3">
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Group Name" autoFocus />
              <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={handleUpdateDetails} disabled={!editName || updateGroup.isPending}>Save</Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-xl font-bold flex items-center justify-center gap-2">
                {group.name}
                {isAdmin && (
                  <button onClick={() => { setEditName(group.name); setEditDesc(group.description || ""); setIsEditing(true); }} className="text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Group · {group.members?.length} members</p>
              {group.description && <p className="text-sm mt-3">{group.description}</p>}
            </div>
          )}
        </DialogHeader>

        <div className="bg-muted/30">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-medium text-sm text-muted-foreground">Members</h3>
            {isAdmin && !isAdding && (
              <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => setIsAdding(true)}>
                Add member
              </Button>
            )}
            {isAdding && (
              <Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground" onClick={() => { setIsAdding(false); setSearchQuery(""); }}>
                Cancel
              </Button>
            )}
          </div>

          {isAdding && (
            <div className="p-3 border-b bg-card">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>
              {searchLoading && <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>}
              {searchResults && searchResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  {searchResults.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6"><AvatarFallback>{u.username[0]}</AvatarFallback></Avatar>
                        <span className="text-sm">{u.username}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleAddMember(u.id)} disabled={group.members?.some(m => m.userId === u.id)}>
                        {group.members?.some(m => m.userId === u.id) ? 'In Group' : 'Add'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <ScrollArea className="max-h-[300px] p-2">
            {group.members?.map(member => (
              <div key={member.userId} className="flex items-center justify-between p-2 hover:bg-accent rounded-md group">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.profilePicUrl || undefined} />
                    <AvatarFallback>{member.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {member.username} {member.userId === currentUser.id && <span className="text-xs font-normal text-muted-foreground">(You)</span>}
                    </div>
                    {member.isAdmin && <div className="text-[10px] uppercase tracking-wider text-primary font-bold mt-0.5">Admin</div>}
                  </div>
                </div>
                
                {isAdmin && member.userId !== currentUser.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!member.isAdmin && (
                        <DropdownMenuItem onClick={() => handlePromoteMember(member.userId)}>
                          <ShieldAlert className="w-4 h-4 mr-2" /> Make Admin
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => handleRemoveMember(member.userId)}>
                        <UserMinus className="w-4 h-4 mr-2" /> Remove from group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </ScrollArea>
          
          <div className="p-4 border-t bg-card mt-2">
            <Button variant="destructive" className="w-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={handleLeaveGroup}>
              <LogOut className="w-4 h-4 mr-2" /> Leave Group
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
