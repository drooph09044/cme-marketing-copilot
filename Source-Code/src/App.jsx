import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import exlLogo from "./assets/exl-logo.svg";

import ProtectedRoute, {
  canAccess,
  defaultRouteForRole,
  ROLE_LABELS,
  normalizeRole,
} from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import { syncRouteMetadata } from "./routeMetadata";

// Route modules are intentionally loaded on demand. This keeps graphing,
// reporting, campaign and QA dependencies out of the first-page payload while
// preserving each route's existing component and API behavior.
const Login = lazy(() => import("./auth/Login"));
const DataOverview = lazy(() => import("./idres/pages/DataOverview"));
const GoldenRecords = lazy(() => import("./idres/pages/GoldenRecords"));
const IDGraph = lazy(() => import("./idres/pages/IDGraph"));
const Overview = lazy(() => import("./idres/pages/Overview"));
const PipelineOverview = lazy(() => import("./idres/pages/PipelineOverview"));
const PipelinePerformance = lazy(() => import("./idres/pages/PipelinePerformance"));
const RecordTrace = lazy(() => import("./idres/pages/RecordTrace"));
const AudiencesSegments_TabView = lazy(() => import("./idres/pages/AudiencesSegments_TabView"));
const ActivationRoute = lazy(() => import("./routes/ActivationRoute"));
const QaAutomationRoute = lazy(() => import("./routes/QaAutomationRoute"));
const CampaignJourneyListing = lazy(() => import("./idres/pages/campaignJourneyListing"));
const CampaignJourneyView = lazy(() => import("./idres/pages/campaignJourneyView"));
const CustomerProfile_TabView = lazy(() => import("./idres/pages/CustomerProfile_TabView"));
const CleaningStandardization_TabView = lazy(() => import("./idres/pages/CleaningStandardization_TabView"));
const Settings = lazy(() => import("./idres/pages/Settings"));

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: 180,
        display: "grid",
        placeItems: "center",
        color: "var(--text-muted)",
      }}
    >
      Loading…
    </div>
  );
}

const ICONS = {
  overview:        "M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z",
  home:            "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  settings:        "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
  dataOverview:    "M4 6h16M4 12h16M4 18h16",
  cleaning:        "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
  idGraph:         "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  goldenRecords:   "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  customer360:     "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  segmentation:    "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  campaigns:       "M4 6h6v4H4V6zm10 0h6v4h-6V6zM4 14h6v4H4v-4zm10 0h6v4h-6v-4zM10 8h4M12 10v4",
  journeyConfig:   "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0zM12 6v2m0 8v2m6-6h-2M8 12H6",
  qaAutomation:    "M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z",
  performance:     "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  pipeline:        "M13 10V3L4 14h7v7l9-11h-7z",
  pipelinePerf:    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  recordTrace:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
};

function SvgIcon({ path }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        width: 13,
        height: 13,
        flexShrink: 0,
        transition: "transform 0.2s",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
      }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function NavSection({ label, sectionKey, open, onToggle, collapsed, children }) {
  if (collapsed) {
    return <>{children}</>;
  }
  return (
    <div className="nav-section">
      <button
        type="button"
        className="nav-section-header"
        onClick={() => onToggle(sectionKey)}
        aria-expanded={open}
      >
        <span className="nav-section-label-text">{label}</span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="nav-section-items">{children}</div>}
    </div>
  );
}

const ROUTE_SECTION_MAP = {
  "/data-overview":           "dataIdentity",
  "/cleaning":                "dataIdentity",
  "/id-graph":                "dataIdentity",
  "/golden-records":          "dataIdentity",
  "/customer360":             "dataIdentity",
  "/segmentation":            "activation",
  "/campaigns-and-journeys":  "activation",
  "/campaign-manager":        "activation",
  "/qa-automation":           "activation",
  "/journey-config":          "activation",
  "/campaign-journey-listing":"measurement",
  "/pipeline":                "operations",
  "/performance":             "operations",
  "/record-trace":            "operations",
  "/settings":                "configuration",
};

function sectionForPath(path) {
  for (const [prefix, section] of Object.entries(ROUTE_SECTION_MAP)) {
    if (path === prefix || path.startsWith(prefix + "/")) return section;
  }
  return null;
}

