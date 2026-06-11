"use client";

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, AlertTriangle, Info, Upload, FileText, 
  ArrowRight, RefreshCw, Download, Building2 
} from 'lucide-react';

// SmartPR Local Testing Demo
// Implements the designed 9-step readiness flow using local state + optional backend

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface BusinessProfile {
  name: string;
  municipality: string;
  industry: string;
  business_structure: string;
  is_home_based: boolean;
  employee_count?: number;
}

interface Finding {
  severity: 'critical' | 'warning' | 'informational';
  title: string;
  description: string;
  recommended_action: string;
}

interface Requirement {
  code: string;
  name: string;
  mandatory: boolean;
  status: 'pending' | 'uploaded' | 'passed' | 'warning';
  agency: string;
  reason: string;
}

const INDUSTRIES = ['Restaurant', 'Medical Office', 'Retail Store', 'Professional Services', 'Construction', 'Tourism'];
const MUNICIPALITIES = ['San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Aguada', 'Other'];

// Core compute logic - matches the approved rules engine design + seed data
function computeRequirements(profile: BusinessProfile, answers: Record<string, any>): Requirement[] {
  const reqs: Requirement[] = [];
  const industry = profile.industry;
  const isHome = profile.is_home_based;
  const hasFood = answers.has_food_service || industry === 'Restaurant';
  const hasAlcohol = answers.alcohol_sales;
  const isMedical = industry === 'Medical Office' || answers.provides_healthcare;

  // Universal core (from design + real PR sources: Dept of State, Hacienda, OGPe, Municipal)
  reqs.push(
    { code: 'certificate_of_incorporation', name: 'Certificate of Incorporation / LLC Formation', mandatory: true, status: 'pending', agency: 'Department of State', reason: 'Required for all formal business entities in Puerto Rico.' },
    { code: 'ein_letter', name: 'IRS EIN Confirmation Letter', mandatory: true, status: 'pending', agency: 'IRS', reason: 'Federal tax ID required for all businesses operating in PR.' },
    { code: 'merchant_registration', name: 'Merchant Registration Certificate (Registro de Comerciante)', mandatory: true, status: 'pending', agency: 'Hacienda (SURI)', reason: 'Mandatory to legally operate as a merchant and collect sales tax (IVU).' },
    { code: 'permiso_unico', name: 'Single Use Permit / Permiso Único', mandatory: true, status: 'pending', agency: 'OGPe / SBP', reason: 'Consolidates use permit, zoning, and often fire/sanitary approvals via the Single Business Portal.' },
    { code: 'patente_municipal', name: `Patente Municipal (${profile.municipality})`, mandatory: true, status: 'pending', agency: 'Municipal Government', reason: `Municipal business tax/license required in the ${profile.municipality} municipality. Usually requires Permiso Único first.` }
  );

  // Food / Restaurant triggered (Departamento de Salud + Bomberos)
  if (hasFood) {
    reqs.push(
      { code: 'health_permit', name: 'Health / Sanitary Permit', mandatory: true, status: 'pending', agency: 'Departamento de Salud', reason: 'Required for any business preparing or serving food. Follows FDA Food Code (CFPM also needed).' },
      { code: 'fire_certification', name: 'Fire Safety Certification (Certificado de Bomberos)', mandatory: true, status: 'pending', agency: 'Cuerpo de Bomberos', reason: 'Fire prevention and safety inspection certificate required for physical commercial locations, especially food service.' },
      { code: 'food_manager_cert', name: 'Certified Food Protection Manager (CFPM)', mandatory: true, status: 'pending', agency: 'Departamento de Salud', reason: 'Person-in-charge must hold current accredited CFPM certification for potentially hazardous food handling.' }
    );
  }

  // Alcohol additional
  if (hasAlcohol) {
    reqs.push({ code: 'alcohol_permit', name: 'Alcohol Sales / Beverage Permit', mandatory: true, status: 'pending', agency: 'Hacienda / OGPe', reason: 'Additional licensing for alcohol sales and service.' });
  }

  // Non home-based physical location
  if (!isHome) {
    reqs.push({ code: 'lease_or_property_docs', name: 'Lease Agreement or Property Docs + Floor Plans / Photos', mandatory: true, status: 'pending', agency: 'OGPe / Municipal', reason: 'Proof of legal right to use the commercial space. Required for Permiso Único and most municipal approvals.' });
  }

  // Medical / Professional services
  if (isMedical) {
    reqs.push(
      { code: 'professional_licenses', name: 'Professional Licenses for Staff', mandatory: true, status: 'pending', agency: 'Department of State Examining Boards', reason: 'Individual licenses for physicians, nurses, therapists, etc. (searchable via PCS lookup).' },
      { code: 'malpractice_insurance', name: 'Professional Liability / Malpractice Insurance', mandatory: false, status: 'pending', agency: 'Various', reason: 'Strongly recommended / often required for healthcare providers.' }
    );
  }

  // Construction
  if (industry === 'Construction') {
    reqs.push({ code: 'contractor_license', name: 'Contractor License / Trade Certification', mandatory: true, status: 'pending', agency: 'Department of State', reason: 'Required for construction trades and public work.' });
  }

  // Retail general
  if (industry === 'Retail Store') {
    reqs.push({ code: 'crim_clearance', name: 'CRIM Property Tax Clearance', mandatory: false, status: 'pending', agency: 'CRIM', reason: 'Often requested by municipalities for Patente.' });
  }

  return reqs;
}

