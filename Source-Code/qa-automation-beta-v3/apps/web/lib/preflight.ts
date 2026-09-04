import type { Journey, Preflight, PreflightWarning, Profile } from "./types";

// Static analysis of a journey + the current profile cohort.
// Used by the pre-flight rail and the canvas reach badges.
export function computePreflight(journey: Journey, profiles: Profile[]): Preflight {
  const consenting = profiles.filter((p) => p.consent).length;
  const consentingUnderCap = profiles.filter((p) => p.consent && p.fcap < 3).length;

  const nearCap = profiles.filter((p) => p.fcap >= 3).length;
  const noConsent = profiles.filter((p) => !p.consent).length;

  const warnings: PreflightWarning[] = [];
  if (nearCap > 0) {
    warnings.push({
      id: "w1",
      level: "warn",
      msg: `${nearCap} profiles near frequency cap will be filtered.`,
    });
  }
  if (noConsent > 0) {
    warnings.push({
      id: "w2",
      level: "info",
      msg: `${noConsent} profiles lack consent and will be suppressed at step S.`,
    });
  }
  warnings.push({
    id: "w3",
    level: "info",
    msg: "Identity namespace 'Email' detected on entry event.",
  });

  return {
    holdouts: journey.holdouts,
    suppression: journey.suppression,
    criteria: journey.criteria,
    nodeReach: {
      n1: profiles.length,
      n2: profiles.length,
      n3: consenting,
      n4: consentingUnderCap,
      n5: Math.round(consentingUnderCap * 0.9 * 0.6),
      n6: Math.round(consentingUnderCap * 0.9),
      n7: Math.round(consentingUnderCap * 0.9 * 0.4),
      n8: Math.round(consentingUnderCap * 0.9),
      n9: Math.round(consentingUnderCap * 0.9 * 0.27),
      n10: Math.round(consentingUnderCap * 0.9 * 0.73),
    },
    warnings,
  };
}
