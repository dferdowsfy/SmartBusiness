"""
SmartPR Backend (FastAPI)
Local dev server with real AI integration via OpenRouter.

Uses the configured AI (Grok via OpenRouter) for:
- Document identification and text extraction
- Determining if requirements are met (validation + findings)
- "Use this AI for everything" as requested.

.env should contain:
  OPENROUTER_API_KEY=sk-or-...
  OPENROUTER_MODEL=x-ai/grok-4.3
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
from openai import OpenAI

# Load environment
load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "x-ai/grok-4.3")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# OpenRouter client (OpenAI compatible)
ai_client = None
if OPENROUTER_API_KEY:
    ai_client = OpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )

app = FastAPI(
    title="SmartPR API (Local Dev + Real AI)",
    description="Puerto Rico Business Licensing Readiness Platform - Local testing server with Grok AI for document analysis and requirements validation",
    version="0.2.0-ai"
)

# CORS
cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AI Helper Functions (using the provided Grok model via OpenRouter) ---

def _call_ai(system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> str:
    """Central AI call - used for EVERYTHING as requested."""
    if not ai_client:
        return "AI client not configured. Using fallback."
    
    try:
        completion = ai_client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=max_tokens,
            temperature=0.2,  # more deterministic for analysis
        )
        return completion.choices[0].message.content or ""
    except Exception as e:
        return f"AI call failed: {str(e)}. Falling back to rules."

async def ai_identify_and_extract_document(document_text: str, filename: str, business_context: dict) -> dict:
    """
    Use AI to:
    - Identify what kind of document this is (match to requirement codes)
    - Extract key structured fields (business name, dates, IDs, etc.)
    - Determine confidence
    """
    system = """You are an expert Puerto Rico business licensing document analyst.
Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "document_type": "one of: certificate_of_incorporation, ein_letter, merchant_registration, health_permit, fire_certification, lease_or_property_docs, professional_license, or other",
  "matched_requirement_code": "the best matching code from the list above or null",
  "extracted": {
    "business_name": "string or null",
    "entity_name": "string or null",
    "issue_date": "YYYY-MM-DD or null",
    "expiration_date": "YYYY-MM-DD or null",
    "license_or_permit_number": "string or null",
    "address": "string or null",
    "owner": "string or null"
  },
  "confidence": 0.0 to 1.0,
  "notes": "short explanation of what you saw"
}"""

    user = f"""Filename: {filename}
Business context: {business_context}

Document content / text:
{document_text[:4000]}

Analyze and return the JSON only."""

    response = _call_ai(system, user)
    
    # Try to parse JSON from response
    import json, re
    try:
        # Clean common wrappers
        cleaned = re.sub(r'```json|```', '', response).strip()
        data = json.loads(cleaned)
        return data
    except:
        return {
            "document_type": "other",
            "matched_requirement_code": None,
            "extracted": {},
            "confidence": 0.3,
            "notes": f"AI response could not be parsed. Raw: {response[:300]}"
        }

async def ai_validate_requirements(business: dict, requirements: list, extracted_docs: list) -> dict:
    """
    Use the AI to determine which requirements are met based on uploaded/extracted documents.
    Returns score, findings, and which items are satisfied.
    """
    system = """You are an expert Puerto Rico business licensing compliance validator.
You will be given:
- Business profile
- List of required items (with codes and agencies)
- List of documents that have been "uploaded" with their extracted fields and matched types

Your job:
- Decide for each requirement whether it is MET, PARTIALLY_MET, or NOT_MET based on the documents.
- Produce a realistic readiness score (0-100).
- Generate findings in this format:
  [
    {"severity": "critical|warning|informational", "title": "...", "description": "...", "recommended_action": "..."}
  ]

Return ONLY valid JSON:
{
  "readiness_score": 85,
  "findings": [ ... array as above ... ],
  "satisfied_codes": ["code1", "code2"],
  "summary": "short overall assessment"
}"""

    user = f"""Business profile: {business}

Required items:
{requirements}

Extracted / uploaded documents (with AI analysis):
{extracted_docs}

