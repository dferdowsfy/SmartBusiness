// Contextual copy for requirement cards — pure, name-pattern based, and
// purely additive: it only changes what a button *says* and, for a small
// list of well-known requirements that require an external government step
// before an upload is possible, adds a helpful outbound link. It never
// changes requirement determination, eligibility, or any tracked state.

export type IconTone = "green" | "blue" | "purple" | "gray";

export interface ActionCopy {
  label: string;
  helper?: string;
  /** Present only for the "external government action" pattern. */
  externalHref?: string;
  externalTone?: "green" | "blue";
}

interface NamePattern {
  test: RegExp;
  icon: IconTone;
  upload?: ActionCopy;
  external?: ActionCopy;
  /** Rough time estimate shown under a SmartPR-guided form CTA, if known. */
  formEstimate?: string;
}

const PATTERNS: NamePattern[] = [
  {
    test: /certificate of incorporation|articles of incorporation|charter/i,
    icon: "green",
    upload: { label: "Upload certificate", helper: "Accepted: PDF, JPG, PNG" },
  },
  {
    test: /\bein\b|employer identification/i,
    icon: "blue",
    external: {
      label: "Complete EIN application",
      helper: "After the IRS issues your EIN, we'll ask you to upload the confirmation.",
      externalHref:
        "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
      externalTone: "blue",
    },
    upload: {
      label: "Upload EIN confirmation",
      helper: "Once the IRS issues your EIN, upload the confirmation letter here.",
    },
  },
  {
    test: /merchant registration|registro de comerciante/i,
    icon: "purple",
    external: {
      label: "Register in SURI",
      helper: "After registration is approved, we'll ask you to upload the certificate.",
      externalHref: "https://suri.hacienda.pr.gov/",
      externalTone: "green",
    },
    upload: {
      label: "Upload merchant certificate",
      helper: "Once approved, upload your Registro de Comerciante certificate.",
    },
  },
  {
    test: /permiso ?[uú]nico|single business permit/i,
    icon: "purple",
    upload: { label: "Upload permit", helper: "Accepted: PDF, JPG, PNG" },
    formEstimate: "Takes ~10 min",
  },
  {
    test: /insurance|seguro|cfse|workers comp/i,
    icon: "gray",
    upload: { label: "Upload proof of insurance", helper: "Accepted: PDF, JPG, PNG" },
  },
  {
    test: /(incorpor|corporat|registr.* state|estado|articles)/i,
    icon: "green",
  },
  {
    test: /(tax|hacienda|contribu|iva|sales)/i,
    icon: "blue",
  },
  {
    test: /(permit|use|uso|zoning|ocup)/i,
    icon: "purple",
  },
];

function matchFor(name: string): NamePattern | undefined {
  return PATTERNS.find((pattern) => pattern.test.test(name));
}

export function iconToneFor(name: string): IconTone {
  return matchFor(name)?.icon ?? "gray";
}

/** Copy for the plain "upload a document" action. `hasExisting` swaps in
 * "Re-upload" phrasing once a file is already on file for this requirement. */
export function uploadCopy(name: string, hasExisting: boolean): ActionCopy {
  const preset = matchFor(name)?.upload;
  if (preset) {
    return hasExisting ? { ...preset, label: preset.label.replace(/^Upload/, "Re-upload") } : preset;
  }
  return hasExisting
    ? { label: "Re-upload document", helper: "Accepted: PDF, JPG, PNG" }
    : { label: "Upload document", helper: "Accepted: PDF, JPG, PNG" };
}

/** Copy for a well-known "go do this on an external government site first"
 * action. Returns null for anything not in the small known list — those
 * requirements fall back to the plain upload action, since we don't track
 * an external application state for them. */
export function externalCopy(name: string): ActionCopy | null {
  return matchFor(name)?.external ?? null;
}

export function formEstimateFor(name: string): string | undefined {
  return matchFor(name)?.formEstimate;
}
