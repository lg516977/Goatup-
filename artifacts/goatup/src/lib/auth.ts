import { setAuthTokenGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => localStorage.getItem("goatup_token"));

export const getAuthToken = () => localStorage.getItem("goatup_token");
export const getAuthUser = () => {
  const user = localStorage.getItem("goatup_user");
  return user ? JSON.parse(user) : null;
};
export const setAuthData = (token: string, user: any) => {
  localStorage.setItem("goatup_token", token);
  localStorage.setItem("goatup_user", JSON.stringify(user));
};
export const clearAuthData = () => {
  localStorage.removeItem("goatup_token");
  localStorage.removeItem("goatup_user");
};
