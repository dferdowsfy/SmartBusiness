// ============================================================================
// Puerto Rico Regulatory Knowledge Pack.
//
// This is the first concrete jurisdiction. Everything Puerto Rico-specific that
// used to be scattered across kb.ts, potentialRequirements.ts, page.tsx, and the
// analyze-document route now lives here as data.
// ============================================================================

import type {
  KnowledgeBase,
  KBMunicipality,
  KBBusinessType,
  KBQuestion,
  KBDocument,
  KBRule,
} from "../../rulesEngine";
import type { JurisdictionPack } from "../types";
import type { RateFact, RequirementGuidanceMap } from "../../requirementGuidance";

import municipalitiesJson from "../../../kb/municipalities.json" with { type: "json" };
import businessTypesJson from "../../../kb/business_types.json" with { type: "json" };
import questionsJson from "../../../kb/questions.json" with { type: "json" };
import documentsJson from "../../../kb/documents.json" with { type: "json" };
import rulesJson from "../../../kb/rules.json" with { type: "json" };

const kb: KnowledgeBase = {
  municipalities: municipalitiesJson as KBMunicipality[],
  businessTypes: businessTypesJson as KBBusinessType[],
  questions: questionsJson as KBQuestion[],
  documents: documentsJson as KBDocument[],
  rules: rulesJson as KBRule[],
  extensions: {
    // DOC_ROOM_TAX_RETURN is a RECURRING obligation, distinct from the
    // one-time DOC_TOURISM_REGISTRATION (Innkeeper) registration that
    // unlocks it — see requirementGuidance below and compliance/server.ts's
    // renewal lookup, which reads this array.
    renewals: [
      { document_id: "DOC_ROOM_TAX_RETURN", frequency_months: 1, citation: "Act 272-2003 (Room Occupancy Tax), 13 L.P.R.A. § 10001 et seq." },
    ],
  },
};

// The room-tax RATE is a fact that can change by legislation — modeled
// explicitly (never hardcoded into a sentence) so a future change is one
// edit here, with its own source/effective-date/supersededBy trail. Do not
// apply a proposed bill's rate until it is actually enacted and in effect.
const ROOM_TAX_RATE: RateFact = {
  rate: "7%",
  basis: "of the room rate charged per night",
  source: "Puerto Rico Tourism Company — Room Tax Division public guidance",
  effectiveDate: null,
  lastVerified: "September 2026",
  supersededBy: null,
};

const strPropertyTypeLabel = (value: unknown, es: boolean): string => {
  if (value === "apartment") return es ? "apartamento" : "apartment";
  if (value === "house") return es ? "casa" : "house";
  return es ? "propiedad" : "property";
};