const DEFAULT_OPEN_SECTIONS = {
  configuration: false,
  dataIdentity: false,
  activation: false,
  measurement: false,
  operations: false,
};

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [activatedSegments, setActivatedSegments] = useState([]);
  const [themeMode, setThemeMode] = useState("dark");
  const [openSections, setOpenSections] = useState(DEFAULT_OPEN_SECTIONS);

  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

const { user, logout } = useAuth();
const location = useLocation();
const navigate = useNavigate();

// Keep a single canonical declaration synchronized with client-side routing.
// window.location.origin makes this work unchanged on each Databricks Apps
// deployment URL and deliberately excludes query strings and hash fragments.
useEffect(() => {
  syncRouteMetadata({
    pathname: location.pathname,
    origin: window.location.origin,
  });
}, [location.pathname]);

// Auto-expand the section that contains the current route
useEffect(() => {
  const section = sectionForPath(location.pathname);
  if (section) {
    setOpenSections((prev) => ({ ...DEFAULT_OPEN_SECTIONS, [section]: true }));
  } else {
    setOpenSections(DEFAULT_OPEN_SECTIONS);
  }
}, [location.pathname]);

const isAuthed = !!user?.token;
const isLoginPage = location.pathname === "/login";

// User menu state
const [showUserMenu, setShowUserMenu] = useState(false);
const userMenuRef = useRef(null);

useEffect(() => {
  function handleClickOutside(e) {
    if (!showUserMenu) return;
    if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
      setShowUserMenu(false);
    }
  }

  function handleEsc(e) {
    if (e.key === "Escape") setShowUserMenu(false);
  }

  document.addEventListener("mousedown", handleClickOutside);
  document.addEventListener("keydown", handleEsc);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleEsc);
  };
}, [showUserMenu]);

useEffect(() => {
  document.documentElement.dataset.theme = themeMode;
}, [themeMode]);

const roleLabel = useMemo(() => {
  const normalized = normalizeRole(user?.role);
  return ROLE_LABELS[normalized] || normalized || "Unknown";
}, [user?.role]);

const loggedInText = useMemo(() => {
  if (!user?.loggedInAt) return "-";
  try {
    return new Date(user.loggedInAt).toLocaleString();
  } catch {
    return "-";
  }
}, [user?.loggedInAt]);

const allowed = useMemo(() => {
  const r = normalizeRole(user?.role);
  return (key) => canAccess(r, key);
}, [user?.role]);

const handleLogout = () => {
  logout();
  navigate("/login", { replace: true });
};

