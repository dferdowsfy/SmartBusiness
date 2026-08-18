// ============================================================================
// Canonical field catalog.
//
// ONE profile feeds every government artifact. A form does not get its own data
// model: it declares which canonical field each of its blanks corresponds to.
//
// Canonical ids are stable, snake_case, dotted strings ("business.legal_name").
// They are deliberately decoupled from the in-memory shape of
// `CanonicalApplicationData` (which is camelCase and predates this engine) so
// mapping files stay readable and survive refactors of the TypeScript model.
// ============================================================================

import { readPath } from "../engine/formConditions.ts";
import type { CanonicalAddress, CanonicalApplicationData } from "../engine/types.ts";

export type CanonicalValueType =
  | "text"
  | "long_text"
  | "number"
  | "currency"
  | "date"
  | "boolean"
  | "email"
  | "phone"
  | "address";

export interface CanonicalFieldSpec {
  id: string;
  label: string;
  type: CanonicalValueType;
  /** Dotted path into CanonicalApplicationData, when the value is stored directly. */
  path?: string;
  /** Computed accessor for values assembled from several stored fields. */
  derive?: (profile: CanonicalApplicationData) => unknown;
  /**
   * Never auto-populated from the profile even when present — the filer must
   * type it onto the artifact themselves (government identifiers of people).
   */
  sensitive?: boolean;
  description?: string;
}

export function formatAddressLine(addr: CanonicalAddress | undefined): string {
  if (!addr) return "";
  return [addr.line1, addr.line2, addr.cityOrMunicipality, addr.stateOrTerritory, addr.postalCode]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(", ");
}

function operatingAddress(profile: CanonicalApplicationData): CanonicalAddress | undefined {
  return profile.addresses.operatingAddress ?? profile.addresses.principalPhysical;
}

function mailingAddress(profile: CanonicalApplicationData): CanonicalAddress | undefined {
  if (profile.addresses.mailingSameAsPhysical) return operatingAddress(profile);
  return profile.addresses.principalMailing ?? operatingAddress(profile);
}

/**
 * The canonical profile every artifact maps into. Extend this list — never add
 * a form-specific data model.
 */
