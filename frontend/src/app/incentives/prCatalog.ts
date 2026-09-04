// A statically authored Act 60 (Puerto Rico Incentives Code) catalog.
// Mirrors guidance/pr.ts: no database/graph dependency, so it renders the
// same whether or not a knowledge-graph store is configured. Each program
// maps 1:1 to an intake `industry` value so the eligibility engine's
// automatic industry-scope check is the only gate — no invented facts.
import type { IncentiveBenefit, IncentiveProgram, IncentiveSource } from "./types";

const VERIFIED = "2026-09-04";

const ACT_60: IncentiveSource = {
  id: "SRC_ACT60",
  name: "Ley 60-2019, Código de Incentivos de Puerto Rico",
  sourceType: "statute",
  legalStatus: "effective",
  jurisdiction: "Puerto Rico",
  citation: "Ley Núm. 60-2019, según enmendada, Código de Incentivos de Puerto Rico",
  url: "https://www.ddec.pr.gov/",
  effectiveDate: "2019-07-01",
  lastVerifiedAt: VERIFIED,
  sourceVersion: "2019-60-consolidated",
};

const DDEC = { id: "AGENCY_DDEC", name: "Departamento de Desarrollo Económico y Comercio (DDEC)" };

const benefit = (id: string, name: string, description: string, amountDescription?: string): IncentiveBenefit => ({
  id, name, description, benefitType: "tax_incentive", amountDescription: amountDescription ?? null,
  citation: ACT_60.citation,
});

function program(input: {
  id: string;
  name: string;
  industry: string;
  description: string;
  benefits: IncentiveBenefit[];
  applicationProcess: string;
  sources?: IncentiveSource[];
}): IncentiveProgram {
  return {
    id: input.id, name: input.name, programType: "tax_incentive",
    administeringAgency: DDEC, applicationAgency: DDEC,
    description: input.description, benefits: input.benefits,
    geography: { level: "island_wide", municipalityIds: [], municipalityNames: [], notes: null },
    applicableIndustries: { ids: [], names: [input.industry] },
    criteria: [], evidence: [],
    applicationProcess: input.applicationProcess,
    applicationWindow: null,
    sources: input.sources ?? [ACT_60],
    status: "active", effectiveFrom: "2019-07-01", effectiveTo: null,
    lastVerifiedAt: VERIFIED, sourceVersion: "2026-09-04.1",
    supersedes: null, supersededBy: null,
    compatibleWith: [], conflictsWith: [], prerequisiteFor: [],
    automaticEligibility: false,
  };
}

