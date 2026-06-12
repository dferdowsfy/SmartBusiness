// ============================================================================
// Extraction-first document schema + builder.
//
// Defines which fields each document type should contain, and turns raw
// extracted values into a transparent result: fields found, fields missing,
// a validation result, and human-readable reasoning. Used by BOTH the server
// LLM route and the client fallback so behavior is identical.
// ============================================================================

export const FIELD_LABELS: Record<string, string> = {
  business_name: "Business Name",
  entity_name: "Entity Name",
  owner: "Owner / Authorized Person",
  address: "Address",
  issue_date: "Issue Date",
  expiration_date: "Expiration Date",
  license_or_permit_number: "License / Permit Number",
  merchant_number: "Merchant Number",
  permit_number: "Permit Number",
  municipality: "Municipality",
};

// Every field we attempt to extract from any document.
export const ALL_CANDIDATES = Object.keys(FIELD_LABELS);

// Required fields per classified document type.
const REQUIRED_BY_TYPE: Record<string, string[]> = {
  "IRS EIN Letter": ["business_name", "license_or_permit_number"],
  "Certificate of Incorporation": ["entity_name"],
  "Articles of Organization": ["entity_name"],
  "Merchant Registration Certificate": ["merchant_number", "business_name"],
  "Permiso Único": ["permit_number", "address", "expiration_date"],
  "Patente Municipal": ["license_or_permit_number", "business_name"],
  "Health Permit": ["permit_number", "expiration_date", "business_name"],
  "Fire Certification": ["license_or_permit_number", "expiration_date"],
  "CFPM Certificate": ["owner", "expiration_date"],
  "Professional License": ["license_or_permit_number", "expiration_date"],
  "Contractor License": ["license_or_permit_number", "expiration_date"],
  "Tourism Registration": ["license_or_permit_number", "business_name"],
  "Lease Agreement": ["address", "expiration_date"],
  "Property Deed": ["address", "owner"],
  "Insurance Certificate": ["business_name", "expiration_date"],
  "Workers Compensation Certificate": ["business_name", "expiration_date"],
  "Alcohol Permit": ["license_or_permit_number", "expiration_date"],
  "Environmental Permit": ["permit_number", "expiration_date"],
};

export function requiredFieldsFor(documentType: string): string[] {
  return REQUIRED_BY_TYPE[documentType] || ["business_name"];
}

export interface ExtractionField {
  key: string;
  label: string;
  value: string | null;
  required: boolean;
  found: boolean;
}

export interface ExtractionResult {
  classification_confidence: number;       // 0..100
  fields: ExtractionField[];               // required + any found field
  fields_found: { label: string; value: string }[];
  fields_missing: { label: string }[];
  validation_result: "PASS" | "NEEDS_REVIEW" | "FAIL";
  expiration_status: "Valid" | "Expired" | "Unknown";
  reasoning: string;
}

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || /^(null|n\/a|none|-|—)$/i.test(s)) return null;
  return s;
};

const namesRoughlyMatch = (a?: string | null, b?: string | null): boolean => {
  if (!a || !b) return true; // can't disprove
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!na || !nb) return true;
  return na.includes(nb) || nb.includes(na);
};

// Deterministically turn extracted values into the extraction-first result.
export function buildExtraction(
  documentType: string,
  extracted: Record<string, unknown>,
  confidence: number,
  opts: { businessName?: string | null } = {}
): ExtractionResult {
  const required = requiredFieldsFor(documentType);
  const requiredSet = new Set(required);
  const ex = extracted || {};

  const fields: ExtractionField[] = [];
  for (const key of ALL_CANDIDATES) {
    const value = clean(ex[key]);
    const isRequired = requiredSet.has(key);
    if (!isRequired && value === null) continue; // only show required + found
    fields.push({ key, label: FIELD_LABELS[key] || key, value, required: isRequired, found: value !== null });
  }

  const fields_found = fields.filter((f) => f.found).map((f) => ({ label: f.label, value: f.value as string }));
  const fields_missing = required
    .filter((k) => clean(ex[k]) === null)
    .map((k) => ({ label: FIELD_LABELS[k] || k }));

  // Expiration status
  const expRaw = clean(ex.expiration_date);
  let expiration_status: ExtractionResult["expiration_status"] = "Unknown";
  if (expRaw) {
    const d = new Date(expRaw);
    expiration_status = isNaN(d.getTime()) ? "Unknown" : d < new Date() ? "Expired" : "Valid";
  }

  // Name match against intake
  const nameOk = namesRoughlyMatch(clean(ex.business_name) || clean(ex.entity_name), opts.businessName || null);

  // Validation result
  let validation_result: ExtractionResult["validation_result"];
  if (documentType === "Unknown" || fields_missing.length > 0) validation_result = "FAIL";
  else if (expiration_status === "Expired" || !nameOk) validation_result = "NEEDS_REVIEW";
  else validation_result = "PASS";

  // Reasoning (specific, never generic)
  const conf = Math.round((confidence ?? 0) * 100);
  const parts: string[] = [];
  parts.push(`Classified as "${documentType}" with ${conf}% confidence.`);
  if (fields_found.length) parts.push(`Found ${fields_found.length} field${fields_found.length === 1 ? "" : "s"}: ${fields_found.map((f) => f.label).join(", ")}.`);
  if (fields_missing.length) parts.push(`Missing required: ${fields_missing.map((f) => f.label).join(", ")}.`);
  if (expiration_status !== "Unknown") parts.push(`Expiration ${expiration_status === "Valid" ? "is valid" : "has passed"}.`);
  if (!nameOk) parts.push(`Business name does not match the intake profile.`);
  parts.push(
    validation_result === "PASS" ? "All required fields are present and valid."
    : validation_result === "FAIL" ? "Required fields are missing — this document cannot be validated yet."
    : "Present but needs review before it can be accepted."
  );

  return {
    classification_confidence: conf,
    fields,
    fields_found,
    fields_missing,
    validation_result,
    expiration_status,
    reasoning: parts.join(" "),
  };
}
