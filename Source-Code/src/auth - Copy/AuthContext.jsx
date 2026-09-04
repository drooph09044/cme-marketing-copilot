import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "me_auth"; // Marketting Engine auth

function readSavedUser() {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return saved?.token ? saved : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // Initialize synchronously from localStorage so the very first render
  // already knows whether the user is authenticated. Otherwise the catch-all
  // route in App.jsx redirects to /login before useEffect can restore.
  const [user, setUser] = useState(readSavedUser);

  const value = useMemo(() => {
    function login(payload) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setUser(payload);
    }

    function logout() {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    }

    return { user, login, logout };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}