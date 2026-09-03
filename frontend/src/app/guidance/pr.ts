import type { GuidanceConcept, GuidanceCondition, GuidanceSource, LocalizedText } from "./model";

const text = (en: string, es: string): LocalizedText => ({ en, es });
const condition = (key: GuidanceCondition["key"], en: string, es: string, equals?: string | boolean): GuidanceCondition => ({ key, label: text(en, es), ...(equals === undefined ? {} : { equals }) });
const source = (id: string, agency: string, citation: string, url: string, supports: string): GuidanceSource => ({ id, agency, citation, url, supports, lastVerified: "2026-09-03", sourceVersion: "public-guidance-2026-09-03" });

export const PR_GUIDANCE_SOURCES = {
  alcohol: source("SRC_GUIDANCE_ALCOHOL", "Departamento de Hacienda", "Internal Revenue Code, Subtitle E; licensing FAQs", "https://hacienda.pr.gov/sites/default/files/codigo_de_rentas_internas.pdf", "Subtitle E, sections 5050.01–5050.18: licensing alcoholic-beverage dealers and limits on licensed sales."),
  ein: source("SRC_GUIDANCE_EIN", "Internal Revenue Service", "Employer identification number — who needs an EIN; confirmation", "https://www.irs.gov/businesses/employer-identification-number", "Employers need an EIN; IRS confirmation documents the assigned number; form the legal entity before applying."),
  merchant: source("SRC_GUIDANCE_MERCHANT", "Departamento de Hacienda", "SURI — merchant location registration and certificates", "https://hacienda.pr.gov/transacciones-que-puedes-realizar-traves-de-suri", "SURI registers merchant locations and issues the Merchant Registration Certificate electronically."),
  merchantLaw: source("SRC_GUIDANCE_MERCHANT_RULE", "Departamento de Hacienda", "Regulation 8942 — Merchant Registration Certificate", "https://hacienda.pr.gov/sites/default/files/8942.pdf", "Merchant registration identifies each commercial location and whether the merchant is an IVU withholding agent."),
  permiso: source("SRC_GUIDANCE_PU", "OGPe", "Nonresidential use — permits for a business or activity", "https://www.permisos.pr.gov/", "Nonresidential uses require the Permiso Único process; check permitted use and applicable special licenses in SBP."),
  bayamon: source("SRC_GUIDANCE_PATENTE_BAYAMON", "Municipio de Bayamón", "Patente Municipal — commercial activity and provisional filing", "https://www.municipiodebayamon.com/servicios-municipales/empresas/patente-municipal/", "Municipal patent is a tax on volume of business; Bayamón provides provisional and volume-of-business filings."),
  lease: source("SRC_GUIDANCE_LEASE_BAYAMON", "Municipio de Bayamón", "Permiso Único — property evidence checklist", "https://www.municipiodebayamon.com/servicios-municipales/oficina-de-permisos/permiso-unico-pu/", "The municipal PU checklist accepts a property deed or lease as supporting evidence."),
  entity: source("SRC_GUIDANCE_ENTITY", "Departamento de Estado", "Corporations — LLC formation by Certificate of Organization", "https://www.estado.pr.gov/corporaciones", "An LLC is created through a Certificate of Organization; corporations use the incorporation process."),
  cfse: source("SRC_GUIDANCE_CFSE", "Corporación del Fondo del Seguro del Estado", "Employer information — workers compensation coverage", "https://old.fondopr.com/patronos/informacion-general/", "Employers hire compensated workers; insured employers formalize a CFSE policy, report payroll, risks and locations, and pay premiums."),
};

const employee = condition("Q_EMPLOYEES_HIRED", "Hiring employees", "Contratación de empleados", true);
const municipality = condition("municipality", "Municipality", "Municipio");
const business = condition("businessType", "Commercial activity", "Actividad comercial");
const SUBJECTS: Record<string, { en: string[]; es: string[] }> = {
  DOC_ALCOHOL_LICENSE: { en: ["alcohol"], es: ["alcohol", "alcohólic"] },
  DOC_EIN: { en: ["ein", "federal tax identifier"], es: ["ein", "identificador contributivo"] },
  DOC_MERCHANT_REGISTRATION: { en: ["merchant", "suri", "ivu"], es: ["comerciante", "suri", "ivu"] },
  DOC_PERMISO_UNICO: { en: ["permit"], es: ["permiso", "solicitud en sbp"] },
  DOC_PATENTE_MUNICIPAL: { en: ["patent", "municipal tax"], es: ["patente", "contributivo municipal"] },
  DOC_LEASE_AGREEMENT: { en: ["lease", "landlord"], es: ["contrato", "arrendador"] },
  DOC_ARTICLES_ORGANIZATION: { en: ["llc", "limited liability company", "organization"], es: ["llc", "compañía de responsabilidad limitada", "organización"] },
  DOC_WORKERS_COMP: { en: ["cfse", "coverage"], es: ["cfse", "cobertura"] },
};
function concept(requirementId: string, conditions: GuidanceCondition[][], sources: GuidanceSource[], content: [LocalizedText, LocalizedText, LocalizedText, LocalizedText], dependencies: string[] = []): GuidanceConcept {
  return { requirementId, version: "2026-09-03.1", validationStatus: "validated", subjectTerms: SUBJECTS[requirementId], conditions, sources, regulatoryReason: content[0], purpose: content[1], nextAction: content[2], consequenceOrNextStep: content[3], dependencies,
    ...(requirementId === "DOC_EIN" ? { conditionalDependencies: [
      { entityType: "limited_liability_company", documentId: "DOC_ARTICLES_ORGANIZATION" },
      ...["stock_corporation", "close_corporation", "professional_corporation", "nonprofit_nonstock_corporation"].map(entityType => ({ entityType, documentId: "DOC_CERT_INCORPORATION" })),
    ] } : {}),
  };
}

