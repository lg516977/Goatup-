import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateGroup, useSearchUsers, getSearchUsersQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import { Search, Loader2, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { ScrollArea } from "@/components/ui/scroll-area";

const groupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100),
  description: z.string().optional(),
});

export function NewGroupDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [, setLocation] = useLocation();
  const createGroup = useCreateGroup();
  
  const [step, setStep] = useState<1 | 2>(1); // 1: add members, 2: group details
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);
  const [selectedUsers, setSelectedUsers] = useState<Array<{id: number, username: string, profilePicUrl?: string | null}>>([]);

  const { data: users, isLoading } = useSearchUsers({ q: debouncedQuery }, {
    query: {
      queryKey: getSearchUsersQueryKey({ q: debouncedQuery }),
      enabled: debouncedQuery.length > 0,
    }
  });

  const form = useForm<z.infer<typeof groupSchema>>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "" },
  });

  // Reset state when opened
  if (open && step === 2 && !form.getValues("name")) {
     // initial render sync
  }

  const handleToggleUser = (user: {id: number, username: string, profilePicUrl?: string | null}) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const onSubmit = (values: z.infer<typeof groupSchema>) => {
    createGroup.mutate({ 
      data: { 
        name: values.name, 
        description: values.description || null,
        memberIds: selectedUsers.map(u => u.id)
      } 
    }, {
      onSuccess: (conv) => {
        onOpenChange(false);
        setStep(1);
        setSelectedUsers([]);
        form.reset();
        setLocation(`/chat/${conv.id}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) setTimeout(() => { setStep(1); setSelectedUsers([]); form.reset(); }, 200);
    }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 pb-2 border-b bg-card">
          <DialogTitle>{step === 1 ? "Add Group Members" : "New Group Details"}</DialogTitle>
        </DialogHeader>
        
        {step === 1 ? (
          <>
            <div className="p-4 border-b">
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-1 bg-accent rounded-full pl-1 pr-2 py-1 text-xs">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={u.profilePicUrl || undefined} />
                        <AvatarFallback className="text-[10px]">{u.username[0]}</AvatarFallback>
                      </Avatar>
                      <span>{u.username}</span>
                      <button onClick={() => handleToggleUser(u)} className="ml-1 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search users..."
                  className="pl-9 bg-muted/50 border-none"
                  autoFocus
                />
              </div>
            </div>
            
            <ScrollArea className="h-[250px] p-2">
              {!debouncedQuery && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Type to search for friends to add
                </div>
              )}
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {users?.map(user => {
                const isSelected = selectedUsers.some(u => u.id === user.id);
                return (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                    onClick={() => handleToggleUser(user)}
                  >
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={user.profilePicUrl || undefined} />
                        <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{user.username}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                      {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><path d="M20 6L9 17l-5-5"/></svg>}
                    </div>
                  </div>
                );
              })}
            </ScrollArea>

            <DialogFooter className="p-4 bg-card border-t">
              <Button 
                onClick={() => setStep(2)} 
                disabled={selectedUsers.length === 0}
                className="w-full sm:w-auto"
              >
                Next
              </Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Group name" {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="What's this group about?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Members ({selectedUsers.length})</p>
                <div className="flex flex-wrap gap-1">
                  {selectedUsers.map(u => <span key={u.id} className="text-xs text-muted-foreground">{u.username}{u !== selectedUsers[selectedUsers.length-1] ? ', ' : ''}</span>)}
                </div>
              </div>
              
              <DialogFooter className="pt-4 flex sm:justify-between items-center w-full">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" disabled={createGroup.isPending}>
                  {createGroup.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Group
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
