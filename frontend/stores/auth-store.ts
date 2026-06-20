import { create } from "zustand";
import { UserSession } from "../lib/auth";

interface AuthState {
  user: UserSession | null;
  isAuthenticated: boolean;
  setUser: (user: UserSession) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
}));
