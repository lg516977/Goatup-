import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@/lib/schemas";
import { useRegister } from "@workspace/api-client-react";
import { setAuthData } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { z } from "zod";
import { Loader2, Copy, Check } from "lucide-react";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export default function Signup() {
  const { isLoading: authLoading } = useAuthGuard(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      password: "",
      securityQuestion: "",
      securityAnswer: "",
    },
  });

  const password = form.watch("password");

  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  }, [password]);

  const registerMutation = useRegister();

  const onSubmit = (values: z.infer<typeof signupSchema>) => {
    registerMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        setAuthData(res.token, res.user);
        if (res.recoveryCode) {
          setRecoveryCode(res.recoveryCode);
        } else {
          setLocation("/chat");
        }
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Registration failed",
          description: err.error || "An error occurred.",
        });
      }
    });
  };

  const copyToClipboard = () => {
    if (recoveryCode) {
      navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }
  };

  if (authLoading) return null;

  if (recoveryCode) {
    return (
      <AuthLayout title="Save your recovery code" subtitle="You will only see this once">
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            This code can be used to recover your account if you forget your password and security question answer. <strong>Store it somewhere safe.</strong>
          </p>
          <div className="p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider break-all">
            {recoveryCode}
          </div>
          <Button onClick={copyToClipboard} variant="outline" className="w-full">
            {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied!" : "Copy code"}
          </Button>
          <Button onClick={() => setLocation("/chat")} className="w-full mt-4">
            I have saved it, continue
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create account" subtitle="Join Goatup to start chatting">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="Choose a unique username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Create a strong password" {...field} />
                </FormControl>
                <Progress value={passwordStrength} className="h-1.5 mt-2" />
                <FormDescription className="flex justify-between">
                  <span>Strength</span>
                  <span className={passwordStrength === 100 ? "text-green-500" : passwordStrength > 50 ? "text-yellow-500" : "text-muted-foreground"}>
                    {passwordStrength === 100 ? "Strong" : passwordStrength > 50 ? "Medium" : "Weak"}
                  </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="securityQuestion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Security Question</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. What is your favorite book?" {...field} />
                </FormControl>
                <FormDescription>Write your own custom question.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="securityAnswer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Security Answer</FormLabel>
                <FormControl>
                  <Input placeholder="Your answer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button type="submit" className="w-full mt-6" disabled={registerMutation.isPending || passwordStrength < 100}>
            {registerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create account"}
          </Button>
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </form>
      </Form>
    </AuthLayout>
  );
}