// These are reusable concepts ON the document nodes, not an alternate matcher.
// No fees, deadlines or inferred customer facts. Local sources stay local.
export const PR_REQUIREMENT_GUIDANCE: Record<string, GuidanceConcept> = {
  DOC_ALCOHOL_LICENSE: concept("DOC_ALCOHOL_LICENSE", [[condition("Q_ALCOHOL_SOLD", "Alcohol sales: Yes", "Venta de alcohol: Sí", true)]], [PR_GUIDANCE_SOURCES.alcohol], [
    text("Selling alcoholic beverages is separately licensed. Ordinary business registration does not itself authorize alcohol sales.", "La venta de bebidas alcohólicas requiere una licencia específica. El registro del negocio por sí solo no autoriza esas ventas."),
    text("The Hacienda license authorizes the category of alcoholic-beverage sales specified in it.", "La licencia de Hacienda autoriza la categoría de venta de bebidas alcohólicas que especifica."),
    text("Confirm the sales category, complete the alcohol-license application, and supply the supporting evidence requested for that category.", "Confirma la categoría de venta, completa la solicitud de licencia de alcohol y aporta la evidencia de respaldo correspondiente."),
    text("Issuance authorizes only the alcohol sales covered by that license, subject to its conditions; a prepared application is not authorization.", "La expedición autoriza solo las ventas de alcohol cubiertas por la licencia y sus condiciones; una solicitud preparada no es una autorización."),
  ]),
  DOC_EIN: concept("DOC_EIN", [[employee]], [PR_GUIDANCE_SOURCES.ein], [
    text("Employers need a federal tax identifier for employment-tax reporting. The EIN identifies the business to the IRS.", "Los patronos necesitan un identificador contributivo federal para informar contribuciones sobre el empleo. El EIN identifica al negocio ante el IRS."),
    text("IRS confirmation is official evidence of the EIN assigned to the business, not the application for that number.", "La confirmación del IRS es evidencia oficial del EIN asignado al negocio, no la solicitud de ese número."),
    text("Prepare the EIN application, or upload IRS confirmation if already assigned. Form a new legal entity before applying.", "Prepara la solicitud del EIN o sube la confirmación del IRS si ya fue asignado. Constituye la entidad antes de solicitarlo."),
    text("The assigned EIN can identify the business on tax returns and later licensing applications. Do not substitute a draft for IRS confirmation.", "El EIN asignado identifica al negocio en planillas y solicitudes de licencias. Un borrador no sustituye la confirmación del IRS."),
  ]),
  DOC_MERCHANT_REGISTRATION: concept("DOC_MERCHANT_REGISTRATION", [[business]], [PR_GUIDANCE_SOURCES.merchant, PR_GUIDANCE_SOURCES.merchantLaw], [
    text("Puerto Rico's merchant-registration process identifies commercial locations and their sales-tax treatment with Hacienda.", "El registro de comerciantes de Puerto Rico identifica los locales comerciales y su tratamiento del IVU ante Hacienda."),
    text("The certificate records the merchant's location and whether it is an IVU withholding agent; it is not a business-use permit.", "El certificado identifica la localidad del comerciante y si es agente retenedor del IVU; no es un permiso de uso."),
    text("Review business, tax and location details for registration in SURI. Upload the issued Merchant Registration Certificate when available.", "Revisa los datos del negocio, contributivos y de localidad para registrarte en SURI. Sube el Certificado de Registro de Comerciante emitido."),
    text("The issued certificate documents the merchant registration for later filings; it does not replace location or activity-specific permits.", "El certificado emitido acredita el registro de comerciante en trámites posteriores; no sustituye permisos de uso ni licencias específicas."),
  ]),
  DOC_PERMISO_UNICO: concept("DOC_PERMISO_UNICO", [[condition("Q_PHYSICAL_LOCATION", "Nonresidential business location", "Local comercial no residencial", true)]], [PR_GUIDANCE_SOURCES.permiso], [
    text("Nonresidential business use requires the Permiso Único process, including review of permitted use and applicable operating licenses.", "El uso comercial no residencial requiere el trámite de Permiso Único y revisar el uso permitido y las licencias aplicables."),
    text("This is the operating-permit process for the proposed activity at the premises, not entity formation.", "Es el trámite de permiso para la actividad propuesta en el local, no la constitución de la entidad."),
    text("Check permitted use, assemble the property evidence and applicable license information, and complete the permit application in SBP.", "Verifica el uso permitido, reúne la evidencia de la propiedad y las licencias aplicables, y completa la solicitud en SBP."),
    text("An issued permit covers the approved use at that location, subject to its terms. Preparing the package does not authorize operation.", "El permiso emitido cubre el uso aprobado en esa ubicación y sus condiciones. Preparar el paquete no autoriza operar."),
  ]),
  DOC_PATENTE_MUNICIPAL: concept("DOC_PATENTE_MUNICIPAL", [[{ ...municipality, equals: "Bayamón" }, business]], [PR_GUIDANCE_SOURCES.bayamon], [
    text("Bayamón's municipal patent taxes the volume of business from commercial activity, subject to applicable exceptions.", "La patente de Bayamón grava el volumen de negocios de la actividad comercial, sujeto a las excepciones aplicables."),
    text("The patent is a municipal business-tax obligation, separate from permission to use the premises.", "La patente es una obligación contributiva municipal, distinta del permiso para usar el local."),
    text("For a new business, prepare Bayamón's provisional patent filing; an existing operation should review the volume-of-business filing instead.", "Para un negocio nuevo, prepara la solicitud de patente provisional de Bayamón; una operación existente debe revisar la declaración de volumen de negocios."),
    text("The filing establishes the municipal tax record used for subsequent volume-of-business reporting and patent payments.", "La radicación establece el expediente contributivo municipal para futuras declaraciones de volumen de negocios y pagos de patente."),
  ]),
  DOC_LEASE_AGREEMENT: concept("DOC_LEASE_AGREEMENT", [[condition("Q_EXISTING_LEASE", "Leased premises confirmed", "Local arrendado confirmado", true), { ...municipality, equals: "Bayamón" }]], [PR_GUIDANCE_SOURCES.lease], [
    text("Bayamón's permit checklist requests a lease or deed as property evidence. A lease documents the business's right to occupy rented premises.", "El listado de permisos de Bayamón solicita contrato de arrendamiento o escritura. El contrato documenta el derecho a ocupar el local arrendado."),
    text("This is the agreement with the landlord, not a government-issued permit or proof that the proposed use is approved.", "Es el acuerdo con el arrendador, no un permiso gubernamental ni prueba de que el uso propuesto esté aprobado."),
    text("Upload the signed lease and check that the tenant and premises match the permit application.", "Sube el contrato firmado y verifica que el arrendatario y el local coincidan con la solicitud del permiso."),
    text("The lease supports the property's occupancy evidence in the permit package; the authority must still approve the proposed use.", "El contrato respalda la evidencia de ocupación del inmueble; la autoridad todavía debe aprobar el uso propuesto."),
  ]),
  DOC_ARTICLES_ORGANIZATION: concept("DOC_ARTICLES_ORGANIZATION", [[condition("entityType", "Entity: Puerto Rico LLC", "Entidad: LLC de Puerto Rico", "limited_liability_company")]], [PR_GUIDANCE_SOURCES.entity], [
    text("Selecting an LLC structure does not create the company. Puerto Rico forms an LLC through a Certificate of Organization.", "Elegir la estructura LLC no crea la compañía. Puerto Rico constituye una LLC mediante un Certificado de Organización."),
    text("The formation document establishes the limited liability company with the Department of State.", "El documento de constitución establece la compañía de responsabilidad limitada ante el Departamento de Estado."),
    text("Complete the Certificate of Organization with the company, address and resident-agent details. If already formed, provide the existing formation evidence.", "Completa el Certificado de Organización con los datos de compañía, dirección y agente residente. Si ya está constituida, aporta la evidencia existente."),
    text("After formation is accepted, use the LLC's legal identity for EIN, tax and licensing applications; a completed draft is not formation.", "Tras aceptarse la constitución, usa la identidad legal de la LLC en solicitudes de EIN, contribuciones y licencias; un borrador no constituye la entidad."),
  ]),
  DOC_WORKERS_COMP: concept("DOC_WORKERS_COMP", [[employee]], [PR_GUIDANCE_SOURCES.cfse], [
    text("Hiring workers creates employer responsibilities for workplace-injury coverage through CFSE, subject to the applicable coverage rules.", "Contratar trabajadores conlleva responsabilidades patronales de cobertura por lesiones ocupacionales mediante la CFSE, según las reglas aplicables."),
    text("The CFSE policy documents workers' compensation coverage for the reported workforce, risks and locations.", "La póliza de la CFSE documenta cobertura por accidentes del trabajo para la plantilla, riesgos y localidades informados."),
    text("Provide payroll, work-risk and location information for the CFSE policy process; upload issued coverage evidence when available.", "Aporta nómina, riesgos laborales y localidades para el trámite de póliza de la CFSE; sube la evidencia de cobertura emitida."),
    text("Issued coverage supports employer readiness. Payroll reporting and premium obligations continue; an application alone is not insurance.", "La cobertura emitida respalda la preparación patronal. Continúan las obligaciones de nómina y primas; una solicitud sola no es un seguro."),
  ]),
};
