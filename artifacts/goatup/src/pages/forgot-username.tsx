import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotUsernameSchema } from "@/lib/schemas";
import { useForgotUsername } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { Loader2, ArrowLeft, Copy, Check } from "lucide-react";

export default function ForgotUsername() {
  const { toast } = useToast();
  const [recoveredUsername, setRecoveredUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<z.infer<typeof forgotUsernameSchema>>({
    resolver: zodResolver(forgotUsernameSchema),
    defaultValues: {
      securityAnswer: "",
    },
  });

  const recoverMutation = useForgotUsername();

  const onSubmit = (values: z.infer<typeof forgotUsernameSchema>) => {
    recoverMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        setRecoveredUsername(res.username);
        toast({ title: "Username found!" });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Recovery failed",
          description: err.error || "No matching user found for that answer.",
        });
      }
    });
  };

  const copyToClipboard = () => {
    if (recoveredUsername) {
      navigator.clipboard.writeText(recoveredUsername);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }
  };

  if (recoveredUsername) {
    return (
      <AuthLayout title="Username Recovered" subtitle="We found your account">
        <div className="space-y-6">
          <div className="p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider">
            {recoveredUsername}
          </div>
          <Button onClick={copyToClipboard} variant="outline" className="w-full">
            {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied!" : "Copy username"}
          </Button>
          <div className="flex gap-4 pt-4">
            <Link href="/login" className="flex-1">
              <Button className="w-full">Log in</Button>
            </Link>
            <Link href="/forgot-password" className="flex-1">
              <Button variant="secondary" className="w-full">Reset Password</Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot Username" subtitle="Look up your account">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            If you remember the answer to your security question, we can find your username. Note: this requires an exact match.
          </p>

          <FormField
            control={form.control}
            name="securityAnswer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Security Answer</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your exact security answer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button type="submit" className="w-full mt-6" disabled={recoverMutation.isPending}>
            {recoverMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Find Username"}
          </Button>

          <div className="mt-4 text-center">
            <Link href="/login" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
            </Link>
          </div>
        </form>
      </Form>
    </AuthLayout>
  );
}
