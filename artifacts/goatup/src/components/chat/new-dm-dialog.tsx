import { useState, useEffect } from "react";
import { useSearchUsers, getSearchUsersQueryKey, useCreateOrGetDm, UserSummary } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import { Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export function NewDmDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);
  const [, setLocation] = useLocation();
  const createDm = useCreateOrGetDm();

  const { data: users, isLoading } = useSearchUsers({ q: debouncedQuery }, {
    query: {
      queryKey: getSearchUsersQueryKey({ q: debouncedQuery }),
      enabled: debouncedQuery.length > 0,
    }
  });

  const handleStartChat = (userId: number) => {
    createDm.mutate({ data: { userId } }, {
      onSuccess: (conv) => {
        onOpenChange(false);
        setLocation(`/chat/${conv.id}`);
        setQuery("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle>New Chat</DialogTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by username..."
              className="pl-9 bg-muted/50 border-none"
              autoFocus
            />
          </div>
        </DialogHeader>
        
        <div className="max-h-[300px] overflow-y-auto p-2">
          {!debouncedQuery && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Type a username to search
            </div>
          )}
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {users?.length === 0 && !isLoading && debouncedQuery && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No users found
            </div>
          )}
          {users?.map(user => (
            <div 
              key={user.id} 
              className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
              onClick={() => handleStartChat(user.id)}
            >
              <Avatar>
                <AvatarImage src={user.profilePicUrl || undefined} />
                <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-sm">{user.username}</div>
                {user.aboutStatus && <div className="text-xs text-muted-foreground truncate">{user.aboutStatus}</div>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