Analyze carefully and return the JSON only."""

    response = _call_ai(system, user, max_tokens=2000)
    
    import json, re
    try:
        cleaned = re.sub(r'```json|```', '', response).strip()
        return json.loads(cleaned)
    except:
        # Fallback to reasonable mock if AI fails
        return {
            "readiness_score": 68,
            "findings": [
                {"severity": "critical", "title": "AI validation partial", "description": "Could not fully parse AI response. Some requirements may still be outstanding.", "recommended_action": "Review uploaded documents manually."}
            ],
            "satisfied_codes": [],
            "summary": "AI analysis encountered an issue."
        }

# In-memory stores for local testing (reset on restart)
BUSINESSES: Dict[str, Dict[str, Any]] = {}
DISCOVERY: Dict[str, Dict[str, Any]] = {}
DOCUMENTS: Dict[str, List[Dict[str, Any]]] = {}
VALIDATIONS: Dict[str, Dict[str, Any]] = {}

# --- Models (aligned with design/api) ---

class BusinessCreate(BaseModel):
    name: str
    municipality: str
    industry: str
    business_structure: str
    is_home_based: bool = False
    employee_count: Optional[int] = None
    physical_address: Optional[str] = None

class DiscoveryAnswers(BaseModel):
    answers: Dict[str, Any]
    completed: bool = False

class ReadinessResponse(BaseModel):
    business_id: str
    readiness_score: float
    status: str
    critical_items: int
    total_mandatory: int
    findings: List[Dict[str, Any]]

# --- Endpoints ---

@app.get("/health")
async def health():
    return {"status": "ok", "service": "smartpr-backend-local", "time": datetime.utcnow().isoformat()}

@app.get("/api/v1/businesses")
async def list_businesses():
    return list(BUSINESSES.values())

@app.post("/api/v1/businesses")
async def create_business(payload: BusinessCreate):
    bid = str(uuid.uuid4())
    business = {
        "id": bid,
        "owner_id": "local-dev-user",
        "name": payload.name,
        "municipality": payload.municipality,
        "industry": payload.industry,
        "business_structure": payload.business_structure,
        "is_home_based": payload.is_home_based,
        "employee_count": payload.employee_count,
        "physical_address": payload.physical_address,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    BUSINESSES[bid] = business
    DOCUMENTS[bid] = []
    return business

@app.get("/api/v1/businesses/{business_id}")
async def get_business(business_id: str):
    if business_id not in BUSINESSES:
        raise HTTPException(404, "Business not found")
    return BUSINESSES[business_id]

@app.post("/api/v1/businesses/{business_id}/discovery")
async def submit_discovery(business_id: str, payload: DiscoveryAnswers):
    if business_id not in BUSINESSES:
        raise HTTPException(404, "Business not found")
    DISCOVERY[business_id] = payload.model_dump()
    return {"status": "saved", "business_id": business_id}

@app.get("/api/v1/businesses/{business_id}/requirements")
async def get_requirements(business_id: str):
    if business_id not in BUSINESSES:
        raise HTTPException(404, "Business not found")
    
    b = BUSINESSES[business_id]
    industry = b.get("industry", "")
    is_home = b.get("is_home_based", False)
    has_food = False
    
    # Structured rules engine (from approved design) - fast and deterministic.
    # AI is used on top for document identification + final "requirements met" decision.
    requirements = [
        {"code": "certificate_of_incorporation", "name": "Certificate of Incorporation", "mandatory": True, "status": "pending"},
        {"code": "ein_letter", "name": "EIN Confirmation Letter", "mandatory": True, "status": "pending"},
        {"code": "merchant_registration", "name": "Merchant Registration (Hacienda)", "mandatory": True, "status": "pending"},
        {"code": "permiso_unico", "name": "Permiso Único (OGPe)", "mandatory": True, "status": "pending"},
        {"code": "patente_municipal", "name": f"Patente Municipal ({b['municipality']})", "mandatory": True, "status": "pending"},
    ]
    
    if "restaurant" in industry.lower() or has_food:
        requirements.append({"code": "health_permit", "name": "Health / Sanitary Permit", "mandatory": True, "status": "pending"})
        requirements.append({"code": "fire_certification", "name": "Fire Safety Certification", "mandatory": True, "status": "pending"})
        requirements.append({"code": "food_manager_cert", "name": "Certified Food Protection Manager", "mandatory": True, "status": "pending"})
    
    if not is_home:
        requirements.append({"code": "lease_or_property_docs", "name": "Lease / Property Docs + Floor Plan", "mandatory": True, "status": "pending"})
    
    return {
        "business_id": business_id,
        "requirements": requirements,
        "rule_set_version": "demo-v0.1",
        "note": "Initial list from rules engine. AI (Grok) is used for document identification and final 'requirements met' validation."
    }

@app.post("/api/v1/businesses/{business_id}/validations")
async def trigger_validation(business_id: str):
    if business_id not in BUSINESSES:
        raise HTTPException(404, "Business not found")
    
    b = BUSINESSES[business_id]
    reqs = (await get_requirements(business_id))["requirements"]
    docs = DOCUMENTS.get(business_id, [])
    
    # === USE THE CONFIGURED AI FOR EVERYTHING (validation + findings) ===
    if ai_client:
        ai_result = await ai_validate_requirements(b, reqs, docs)
        score = ai_result.get("readiness_score", 65)
        findings = ai_result.get("findings", [])
    else:
        score = 65.0
        findings = [{"severity": "warning", "title": "AI not configured", "description": "Add OPENROUTER_API_KEY to .env", "recommended_action": "See backend/.env"}]
    
    run_id = str(uuid.uuid4())
    VALIDATIONS[run_id] = {
        "id": run_id,
        "business_id": business_id,
        "readiness_score": score,
        "status": "completed",
        "findings": findings,
        "created_at": datetime.utcnow().isoformat(),
        "ai_model_used": OPENROUTER_MODEL if ai_client else "none"
    }
    
    return {
        "job_id": run_id,
        "status": "completed",
        "readiness_score": score,
        "findings_count": len(findings),
        "ai_powered": bool(ai_client)
    }

@app.get("/api/v1/businesses/{business_id}/findings")
async def get_findings(business_id: str):
    # Return latest validation's findings (demo)
    for run in reversed(list(VALIDATIONS.values())):
        if run["business_id"] == business_id:
            return run["findings"]
    return []

# === NEW: Real AI-powered document identification and text extraction ===
class DocumentInput(BaseModel):
    filename: str
    content: str  # Text content of the document (or description / OCR text). For images/PDFs, paste key text or base64 note.
    # In a production version we would accept UploadFile + use vision.

@app.post("/api/v1/businesses/{business_id}/analyze-document")
async def analyze_document(business_id: str, payload: DocumentInput):
    if business_id not in BUSINESSES:
        raise HTTPException(404, "Business not found")
    
    b = BUSINESSES[business_id]
    
    # Use the Grok model via OpenRouter to identify the document and extract structured data
    analysis = await ai_identify_and_extract_document(
        document_text=payload.content,
        filename=payload.filename,
        business_context=b
    )
    
    # Store the analyzed document
    doc_entry = {
        "id": str(uuid.uuid4()),
        "filename": payload.filename,
        "analysis": analysis,
        "uploaded_at": datetime.utcnow().isoformat(),
        "ai_model": OPENROUTER_MODEL
    }
    DOCUMENTS[business_id].append(doc_entry)
    
    return {
        "business_id": business_id,
        "analysis": analysis,
        "stored_document_id": doc_entry["id"],
        "message": "Document analyzed with AI. Matched requirement (if any) can now be used in validation."
    }

@app.post("/api/v1/businesses/{business_id}/packages")
async def generate_package(business_id: str):
    if business_id not in BUSINESSES:
        raise HTTPException(404, "Business not found")
    
    pkg_id = str(uuid.uuid4())
    # In real impl this would generate a PDF via ReportLab/Weasy and store in Supabase
    return {
        "package_id": pkg_id,
        "business_id": business_id,
        "readiness_score": 72.0,
        "download_url": f"/mock-package/{pkg_id}.pdf",
        "message": "Mock package generated. In production this returns a real PDF."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
