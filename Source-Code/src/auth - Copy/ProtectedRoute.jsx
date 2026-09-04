import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export const ROLES = {
  PLATFORM_ADMIN: "PLATFORM_ADMIN", // 1
  DATA_IDENTITY_OPERATOR: "DATA_IDENTITY_OPERATOR", // 2
  PLANNER: "PLANNER", // 3
  CAMPAIGN_PRODUCER: "CAMPAIGN_PRODUCER", // 4
  PRODUCTION_LEAD: "PRODUCTION_LEAD", // 5
  PRODUCTION_SPECIALIST: "PRODUCTION_SPECIALIST", // 6
  INSIGHTS_MANAGER: "INSIGHTS_MANAGER", // 7

  //   Legacy roles (to avoid breaking existing sessions)
  Admin: "Admin",
  Marketeer: "Marketeer",
  Other: "Other",
  CampaignProducer: "CampaignProducer",
};

export const ROLE_LABELS = {
  [ROLES.PLATFORM_ADMIN]: "MarTech Product Owner (Platform Admin)",
  [ROLES.DATA_IDENTITY_OPERATOR]: "Data Engineer (Data & Identity Operator)",
  [ROLES.PLANNER]: "Planning Specialist / Strategist (Planner)",
  [ROLES.CAMPAIGN_PRODUCER]: "Campaign Producer (Campaign Builder / Operator)",
  [ROLES.PRODUCTION_LEAD]: "Production Lead (Approver / Release Manager)",
  [ROLES.PRODUCTION_SPECIALIST]: "Production Specialist (Activation Executor on underlying stack)",
  [ROLES.INSIGHTS_MANAGER]: "Insights Manager (Measurement)",

  // Optional labels for legacy values (if they appear)
  [ROLES.Admin]: "MarTech Product Owner (Platform Admin) - All Access (Legacy)",
  [ROLES.Marketeer]: "Planner (Legacy)",
  [ROLES.Other]: "Data Engineer (Legacy)",
  [ROLES.CampaignProducer]: "Campaign Producer (Legacy)",
};

/**
 *   Permission model
 * Top-level sections:
 *  - overview
 *  - configuration
 *  - operations
 *  - identity
 *  - audiences
 *  - activation
 *  - measurement
 *
 * Identity is granular:
 *  - identity:cleaning
 *  - identity:golden-records
 *  - identity:id-graph
 *  - identity:customer-profile
 *
 * Wildcard:
 *  - identity:* (all identity pages)
 */

/**
 *   Role -> permissions mapping (7 roles)
 */
export const ROLE_PERMISSIONS = {
  // 1) Platform Admin - All Access
  [ROLES.PLATFORM_ADMIN]: ["*"],

  // 2) Data Engineer (Data & Identity Operator): Configuration + Identity Resolution + Audiences
  [ROLES.DATA_IDENTITY_OPERATOR]: ["overview", "configuration", "identity:*", "audiences"],

  // 3) Planner: Audiences + Activation
  [ROLES.PLANNER]: ["overview", "audiences", "activation"],

  // 4) Campaign Producer:
  // Identity Resolution: ONLY Golden Records + Customer Profile
  // Audiences + Activation
  [ROLES.CAMPAIGN_PRODUCER]: [
    "identity:golden-records",
    "identity:customer-profile",
    "overview",
    "audiences",
    "activation",
  ],

  // 5) Production Lead: Audiences + Activation + Measurement
  [ROLES.PRODUCTION_LEAD]: ["overview", "audiences", "activation", "measurement"],

  // 6) Production Specialist: Activation
  [ROLES.PRODUCTION_SPECIALIST]: ["overview", "activation"],

  // 7) Insights Manager: Measurement
  [ROLES.INSIGHTS_MANAGER]: ["overview", "measurement"],

  /**
   *   Legacy role mappings (so existing users keep working)
   * If your localStorage has old role strings, they will still be authorized.
   */
  [ROLES.Admin]: ["*"],
  [ROLES.Other]: ["overview", "configuration", "identity:*", "audiences"],
  [ROLES.Marketeer]: ["overview", "audiences", "activation"], // treat legacy Marketeer like Planner
  [ROLES.CampaignProducer]: [
    "identity:golden-records",
    "identity:customer-profile",
    "overview",
    "audiences",
    "activation",
  ],
};

/** Convert legacy roles into canonical roles (optional but helpful) */
export function normalizeRole(role) {
  if (!role) return role;

  // Legacy -> Canonical
  if (role === ROLES.Admin) return ROLES.PLATFORM_ADMIN;
  if (role === ROLES.Other) return ROLES.DATA_IDENTITY_OPERATOR;
  if (role === ROLES.Marketeer) return ROLES.PLANNER;
  if (role === ROLES.CampaignProducer) return ROLES.CAMPAIGN_PRODUCER;

  // Already canonical
  return role;
}

function matchesPermission(permission, resource) {
  if (permission === "*" || permission === resource) return true;

  // identity:* wildcard
  if (permission.endsWith(":*")) {
    const prefix = permission.slice(0, -1); // keeps "identity:"
    return resource.startsWith(prefix);
  }

  return false;
}

export function canAccess(role, resource) {
  if (!role) return false;

  const normalized = normalizeRole(role);
  const allowed = ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS[role] || [];

  if (allowed.includes("*")) return true;

  // Sidebar checks "identity" section
  if (resource === "identity") {
    return allowed.some((p) => p === "identity:*" || p.startsWith("identity:"));
  }

  return allowed.some((p) => matchesPermission(p, resource));
}

export function defaultRouteForRole(role) {
  const r = normalizeRole(role);

  return "/overview";
}

export default function ProtectedRoute({ children, section }) {
  const { user } = useAuth();

  if (!user?.token) return <Navigate to="/login" replace />;

  // Normalize role so legacy stored roles also work
  const role = normalizeRole(user.role);

  if (section && !canAccess(role, section)) {
    return <Navigate to={defaultRouteForRole(role)} replace />;
  }

  return children;
}

