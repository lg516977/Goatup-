import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { getAuthToken } from "@/lib/auth";

export function RootRedirect() {
  const [, setLocation] = useLocation();
  const token = getAuthToken();
  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (!isLoading) {
      if (token && user) {
        setLocation("/chat");
      } else {
        setLocation("/login");
      }
    }
  }, [isLoading, token, user, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 bg-primary/20 rounded-xl mb-4"></div>
        <div className="h-4 w-24 bg-muted rounded"></div>
      </div>
    </div>
  );
}
