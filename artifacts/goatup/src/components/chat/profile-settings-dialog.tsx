import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateProfile, useUploadFile, User } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  aboutStatus: z.string().max(100).nullable(),
  lastSeenVisibility: z.enum(["everyone", "nobody"]),
});

export function ProfileSettingsDialog({ open, onOpenChange, user }: { open: boolean, onOpenChange: (open: boolean) => void, user: User }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(user.profilePicUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  const updateProfile = useUpdateProfile();
  const uploadFile = useUploadFile();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      aboutStatus: user.aboutStatus || "",
      lastSeenVisibility: user.lastSeenVisibility || "everyone",
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: client side validation
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Image must be under 5MB" });
      return;
    }

    setIsUploading(true);
    
    // We construct a multipart form data manually since the hook expects it
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileType", "image");

    try {
      // @ts-ignore - the openapi spec types this oddly but we need to send FormData
      const res = await uploadFile.mutateAsync({ data: formData as any });
      setProfilePicUrl(res.url);
      
      // Auto-save just the picture
      await updateProfile.mutateAsync({ data: { profilePicUrl: res.url } });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: "Could not upload profile picture" });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    updateProfile.mutate({ 
      data: { 
        aboutStatus: values.aboutStatus || null,
        lastSeenVisibility: values.lastSeenVisibility,
        profilePicUrl
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        onOpenChange(false);
        toast({ title: "Profile updated" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4">
          <div className="relative group">
            <Avatar className="w-24 h-24 border-4 border-background shadow-sm">
              <AvatarImage src={profilePicUrl || undefined} />
              <AvatarFallback className="text-2xl">{user.username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
          <h3 className="mt-4 font-semibold text-lg">{user.username}</h3>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="aboutStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About</FormLabel>
                  <FormControl>
                    <Input placeholder="Hey there! I am using Goatup." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="lastSeenVisibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Seen Visibility</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="nobody">Nobody</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