export const PR_ACT60_CATALOG: IncentiveProgram[] = [
  program({
    id: "PR_ACT60_TOURISM", name: "Tourism and Visitors Economy Incentive", industry: "Accommodation & Tourism",
    description: "Act 60's tourism chapter offers a reduced corporate tax rate and municipal exemptions for hotels, resorts, guesthouses, and other visitor-economy businesses.",
    benefits: [
      benefit("b1", "Fixed corporate tax rate", "A fixed corporate tax rate, typically 4%, on income from the tourism activity."),
      benefit("b2", "Municipal development tax exemption", "A 100% exemption on municipal development taxes."),
      benefit("b3", "Municipal license and property tax exemption", "Up to a 100% exemption on municipal license and property taxes."),
      benefit("b4", "Tourism tax credits", "30% to 40% tax credits on total eligible project costs for building or substantially renovating hotels, resorts, guesthouses, and theme parks."),
    ],
    applicationProcess: "Apply for a tourism tax exemption decree through DDEC's Tourism Incentives Office before or during project development.",
  }),
  program({
    id: "PR_ACT60_AGRICULTURE", name: "Agricultural Development Incentive", industry: "Agriculture & Farming",
    description: "Act 60's agricultural chapter exempts most income and property associated with bona fide farming activity.",
    benefits: [
      benefit("b1", "Income tax exemption", "A 90% income tax exemption on income derived directly from agricultural activities."),
      benefit("b2", "Property tax exemption", "A 100% exemption on real and personal property taxes."),
      benefit("b3", "Municipal license tax exemption", "A 100% exemption on municipal license taxes."),
      benefit("b4", "IVU exemption on inputs", "A 100% exemption on Sales and Use Tax (IVU) for raw materials and farming equipment."),
    ],
    applicationProcess: "Apply for Bona Fide Farmer certification and the related tax exemption decree through DDEC / Departamento de Agricultura.",
  }),
  program({
    id: "PR_ACT60_FILM", name: "Creative Industries and Film Production Incentive", industry: "Arts, Entertainment & Recreation",
    description: "Act 60's creative-industries chapter credits production spending and offers a reduced rate for local studios and distribution entities.",
    benefits: [
      benefit("b1", "Resident production tax credit", "A 40% tax credit on production expenditures paid to Puerto Rico residents."),
      benefit("b2", "Non-resident talent tax credit", "A 20% tax credit for payments made to non-resident talent."),
      benefit("b3", "Studio corporate tax rate", "A 4% corporate tax rate for local film studios, sound stages, and distribution entities."),
    ],
    applicationProcess: "Apply through DDEC's Puerto Rico Film Commission before production begins to preserve credit eligibility.",
  }),
  program({
    id: "PR_ACT60_AUTOMOTIVE_EXPORT", name: "Export Services Framework — Automotive", industry: "Automotive",
    description: "Automotive design, logistics consulting, or software built for international dealerships can qualify as an export service under Act 60. Local dealerships and repair shops serving only the island's retail market do not qualify.",
    benefits: [
      benefit("b1", "Export-services corporate tax rate", "A 4% corporate tax rate on income from qualifying export activity."),
    ],
    applicationProcess: "Confirm the activity is genuinely export-oriented (clients and revenue outside Puerto Rico), then apply for an export-services tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_BEAUTY_EXPORT", name: "Export Services Framework — Beauty & Personal Care", industry: "Beauty & Personal Care",
    description: "Manufacturing localized cosmetics, or providing corporate training/franchise management for international beauty brands from Puerto Rico, can qualify as an export service. Local salons, spas, and storefronts serving only island customers do not qualify.",
    benefits: [
      benefit("b1", "Export-services corporate tax rate", "A 4% corporate tax rate on income from qualifying export activity."),
    ],
    applicationProcess: "Confirm the activity is genuinely export-oriented, then apply for an export-services tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_CONSTRUCTION", name: "Infrastructure and Housing Development Incentive", industry: "Construction",
    description: "Act 60 and related opportunity-zone rules offer exemptions, credits, and accelerated depreciation for developers building affordable housing, multi-family units, or state-partnered infrastructure.",
    benefits: [
      benefit("b1", "Development tax exemptions and credits", "Specialized tax exemptions, credits, and accelerated depreciation for qualifying housing or infrastructure development."),
      benefit("b2", "Opportunity Zone deferral", "Projects sited within a designated distressed area (Opportunity Zone) can unlock tax deferrals and reduced capital gains treatment."),
    ],
    applicationProcess: "Apply for the applicable housing/infrastructure decree through DDEC, or confirm Opportunity Zone status for the project site.",
  }),
  program({
    id: "PR_ACT60_EDUCATION_EXPORT", name: "Export Services Framework — Education & Training", industry: "Education & Training",
    description: "Companies producing educational modules, digital courses, online programs, or remote corporate training for audiences outside Puerto Rico can qualify as an export service.",
    benefits: [
      benefit("b1", "Export-services corporate tax rate", "A 4% corporate tax rate on income from qualifying export activity."),
      benefit("b2", "Dividend distribution exemption", "A 100% tax exemption on dividend distributions from the exempt business."),
    ],
    applicationProcess: "Confirm the activity is genuinely export-oriented, then apply for an export-services tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_ENERGY", name: "Green Energy and Renewable Resources Incentive", industry: "Energy & Utilities",
    description: "Act 60's green-energy chapter offers a reduced rate and tax exemptions for businesses generating power from renewable systems.",
    benefits: [
      benefit("b1", "Renewable-generation corporate tax rate", "A fixed 4% corporate tax rate for businesses generating power via renewable systems (solar, wind, hydro)."),
      benefit("b2", "Excise tax exemption", "A 100% exemption from state excise taxes on energy-generation machinery and equipment."),
      benefit("b3", "IVU exemption on equipment", "A 100% exemption from Sales and Use Tax (IVU) on energy-generation machinery and equipment."),
    ],
    applicationProcess: "Apply for a green-energy tax exemption decree through DDEC before installing generation equipment.",
  }),
  program({
    id: "PR_ACT60_FINANCE_IFE", name: "International Financial Entities (IFE) / Insurers Incentive", industry: "Finance & Insurance",
    description: "Act 60 offers a reduced corporate tax rate for offshore banking, international asset management, and cross-border insurance risk, provided the business does not transact with local Puerto Rico residents.",
    benefits: [
      benefit("b1", "IFE corporate tax rate", "A 4% corporate tax rate for offshore banking units, international asset managers, and clearinghouses that do not transact business with local residents."),
      benefit("b2", "International insurer/reinsurer rate", "A preferential corporate tax rate (as low as 1–2% in some configurations) for managing cross-border insurance risk."),
    ],
    applicationProcess: "Apply for an IFE or international insurer license and decree through the Oficina del Comisionado de Instituciones Financieras (OCIF) and DDEC.",
  }),
  program({
    id: "PR_ACT60_FOOD_MANUFACTURING", name: "Manufacturing Framework — Food & Beverage Export", industry: "Food & Beverage",
    description: "Companies that process, blend, or package food or beverages on the island for export qualify under the industrial tax decree. Local restaurants, bars, and cafes serving island customers operate under standard Puerto Rico corporate tax rates instead.",
    benefits: [
      benefit("b1", "Manufacturing corporate tax rate", "A 4% corporate tax rate on qualifying export food/beverage manufacturing income."),
    ],
    applicationProcess: "Confirm the activity is manufacturing-for-export rather than local food service, then apply for an industrial tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_PHYSICIAN", name: "Resident Physician Incentive", industry: "Healthcare",
    description: "Act 60 offers a reduced personal income tax rate on income from medical professional services practiced locally, intended to retain physicians on the island. Telehealth or medical-billing platforms serving international clinics can separately qualify as an export service.",
    benefits: [
      benefit("b1", "Resident physician tax rate", "A 4% personal income tax rate on income derived from medical professional services practiced locally."),
      benefit("b2", "Medical services export rate", "A 4% corporate tax rate for telehealth or medical-billing platforms serving international clinics."),
    ],
    applicationProcess: "Apply for the physician or medical-export decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_IT_EXPORT", name: "Export Services Framework — Information Technology", industry: "Information Technology",
    description: "Software development, blockchain engineering, cloud hosting, SaaS, cybersecurity, and tech-support services provided to entities outside Puerto Rico qualify as a core export service.",
    benefits: [
      benefit("b1", "Export-services corporate tax rate", "A 4% corporate tax rate on qualifying export-services income."),
      benefit("b2", "Dividend distribution exemption", "A 100% exemption on distributed dividends from the exempt business."),
    ],
    applicationProcess: "Apply for an export-services tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_MANUFACTURING", name: "Manufacturing and Industrial Development Incentive", industry: "Manufacturing",
    description: "Act 60's industrial-development chapter offers a fixed reduced corporate tax rate for manufacturers, with a further-reduced rate available for pioneer or critical-IP projects.",
    benefits: [
      benefit("b1", "Industrial corporate tax rate", "A fixed 4% corporate tax rate, which can drop to 1–2% for pioneer mega-projects or critical intellectual property."),
      benefit("b2", "Profit distribution exemption", "A 100% tax exemption on distributed profits."),
      benefit("b3", "Royalty/license withholding exemption", "A significant exemption on royalty or license payments made to foreign entities."),
    ],
    applicationProcess: "Apply for an industrial tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_PROFESSIONAL_EXPORT", name: "Professional Services Framework (Core Export Industry)", industry: "Professional Services",
    description: "Consultants, lawyers, architects, marketing agencies, corporate headquarters, and remote project managers exporting their services to clients outside Puerto Rico qualify as a core export industry.",
    benefits: [
      benefit("b1", "Export-services corporate tax rate", "A 4% corporate tax rate on qualifying export-services income."),
      benefit("b2", "Dividend tax exemption", "A 100% dividend tax exemption on distributions from the exempt business."),
    ],
    applicationProcess: "Apply for an export-services tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_REAL_ESTATE", name: "Real Estate Investment Vehicles & Resident Investor Incentive", industry: "Real Estate",
    description: "Structured real estate investment vehicles and the Individual Investor Resident Decree offer distinct Act 60 tax treatment for Puerto Rico real estate.",
    benefits: [
      benefit("b1", "REIT pass-through exemption", "Highly structured vehicles investing in local real estate projects (REIT-style structures) can receive substantial pass-through tax exemptions."),
      benefit("b2", "Resident investor capital gains rate", "Individuals buying local real estate as a primary residence under the Individual Investor Resident Decree secure a 0% (pre-2027, grandfathered track) or 4% (2027 onward, new track) rate on post-move long-term capital gains when selling."),
    ],
    applicationProcess: "Apply for the applicable REIT structuring or Individual Investor Resident Decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_RETAIL_EXPORT", name: "E-Commerce Export Incentive", industry: "Retail",
    description: "Traditional physical retail stores do not qualify for Act 60 corporate tax exemptions. E-commerce drop-shippers, digital marketplaces, or distribution hubs that store inventory locally and ship items to global customers can qualify as an export activity.",
    benefits: [
      benefit("b1", "Export-services corporate tax rate", "A 4% corporate tax rate on qualifying e-commerce export income."),
    ],
    applicationProcess: "Confirm the activity is export-oriented e-commerce rather than local storefront retail, then apply through DDEC.",
  }),
  program({
    id: "PR_ACT60_LOGISTICS_EXPORT", name: "Export Logistics Incentive", industry: "Transportation & Logistics",
    description: "Companies using Puerto Rico as an international maritime transport hub, hub-and-spoke freight forwarder, or cross-border shipping management platform qualify for the export logistics rate.",
    benefits: [
      benefit("b1", "Export logistics corporate tax rate", "A 4% corporate tax rate on qualifying export logistics income."),
    ],
    applicationProcess: "Apply for an export-services tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_WHOLESALE_EXPORT", name: "Export Goods Incentive", industry: "Wholesale Distribution",
    description: "Businesses that buy wholesale merchandise locally or internationally, hold inventory on the island, and redistribute those goods exclusively to foreign markets qualify for the export goods decree.",
    benefits: [
      benefit("b1", "Export goods corporate tax rate", "A 4% corporate tax rate on qualifying export-goods income."),
    ],
    applicationProcess: "Confirm the redistribution is exclusively to markets outside Puerto Rico, then apply through DDEC.",
  }),
  program({
    id: "PR_ACT60_GOVT_CONTRACTOR_EXPORT", name: "Export Services Framework — Government Contractor", industry: "Government Contractor",
    description: "Federal or international government contractors who perform administrative work, software design, consulting, or project tracking from a Puerto Rico office for overseas agencies qualify as an export service.",
    benefits: [
      benefit("b1", "Export-services corporate tax rate", "A 4% corporate tax rate on qualifying export-services income."),
    ],
    applicationProcess: "Confirm the work is performed for agencies outside Puerto Rico, then apply for an export-services tax exemption decree through DDEC.",
  }),
  program({
    id: "PR_ACT60_NONPROFIT", name: "Nonprofit Exemption Decree", industry: "Nonprofit / Religious Organization",
    description: "Certified charitable entities, foundations, and religious organizations receive a full exemption from corporate, municipal, and property taxes, and are eligible recipients of the mandatory annual charitable donations required from Act 60 individual investors.",
    benefits: [
      benefit("b1", "Full tax exemption", "A 100% exemption from corporate income, municipal, and property taxes for certified nonprofit/religious entities."),
      benefit("b2", "Eligible investor-donation recipient", "Eligibility to receive the mandatory annual $15,000 charitable donation required from Act 60 individual investor decree holders."),
    ],
    applicationProcess: "Apply for nonprofit certification and the related exemption decree through DDEC and Departamento de Hacienda.",
  }),
  program({
    id: "PR_ACT60_RND", name: "Research and Development (R&D) Incentive", industry: "Other",
    description: "For any cross-functional or otherwise unlisted industry investing in scientific advancement, Act 60 offers a substantial tax credit for eligible R&D, clinical trial, or intellectual-property development spending.",
    benefits: [
      benefit("b1", "R&D investment tax credit", "A 50% tax credit for eligible investments in local R&D, clinical trials, or home-grown intellectual property development."),
    ],
    applicationProcess: "Apply for the R&D tax credit through DDEC, documenting the qualifying research or development spending.",
  }),
];