export const CANONICAL_FIELDS: CanonicalFieldSpec[] = [
  // --- business ------------------------------------------------------------
  { id: "business.legal_name", label: "Legal business name", type: "text", path: "business.legalName" },
  { id: "business.trade_name", label: "Trade name / DBA", type: "text", path: "business.tradeName" },
  {
    id: "business.entity_type",
    label: "Entity type",
    type: "text",
    // "other" is the intake placeholder for "not sure yet" — it cannot route a
    // filing, so it reads as unanswered rather than as an answer.
    derive: (p) => (p.business.entityType === "other" ? undefined : p.business.entityType),
  },
  { id: "business.ein", label: "Employer Identification Number", type: "text", path: "business.ein" },
  { id: "business.naics_code", label: "NAICS code", type: "text", path: "business.naicsCode" },
  {
    id: "business.activity_description",
    label: "Business activity description",
    type: "long_text",
    derive: (p) => p.business.activityDescription || p.business.purpose,
  },
  {
    id: "business.start_date",
    label: "Operations start date",
    type: "date",
    derive: (p) => p.business.operationsStartDate || p.business.incorporationDate,
  },
  { id: "business.incorporation_date", label: "Incorporation date", type: "date", path: "business.incorporationDate" },
  { id: "business.email", label: "Business email", type: "email", path: "business.email" },
  { id: "business.phone", label: "Business phone", type: "phone", path: "business.phone" },
  {
    id: "business.merchant_registration_number",
    label: "Merchant registration number (Registro de Comerciante)",
    type: "text",
    path: "business.merchantRegistrationNumber",
  },
  {
    id: "business.registry_number",
    label: "Department of State registry number",
    type: "text",
    path: "business.registryNumber",
  },

  // --- owner / primary contact --------------------------------------------
  {
    id: "owner.full_name",
    label: "Owner or authorized representative",
    type: "text",
    derive: (p) => p.contact.fullName || p.parties.authorizedSigners[0]?.fullName || p.parties.incorporators[0]?.fullName,
  },
  {
    id: "owner.first_name",
    label: "Owner first name",
    type: "text",
    derive: (p) => splitName(String(p.contact.fullName ?? "")).first,
  },
  {
    id: "owner.last_name",
    label: "Owner last name",
    type: "text",
    derive: (p) => splitName(String(p.contact.fullName ?? "")).last,
  },
  { id: "owner.title", label: "Owner title or role", type: "text", path: "contact.role" },
  { id: "owner.email", label: "Owner email", type: "email", path: "contact.email" },
  { id: "owner.phone", label: "Owner phone", type: "phone", path: "contact.phone" },
  {
    id: "owner.address",
    label: "Owner residential address",
    type: "address",
    derive: (p) => formatAddressLine(p.parties.authorizedSigners[0]?.physicalAddress ?? p.addresses.principalMailing),
  },
  {
    id: "owner.city",
    label: "Owner residence municipality or city",
    type: "text",
    derive: (p) => p.parties.authorizedSigners[0]?.physicalAddress?.cityOrMunicipality,
  },
  {
    id: "owner.state",
    label: "Owner residence state or territory",
    type: "text",
    derive: (p) => p.parties.authorizedSigners[0]?.physicalAddress?.stateOrTerritory,
  },
  {
    id: "owner.postal_code",
    label: "Owner residence postal code",
    type: "text",
    derive: (p) => p.parties.authorizedSigners[0]?.physicalAddress?.postalCode,
  },
  {
    id: "owner.tax_id",
    label: "Owner social security / tax identification number",
    type: "text",
    sensitive: true,
    description: "Collected on the government artifact itself; SmartPR does not store or auto-fill it.",
  },

  // --- location ------------------------------------------------------------
  {
    id: "location.physical_address",
    label: "Physical business address",
    type: "address",
    derive: (p) => formatAddressLine(operatingAddress(p)),
  },
  {
    id: "location.mailing_address",
    label: "Mailing address",
    type: "address",
    derive: (p) => formatAddressLine(mailingAddress(p)),
  },
  {
    id: "location.municipality",
    label: "Municipality",
    type: "text",
    derive: (p) => p.addresses.municipality || operatingAddress(p)?.cityOrMunicipality,
  },
  {
    id: "location.state",
    label: "State or territory",
    type: "text",
    derive: (p) => operatingAddress(p)?.stateOrTerritory || "PR",
  },
  {
    id: "location.postal_code",
    label: "Postal code",
    type: "text",
    derive: (p) => operatingAddress(p)?.postalCode,
  },
  {
    id: "location.mailing_postal_code",
    label: "Mailing postal code",
    type: "text",
    derive: (p) => mailingAddress(p)?.postalCode,
  },

  // --- operations ----------------------------------------------------------
  {
    id: "operations.employee_count",
    label: "Number of employees",
    type: "number",
    derive: (p) => p.operations.employeeCount ?? p.business.employeeCount,
  },
  {
    id: "operations.estimated_payroll",
    label: "Estimated annual payroll",
    type: "currency",
    path: "operations.estimatedAnnualPayroll",
  },
  {
    id: "operations.estimated_gross_receipts",
    label: "Estimated annual gross receipts (volumen de negocio)",
    type: "currency",
    path: "operations.estimatedAnnualGrossReceipts",
  },
  {
    id: "operations.municipal_taxpayer_id",
    label: "Municipal taxpayer identification number",
    type: "text",
    path: "operations.municipalTaxpayerId",
  },
  { id: "operations.fiscal_year_end", label: "Fiscal year end", type: "date", path: "operations.fiscalYearEnd" },

  // --- parties (reused by every formation artifact) -------------------------
  {
    id: "parties.resident_agent_name",
    label: "Resident agent",
    type: "text",
    derive: (p) => p.parties.residentAgent?.fullName,
  },
  {
    id: "parties.resident_agent_physical_address",
    label: "Resident agent physical address",
    type: "address",
    derive: (p) => formatAddressLine(p.parties.residentAgent?.physicalAddress),
  },
  {
    id: "parties.resident_agent_mailing_address",
    label: "Resident agent mailing address",
    type: "address",
    derive: (p) =>
      formatAddressLine(
        p.parties.residentAgent?.mailingSameAsPhysical
          ? p.parties.residentAgent?.physicalAddress
          : p.parties.residentAgent?.mailingAddress ?? p.parties.residentAgent?.physicalAddress
      ),
  },
  {
    id: "parties.incorporator_list",
    label: "Incorporators (name and address)",
    type: "long_text",
    derive: (p) => partyList(p.parties.incorporators),
  },
  {
    id: "parties.incorporator_names",
    label: "Incorporator names",
    type: "text",
    derive: (p) => p.parties.incorporators.map((i) => i.fullName).filter(Boolean).join(", "),
  },
  {
    id: "parties.director_list",
    label: "Initial directors (name and address)",
    type: "long_text",
    derive: (p) => partyList(p.parties.directors),
  },

  // --- filing preferences --------------------------------------------------
  { id: "filing.term_of_existence", label: "Term of existence", type: "text", path: "filingPreferences.existenceTerm" },
  { id: "filing.existence_end_date", label: "Specific end date of existence", type: "date", path: "filingPreferences.existenceEndDate" },
  { id: "filing.effective_date_choice", label: "Effective date choice", type: "text", path: "filingPreferences.effectiveDateChoice" },
  { id: "filing.future_effective_date", label: "Future effective date", type: "date", path: "filingPreferences.futureEffectiveDate" },

  // --- regulated activities ------------------------------------------------
  { id: "activities.food_service", label: "Food service", type: "boolean", path: "activities.foodService" },
  { id: "activities.outdoor_seating", label: "Outdoor seating", type: "boolean", path: "activities.outdoorSeating" },
  { id: "activities.alcohol_sales", label: "Alcohol sales", type: "boolean", path: "activities.alcoholSales" },
  { id: "activities.entertainment", label: "Entertainment", type: "boolean", path: "activities.entertainment" },
  { id: "activities.signage", label: "Commercial signage", type: "boolean", path: "activities.signage" },
  {
    id: "activities.coin_operated_machines",
    label: "Coin-operated / amusement machines",
    type: "boolean",
    path: "activities.coinOperatedMachines",
  },
  { id: "activities.fuel_sales", label: "Fuel sales", type: "boolean", path: "activities.fuelSales" },
  { id: "activities.cigarette_sales", label: "Cigarette sales", type: "boolean", path: "activities.cigaretteSales" },
  { id: "activities.weapons_sales", label: "Weapons and ammunition sales", type: "boolean", path: "activities.weaponsSales" },
  { id: "activities.precious_metals", label: "Purchase/sale of precious metals", type: "boolean", path: "activities.preciousMetals" },
  { id: "activities.public_show_promoter", label: "Public show promoter", type: "boolean", path: "activities.publicShowPromoter" },
];

