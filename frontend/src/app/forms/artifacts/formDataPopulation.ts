import type { CanonicalAddress, FormData } from "../engine/types.ts";

export interface DirectAcroValue {
  pdfField: string;
  type: "text" | "checkbox";
  value: string;
  /** Prevent the raw value from being copied into population metadata. */
  sensitive?: boolean;
}

const P = "topmostSubform[0].Page1[0].";
const field = (name: string) => `${P}${name}`;

function textValue(data: FormData, id: string): string {
  const value = data[id];
  if (value === undefined || value === null || typeof value === "object") return "";
  return String(value).trim().slice(0, 500);
}

function addressValue(data: FormData, id: string): CanonicalAddress | null {
  const value = data[id];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as CanonicalAddress;
}

function addressLines(address: CanonicalAddress | null): [string, string] {
  if (!address) return ["", ""];
  const street = [address.line1, address.line2].filter(Boolean).join(", ").slice(0, 200);
  const locality = [
    address.cityOrMunicipality,
    [address.stateOrTerritory, address.postalCode].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const country = address.country?.trim();
  const includeCountry = country && !/^(united states|u\.?s\.?a?\.?|puerto rico)$/i.test(country);
  return [street, `${locality}${includeCountry ? `, ${country}` : ""}`.slice(0, 200)];
}

function pushText(values: DirectAcroValue[], pdfField: string, value: string, sensitive = false) {
  if (value) values.push({ pdfField, type: "text", value, sensitive });
}

function clearText(values: DirectAcroValue[], pdfField: string) {
  values.push({ pdfField, type: "text", value: "" });
}

function setChoice(values: DirectAcroValue[], pdfField: string, selected: boolean) {
  values.push({ pdfField, type: "checkbox", value: selected ? "Yes" : "" });
}

/**
 * Values collected by the schema-driven builder that do not belong in the
 * shared canonical business profile. Only known form codes are accepted; a
 * client cannot name arbitrary PDF fields.
 */
export function directAcroValues(formCode: string, data: FormData | undefined): DirectAcroValue[] {
  if (formCode !== "SS4" || !data) return [];
  const values: DirectAcroValue[] = [];

  // Lines 1–7.
  pushText(values, field("f1_2[0]"), textValue(data, "legal_name"));
  pushText(values, field("f1_3[0]"), textValue(data, "trade_name"));
  pushText(values, field("f1_4[0]"), textValue(data, "care_of_name"));
  const [mailStreet, mailLocality] = addressLines(addressValue(data, "mailing_address"));
  pushText(values, field("Line4ReadOrder[0].f1_5[0]"), mailStreet);
  pushText(values, field("Line4ReadOrder[0].f1_6[0]"), mailLocality);
  if (data.street_address_different === true) {
    const [physicalStreet, physicalLocality] = addressLines(addressValue(data, "street_address"));
    pushText(values, field("f1_7[0]"), physicalStreet);
    pushText(values, field("f1_8[0]"), physicalLocality);
  } else {
    clearText(values, field("f1_7[0]"));
    clearText(values, field("f1_8[0]"));
  }
  pushText(values, field("f1_9[0]"), textValue(data, "principal_location"));
  pushText(values, field("f1_10[0]"), textValue(data, "responsible_party_name"));
  pushText(values, field("f1_11[0]"), textValue(data, "responsible_party_tin"), true);

  // Lines 8a–8c.
  const llc = textValue(data, "is_llc");
  setChoice(values, field("c1_1[0]"), llc === "yes");
  setChoice(values, field("c1_1[1]"), llc === "no");
  if (llc === "yes") {
    pushText(values, field("f1_12[0]"), textValue(data, "llc_member_count"));
    const domestic = textValue(data, "llc_organized_us");
    setChoice(values, field("c1_2[0]"), domestic === "yes");
    setChoice(values, field("c1_2[1]"), domestic === "no");
  } else {
    clearText(values, field("f1_12[0]"));
    setChoice(values, field("c1_2[0]"), false);
    setChoice(values, field("c1_2[1]"), false);
  }

  // Line 9a entity checkbox and its associated detail blank.
  const classification = textValue(data, "entity_classification");
  const entityBoxes: Record<string, number> = {
    sole_proprietor: 0, estate: 1, partnership: 2, plan_administrator: 3,
    corporation: 4, trust: 5, personal_service_corporation: 6, military: 7,
    state_local_government: 8, church: 9, farmers_cooperative: 10,
    federal_government: 11, nonprofit: 12, remic: 13, tribal_government: 14, other: 15,
  };
  for (let index = 0; index < 16; index += 1) {
    setChoice(values, field(`c1_3[${index}]`), entityBoxes[classification] === index);
  }
  pushText(values, field("f1_13[0]"), textValue(data, "sole_proprietor_tin"), true);
  pushText(values, field("f1_14[0]"), textValue(data, "estate_decedent_tin"), true);
  pushText(values, field("f1_15[0]"), textValue(data, "plan_administrator_tin"), true);
  pushText(values, field("f1_16[0]"), textValue(data, "corporation_return_form"));
  pushText(values, field("f1_17[0]"), textValue(data, "trust_grantor_tin"), true);
  pushText(values, field("f1_18[0]"), textValue(data, "nonprofit_type"));
  pushText(values, field("f1_19[0]"), textValue(data, "other_entity_type"));
  pushText(values, field("f1_20[0]"), textValue(data, "group_exemption_number"));
  if (["corporation", "personal_service_corporation"].includes(classification)) {
    const incorporationType = textValue(data, "incorporation_location_type");
    pushText(values, field("f1_21[0]"), incorporationType === "state" ? textValue(data, "incorporation_state") : "");
    pushText(values, field("f1_22[0]"), incorporationType === "foreign_country" ? textValue(data, "incorporation_foreign_country") : "");
  }

  // Lines 10–15.
  const reason = textValue(data, "reason_for_applying");
  const reasonBoxes: Record<string, number> = {
    started_new_business: 0, changed_organization: 1, purchased_business: 2,
    hired_employees: 3, created_trust: 4, withholding: 5,
    created_pension: 6, other: 7, banking: 8,
  };
  for (let index = 0; index < 9; index += 1) {
    setChoice(values, field(`c1_4[${index}]`), reasonBoxes[reason] === index);
  }
  const reasonDetailFields: Record<string, string> = {
    banking: "f1_24[0]", started_new_business: "f1_25[0]", changed_organization: "f1_27[0]",
    created_trust: "f1_28[0]", created_pension: "f1_29[0]", other: "f1_30[0]",
  };
  if (reasonDetailFields[reason]) pushText(values, field(reasonDetailFields[reason]), textValue(data, "reason_detail"));
  pushText(values, field("f1_31[0]"), textValue(data, "date_business_started"));
  pushText(values, field("f1_32[0]"), textValue(data, "closing_month"));
  pushText(values, field("f1_33[0]"), textValue(data, "agricultural_employee_count"));
  pushText(values, field("f1_34[0]"), textValue(data, "household_employee_count"));
  pushText(values, field("f1_35[0]"), textValue(data, "other_employee_count"));
  setChoice(values, field("c1_5[0]"), data.form_944_election === true);
  pushText(values, field("f1_36[0]"), textValue(data, "first_wage_date_or_na"));

  // Lines 16–18.
  const activity = textValue(data, "principal_activity_category");
  const activityBoxes: Record<string, number> = {
    health_care: 0, wholesale_agent: 1, construction: 2, rental_leasing: 3,
    transportation: 4, food_service: 5, wholesale_other: 6, retail: 7,
    real_estate: 8, manufacturing: 9, finance: 10, other: 11,
  };
  for (let index = 0; index < 12; index += 1) {
    setChoice(values, field(`c1_6[${index}]`), activityBoxes[activity] === index);
  }
  pushText(values, field("f1_37[0]"), textValue(data, "principal_activity_other"));
  pushText(values, field("f1_38[0]"), textValue(data, "principal_activity_line"));
  const prior = textValue(data, "previous_ein_received");
  setChoice(values, field("c1_7[0]"), prior === "yes");
  setChoice(values, field("c1_7[1]"), prior === "no");
  if (prior === "yes") pushText(values, field("f1_39[0]"), textValue(data, "previous_ein"), true);

  // Optional third-party designee and applicant contact block.
  if (textValue(data, "use_third_party_designee") === "yes") {
    pushText(values, field("f1_40[0]"), textValue(data, "designee_name"));
    pushText(values, field("f1_41[0]"), textValue(data, "designee_phone"));
    pushText(values, field("f1_42[0]"), textValue(data, "designee_address"));
    pushText(values, field("f1_43[0]"), textValue(data, "designee_fax"));
  }
  pushText(values, field("f1_44[0]"), textValue(data, "signer_name_and_title"));
  pushText(values, field("f1_45[0]"), textValue(data, "applicant_phone"));
  pushText(values, field("f1_46[0]"), textValue(data, "applicant_fax"));

  return values;
}
