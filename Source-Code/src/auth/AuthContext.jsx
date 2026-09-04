import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "me_auth"; // Marketing Engine auth

function readSavedUser() {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return saved?.token ? saved : null;
  } catch {
    return null;
  }
}

function AuthLoaderOverlay({ text = "Loading..." }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.35)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          minWidth: 180,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--bg-primary)",
          color: "var(--text-muted)",
          boxShadow: "var(--shadow-lg)",
          padding: "22px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            border: "3px solid var(--border)",
            borderTop: "3px solid var(--accent)",
            borderRadius: "50%",
            animation: "authSpin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        <div style={{ fontSize: 14, fontWeight: 600 }}>{text}</div>

        <style>
          {`
            @keyframes authSpin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </div>
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSavedUser);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const value = useMemo(() => {
    
async function login(payload) {
  let response;

  try {
    response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      "Login service is not responding. Please check if backend server is running on port 5173"
    );
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || data?.status !== "success") {
    if (response.status === 400) {
      throw new Error(data?.message || "Role, email and password are required.");
    }

    if (response.status === 401) {
      throw new Error(data?.message || "Invalid role, email or password.");
    }

    if (response.status === 404) {
      throw new Error("Login API not found. Please check /api/login endpoint.");
    }

    if (response.status >= 500) {
      throw new Error(
        data?.message || "Backend server error. Please check and run backend server."
      );
    }

    throw new Error(data?.message || "Login failed. Please try again.");
  }

  if (!data?.access_token || !data?.user?.role) {
    throw new Error("Invalid login response from server. Token or user role is missing.");
  }

  const authUser = {
    id: data.user?.id,
    username: data.user?.username,
    name: data.user?.full_name,
    full_name: data.user?.full_name,
    email: data.user?.email,
    role: data.user?.role,
    role_label: data.user?.role_label,
    token: data.access_token,
    tokenType: data.token_type || "Bearer",
    loggedInAt: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
  setUser(authUser);

  return authUser;
}

    // async function login(payload) {
    //   const response = await fetch("/api/login", {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify(payload),
    //   });

    //   const data = await response.json().catch(() => null);

    //   if (!response.ok || data?.status !== "success") {
    //     throw new Error(data?.message || "Login failed");
    //   }

    //   const authUser = {
    //     id: data.user?.id,
    //     username: data.user?.username,
    //     name: data.user?.full_name,
    //     full_name: data.user?.full_name,
    //     email: data.user?.email,
    //     role: data.user?.role,
    //     role_label: data.user?.role_label,
    //     token: data.access_token,
    //     tokenType: data.token_type || "Bearer",
    //     loggedInAt: Date.now(),
    //   };

    //   localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    //   setUser(authUser);

    //   return authUser;
    // }

    async function logout() {
      const savedUser = user || readSavedUser();
      const token = savedUser?.token;

      setLogoutLoading(true);

      try {
        if (token) {
          await fetch("/api/logout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch (error) {
        console.warn("Logout API failed:", error);
      } finally {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setLogoutLoading(false);
      }
    }

    return { user, login, logout, logoutLoading };
  }, [user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {logoutLoading ? <AuthLoaderOverlay text="Logging out..." /> : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}