export default function SmartPRDemo() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [profile, setProfile] = useState<BusinessProfile>({
    name: 'Mi Restaurante Boricua LLC',
    municipality: 'San Juan',
    industry: 'Restaurant',
    business_structure: 'llc',
    is_home_based: false,
    employee_count: 8,
  });
  const [discoveryAnswers, setDiscoveryAnswers] = useState<Record<string, any>>({});
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useBackend, setUseBackend] = useState(false); // Toggle for real backend testing
  const [businessId, setBusinessId] = useState<string | null>(null);

  const BACKEND_URL = 'http://localhost:8000';

  // Recompute requirements whenever profile or answers change (demo of the rules engine)
  const updateRequirements = (newProfile?: BusinessProfile, newAnswers?: Record<string, any>) => {
    const p = newProfile || profile;
    const a = newAnswers || discoveryAnswers;
    const computed = computeRequirements(p, a);
    setRequirements(computed);
  };

  // Dynamic follow-up questions based on design
  const getFollowUpQuestions = (ind?: string) => {
    const industry = ind || profile.industry;
    const q: Record<string, any> = {};
    if (industry === 'Restaurant') {
      q.has_food_service = true;
      q.alcohol_sales = false;
      q.indoor_seating = true;
      q.commercial_kitchen = true;
    }
    if (industry === 'Medical Office') {
      q.licensed_professionals = 2;
      q.provides_healthcare = true;
    }
    return q;
  };

  // Auto-recompute when key profile fields change
  useEffect(() => {
    if (currentStep >= 2) {
      const newAnswers = { ...discoveryAnswers, ...getFollowUpQuestions() };
      setDiscoveryAnswers(newAnswers);
      updateRequirements(profile, newAnswers);
    }
  }, [profile.industry, profile.municipality, profile.is_home_based, currentStep]);

  const progress = Math.round(((currentStep - 1) / 8) * 100);

