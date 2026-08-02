import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/schemas";
import { useForgotPassword, useResetPassword } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [method, setMethod] = useState<"question" | "code">("question");

  const verifyForm = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      username: "",
      method: "question",
      securityAnswer: "",
      recoveryCode: "",
    },
  });

  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
    },
  });

  const verifyMutation = useForgotPassword();
  const resetMutation = useResetPassword();

  const onVerifySubmit = (values: z.infer<typeof forgotPasswordSchema>) => {
    verifyMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        setResetToken(res.resetToken);
        toast({ title: "Verified", description: "You can now set a new password." });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: err.error || "Incorrect answer or code.",
        });
      }
    });
  };

  const onResetSubmit = (values: z.infer<typeof resetPasswordSchema>) => {
    if (!resetToken) return;
    resetMutation.mutate({ data: { resetToken, newPassword: values.newPassword } }, {
      onSuccess: () => {
        toast({ title: "Password updated", description: "You can now log in." });
        setLocation("/login");
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: err.error || "Failed to reset password.",
        });
      }
    });
  };

  if (resetToken) {
    return (
      <AuthLayout title="Reset Password" subtitle="Choose a new strong password">
        <Form {...resetForm}>
          <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
            <FormField
              control={resetForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full mt-6" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        </Form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Recover Account" subtitle="Verify your identity to reset password">
      <Form {...verifyForm}>
        <form onSubmit={verifyForm.handleSubmit(onVerifySubmit)} className="space-y-4">
          <FormField
            control={verifyForm.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="Your username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 p-1 bg-muted rounded-md mb-4">
            <button
              type="button"
              className={`flex-1 py-1.5 text-sm font-medium rounded-sm ${method === "question" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => {
                setMethod("question");
                verifyForm.setValue("method", "question");
              }}
            >
              Security Question
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 text-sm font-medium rounded-sm ${method === "code" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => {
                setMethod("code");
                verifyForm.setValue("method", "code");
              }}
            >
              Recovery Code
            </button>
          </div>

          {method === "question" ? (
            <FormField
              control={verifyForm.control}
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
          ) : (
            <FormField
              control={verifyForm.control}
              name="recoveryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recovery Code</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your 16-character code" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          <Button type="submit" className="w-full mt-6" disabled={verifyMutation.isPending}>
            {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Identity"}
          </Button>

          <div className="mt-4 text-center">
            <Link href="/login" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <Link href="/forgot-username" className="text-primary hover:underline">
              Forgot your username?
            </Link>
          </div>
        </form>
      </Form>
    </AuthLayout>
  );
}
