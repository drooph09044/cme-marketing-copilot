import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { defaultRouteForRole, ROLES, ROLE_LABELS, normalizeRole } from "./ProtectedRoute";
import exlLogo from "../assets/exl-logo.svg";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState(ROLES.PLATFORM_ADMIN);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // If already logged in, go home
  useEffect(() => {
    if (user?.token) {
      navigate(defaultRouteForRole(normalizeRole(user.role)), { replace: true });
    }
  }, [user, navigate]);

  const roleOptions = useMemo(() => ([
    ROLES.PLATFORM_ADMIN,
    ROLES.DATA_IDENTITY_OPERATOR,
    ROLES.PLANNER,
    ROLES.CAMPAIGN_PRODUCER,
    ROLES.PRODUCTION_LEAD,
    ROLES.PRODUCTION_SPECIALIST,
    ROLES.INSIGHTS_MANAGER,
  ]), []);

  function onRoleChange(nextRole) {
    setRole(nextRole);
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();

    const normalizedRole = normalizeRole(role);
    setError("");
    setIsLoggingIn(true);

    try {
      await login({ role: normalizedRole, email: email.trim(), password });
      navigate(defaultRouteForRole(normalizedRole), { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <div
      className="main-content"
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-secondary)",
        padding: 24,
      }}
    >
      <section
        style={{
          width: 460,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--bg-primary)",
          boxShadow: "var(--shadow-lg)",
          padding: 20,
        }}
      >
        <div className="page-header" style={{ marginBottom: 16, alignItems: "center" }}>
          <div className="sidebar-logo">
            <img src={exlLogo} alt="EXL" />
            <span className="sidebar-title">COPILOT</span>
          </div>

          <NavLink
            to="/overview"
            className="sidebar-subtitle"
            style={{ paddingLeft: 0, display: "block", cursor: "pointer" }}
          >
            Marketing Engine
          </NavLink>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>Role</span>
            <select
              className="theme-switch-select"
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              disabled={isLoggingIn}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>User Name (Email)</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="useremailid"
              style={{
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                padding: "10px 12px",
                outline: "none",
              }}
              type="email"
              name="email"
              autoComplete="email"
              disabled={isLoggingIn}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={{
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                padding: "10px 12px",
                outline: "none",
              }}
              type="password"
              name="password"
              autoComplete="current-password"
              disabled={isLoggingIn}
            />
          </label>

          {error ? (
            <div
              style={{
                borderRadius: 10,
                border: "1px solid rgba(220, 38, 38, 0.35)",
                background: "rgba(220, 38, 38, 0.08)",
                color: "#dc2626",
                padding: "9px 12px",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoggingIn}
            style={{
              marginTop: 6,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "white",
              padding: "10px 12px",
              cursor: isLoggingIn ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isLoggingIn ? "Logging in..." : "Login"}
          </button>
        </form>
      </section>
    </div>
  );
}