// Quick loaders for demo readiness - instantly shows different requirements per business type
const loadExample = (example: Partial<BusinessProfile>) => {
  const newProfile = { ...profile, ...example };
  setProfile(newProfile);
  const newAnswers = { ...getFollowUpQuestions(newProfile.industry) };
  setDiscoveryAnswers(newAnswers);
  const computed = computeRequirements(newProfile, newAnswers);
  setRequirements(computed);
  setReadinessScore(null);
  setFindings([]);
  setUploadedDocs([]);
  setCurrentStep(3); // Go straight to the checklist so user sees the exact requirements
};

  // Step 1: Save profile + discovery (calls backend optionally)
  const handleStartDiscovery = async () => {
    setIsLoading(true);
    const answers = { ...getFollowUpQuestions() };

    try {
      let bid = businessId;
      if (useBackend) {
        const res = await fetch(`${BACKEND_URL}/api/v1/businesses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        });
        const data = await res.json();
        bid = data.id;
        setBusinessId(bid);

        await fetch(`${BACKEND_URL}/api/v1/businesses/${bid}/discovery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers, completed: true }),
        });
      } else {
        bid = 'local-' + Date.now();
        setBusinessId(bid);
      }

      setDiscoveryAnswers(answers);
      // Immediately compute requirements so user sees exactly what is needed for this business
      const computed = computeRequirements(profile, answers);
      setRequirements(computed);
      setCurrentStep(3); // Jump to the rich checklist view for best demo experience
    } catch (e) {
      // Fallback to local mode
      setUseBackend(false);
      const bid = 'local-' + Date.now();
      setBusinessId(bid);
      setDiscoveryAnswers(answers);
      const computed = computeRequirements(profile, answers);
      setRequirements(computed);
      setCurrentStep(3);
    } finally {
      setIsLoading(false);
    }
  };

  // Load / recompute requirements (now powered by the design-accurate compute function)
  const loadRequirements = async () => {
    setIsLoading(true);
    try {
      if (useBackend && businessId) {
        const res = await fetch(`${BACKEND_URL}/api/v1/businesses/${businessId}/requirements`);
        const data = await res.json();
        // Map backend response into our richer structure (fallback to compute for display)
        const computed = computeRequirements(profile, discoveryAnswers);
        setRequirements(computed);
      } else {
        const computed = computeRequirements(profile, discoveryAnswers);
        setRequirements(computed);
      }
      setCurrentStep(3);
    } catch (e) {
      setUseBackend(false);
      const computed = computeRequirements(profile, discoveryAnswers);
      setRequirements(computed);
      setCurrentStep(3);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4-5: Document upload + REAL AI identification/extraction (when backend enabled)
  const handleMockUpload = async (reqCode: string) => {
    const docName = `${reqCode.replace(/_/g, ' ')}.pdf`;
    
    // Simulated document text for the AI (in real use, this would come from OCR / file text)
    const simulatedContent = `This is a ${reqCode.replace(/_/g, ' ')} for ${profile.name || "the business"} located in ${profile.municipality}. Issued recently. Contains business name, dates, and official stamps.`;

    let analysis: any = null;
    let extracted = {
      business_name: profile.name || "ABC Restaurant LLC",
      entity_name: profile.name || "ABC Restaurant LLC",
      issue_date: "2024-03-15",
      expiration_date: reqCode.includes("insurance") ? "2025-03-14" : "2026-01-01",
    };

    if (useBackend && businessId) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/businesses/${businessId}/analyze-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: docName,
            content: simulatedContent
          })
        });
        const data = await res.json();
        analysis = data.analysis;
        
        if (analysis?.extracted) {
          extracted = { ...extracted, ...analysis.extracted };
        }
        
        // Auto-match requirement if AI identified one
        if (analysis?.matched_requirement_code && analysis.matched_requirement_code !== reqCode) {
          // Could auto-link here in a fuller implementation
        }
      } catch (e) {
        console.warn("Backend AI analysis failed, using local simulation", e);
      }
    }

    const newDoc = {
      id: Date.now(),
      requirement_code: reqCode,
      name: docName,
      extracted,
      ai_analysis: analysis
    };
    setUploadedDocs(prev => [...prev, newDoc]);

    // Mark corresponding requirement as uploaded
    const updatedReqs = requirements.map(r =>
      r.code === reqCode ? { ...r, status: 'uploaded' as const } : r
    );
    setRequirements(updatedReqs);

    // Live update (still client-side for responsiveness, real validation uses backend AI)
    const stillMissing = updatedReqs.filter(r => r.mandatory && r.status === 'pending').length;
    const newScore = Math.max(45, 92 - (stillMissing * 9));
    setReadinessScore(newScore);

    const newFindings: Finding[] = [];
    if (stillMissing > 0) {
      newFindings.push({
        severity: 'critical',
        title: `${stillMissing} Mandatory Item(s) Still Needed`,
        description: 'Some required permits or documents remain outstanding for this specific business profile.',
        recommended_action: 'Upload the highlighted items or obtain them from the listed agency.'
      });
    }
    if (profile.industry === 'Restaurant' || discoveryAnswers.has_food_service) {
      newFindings.push({
        severity: 'warning',
        title: 'Confirm all food safety items',
        description: 'Health Permit + CFPM + Fire Certification are all critical for food businesses.',
        recommended_action: 'Ensure the CFPM certificate name matches the business owner on file.'
      });
    }
    setFindings(newFindings);
  };

  // Step 6-7: Run validation (calls backend mock or local logic)
  const runValidation = async () => {
    setIsLoading(true);
    try {
      let score = 68;
      let newFindings: Finding[] = [];

      if (useBackend && businessId) {
        const res = await fetch(`${BACKEND_URL}/api/v1/businesses/${businessId}/validations`, { method: 'POST' });
        const data = await res.json();
        score = data.readiness_score || 68;
        
        const fRes = await fetch(`${BACKEND_URL}/api/v1/businesses/${businessId}/findings`);
        newFindings = await fRes.json();
      } else {
        // Local simulation of the Validation Engine from design
        const missing = requirements.filter(r => r.mandatory && r.status === 'pending').length;
        score = Math.max(40, 95 - (missing * 12));

        newFindings = [];
        if (missing > 0) {
          newFindings.push({
            severity: 'critical',
            title: `${missing} Critical Items Missing`,
            description: 'Required documents or permits have not been uploaded or validated.',
            recommended_action: 'Upload the missing items shown in the checklist.'
          });
        }
        if (profile.industry === 'Restaurant') {
          newFindings.push({
            severity: 'warning',
            title: 'Insurance expires soon',
            description: 'One of your insurance certificates is approaching expiration.',
            recommended_action: 'Renew and re-upload the certificate before submission.'
          });
        }
        newFindings.push({
          severity: 'informational',
          title: 'Municipal recommendation recommended',
          description: 'Some municipalities require a local planning letter.',
          recommended_action: 'Contact your municipal Oficina de Planificación.'
        });
      }

      setReadinessScore(score);
      setFindings(newFindings);
      setCurrentStep(7);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 9: "Generate Package" (downloads a realistic text report)
  const generatePackage = async () => {
    const content = `SMARTPR READINESS PACKAGE (LOCAL DEMO)
Business: ${profile.name || 'Unnamed Business'}
Municipality: ${profile.municipality}
Industry: ${profile.industry}
Readiness Score: ${readinessScore ?? 'N/A'}%

=== REQUIRED ITEMS STATUS ===
${requirements.map(r => `${r.status === 'passed' || r.status === 'uploaded' ? '✓' : '⬜'} ${r.name}`).join('\n')}

=== FINDINGS ===
${findings.map(f => `[${f.severity.toUpperCase()}] ${f.title}\n${f.description}\n→ ${f.recommended_action}`).join('\n\n')}

=== DISCLAIMER ===
This is a LOCAL DEMO only. SmartPR determines READINESS for submission.
It does NOT approve, grant, or issue any license. All approvals are made exclusively
by the Government of Puerto Rico and its agencies.

Generated: ${new Date().toLocaleString()}
Rule Set: demo-v0.1 (local)
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartPR-Readiness-${(profile.name || 'business').replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    // In a real app this would trigger the backend PDF generation
    alert('Package downloaded (demo .txt). In production this produces the professional bilingual PDF described in the design.');
    setCurrentStep(9);
  };

  const completedMandatory = requirements.filter(r => r.mandatory && (r.status === 'uploaded' || r.status === 'passed')).length;
  const totalMandatory = requirements.filter(r => r.mandatory).length;
  const checklistProgress = totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0A2540] rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-xl tracking-tight text-[#0A2540]">SmartPR</div>
              <div className="text-[10px] text-[#0A2540]/60 -mt-1">LOCAL DEMO • READINESS ONLY</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={useBackend} 
                onChange={(e) => setUseBackend(e.target.checked)}
                className="accent-[#0D9488]"
              />
              <span className="text-[#0A2540]/80">Use local backend (port 8000)</span>
            </label>
            <div className="text-xs px-3 py-1 bg-[#0A2540]/10 rounded-full text-[#0A2540]/70">
              {useBackend ? 'Connected to FastAPI + Grok AI (document ID + validation)' : 'Pure client-side mock'}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2 text-sm">
            <div className="font-medium text-[#0A2540]">SmartPR Readiness Workflow — Step {currentStep} of 9</div>
            <div className="text-[#0A2540]/60">{progress}% complete</div>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#0D9488] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* STEP 1: Business Discovery */}
        {currentStep === 1 && (
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0A2540] mb-2">Step 1 — Business Discovery</h1>
            <p className="text-[#0A2540]/80 mb-8">Answer a few questions. Follow-ups appear based on your industry (exactly as designed).</p>

            <div className="bg-white border rounded-2xl p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">Business Name</label>
                <input 
                  className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" 
                  placeholder="ABC Restaurant LLC" 
                  value={profile.name} 
                  onChange={e => setProfile({ ...profile, name: e.target.value })} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">Municipality</label>
                  <select className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" value={profile.municipality} onChange={e => setProfile({...profile, municipality: e.target.value})}>
                    {MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">Industry</label>
                  <select className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" value={profile.industry} onChange={e => setProfile({...profile, industry: e.target.value})}>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">Business Structure</label>
                  <select className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" value={profile.business_structure} onChange={e => setProfile({...profile, business_structure: e.target.value})}>
                    <option value="llc">LLC</option>
                    <option value="corporation">Corporation</option>
                    <option value="sole_proprietorship">Sole Proprietorship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">Employees</label>
                  <input type="number" className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" value={profile.employee_count} onChange={e => setProfile({...profile, employee_count: parseInt(e.target.value) || 0})} />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-sm text-[#0A2540]">
                  <input type="checkbox" checked={profile.is_home_based} onChange={e => setProfile({...profile, is_home_based: e.target.checked})} />
                  Home-based business
                </label>
              </div>

              {/* Dynamic follow-ups (from design) */}
              {profile.industry === 'Restaurant' && (
                <div className="bg-slate-50 border rounded-xl p-4 text-sm">
                  <div className="font-medium mb-2 text-[#0A2540]">Additional questions for Restaurant / Food Service</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[#0A2540]/80">
                    <div>✓ Commercial kitchen</div>
                    <div>✓ Indoor seating</div>
                    <div>○ Alcohol sales</div>
                    <div>✓ Food preparation on site</div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleStartDiscovery} 
                disabled={!profile.name || isLoading}
                className="mt-4 w-full bg-[#0A2540] hover:bg-black text-white rounded-full py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Continue to Requirements {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              </button>
            </div>

            {/* Quick examples - makes the demo excellent for identifying requirements per business type */}
            <div className="mt-8">
              <div className="text-sm font-medium text-[#0A2540] mb-3">Quick Test Different Business Types (see exact requirements instantly):</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => loadExample({ industry: 'Restaurant', name: 'Mi Restaurante Boricua LLC', municipality: 'San Juan', is_home_based: false })} className="px-3 py-1.5 text-sm rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white">Restaurant (San Juan, not home)</button>
                <button onClick={() => loadExample({ industry: 'Medical Office', name: 'Clínica San Jorge', municipality: 'Bayamón', is_home_based: false })} className="px-3 py-1.5 text-sm rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white">Medical Office</button>
                <button onClick={() => loadExample({ industry: 'Retail Store', name: 'Tienda El Coquí', municipality: 'Carolina', is_home_based: true })} className="px-3 py-1.5 text-sm rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white">Retail (Home-based)</button>
                <button onClick={() => loadExample({ industry: 'Construction', name: 'Construcciones PR LLC', municipality: 'Ponce', is_home_based: false })} className="px-3 py-1.5 text-sm rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white">Construction</button>
                <button onClick={() => loadExample({ industry: 'Professional Services', name: 'Bufete Legal Caribe', municipality: 'San Juan', is_home_based: true })} className="px-3 py-1.5 text-sm rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white">Professional Services (Home)</button>
              </div>
              <p className="text-[10px] text-[#0A2540]/70 mt-2">Each example loads the precise licenses, permits, and documents required for that business profile per the Puerto Rico rules (Hacienda, OGPe, Salud, Bomberos, Municipal, Examining Boards, etc.).</p>
            </div>

            <p className="text-xs text-center text-[#0A2540]/70 mt-6">This is a faithful local implementation of the Step 1 flow + rules engine from the approved SmartPR design.</p>
          </div>
        )}

        {/* STEP 3: Checklist (main experience) */}
        {currentStep >= 3 && (
          <div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="text-sm text-[#0D9488] font-medium">SMARTPR READINESS CHECKLIST</div>
                <h2 className="text-2xl font-semibold text-[#0A2540]">{profile.name || 'Your Business'} — {profile.municipality}</h2>
              </div>
              {readinessScore !== null && (
                <div className="text-right">
                  <div className="text-4xl font-semibold tabular-nums text-[#0A2540]">{readinessScore}<span className="text-2xl">%</span></div>
                  <div className="text-xs text-[#0A2540]/60">READINESS SCORE</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Checklist */}
              <div className="lg:col-span-7 bg-white border rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="font-medium text-[#0A2540]">Required Items for this business ({completedMandatory}/{totalMandatory} mandatory complete)</div>
                  <div className="text-sm text-[#0D9488]">{checklistProgress}%</div>
                </div>

                <div className="space-y-2">
                  {requirements.length === 0 && currentStep === 3 && (
                    <button onClick={loadRequirements} className="w-full py-3 border border-dashed rounded-xl text-[#0D9488] hover:bg-slate-50 flex items-center justify-center gap-2">
                      Compute Requirements from Rules Engine <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {requirements.map((req, idx) => (
                    <div key={idx} className="border rounded-xl px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          {req.status === 'uploaded' || req.status === 'passed' ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-[#0A2540]/30 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-[#0A2540]">{req.name}</div>
                            <div className="text-xs text-[#0A2540]/70 mt-0.5">
                              <span className="font-semibold">{req.agency}</span> • {req.mandatory ? 'Mandatory' : 'Recommended'}
                            </div>
                            <div className="text-xs text-[#0A2540]/60 mt-1 leading-snug">{req.reason}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleMockUpload(req.code)}
                          className="text-xs px-3 py-1.5 rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white flex items-center gap-1 flex-shrink-0"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {requirements.length > 0 && currentStep < 7 && (
                  <button onClick={runValidation} disabled={isLoading} className="mt-6 w-full bg-[#0D9488] text-white rounded-full py-3 font-medium flex items-center justify-center gap-2">
                    Run Validation Engine {isLoading && <RefreshCw className="animate-spin w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Side panel: Findings / Actions */}
              <div className="lg:col-span-5 space-y-4">
                {findings.length > 0 && (
                  <div className="bg-white border rounded-2xl p-6">
                    <div className="font-medium mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Findings</div>
                    <div className="space-y-3 text-sm">
                      {findings.map((f, i) => (
                        <div key={i} className={`p-3 rounded-lg border-l-4 ${f.severity === 'critical' ? 'border-red-600 bg-red-50' : f.severity === 'warning' ? 'border-amber-600 bg-amber-50' : 'border-blue-600 bg-blue-50'}`}>
                          <div className="font-medium">{f.title}</div>
                          <div className="text-[#0A2540]/80 mt-0.5">{f.description}</div>
                          <div className="mt-1 text-xs text-[#0A2540]/60">→ {f.recommended_action}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {readinessScore !== null && (
                  <button onClick={generatePackage} className="w-full bg-[#0A2540] text-white rounded-2xl py-4 flex items-center justify-center gap-3 text-sm font-medium hover:bg-black">
                    <Download className="w-4 h-4" /> Generate Submission Package (Demo)
                  </button>
                )}

                <div className="text-[10px] text-[#0A2540]/60 px-1">
                  This demo faithfully follows the architecture, rules engine, validation axes, and UI patterns from the approved SmartPR design. 
                  No government approval is implied or simulated.
                </div>
              </div>
            </div>

            {/* Quick nav */}
            <div className="mt-8 flex gap-3 text-sm">
              <button onClick={() => setCurrentStep(1)} className="px-4 py-2 border rounded-full">← Back to Discovery</button>
              {currentStep < 9 && <button onClick={() => setCurrentStep((currentStep + 1) as Step)} className="px-4 py-2 border rounded-full flex items-center gap-1">Skip to next step <ArrowRight className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t bg-white py-4 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-xs text-[#0A2540]/60 flex justify-between">
          <div>SmartPR Local Demo — Based on approved design v1.0. Readiness assessment only.</div>
          <div>Backend: {useBackend ? 'http://localhost:8000' : 'mock mode'}</div>
        </div>
      </footer>
    </div>
  );
}
