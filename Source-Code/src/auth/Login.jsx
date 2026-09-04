import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { defaultRouteForRole, ROLES, ROLE_LABELS, normalizeRole } from "./ProtectedRoute";
import exlLogo from "../assets/exl-logo.svg";

const DEMO_CREDENTIALS = Object.freeze({
  [ROLES.PLATFORM_ADMIN]: {
    email: "platform.admin@exl.com",
    password: "password-admin-123",
  },
  [ROLES.DATA_IDENTITY_OPERATOR]: {
    email: "data.engineer@exl.com",
    password: "password-data-123",
  },
  [ROLES.PLANNER]: {
    email: "planner@exl.com",
    password: "password-planner-123",
  },
  [ROLES.CAMPAIGN_PRODUCER]: {
    email: "campaign.producer@exl.com",
    password: "password-cp-123",
  },
  [ROLES.PRODUCTION_LEAD]: {
    email: "production.lead@exl.com",
    password: "password-pl-123",
  },
  [ROLES.PRODUCTION_SPECIALIST]: {
    email: "production.specialist@exl.com",
    password: "password-ps-123",
  },
  [ROLES.INSIGHTS_MANAGER]: {
    email: "insights.manager@exl.com",
    password: "password-im-123",
  },
});

function ButtonSpinner() {
  return (
    <>
      <span
        style={{
          width: 16,
          height: 16,
          border: "2px solid rgba(255,255,255,0.45)",
          borderTop: "2px solid #ffffff",
          borderRadius: "50%",
          animation: "loginSpin 0.8s linear infinite",
          display: "inline-block",
        }}
      />
      <style>
        {`
          @keyframes loginSpin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
}

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState(ROLES.PLATFORM_ADMIN);
  const [email, setEmail] = useState(
    DEMO_CREDENTIALS[ROLES.PLATFORM_ADMIN].email
  );
  const [password, setPassword] = useState(
    DEMO_CREDENTIALS[ROLES.PLATFORM_ADMIN].password
  );
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (user?.token) {
      navigate(defaultRouteForRole(normalizeRole(user.role)), { replace: true });
    }
  }, [user, navigate]);

  const roleOptions = useMemo(
    () => [
      ROLES.PLATFORM_ADMIN,
      ROLES.DATA_IDENTITY_OPERATOR,
      ROLES.PLANNER,
      ROLES.CAMPAIGN_PRODUCER,
      ROLES.PRODUCTION_LEAD,
      ROLES.PRODUCTION_SPECIALIST,
      ROLES.INSIGHTS_MANAGER,
    ],
    []
  );

  function onRoleChange(nextRole) {
    const credentials = DEMO_CREDENTIALS[nextRole];
    setRole(nextRole);
    setEmail(credentials?.email || "");
    setPassword(credentials?.password || "");
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();

    const normalizedRole = normalizeRole(role);

    setError("");
    setIsLoggingIn(true);

    try {
      await login({
        role: normalizedRole,
        email: email.trim(),
        password,
      });

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
          position: "relative",
        }}
      >
        {isLoggingIn ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              borderRadius: 12,
              background: "rgba(0, 0, 0, 0.08)",
              pointerEvents: "none",
            }}
          />
        ) : null}

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
                opacity: isLoggingIn ? 0.75 : 1,
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
                opacity: isLoggingIn ? 0.75 : 1,
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
              opacity: isLoggingIn ? 0.8 : 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {isLoggingIn ? (
              <>
                <ButtonSpinner />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
