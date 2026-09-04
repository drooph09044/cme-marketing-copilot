const APP_TITLE = "EXL Copilot";

const ROUTE_TITLES = Object.freeze({
  "/login": "Sign In",
  "/overview": "Home",
  "/data-overview": "Input Sources",
  "/cleaning": "Cleaning & Standardization",
  "/id-graph": "ID Graph",
  "/golden-records": "Golden Records",
  "/customer360": "Customer Profile",
  "/segmentation": "Audiences & Segments",
  "/activation": "Campaigns & Journeys",
  "/campaigns-and-journeys": "Campaigns & Journeys",
  "/journey-config": "Journey Builder",
  "/qa-automation": "QA & Automation",
  "/automation": "QA & Automation",
  "/campaign-journey-listing": "Performance Hub",
  "/campaign-journey-view": "Campaign & Journey Performance",
  "/pipeline": "Pipeline Overview",
  "/performance": "Pipeline Performance",
  "/record-trace": "Record Trace",
  "/settings": "Settings",
});

function normalizedPathname(pathname) {
  const value = typeof pathname === "string" ? pathname.trim() : "";
  if (!value || value === "/") return "/";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

function metadataKeyForPath(pathname) {
  const normalized = normalizedPathname(pathname);
  if (normalized.startsWith("/campaign-journey-view/")) {
    return "/campaign-journey-view";
  }
  return normalized;
}

export function canonicalUrlFor(pathname, origin) {
  const canonicalPath = normalizedPathname(pathname);
  const canonicalOrigin = String(origin || "").replace(/\/+$/, "");
  return `${canonicalOrigin}${canonicalPath}`;
}

export function syncRouteMetadata({
  pathname,
  origin,
  documentRef = document,
}) {
  const canonicalUrl = canonicalUrlFor(pathname, origin);
  const canonicalLinks = Array.from(
    documentRef.head.querySelectorAll('link[rel="canonical"]'),
  );
  const canonicalLink = canonicalLinks.shift()
    || documentRef.createElement("link");

  canonicalLink.setAttribute("rel", "canonical");
  canonicalLink.setAttribute("href", canonicalUrl);
  if (!canonicalLink.parentNode) {
    documentRef.head.appendChild(canonicalLink);
  }

  // Guarantee one canonical declaration even if a host template or a future
  // integration adds another copy.
  canonicalLinks.forEach((duplicate) => duplicate.remove());

  const routeTitle = ROUTE_TITLES[metadataKeyForPath(pathname)];
  documentRef.title = routeTitle ? `${routeTitle} | ${APP_TITLE}` : APP_TITLE;

  return canonicalUrl;
}

export const ROUTE_METADATA_PATHS = Object.freeze(Object.keys(ROUTE_TITLES));