// Hand-written, fact-interpolated explanations for the requirements this
// product currently gives full-depth treatment: the Short-Term Rental /
// Airbnb archetype. Every other document falls back to the generic,
// still-structured explanation in requirementGuidance.ts.
const requirementGuidance: RequirementGuidanceMap = {
  DOC_TOURISM_REGISTRATION: (req, ctx) => {
    const es = ctx.language === "es";
    const isSTR = ctx.discoveryAnswers.short_term_rental === true
      || /airbnb|short.?term rental|vacation rental|vrbo/i.test(ctx.businessTypeName || "");
    if (!isSTR) {
      return {
        summary: req.reason,
        whyThisApplies: es
          ? `Tu negocio en ${ctx.municipality || "este municipio"} atiende a turistas o visitantes, por lo que Puerto Rico requiere registro con la Compañía de Turismo.`
          : `Your business in ${ctx.municipality || "this municipality"} serves tourists or visitors, so Puerto Rico requires registration with the Tourism Company.`,
        whatThisIs: es
          ? "Este registro identifica tu negocio ante la Compañía de Turismo de Puerto Rico."
          : "This registration identifies your business with the Puerto Rico Tourism Company.",
        whatYouNeedToDo: es
          ? "Completa el registro de turismo. SmartPR usará la información de tu negocio que ya tenemos."
          : "Complete the tourism registration. SmartPR will use the business information we already have.",
        whatHappensNext: es
          ? "Una vez registrado, tu número de registro pasa a formar parte de tu expediente de cumplimiento."
          : "Once registered, your registration number becomes part of your compliance record.",
        triggeredBy: [ctx.businessTypeName, ctx.municipality].filter((v): v is string => Boolean(v)),
        satisfiesOrUnlocks: [],
        sourceReferences: [{ agency: "Compañía de Turismo de Puerto Rico", citation: "Ley de la Compañía de Turismo de Puerto Rico" }],
        lastVerified: "September 2026",
      };
    }
    const property = strPropertyTypeLabel(ctx.discoveryAnswers.str_property_type, es);
    const municipality = ctx.municipality || (es ? "tu municipio" : "your municipality");
    const hasExisting = ctx.discoveryAnswers.str_existing_innkeeper_id === "yes";
    const triggeredBy = [
      es ? "Alquiler a corto plazo" : "Short-term rental",
      es ? "Estadías ≤ 90 días" : "Stays ≤ 90 days",
      ctx.municipality,
    ].filter((v): v is string => Boolean(v));

    return {
      summary: req.reason,
      whyThisApplies: es
        ? `Vas a alquilar tu propiedad tipo ${property} en ${municipality} a huéspedes por estadías de 90 días o menos. Puerto Rico clasifica esto como alquiler a corto plazo, lo que requiere registro con la División de Impuesto de Habitación de la Compañía de Turismo.`
        : `You're renting ${/^[aeiou]/i.test(property) ? "an" : "a"} ${property} in ${municipality} to guests for stays of less than 90 days. Puerto Rico classifies this as a short-term rental, which requires registration with the Puerto Rico Tourism Company's Room Tax Division.`,
      whatThisIs: hasExisting
        ? (es
          ? "Ya nos dijiste que tienes un número de Innkeeper de la Compañía de Turismo para esta propiedad — solo confirmaremos que sigue vigente, no se inicia un registro nuevo."
          : "You told us you already have a Tourism Company Innkeeper ID for this property — SmartPR will confirm it rather than starting a new registration.")
        : (es
          ? "Tu Innkeeper ID (también llamado Registro de Turismo) te identifica como operador de hospedaje a corto plazo ante la Compañía de Turismo, para fines del Impuesto de Habitación."
          : "Your Innkeeper ID (also shown on this form as your Tourism Registration) identifies you as a short-term lodging operator with the Tourism Company, for Room Tax purposes."),
      whatYouNeedToDo: hasExisting
        ? (es ? "Confirma tu número de Innkeeper existente — SmartPR no te pedirá registrarte de nuevo." : "Confirm your existing Innkeeper number — SmartPR won't ask you to register again.")
        : (es
          ? "Completa el Registro de Innkeeper. SmartPR usará la información de la propiedad y del operador que ya nos diste."
          : "Complete your Innkeeper Registration. SmartPR will use the property and operator information you've already provided."),
      whatHappensNext: es
        ? "Una vez registrado, tu Innkeeper ID pasa a formar parte de tu expediente y SmartPR comenzará a rastrear tu declaración mensual del Impuesto de Habitación."
        : "Once registered, your Innkeeper ID becomes part of your operating record, and SmartPR will start tracking your recurring monthly Room Tax filing.",
      triggeredBy,
      satisfiesOrUnlocks: [es ? "Necesario antes de la declaración mensual del Impuesto de Habitación" : "Needed before the monthly Room Tax return can start"],
      sourceReferences: [{ agency: "Puerto Rico Tourism Company", citation: "Act 272-2003 (Room Tax) — Room Tax Division" }],
      lastVerified: "September 2026",
    };
  },

  DOC_ROOM_TAX_RETURN: (_req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: es ? "Declaración mensual del Impuesto de Habitación." : "Monthly Room Tax return.",
      whyThisApplies: es
        ? `Tu alquiler a corto plazo en ${ctx.municipality || "Puerto Rico"} genera ingresos de hospedaje sujetos al Impuesto de Habitación de Puerto Rico.`
        : `Your short-term rental in ${ctx.municipality || "Puerto Rico"} earns lodging income subject to Puerto Rico's room occupancy tax.`,
      whatThisIs: es
        ? `Puerto Rico requiere que los alquileres a corto plazo cobren un impuesto de habitación equivalente al ${ROOM_TAX_RATE.rate} de la tarifa por noche y presenten una declaración mensual, a más tardar el día 10 del mes siguiente.`
        : `Puerto Rico requires short-term rentals to collect a room occupancy tax equal to ${ROOM_TAX_RATE.rate} of the nightly room rate and submit a monthly return, due by the 10th day of the following month.`,
      whatYouNeedToDo: es
        ? "Esto es cumplimiento recurrente, no una preparación única — aparecerá en tu calendario de cumplimiento una vez que tu Innkeeper ID esté activo."
        : "This is recurring compliance, not a one-time setup step — it will appear on your compliance calendar once your Innkeeper ID is active.",
      whatHappensNext: es
        ? "SmartPR te recordará cada ciclo mensual conforme se acerque la fecha límite."
        : "SmartPR will remind you each monthly cycle as the deadline approaches.",
      triggeredBy: [es ? "Alquiler a corto plazo" : "Short-term rental", ctx.municipality].filter((v): v is string => Boolean(v)),
      satisfiesOrUnlocks: [],
      sourceReferences: [
        { agency: "Puerto Rico Tourism Company", citation: `Act 272-2003 (Room Tax) — current rate ${ROOM_TAX_RATE.rate} ${ROOM_TAX_RATE.basis}, per ${ROOM_TAX_RATE.source}` },
      ],
      lastVerified: ROOM_TAX_RATE.lastVerified,
    };
  },

  DOC_HOA_AUTHORIZATION: (_req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: es ? "Autorización de condominio / asociación de residentes." : "Condo / HOA authorization.",
      whyThisApplies: es
        ? "Nos dijiste que la propiedad es parte de un condominio o asociación de residentes. Algunas asociaciones restringen o prohíben el alquiler a corto plazo, así que SmartPR necesita evidencia de que está permitido en tu caso."
        : "You told us the property is part of a condominium or residential association. Some associations restrict or prohibit short-term rentals, so SmartPR needs evidence that it's permitted here.",
      whatThisIs: es
        ? "No es un formulario gubernamental — es prueba (reglamento del condominio, estatutos o una carta de autorización) de que la operación cumple con las reglas de tu comunidad residencial."
        : "This isn't a government form — it's evidence (your condo/HOA rules, bylaws, or an authorization letter) that your operation complies with the rules governing your residential complex.",
      whatYouNeedToDo: es
        ? "Sube el reglamento de tu condominio/asociación o una carta de autorización. SmartPR lo revisará por restricciones de alquiler a corto plazo."
        : "Upload your condo/HOA rules or an authorization letter. SmartPR will review the document for short-term-rental restrictions.",
      whatHappensNext: es
        ? "Esto queda como evidencia de respaldo junto a tu registro de Turismo — no bloquea el registro, pero forma parte de tu expediente de cumplimiento."
        : "This is kept as supporting evidence alongside your Tourism registration — it doesn't block registration, but it's part of your compliance record.",
      triggeredBy: [es ? "Propiedad en condominio / HOA" : "Condominium / HOA property", es ? "Alquiler a corto plazo" : "Short-term rental"],
      satisfiesOrUnlocks: [],
      sourceReferences: [{ agency: es ? "Reglamento de tu condominio / asociación" : "Your condo / HOA's own governing rules", citation: es ? "Ley de Condominios de Puerto Rico" : "Puerto Rico Condominium Act" }],
      lastVerified: null,
    };
  },

  // The following documents apply broadly (not just to STR) and are common
  // enough across business types that generic fallback copy was the single
  // biggest source of "sounds the same for every requirement" complaints —
  // each explanation below is grounded in what the specific document
  // actually does, not just its name/agency/business-type/municipality.
  DOC_ALCOHOL_LICENSE: (req, ctx) => {
    const es = ctx.language === "es";
    const sellsAlcohol = [ctx.discoveryAnswers.alcohol_sold, ctx.discoveryAnswers.alcohol_served, ctx.discoveryAnswers.Q_ALCOHOL_SOLD, ctx.discoveryAnswers.Q_ALCOHOL_SERVED]
      .some((v) => v === true);
    const isBarLike = /\bbar\b|nightclub/i.test(ctx.businessTypeName || "");
    const triggeredBy = [
      isBarLike ? ctx.businessTypeName : null,
      sellsAlcohol ? (es ? "Venta de alcohol" : "Selling alcohol") : null,
    ].filter((v): v is string => Boolean(v));
    return {
      summary: req.reason,
      whyThisApplies: es
        ? "Nos dijiste que este negocio venderá bebidas alcohólicas. Puerto Rico otorga licencias por separado a los negocios que venden alcohol, así que tus registros comerciales y permisos municipales habituales no autorizan por sí solos la venta de alcohol."
        : "You told us this business will sell alcoholic beverages. Puerto Rico separately licenses businesses that sell alcohol, so your normal business registrations and municipal permits do not by themselves authorize alcohol sales.",
      whatThisIs: es
        ? "Esta es la licencia de Hacienda que autoriza a tu negocio a vender bebidas alcohólicas bajo la categoría de licencia correspondiente."
        : "This is the Hacienda license that authorizes your business to sell alcoholic beverages under the applicable license category.",
      whatYouNeedToDo: es
        ? "Completa la solicitud de licencia de alcohol. SmartPR prellenará la información de tu negocio, entidad y ubicación, y te indicará qué documentos de respaldo faltan."
        : "Complete the alcohol-license application. SmartPR will prefill your business, entity and location information and tell you which supporting documents are still missing.",
      whatHappensNext: es
        ? "Una vez emitida la licencia, el negocio puede realizar legalmente las ventas de alcohol cubiertas por esa licencia. Hasta entonces, abrir el negocio no autoriza automáticamente la venta de alcohol."
        : "Once the license is issued, the business can legally conduct the alcohol sales covered by that license. Until then, opening the business does not automatically mean alcohol sales are authorized.",
      triggeredBy: triggeredBy.length ? triggeredBy : (es ? ["Venta de alcohol"] : ["Selling alcohol"]),
      satisfiesOrUnlocks: [],
      sourceReferences: [{ agency: "Departamento de Hacienda", citation: es ? "Reglamento de Bebidas Alcohólicas de Puerto Rico" : "Puerto Rico Alcoholic Beverages Act and regulations" }],
      lastVerified: "September 2026",
    };
  },

  DOC_EIN: (req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: req.reason,
      whyThisApplies: es
        ? "Tu negocio se está constituyendo como una entidad separada y necesita un número de identificación fiscal federal. El EIN es el identificador que se usa para declaraciones federales de impuestos, reportes de empleador y muchos registros posteriores."
        : "Your business is being set up as a separate entity and needs a federal tax identification number. The EIN is the identifier used for federal tax filings, employer reporting and many downstream registrations.",
      whatThisIs: es
        ? "La Carta de Confirmación del EIN del IRS es la evidencia oficial que muestra el EIN asignado a tu negocio."
        : "The IRS EIN Confirmation is the official evidence showing the EIN assigned to your business.",
      whatYouNeedToDo: es
        ? "Completa la solicitud de EIN a través de SmartPR, o sube la confirmación del IRS si ya la tienes."
        : "Complete the EIN application through SmartPR, or upload the IRS confirmation if you already have one.",
      whatHappensNext: es
        ? "SmartPR podrá reutilizar el EIN en formularios posteriores de impuestos, municipales y de licencias de Puerto Rico en lugar de pedírtelo de nuevo."
        : "SmartPR can reuse the EIN on later Puerto Rico tax, municipal and licensing forms instead of asking you for it repeatedly.",
      triggeredBy: [es ? "Formación de una entidad de negocio" : "Forming a business entity"],
      satisfiesOrUnlocks: [es ? "Habilita el Registro de Comerciante y otras declaraciones federales" : "Unlocks Merchant Registration and other federal filings"],
      sourceReferences: [{ agency: "IRS", citation: "IRS Form SS-4 — Application for Employer Identification Number" }],
      lastVerified: "September 2026",
    };
  },

  DOC_PATENTE_MUNICIPAL: (req, ctx) => {
    const es = ctx.language === "es";
    const municipality = ctx.municipality || (es ? "tu municipio" : "your municipality");
    return {
      summary: req.reason,
      whyThisApplies: es
        ? `Vas a operar un negocio con fines de lucro en ${municipality}. El municipio requiere que los negocios que realizan actividad comercial tributable allí se registren en el proceso de patente municipal.`
        : `You're operating a for-profit business in ${municipality}. The municipality requires businesses conducting taxable commercial activity there to register for the municipal patent process.`,
      whatThisIs: es
        ? `La patente municipal es el registro de impuesto comercial de ${municipality}, vinculado a la actividad del negocio y su volumen de negocio.`
        : `The municipal patent is ${municipality}'s business-tax registration tied to the business activity and its volume of business.`,
      whatYouNeedToDo: es
        ? "Para una operación nueva, SmartPR preparará la solicitud de patente municipal correspondiente usando la información de tu negocio, ubicación, entidad y empleo."
        : "For a new operation, SmartPR will prepare the applicable municipal patent filing using your business, location, entity and employment information.",
      whatHappensNext: es
        ? "Esto establece el registro de impuesto municipal que se usa para las obligaciones de patente del negocio y las futuras declaraciones de volumen de negocio."
        : "This establishes the municipal business-tax record used for the business's patent obligations and later volume-of-business filings.",
      triggeredBy: [municipality, es ? "Actividad comercial" : "Commercial activity"],
      satisfiesOrUnlocks: [],
      sourceReferences: [{ agency: es ? `Gobierno Municipal de ${municipality}` : `${municipality} Municipal Government`, citation: "Ley de Patentes Municipales de Puerto Rico (Ley 107-2020)" }],
      lastVerified: "September 2026",
    };
  },

  DOC_MERCHANT_REGISTRATION: (req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: req.reason,
      whyThisApplies: es
        ? "Estás iniciando un negocio que realizará actividad comercial tributable en Puerto Rico. Hacienda necesita que el negocio esté registrado como comerciante para poder identificar y administrar su actividad tributaria en Puerto Rico."
        : "You're starting a business that will conduct taxable commercial activity in Puerto Rico. Hacienda needs the business registered as a merchant so its Puerto Rico tax activity can be identified and administered.",
      whatThisIs: es
        ? "El Certificado de Registro de Comerciante establece el registro de comerciante del negocio ante Hacienda."
        : "The Merchant Registration Certificate establishes the business's merchant record with Hacienda.",
      whatYouNeedToDo: es
        ? "SmartPR usará la información de negocio e impuestos que ya proporcionaste para preparar la información de registro y luego almacenar el certificado emitido."
        : "SmartPR will use the business and tax information you've already provided to prepare the registration information and then store the issued certificate.",
      whatHappensNext: es
        ? "Tu registro de comerciante se convierte en una credencial tributaria reutilizable para otras declaraciones y procesos de licencia en Puerto Rico."
        : "Your merchant registration becomes a reusable tax credential for other Puerto Rico filings and licensing processes.",
      triggeredBy: es ? ["Actividad comercial tributable"] : ["Taxable commercial activity"],
      satisfiesOrUnlocks: es ? ["Se reutiliza en otras declaraciones y licencias"] : ["Reused across other filings and licenses"],
      sourceReferences: [{ agency: "Departamento de Hacienda", citation: "Código de Rentas Internas de Puerto Rico — Registro de Comerciantes" }],
      lastVerified: "September 2026",
    };
  },

  DOC_PERMISO_UNICO: (req, ctx) => {
    const es = ctx.language === "es";
    const municipality = ctx.municipality || (es ? "tu municipio" : "your municipality");
    return {
      summary: req.reason,
      whyThisApplies: es
        ? `Nos dijiste que el negocio operará desde una ubicación física en ${municipality}. El gobierno necesita determinar que la actividad comercial propuesta está autorizada en esa ubicación y que se han atendido los endosos operativos aplicables.`
        : `You told us the business will operate from a physical location in ${municipality}. The government needs to determine that the proposed commercial activity is authorized at that location and that the applicable operating endorsements have been addressed.`,
      whatThisIs: es
        ? "El Permiso Único es el proceso de permiso operativo que reúne las aprobaciones aplicables para operar el negocio desde esa ubicación."
        : "Permiso Único is the operating-permit process that brings together the approvals applicable to operating the business from that location.",
      whatYouNeedToDo: es
        ? "SmartPR preparará la información de la solicitud e identificará la propiedad y la evidencia de respaldo necesarias para el paquete del permiso."
        : "SmartPR will prepare the application information and identify the property and supporting evidence needed for the permit package.",
      whatHappensNext: es
        ? "Una vez emitido, el permiso establece que la actividad de negocio aprobada puede operar desde esa ubicación, sujeta a sus condiciones."
        : "Once issued, the permit establishes that the approved business activity can operate from that location subject to its conditions.",
      triggeredBy: [es ? "Ubicación física del negocio" : "Physical business location", municipality],
      satisfiesOrUnlocks: [],
      sourceReferences: [{ agency: "OGPe", citation: "Ley para la Reforma del Proceso de Permisos de Puerto Rico (Ley 161-2009)" }],
      lastVerified: "September 2026",
    };
  },

  DOC_LEASE_AGREEMENT: (req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: req.reason,
      whyThisApplies: es
        ? "Nos dijiste que el negocio operará desde un espacio comercial arrendado. El proceso de permisos necesita evidencia de que el negocio tiene derecho a usar esa propiedad."
        : "You told us the business will operate from leased commercial space. The permit process needs evidence that the business has the right to use that property.",
      whatThisIs: es
        ? "Tu contrato de arrendamiento es la evidencia que conecta tu negocio con la ubicación donde planea operar."
        : "Your lease is the evidence connecting your business to the location where it plans to operate.",
      whatYouNeedToDo: es
        ? "Sube el contrato de arrendamiento firmado. SmartPR usará la dirección de la propiedad y la información de ocupación para respaldar los requisitos basados en la ubicación."
        : "Upload the signed lease. SmartPR will use the property address and occupancy information from it to support location-based requirements.",
      whatHappensNext: es
        ? "Una vez validado, SmartPR podrá reutilizar el contrato como evidencia de control de propiedad en lugar de pedir la misma información en varios requisitos."
        : "Once validated, SmartPR can reuse the lease as property-control evidence instead of asking for the same information in multiple requirements.",
      triggeredBy: [es ? "Ubicación arrendada" : "Leased location"],
      satisfiesOrUnlocks: [es ? "Respalda el Permiso Único y otros requisitos basados en la ubicación" : "Supports Permiso Único and other location-based requirements"],
      sourceReferences: [{ agency: es ? "Propietario" : "Property Owner", citation: es ? "Documento privado — no es un formulario gubernamental" : "Private document — not a government-issued form" }],
      lastVerified: null,
    };
  },

  DOC_ARTICLES_ORGANIZATION: (req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: req.reason,
      whyThisApplies: es
        ? "Elegiste operar el negocio como una LLC de Puerto Rico. Una LLC no existe legalmente solo porque seleccionaste esa estructura — primero debe constituirse ante el Departamento de Estado."
        : "You chose to operate the business as a Puerto Rico LLC. An LLC does not legally exist simply because you selected the structure — it must first be formed with the Department of State.",
      whatThisIs: es
        ? "El Certificado de Organización es el documento de constitución que establece la LLC y registra información clave de la compañía."
        : "The Certificate of Organization is the formation document that establishes the LLC and records key information about the company.",
      whatYouNeedToDo: es
        ? "Completa el Certificado de Organización a través de SmartPR. Prellenaremos el nombre de tu compañía, dirección, agente residente y demás información ya recopilada."
        : "Complete the Certificate of Organization through SmartPR. We'll prefill your company name, address, resident agent and other information already collected.",
      whatHappensNext: es
        ? "Después de la constitución, SmartPR podrá usar la información de la entidad legal en las declaraciones de EIN, Hacienda, municipales y de licencias."
        : "After formation, SmartPR can use the legal entity information across EIN, Hacienda, municipal and licensing filings.",
      triggeredBy: [es ? "Estructura legal: LLC" : "Legal structure: LLC"],
      satisfiesOrUnlocks: [es ? "Habilita el EIN y los registros posteriores como entidad legal" : "Unlocks the EIN and downstream registrations as a legal entity"],
      sourceReferences: [{ agency: "Departamento de Estado", citation: "Ley General de Corporaciones de Puerto Rico (Ley 164-2009) — Compañías de Responsabilidad Limitada" }],
      lastVerified: "September 2026",
    };
  },

  DOC_CERT_INCORPORATION: (req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: req.reason,
      whyThisApplies: es
        ? "Elegiste operar el negocio como una corporación de Puerto Rico. Una corporación no existe legalmente solo porque seleccionaste esa estructura — primero debe constituirse ante el Departamento de Estado."
        : "You chose to operate the business as a Puerto Rico corporation. A corporation does not legally exist simply because you selected the structure — it must first be incorporated with the Department of State.",
      whatThisIs: es
        ? "El Certificado de Incorporación es el documento de constitución que establece la corporación y registra su información clave."
        : "The Certificate of Incorporation is the formation document that establishes the corporation and records its key information.",
      whatYouNeedToDo: es
        ? "Completa el Certificado de Incorporación a través de SmartPR. Prellenaremos el nombre de tu compañía, dirección, agente residente y demás información ya recopilada."
        : "Complete the Certificate of Incorporation through SmartPR. We'll prefill your company name, address, resident agent and other information already collected.",
      whatHappensNext: es
        ? "Después de la constitución, SmartPR podrá usar la información de la entidad legal en las declaraciones de EIN, Hacienda, municipales y de licencias."
        : "After formation, SmartPR can use the legal entity information across EIN, Hacienda, municipal and licensing filings.",
      triggeredBy: [es ? "Estructura legal: Corporación" : "Legal structure: Corporation"],
      satisfiesOrUnlocks: [es ? "Habilita el EIN y los registros posteriores como entidad legal" : "Unlocks the EIN and downstream registrations as a legal entity"],
      sourceReferences: [{ agency: "Departamento de Estado", citation: "Ley General de Corporaciones de Puerto Rico (Ley 164-2009)" }],
      lastVerified: "September 2026",
    };
  },

  DOC_WORKERS_COMP: (req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: req.reason,
      whyThisApplies: es
        ? "Nos dijiste que el negocio contratará empleados. Los empleadores de Puerto Rico generalmente necesitan cobertura de compensación por accidentes del trabajo para sus empleados, así que este requisito se agregó porque tu negocio tendrá personal."
        : "You told us the business will hire employees. Puerto Rico employers generally need workers' compensation coverage for employees, so this requirement was added because your business will have a workforce.",
      whatThisIs: es
        ? "La cobertura del CFSE provee el marco de seguro de compensación por accidentes del trabajo requerido para lesiones laborales cubiertas."
        : "CFSE coverage provides the required workers' compensation insurance framework for covered workplace injuries.",
      whatYouNeedToDo: es
        ? "Completa la inscripción correspondiente en el CFSE y sube la prueba de cobertura emitida cuando esté disponible."
        : "Complete the applicable CFSE setup and upload the issued proof of coverage when available.",
      whatHappensNext: es
        ? "SmartPR tratará la evidencia de cobertura emitida como parte de tus requisitos de preparación como empleador."
        : "SmartPR will treat the issued coverage evidence as part of your employer-readiness requirements.",
      triggeredBy: [es ? "Contratará empleados" : "Will hire employees"],
      satisfiesOrUnlocks: [],
      sourceReferences: [{ agency: "Corporación del Fondo del Seguro del Estado", citation: "Ley de Compensaciones por Accidentes del Trabajo de Puerto Rico" }],
      lastVerified: "September 2026",
    };
  },
};

