export const DEFAULT_SEGMENT_SOURCE_URL = "/api/segments";

const FIRST_NAMES = [
  "Jordan",
  "Taylor",
  "Morgan",
  "Alex",
  "Cameron",
  "Riley",
  "Avery",
  "Drew",
  "Casey",
  "Harper",
  "Parker",
  "Quinn",
  "Skyler",
  "Logan",
  "Rowan",
  "Blake",
];

const LAST_NAMES = [
  "Williams",
  "Thompson",
  "Johnson",
  "Garcia",
  "Brown",
  "Davis",
  "Martinez",
  "Wilson",
  "Anderson",
  "Lopez",
  "Moore",
  "Clark",
  "Hall",
  "Allen",
  "Young",
  "Scott",
];

const EMAIL_DOMAINS = [
  "gmail.com",
  "icloud.com",
  "outlook.com",
  "yahoo.com",
  "hotmail.com",
];

function hashSeed(value) {
  return String(value ?? "").split("").reduce((acc, char) => ((acc * 33) ^ char.charCodeAt(0)) >>> 0, 5381);
}

function titleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSegmentCount(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

export function formatCoveragePercent(value) {
  const numeric = Number(value ?? 0);
  return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}%`;
}

export function inferImportedSegmentStatus(segment) {
  const count = Number(segment?.count ?? 0);
  const coverage = Number(segment?.coveragePct ?? segment?.coverage_pct ?? 0);

  if (count <= 0) {
    return "Needs review";
  }
  if (coverage >= 30) {
    return "Production ready";
  }
  return "Ready for activation";
}

function normalizeProfile(profile, index, segmentId) {
  const goldenId =
    profile.goldenId ??
    profile.golden_id ??
    profile.id ??
    profile.customerId ??
    profile.customer_id ??
    `GR-${String(index + 1).padStart(5, "0")}`;

  const joinedName = [profile.firstName ?? profile.first_name, profile.lastName ?? profile.last_name].filter(Boolean).join(" ");
  const fullName =
    profile.fullName ??
    profile.full_name ??
    profile.name ??
    (joinedName || `${titleCase(segmentId)} Member ${index + 1}`);

  const email =
    profile.email ??
    profile.emailAddress ??
    profile.email_address ??
    `${String(fullName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") || `member.${index + 1}`}@example.com`;

  return {
    goldenId: String(goldenId),
    fullName: String(fullName).toUpperCase(),
    email: String(email).toUpperCase(),
  };
}

function buildPreviewProfiles(segment, limit = 18) {
  const seed = hashSeed(`${segment.id}:${segment.name}`);
  const total = Math.max(8, Math.min(limit, 18));

  return Array.from({ length: total }, (_, index) => {
    const firstName = FIRST_NAMES[(seed + index * 3) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(seed + index * 5) % LAST_NAMES.length];
    const domain = EMAIL_DOMAINS[(seed + index * 7) % EMAIL_DOMAINS.length];
    const goldenId = `GR-${String(((seed + index * 13) % 90000) + 10000).padStart(5, "0")}`;
    const emailLocal = `${firstName}.${lastName}${((seed + index) % 87) + 10}`.toLowerCase();

    return {
      goldenId,
      fullName: `${firstName} ${lastName}`.toUpperCase(),
      email: `${emailLocal}@${domain}`.toUpperCase(),
    };
  });
}

function extractLiveProfiles(segment, profileLookup) {
  const candidates = [
    segment?.profiles,
    segment?.members,
    segment?.records,
    profileLookup?.[segment?.id],
  ];

  const match = candidates.find((value) => Array.isArray(value));
  return Array.isArray(match) ? match : [];
}

export function normalizeSegmentFeedPayload(payload) {
  if (!payload || !Array.isArray(payload.segments)) {
    throw new Error("Segment feed response must include a segments array.");
  }

  const profileLookup = payload.profilesBySegment ?? payload.segmentProfiles ?? {};

  const segments = payload.segments.map((segment, index) => {
    const liveProfiles = extractLiveProfiles(segment, profileLookup);
    const normalizedLiveProfiles = liveProfiles.map((profile, profileIndex) =>
      normalizeProfile(profile, profileIndex, segment.id ?? `segment_${index + 1}`),
    );
    const count = Number(segment.count ?? segment.segment_count ?? 0);
    const coveragePct = Number(segment.coverage_pct ?? segment.coveragePct ?? 0);
    const normalized = {
      id: String(segment.id ?? `segment_${index + 1}`),
      name: String(segment.name ?? `Segment ${index + 1}`),
      description: String(segment.description ?? "No description provided."),
      count,
      coveragePct,
      industries: Array.isArray(segment.industry ?? segment.industries)
        ? (segment.industry ?? segment.industries).map((item) => String(item))
        : [],
      channels: Array.isArray(segment.channel ?? segment.channels)
        ? (segment.channel ?? segment.channels).map((item) => String(item))
        : [],
      status: inferImportedSegmentStatus({ count, coveragePct }),
      hasLiveProfiles: normalizedLiveProfiles.length > 0,
      profiles:
        normalizedLiveProfiles.length > 0
          ? normalizedLiveProfiles
          : buildPreviewProfiles(
              {
                id: segment.id ?? `segment_${index + 1}`,
                name: segment.name ?? `Segment ${index + 1}`,
              },
              18,
            ),
    };

    return normalized;
  });

  const industries = Array.from(new Set(segments.flatMap((segment) => segment.industries))).sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    segments,
    totalRecords: Number(payload.total_records ?? payload.totalRecords ?? 0),
    industries,
    liveProfileSupport: segments.some((segment) => segment.hasLiveProfiles),
  };
}