// LOGIN ONLY VIEW
if (!isAuthed || isLoginPage) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}


  return (
    <div className="app-layout">
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-header">
          {!collapsed ? (
            <>
              <div className="sidebar-logo">
                <img src={exlLogo} alt="EXL" />
                <span className="sidebar-title">COPILOT</span>
              </div>
              <NavLink to="/overview" className="sidebar-subtitle" style={{ paddingLeft: 0, display: "block", cursor: "pointer" }}>
                Marketing Engine
              </NavLink>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: "auto",
              marginTop: collapsed ? 0 : -18,
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={(event) => { event.currentTarget.style.color = "var(--accent-light)"; }}
            onMouseLeave={(event) => { event.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {/* Overview — standalone, no section wrapper */}
          {allowed("overview") && (
            <NavLink
              to="/overview"
              title={collapsed ? "Home" : undefined}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
              }
            >
              <SvgIcon path={ICONS.home} />
              {!collapsed ? "Home" : null}
            </NavLink>
          )}

          {/* Data & Identity */}
          {(allowed("configuration") || allowed("identity:cleaning") || allowed("identity:*") || allowed("identity")) && (
            <NavSection
              label="Data & Identity"
              sectionKey="dataIdentity"
              open={openSections.dataIdentity}
              onToggle={toggleSection}
              collapsed={collapsed}
            >
              {allowed("configuration") && (
                <NavLink
                  to="/data-overview"
                  title={collapsed ? "Input Sources" : undefined}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                  }
                >
                  <SvgIcon path={ICONS.dataOverview} />
                  {!collapsed ? "Input Sources" : null}
                </NavLink>
              )}
              {(allowed("identity:id-graph") || allowed("identity:*")) && (
                <NavLink
                  to="/id-graph"
                  title={collapsed ? "ID Graph" : undefined}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                  }
                >
                  <SvgIcon path={ICONS.idGraph} />
                  {!collapsed ? "ID Graph" : null}
                </NavLink>
              )}
              {(allowed("identity:customer-profile") || allowed("identity:*")) && (
                <NavLink
                  to="/customer360"
                  title={collapsed ? "Customer Profile" : undefined}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                  }
                >
                  <SvgIcon path={ICONS.customer360} />
                  {!collapsed ? "Customer Profile" : null}
                </NavLink>
              )}
            </NavSection>
          )}

          {/* Activation */}
          {(allowed("audiences") || allowed("activation")) && (
            <NavSection
              label="Activation"
              sectionKey="activation"
              open={openSections.activation}
              onToggle={toggleSection}
              collapsed={collapsed}
            >
              {allowed("audiences") && (
                <NavLink
                  to="/segmentation"
                  title={collapsed ? "Audiences & Segments" : undefined}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                  }
                >
                  <SvgIcon path={ICONS.segmentation} />
                  {!collapsed ? "Audiences & Segments" : null}
                </NavLink>
              )}
              {allowed("activation") && (
                <>
                  <NavLink
                    to="/campaigns-and-journeys"
                    title={collapsed ? "Campaigns & Journeys" : undefined}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                    }
                  >
                    <SvgIcon path={ICONS.campaigns} />
                    {!collapsed ? "Campaigns & Journeys" : null}
                  </NavLink>
                  <NavLink
                    to="/qa-automation"
                    title={collapsed ? "QA & Automation" : undefined}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                    }
                  >
                    <SvgIcon path={ICONS.qaAutomation} />
                    {!collapsed ? "QA & Automation" : null}
                  </NavLink>
                </>
              )}
            </NavSection>
          )}

          {/* Measurement */}
          {allowed("measurement") && (
            <NavSection
              label="Measurement"
              sectionKey="measurement"
              open={openSections.measurement}
              onToggle={toggleSection}
              collapsed={collapsed}
            >
              <NavLink
                to="/campaign-journey-listing"
                title={collapsed ? "Performance Hub" : undefined}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                }
              >
                <SvgIcon path={ICONS.performance} />
                {!collapsed ? "Performance Hub" : null}
              </NavLink>
            </NavSection>
          )}

          <div className="nav-ops-divider" />

          {/* Operations + Configuration — pinned to bottom */}
          <div className="nav-config-bottom">
            {allowed("operations") && (
              <>
                <NavSection
                  label="Operations"
                  sectionKey="operations"
                  open={openSections.operations}
                  onToggle={toggleSection}
                  collapsed={collapsed}
                >
                  <NavLink
                    to="/pipeline"
                    title={collapsed ? "Pipeline Overview" : undefined}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                    }
                  >
                    <SvgIcon path={ICONS.pipeline} />
                    {!collapsed ? "Pipeline Overview" : null}
                  </NavLink>
                  <NavLink
                    to="/performance"
                    title={collapsed ? "Pipeline Performance" : undefined}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                    }
                  >
                    <SvgIcon path={ICONS.pipelinePerf} />
                    {!collapsed ? "Pipeline Performance" : null}
                  </NavLink>
                  <NavLink
                    to="/record-trace"
                    title={collapsed ? "Record Trace" : undefined}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                    }
                  >
                    <SvgIcon path={ICONS.recordTrace} />
                    {!collapsed ? "Record Trace" : null}
                  </NavLink>
                </NavSection>
              </>
            )}
            {allowed("configuration") && (
              <NavSection
                label="Configuration"
                sectionKey="configuration"
                open={openSections.configuration}
                onToggle={toggleSection}
                collapsed={collapsed}
              >
                <NavLink
                  to="/settings"
                  title={collapsed ? "Settings" : undefined}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""} ${collapsed ? "nav-item-collapsed" : ""}`
                  }
                >
                  <SvgIcon path={ICONS.settings} />
                  {!collapsed ? "Settings" : null}
                </NavLink>
              </NavSection>
            )}
          </div>
        </nav>

        {!collapsed ? <div className="sidebar-footer">EXL Service | Marketing COE</div> : null}
      </aside>

          <main className="main-content">
  {/* Global toolbar */}
  <div className="global-toolbar" style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div className="theme-switch">
      <span className="theme-switch-label">Theme</span>
      <select
        className="theme-switch-select"
        value={themeMode}
        onChange={(event) => setThemeMode(event.target.value)}
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </div>

    {/* User icon + dropdown + logout */}
    <div style={{ display: "flex", alignItems: "center", gap: 10}}>
      <div ref={userMenuRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setShowUserMenu((s) => !s)}
          title="User"
          aria-haspopup="menu"
          aria-expanded={showUserMenu}
          style={{
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            padding: "6px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
            <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          </svg>
        </button>

        {showUserMenu && (
          <div
            role="menu"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: 340,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--bg-primary)",
              boxShadow: "var(--shadow-lg)",
              padding: 12,
              zIndex: 9999,
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>User Information</div>

              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Email</div>
                <div style={{ fontSize: 13 }}>{user?.email || "-"}</div>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Role</div>
                <div style={{ fontSize: 13 }}>{roleLabel}</div>
              </div>

              {/* <div style={{ display: "grid", gap: 4 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Logged In At</div>
                <div style={{ fontSize: 13 }}>{loggedInText}</div>
              </div> */}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    padding: "8px 10px",
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--accent)",
                    color: "white",
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontWeight: 700,
                    flex: 1,
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    
    </div>
  </div>

  <Suspense fallback={<RouteLoadingFallback />}>
  <Routes>
	    {/* Root -> role landing */}
	    <Route path="/" element={<Navigate to={defaultRouteForRole(normalizeRole(user?.role))} replace />} />

	    {/* Overview */}
	    <Route
	      path="/overview"
	      element={
	        <ProtectedRoute section="overview">
	          <Overview />
	        </ProtectedRoute>
	      }
	    />

	    {/* Configuration */}
    <Route
      path="/settings"
      element={
        <ProtectedRoute section="configuration">
          <Settings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/data-overview"
      element={
        <ProtectedRoute section="configuration">
          <DataOverview />
        </ProtectedRoute>
      }
    />

    {/* Operations */}
    <Route
      path="/pipeline"
      element={
        <ProtectedRoute section="operations">
          <PipelineOverview />
        </ProtectedRoute>
      }
    />
    <Route
      path="/performance"
      element={
        <ProtectedRoute section="operations">
          <PipelinePerformance />
        </ProtectedRoute>
      }
    />

    {/* Identity (granular access) */}
    <Route
      path="/cleaning"
      element={
        <ProtectedRoute section="identity:cleaning">
          <CleaningStandardization_TabView />
        </ProtectedRoute>
      }
    />
    <Route
      path="/golden-records"
      element={
        <ProtectedRoute section="identity:golden-records">
          <GoldenRecords />
        </ProtectedRoute>
      }
    />
    <Route
      path="/record-trace"
      element={
        <ProtectedRoute section="operations">
          <RecordTrace />
        </ProtectedRoute>
      }
    />
    <Route
      path="/id-graph"
      element={
        <ProtectedRoute section="identity:id-graph">
          <IDGraph />
        </ProtectedRoute>
      }
    />
    <Route
      path="/customer360"
      element={
        <ProtectedRoute section="identity:customer-profile">
          <CustomerProfile_TabView />
        </ProtectedRoute>
      }
    />

    {/* Audiences */}
    <Route
      path="/segmentation"
      element={
        <ProtectedRoute section="audiences">
          <AudiencesSegments_TabView onSendToJourneyBuilder={setActivatedSegments} />
        </ProtectedRoute>
      }
    />

    {/* Activation */}
    <Route path="/activation" element={<Navigate to="/campaigns-and-journeys" replace />} />
    <Route
      path="/campaigns-and-journeys"
      element={
        <ProtectedRoute section="activation">
          <ActivationRoute activatedSegments={activatedSegments} section="bp" themeMode={themeMode} />
        </ProtectedRoute>
      }
    />
    <Route
      path="/journey-config"
      element={
        <ProtectedRoute section="activation">
          <ActivationRoute activatedSegments={activatedSegments} section="cfg" themeMode={themeMode} />
        </ProtectedRoute>
      }
    />
    <Route
      path="/qa-automation"
      element={
        <ProtectedRoute section="activation">
          <QaAutomationRoute themeMode={themeMode} />
        </ProtectedRoute>
      }
    />
    <Route path="/automation" element={<Navigate to="/qa-automation" replace />} />

    {/* Measurement */}
    <Route
      path="/campaign-journey-listing"
      element={
        <ProtectedRoute section="measurement">
          <CampaignJourneyListing />
        </ProtectedRoute>
      }
    />
    <Route
      path="/campaign-journey-view/:campaignId"
      element={
        <ProtectedRoute section="measurement">
          <CampaignJourneyView />
        </ProtectedRoute>
      }
    />

    {/* Fallback */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
  </Suspense>
</main>
    </div>
  );
}
