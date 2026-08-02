import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getAuthToken } from "@/lib/auth";

export const useAuthGuard = (requireAuth: boolean = true) => {
  const [, setLocation] = useLocation();
  const token = getAuthToken();
  
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && (!token || isError)) {
        setLocation("/login");
      } else if (!requireAuth && token && user) {
        setLocation("/chat");
      }
    }
  }, [isLoading, isError, token, requireAuth, setLocation, user]);

  return { user, isLoading: isLoading || (!!token && !user && !isError), isAuthenticated: !!user };
};