export const puertoRicoPack: JurisdictionPack = {
  meta: {
    id: "pr",
    name: "Puerto Rico",
    productName: "SmartPR",
    tagline: "Puerto Rico Business Licensing Readiness",
    defaultLanguage: "en",
    languages: ["en", "es"],
  },

  geo: {
    subdivisionLabel: "Municipality",
    subdivisionLabelPlural: "Municipalities",
  },

  kb,

  docMappings: {
    // Map KB document ids to the app's legacy requirement codes so existing
    // behavior (upload matching, submission filename ordering) is preserved.
    legacyCode: {
      DOC_CERT_INCORPORATION: "certificate_of_incorporation",
      DOC_FOREIGN_CORPORATION_AUTHORIZATION: "foreign_corporation_authorization",
      DOC_LLP_REGISTRATION: "llp_registration",
      DOC_EIN: "ein_letter",
      DOC_MERCHANT_REGISTRATION: "merchant_registration",
      DOC_PERMISO_UNICO: "permiso_unico",
      DOC_PATENTE_MUNICIPAL: "patente_municipal",
      DOC_HEALTH_PERMIT: "health_permit",
      DOC_FIRE_CERT: "fire_certification",
      DOC_CFPM: "food_manager_cert",
      DOC_ALCOHOL_LICENSE: "alcohol_permit",
      DOC_LEASE_AGREEMENT: "lease_or_property_docs",
      DOC_CONTRACTOR_LICENSE: "contractor_license",
      DOC_CRIM_CLEARANCE: "crim_clearance",
      DOC_PROFESSIONAL_LICENSE: "professional_licenses",
      DOC_ENVIRONMENTAL_PERMIT: "environmental_permit",
      DOC_TRANSPORT_PERMIT: "transportation_permit",
      DOC_TOURISM_REGISTRATION: "tourism_registration",
      DOC_SIGN_PERMIT: "sign_permit",
      DOC_OUTDOOR_SEATING_AUTH: "outdoor_seating_auth",
      DOC_ENTERTAINMENT_PERMIT: "entertainment_permit",
      DOC_IMPORT_EXPORT_REG: "import_export_reg",
      DOC_HOME_DECLARATION: "home_declaration",
      DOC_HOA_AUTHORIZATION: "hoa_authorization",
      DOC_ROOM_TAX_RETURN: "room_tax_return",
    },
    recommended: [
      "DOC_INSURANCE",
      "DOC_CRIM_CLEARANCE",
      "DOC_SIGN_PERMIT",
      "DOC_OUTDOOR_SEATING_AUTH",
      "DOC_ENTERTAINMENT_PERMIT",
      "DOC_FLOOR_PLANS",
      "DOC_DBA_REGISTRATION",
    ],
    order: [
      "DOC_CERT_INCORPORATION",
      "DOC_ARTICLES_ORGANIZATION",
      "DOC_EIN",
      "DOC_MERCHANT_REGISTRATION",
      "DOC_SURI_REGISTRATION",
      "DOC_PERMISO_UNICO",
      "DOC_ZONING",
      "DOC_PATENTE_MUNICIPAL",
      "DOC_MUNICIPAL_REGISTRATION",
      "DOC_MUNICIPAL_TAX_COMPLIANCE",
      "DOC_HEALTH_PERMIT",
      "DOC_FIRE_CERT",
      "DOC_CFPM",
      "DOC_ALCOHOL_LICENSE",
      "DOC_PROFESSIONAL_LICENSE",
      "DOC_CONTRACTOR_LICENSE",
      "DOC_TOURISM_REGISTRATION",
      "DOC_HOA_AUTHORIZATION",
      "DOC_ROOM_TAX_RETURN",
    ],
  },

  flagAdvisories: {
    order: ["island", "coastal", "tourism", "historic", "metro", "capital", "industrial_port", "airport_host"],
    byFlag: {
      island: {
        flag: "island",
        flagLabel: "Island Municipality",
        document: "ATM Ferry Logistics + Island Waste Management",
        agency: "Autoridad de Transporte Marítimo (ATM) + Municipal Solid Waste",
        why:
          "Vieques and Culebra depend on Autoridad de Transporte Marítimo (ATM) ferry service for inventory, staff, and customer access, and have limited island landfill capacity. Hospitality, F&B, retail, and tour operators here typically need an ATM ferry-logistics manifest and a commercial waste-collection contract.",
        followUp:
          "Will this business transport goods, equipment, employees, food, materials, or customers to/from the island, or generate regular commercial waste?",
      },
      coastal: {
        flag: "coastal",
        flagLabel: "Coastal Municipality",
        document: "Coastal / Environmental Zone Review",
        agency: "Departamento de Recursos Naturales y Ambientales (DRNA)",
        why:
          "This municipality lies in a coastal zone. Businesses operating near the maritime-terrestrial zone may require an environmental or coastal review depending on location and activities.",
        followUp:
          "Will this business operate, build, store, or discharge anything near the coast, beach, or maritime-terrestrial zone?",
      },
      tourism: {
        flag: "tourism",
        flagLabel: "Tourism Municipality",
        document: "Tourism Registration",
        agency: "Compañía de Turismo de Puerto Rico",
        why:
          "This municipality is a designated tourism zone. Businesses serving visitors (lodging, tours, experiences, transport) may need to register with the Tourism Company.",
        followUp:
          "Will this business provide lodging, tours, experiences, or services primarily aimed at tourists/visitors?",
      },
      historic: {
        flag: "historic",
        flagLabel: "Historic District Municipality",
        document: "Historic District Review",
        agency:
          "Instituto de Cultura Puertorriqueña / Oficina Estatal de Conservación Histórica",
        why:
          "This municipality contains a designated historic district. Hospitality, F&B, retail, and personal-care businesses operating in the historic zone face additional review: facade preservation, structural/interior alteration approval, and stricter signage variances distinct from a regular sign permit.",
        followUp:
          "Will this business occupy, renovate, alter the interior, or place signage on a building within the historic district?",
      },
      metro: {
        flag: "metro",
        flagLabel: "Major Metro Municipality",
        document: "Additional Municipal Review",
        agency: "Municipal Permits Office",
        why:
          "This municipality is a major metropolitan area with additional municipal ordinances. Businesses here may face supplementary zoning, traffic, or municipal review depending on size and location.",
        followUp:
          "Will this business have significant foot/vehicle traffic, a large footprint, or operate in a dense commercial zone?",
      },
      capital: {
        flag: "capital",
        flagLabel: "Capital City (San Juan)",
        document: "San Juan-Specific Municipal Review",
        agency: "Municipio Autónomo de San Juan",
        why:
          "San Juan applies city-specific ordinances on top of the standard metro requirements (Old San Juan facade preservation, stricter noise ordinance, dedicated loading zones, San Juan Municipal Use Permit).",
        followUp:
          "Will this business operate in San Juan? It may need additional San Juan-specific permits beyond the standard metro requirements.",
      },
      industrial_port: {
        flag: "industrial_port",
        flagLabel: "Industrial / Port Corridor",
        document: "Heavy Industry & Port Compliance",
        agency: "Autoridad de los Puertos + EPA / Junta de Calidad Ambiental",
        why:
          "Ponce, Cataño, Guayanilla, Salinas, and Yabucoa sit along Puerto Rico's heavy-industry / port corridor. Manufacturing, logistics, and waste-handling businesses here face EPA/JCA point-source discharge (NPDES industrial), RCRA hazardous-waste handler registration, Title V air emissions, and Port Authority docking authorization — obligations that don't apply to ordinary coastal towns.",
        followUp:
          "Does this business manufacture, store hazardous materials, generate point-source discharge, or operate at or near a port facility?",
      },
      airport_host: {
        flag: "airport_host",
        flagLabel: "Airport-Host Municipality",
        document: "Airport-Adjacent Federal Compliance",
        agency: "U.S. Customs and Border Protection + TSA + Aerostar / Autoridad de los Puertos",
        why:
          "Carolina (LMM/SJU), Aguadilla (BQN), and Ponce (Mercedita) host customs-active airports. Air-cargo logistics, freight forwarding, importers, and airport-area car rentals face CBP customs brokerage bonds, TSA Known Shipper / Indirect Air Carrier certification, and airport-area concession agreements that don't apply elsewhere.",
        followUp:
          "Does this business ship cargo by air, clear customs, or operate as a concession in or directly adjacent to the airport?",
      },
    },
  },

  intakeCompat: {
    // Reverse of buildEngineInput()'s translation table: the wizard answer key
    // each KB question corresponds to. Kept 1:1 so snapshot-driven discovery
    // questions keep writing the same profile fields the engine already reads.
    uiKeyByQuestionId: {
      Q_FOOD_PREPARED: "food_prepared_on_site",
      Q_FOOD_SOLD: "food_sold",
      Q_FOOD_SERVED: "food_served",
      Q_ALCOHOL_SOLD: "alcohol_sold",
      Q_ALCOHOL_SERVED: "alcohol_served",
      Q_HEALTHCARE_SERVICES: "healthcare_services",
      Q_CONTROLLED_SUBSTANCES: "controlled_substances",
      Q_MEDICAL_WASTE: "medical_waste",
      Q_BIOHAZARD_WASTE: "biohazard_waste",
      Q_EMPLOYEES_HIRED: "employees_work_on_site",
      Q_COMMERCIAL_VEHICLES: "commercial_vehicles",
      Q_HAZARDOUS_MATERIALS: "hazardous_materials",
      Q_HAZARDOUS_FLUIDS: "hazardous_fluids",
      Q_CHEMICALS_USED: "chemicals_used",
      Q_PRODUCTS_MANUFACTURED: "products_manufactured",
      Q_IMPORT_EXPORT: "import_export",
      Q_PROFESSIONAL_LICENSES: "professional_licenses_required",
      Q_COMMERCIAL_SIGNAGE: "commercial_signage",
      Q_OUTDOOR_SEATING: "outdoor_seating",
      Q_LIVE_ENTERTAINMENT: "live_entertainment",
      Q_SHORT_TERM_RENTAL: "short_term_rental",
      Q_TOURISM_ACTIVITY: "tourism_activity",
      Q_OWNS_PROPERTY: "owns_property",
      Q_EXISTING_LEASE: "existing_lease",
      Q_CHILDREN_PRESENT: "children_present",
      Q_PESTICIDES: "pesticides",
      Q_AGRICULTURE_PRODUCTION: "agriculture_production",
      Q_FIREARMS_SOLD: "firearms_sold",
      Q_NONPROFIT_STATUS: "nonprofit_status",
      Q_RENOVATIONS: "renovations",
      Q_VEHICLE_REPAIR: "vehicles_repaired",
    },
    profileStageQuestionIds: [
      "Q_BUSINESS_STRUCTURE",
      "Q_PHYSICAL_LOCATION",
      "Q_HOME_BASED",
      "Q_ONLINE_ONLY",
      "Q_LOCATION_TYPE",
    ],
  },

  documentIntelligence: {
    analystSubject: "Puerto Rico business licensing",
    documentClasses: [
      "Certificate of Incorporation",
      "Articles of Organization",
      "IRS EIN Letter",
      "Merchant Registration Certificate",
      "Permiso Único",
      "Patente Municipal",
      "Health Permit",
      "Fire Certification",
      "CFPM Certificate",
      "Professional License",
      "Contractor License",
      "Tourism Registration",
      "Lease Agreement",
      "Property Deed",
      "Floor Plan",
      "Insurance Certificate",
      "Workers Compensation Certificate",
      "Medical Waste Contract",
      "Alcohol Permit",
      "Environmental Permit",
      "Sign Permit",
      "Background Check Documentation",
      "Business Address Documentation",
      "Unknown",
    ],
    extractionHints: [
      {
        match: ["ein"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (EIN Letter):
- Treat the provided text as OCR output from an official IRS EIN confirmation letter.
- Specifically hunt for and extract the 9-digit Employer Identification Number (EIN). It usually appears as XX-XXXXXXX (e.g. 66-1234567).
- Prioritize placing the clean EIN into "license_or_permit_number".
- Also extract business_name / entity_name exactly as shown.
- Validation checks MUST include "EIN Format Valid", "EIN Found", "Business Name Match".
- If no properly formatted EIN is present, set overall_status to "Missing Information" or "Needs Review".`,
      },
      {
        match: ["health", "sanitary"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Health / Sanitary Permit):
- Treat the provided text as OCR from a Departamento de Salud Health Permit.
- Extract the permit number, facility name, expiration date, and any "uso"/classification.
- Place the permit number in "permit_number".
- Validation checks MUST include "Health Permit Number Found", "Not Expired", "Facility Name Match".`,
      },
      {
        match: ["fire", "bombero"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Fire Certification):
- Treat the provided text as OCR from a Certificado de Bomberos / Fire Safety document.
- Extract the certificate number, business name, and expiration.
- Place certificate number in "license_or_permit_number".
- Validation checks MUST include "Fire Certificate Number Found", "Not Expired".`,
      },
      {
        match: ["permiso", "unico"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Permiso Único):
- Treat the provided text as OCR from an official OGPe Permiso Único.
- Extract permit number, business name, address, expiration, and use classification.
- Place permit number in "permit_number".
- Validation checks MUST include "Permit Number Found", "Address Match", "Permit Active".`,
      },
      {
        match: ["merchant", "registro"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Merchant Registration):
- Treat the provided text as OCR from Hacienda Registro de Comerciante / Merchant Certificate.
- Extract the Merchant Number (often SURI-related), business name, and address.
- Place merchant number in "merchant_number".
- Validation checks MUST include "Merchant Number Extracted", "Merchant Registration Found".`,
      },
      {
        match: ["patente"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Patente Municipal):
- Extract the municipal account / patente number, municipality name, and business name.
- Place the account number in "license_or_permit_number".`,
      },
      {
        match: ["lease"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Lease Agreement):
- Extract tenant name, property address, lease start/end dates, landlord.
- Validate that the tenant roughly matches the business context.`,
      },
    ],
  },

  requirementGuidance,
};
