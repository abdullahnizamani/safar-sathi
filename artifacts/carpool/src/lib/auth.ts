import { create } from "zustand";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const getInitialToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("carpool_token");
  }
  return null;
};

export const useAuth = create<AuthState>((set) => ({
  token: getInitialToken(),
  isAuthenticated: !!getInitialToken(),
  setToken: (token) => {
    if (token) {
      localStorage.setItem("carpool_token", token);
    } else {
      localStorage.removeItem("carpool_token");
    }
    set({ token, isAuthenticated: !!token });
  },
  logout: () => {
    localStorage.removeItem("carpool_token");
    set({ token: null, isAuthenticated: false });
  },
}));