export const CANONICAL_FIELDS_BY_ID: Record<string, CanonicalFieldSpec> = Object.fromEntries(
  CANONICAL_FIELDS.map((f) => [f.id, f])
);

export function isKnownCanonicalField(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CANONICAL_FIELDS_BY_ID, id);
}

function partyList(parties: { fullName: string; physicalAddress?: CanonicalAddress; mailingAddress?: CanonicalAddress }[]): string {
  return parties
    .map((party) => {
      const address = formatAddressLine(party.physicalAddress ?? party.mailingAddress);
      // ASCII separator: standard PDF fonts (WinAnsi) have no em dash.
      return address ? `${party.fullName} - ${address}` : party.fullName;
    })
    .filter(Boolean)
    .join("; ");
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Read a canonical field from the profile. Returns undefined when the profile
 * has no answer yet — the caller reports that as "additional information
 * required", never as a blank guess written onto a government artifact.
 */
export function readCanonicalField(
  profile: CanonicalApplicationData,
  canonicalField: string
): unknown {
  const spec = CANONICAL_FIELDS_BY_ID[canonicalField];
  if (!spec) return undefined;
  if (spec.sensitive) return undefined;
  const raw = spec.derive ? spec.derive(profile) : spec.path ? readPath(profile, spec.path) : undefined;
  if (raw === null || raw === "" || raw === undefined) return undefined;
  return raw;
}

/** Human label for a canonical field id (falls back to the id itself). */
export function canonicalFieldLabel(canonicalField: string | null | undefined): string {
  if (!canonicalField) return "";
  return CANONICAL_FIELDS_BY_ID[canonicalField]?.label ?? canonicalField;
}
