"use client";

import React, { useState, useEffect, useRef } from 'react';
import { L } from './i18n';
import { computeRequirementsFromKB, runRulesEngineForProfile, buildEngineInput, KB } from './kb';
import { ACTIVE_JURISDICTION } from './jurisdictions';
import { captureEvent, newSubmissionId } from './graph/client';
import type { CapturedAnswer, CapturedRequirement } from './graph/types';
import { enrichRequirements, type EnrichedRequirement } from './relationshipEngine';
import { potentialItemsForFlags, type PotentialDef } from './potentialRequirements';
import { buildExtraction, type ExtractionResult } from './documentFields';
import { createSupabaseBrowser, isAuthConfigured } from '../lib/supabase/client';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import {
  CheckCircle, AlertTriangle, Info, Upload, FileText,
  ArrowRight, RefreshCw, Download, Building2, Archive, ExternalLink,
  Receipt, Landmark, Lightbulb, Waves, ShieldCheck, ScrollText
} from 'lucide-react';

// SmartPR
// Puerto Rico Business Licensing Readiness Platform
// Real LLM-powered document identification and validation (AI via backend)

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface BusinessProfile {
  name: string;
  municipality: string;
  industry: string;
  business_type: string;
  location_type: string;
  business_structure: string;
  number_of_employees: number | null;
  customers_visit: boolean | null;
  food_prepared_or_sold: boolean | null;
  alcohol_sold: boolean | null;
  professional_licenses_required: boolean | null;
  healthcare_services: boolean | null;
  hazardous_materials: boolean | null;
  employees_hired: boolean | null;
  physical_location: boolean | null;
  products_manufactured: boolean | null;
  vehicles_used: boolean | null;
  commercial_signage: boolean | null;
  outdoor_seating: boolean | null;
  live_entertainment: boolean | null;
  short_term_rental: boolean | null;
  medical_waste: boolean | null;
  import_export: boolean | null;
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
  document_id?: string;
  category?: string;
  source_rule?: string;
}

const INDUSTRIES = [
  "Accommodation & Tourism",
  "Agriculture & Farming",
  "Arts, Entertainment & Recreation",
  "Automotive",
  "Beauty & Personal Care",
  "Construction",
  "Education & Training",
  "Energy & Utilities",
  "Finance & Insurance",
  "Food & Beverage",
  "Healthcare",
  "Information Technology",
  "Manufacturing",
  "Professional Services",
  "Real Estate",
  "Retail",
  "Transportation & Logistics",
  "Wholesale Distribution",
  "Government Contractor",
  "Nonprofit / Religious Organization",
  "Other"
];

const BUSINESS_TYPES: Record<string, string[]> = {
  "Food & Beverage": [
    "Restaurant",
    "Fast Food Restaurant",
    "Food Truck",
    "Bakery",
    "Cafe",
    "Coffee Shop",
    "Bar",
    "Nightclub",
    "Catering Business",
    "Commercial Kitchen",
    "Ice Cream Shop",
    "Juice Bar",
    "Convenience Store with Food",
    "Grocery Store",
    "Supermarket",
    "Liquor Store"
  ],
  "Healthcare": [
    "Medical Office",
    "Dental Office",
    "Pharmacy",
    "Laboratory",
    "Mental Health Practice",
    "Psychologist Office",
    "Physical Therapy Clinic",
    "Veterinary Clinic",
    "Home Health Agency",
    "Urgent Care Center",
    "Diagnostic Imaging Center"
  ],
  "Professional Services": [
    "Attorney Office",
    "CPA Firm",
    "Tax Preparation Firm",
    "Consulting Firm",
    "Marketing Agency",
    "Engineering Firm",
    "Architecture Firm",
    "Insurance Agency",
    "Real Estate Brokerage",
    "Property Management Company",
    "Staffing Agency",
    "Bookkeeping Service",
    "Business Consulting Firm"
  ],
  "Retail": [
    "Clothing Store",
    "Jewelry Store",
    "Electronics Store",
    "Furniture Store",
    "Hardware Store",
    "Sporting Goods Store",
    "Pet Store",
    "Gift Shop",
    "Convenience Store",
    "E-Commerce Business",
    "Cannabis Dispensary"
  ],
  "Construction": [
    "General Contractor",
    "Electrical Contractor",
    "Plumbing Contractor",
    "HVAC Contractor",
    "Roofing Contractor",
    "Concrete Contractor",
    "Landscaping Company",
    "Surveying Company",
    "Engineering Contractor",
    "Architecture Firm",
    "Construction Management Firm"
  ],
  "Accommodation & Tourism": [
    "Hotel",
    "Resort",
    "Airbnb",
    "Short-Term Rental",
    "Vacation Rental Manager",
    "Tour Operator",
    "Excursion Company",
    "Car Rental Business",
    "Water Sports Company",
    "Marina",
    "Travel Agency"
  ],
  "Beauty & Personal Care": [
    "Beauty Salon",
    "Barbershop",
    "Nail Salon",
    "Spa",
    "Massage Therapy",
    "Tattoo Shop",
    "Cosmetic Clinic",
    "Esthetics Studio"
  ],
  "Manufacturing": [
    "Food Manufacturing",
    "Pharmaceutical Manufacturing",
    "Medical Device Manufacturing",
    "Textile Manufacturing",
    "Furniture Manufacturing",
    "Beverage Manufacturing",
    "Consumer Products Manufacturing"
  ],
  "Transportation & Logistics": [
    "Trucking Company",
    "Courier Service",
    "Moving Company",
    "Taxi Service",
    "Rideshare Fleet",
    "Logistics Company",
    "Warehouse Operator",
    "Maritime Transportation",
    "Delivery Service"
  ],
  "Education & Training": [
    "Private School",
    "Daycare",
    "Tutoring Center",
    "Vocational School",
    "Training Company",
    "Educational Services Company"
  ],
  "Information Technology": [
    "Software Company",
    "SaaS Company",
    "IT Consulting Firm",
    "Cybersecurity Firm",
    "Managed Services Provider",
    "Data Analytics Firm",
    "AI Startup",
    "Technology Services Company"
  ],
  "Finance & Insurance": [
    "Insurance Agency",
    "Mortgage Broker",
    "Financial Advisor",
    "Accounting Firm",
    "Tax Services",
    "Investment Firm",
    "Credit Services"
  ],
  "Real Estate": [
    "Real Estate Brokerage",
    "Property Management",
    "Real Estate Investment Company",
    "Short-Term Rental Operator",
    "Developer",
    "Real Estate Consulting"
  ],
  "Automotive": [
    "Auto Repair Shop",
    "Body Shop",
    "Car Dealership",
    "Motorcycle Repair",
    "Auto Parts Store",
    "Vehicle Rental"
  ],
  "Agriculture & Farming": [
    "Farm",
    "Livestock Operation",
    "Aquaculture",
    "Food Production",
    "Agricultural Services"
  ]
};

function getQuestionsForBusinessType(businessType: string): { id: string; text: string }[] {
  const bt = businessType.toLowerCase().trim();

  if (["restaurant", "fast food restaurant", "bakery", "cafe", "coffee shop", "bar", "nightclub", "food truck", "catering business", "commercial kitchen", "ice cream shop", "juice bar", "grocery store", "supermarket", "liquor store"].some(k => bt.includes(k))) {
    return [
      { id: "food_prepared_on_site", text: "Will food be prepared on-site?" },
      { id: "customers_consume_on_site", text: "Will customers consume food on-site?" },
      { id: "alcohol_sold", text: "Will alcohol be sold?" },
      { id: "outdoor_seating", text: "Will there be outdoor seating?" },
      { id: "live_entertainment", text: "Will there be live entertainment?" },
      { id: "food_delivered", text: "Will food be delivered?" },
      { id: "employees_work_on_site", text: "Will employees work on-site?" },
      { id: "food_truck_or_mobile", text: "Will this operate from a food truck or mobile unit?" },
    ];
  }

  if (["medical office", "dental office", "pharmacy", "laboratory", "mental health practice", "physical therapy clinic", "veterinary clinic", "urgent care center", "diagnostic imaging center", "medical spa", "assisted living facility", "elder care facility"].some(k => bt.includes(k))) {
    return [
      { id: "patients_visit", text: "Will patients visit this location?" },
      { id: "controlled_substances", text: "Will controlled substances be stored?" },
      { id: "medical_waste", text: "Will medical waste be generated?" },
      { id: "diagnostic_testing", text: "Will diagnostic testing be performed?" },
      { id: "healthcare_professionals", text: "Will healthcare professionals provide services?" },
      { id: "employees_work_on_site", text: "Will employees work on-site?" },
    ];
  }

  if (["attorney office", "cpa firm", "tax preparation firm", "consulting firm", "marketing agency", "engineering firm", "architecture firm", "insurance agency", "real estate brokerage", "property management company", "staffing agency", "bookkeeping service", "business consulting firm", "notary services", "translation services"].some(k => bt.includes(k))) {
    return [
      { id: "clients_visit", text: "Will clients visit your location?" },
      { id: "licensed_professionals", text: "Will licensed professionals provide services?" },
      { id: "employees_hired", text: "Will employees be hired?" },
      { id: "services_online", text: "Will services be delivered entirely online?" },
    ];
  }

  if (["software company", "saas company", "it consulting firm", "cybersecurity firm", "managed services provider", "data analytics firm", "ai startup", "technology services company", "web development agency"].some(k => bt.includes(k))) {
    return [
      { id: "physical_office", text: "Will employees work from a physical office?" },
      { id: "customers_visit", text: "Will customers visit the location?" },
      { id: "inventory_stored", text: "Will inventory be stored?" },
      { id: "hardware_sold", text: "Will hardware be sold?" },
    ];
  }

  if (["clothing store", "jewelry store", "electronics store", "furniture store", "hardware store", "sporting goods store", "pet store", "gift shop", "convenience store", "e-commerce business", "cannabis dispensary", "cosmetics store", "pharmacy retail", "home goods store"].some(k => bt.includes(k))) {
    return [
      { id: "customers_visit", text: "Will customers visit the location?" },
      { id: "products_stored", text: "Will products be stored on-site?" },
      { id: "food_sold", text: "Will food be sold?" },
      { id: "alcohol_sold", text: "Will alcohol be sold?" },
      { id: "deliveries_made", text: "Will deliveries be made?" },
    ];
  }

  if (["general contractor", "electrical contractor", "plumbing contractor", "hvac contractor", "roofing contractor", "concrete contractor", "landscaping company", "surveying company", "engineering contractor", "architecture firm", "construction management firm", "specialty trade contractor"].some(k => bt.includes(k))) {
    return [
      { id: "employees_hired", text: "Will employees be hired?" },
      { id: "commercial_vehicles", text: "Will commercial vehicles be used?" },
      { id: "hazardous_materials", text: "Will hazardous materials be stored?" },
      { id: "equipment_stored", text: "Will equipment be stored at a facility?" },
    ];
  }

  if (["hotel", "resort", "guest house", "airbnb", "short-term rental", "vacation rental manager", "tour operator", "excursion company", "car rental business", "water sports company", "marina", "travel agency"].some(k => bt.includes(k))) {
    return [
      { id: "guests_stay_overnight", text: "Will guests stay overnight?" },
      { id: "food_served", text: "Will food be served?" },
      { id: "alcohol_served", text: "Will alcohol be served?" },
      { id: "water_activities", text: "Will water activities be offered?" },
      { id: "employees_work_on_site", text: "Will employees work on-site?" },
    ];
  }

  if (["beauty salon", "barbershop", "nail salon", "spa", "massage therapy", "tattoo shop", "cosmetic clinic", "esthetics studio", "makeup studio", "hair removal studio"].some(k => bt.includes(k))) {
    return [
      { id: "customers_receive_services", text: "Will customers receive services on-site?" },
      { id: "needles_or_invasive", text: "Will needles or invasive procedures be used?" },
      { id: "biohazard_waste", text: "Will biohazard waste be generated?" },
      { id: "licensed_professionals", text: "Will licensed professionals provide services?" },
    ];
  }

  if (["food manufacturing", "pharmaceutical manufacturing", "medical device manufacturing", "textile manufacturing", "furniture manufacturing", "beverage manufacturing", "consumer products manufacturing", "chemical manufacturing", "industrial manufacturing"].some(k => bt.includes(k))) {
    return [
      { id: "products_manufactured_on_site", text: "Will products be manufactured on-site?" },
      { id: "hazardous_materials", text: "Will hazardous materials be stored?" },
      { id: "employees_work_on_site", text: "Will employees work on-site?" },
      { id: "products_distributed", text: "Will products be distributed?" },
    ];
  }

  if (["trucking company", "courier service", "moving company", "taxi service", "rideshare fleet", "logistics company", "warehouse operator", "maritime transportation", "delivery service", "freight forwarding"].some(k => bt.includes(k))) {
    return [
      { id: "commercial_vehicles", text: "Will commercial vehicles be used?" },
      { id: "goods_stored", text: "Will goods be stored?" },
      { id: "hazardous_materials_transported", text: "Will hazardous materials be transported?" },
      { id: "employees_hired", text: "Will employees be hired?" },
    ];
  }

  if (["private school", "daycare", "tutoring center", "vocational school", "training company", "educational services company", "after-school program", "childcare center"].some(k => bt.includes(k))) {
    return [
      { id: "children_present", text: "Will children be present?" },
      { id: "classes_on_site", text: "Will classes be held on-site?" },
      { id: "employees_hired", text: "Will employees be hired?" },
      { id: "food_served", text: "Will food be served?" },
    ];
  }

  if (["software company", "saas company", "it consulting firm", "cybersecurity firm", "managed services provider", "data analytics firm", "ai startup", "technology services company", "web development agency"].some(k => bt.includes(k))) {
    return [
      { id: "physical_office", text: "Will employees work from a physical office?" },
      { id: "customers_visit", text: "Will customers visit the location?" },
      { id: "inventory_stored", text: "Will inventory be stored?" },
      { id: "hardware_sold", text: "Will hardware be sold?" },
    ];
  }

  if (["insurance agency", "mortgage broker", "financial advisor", "accounting firm", "tax services", "investment firm", "credit services", "bookkeeping firm", "payroll services"].some(k => bt.includes(k))) {
    return [
      { id: "clients_visit", text: "Will clients visit the office?" },
      { id: "employees_hired", text: "Will employees be hired?" },
      { id: "properties_managed", text: "Will properties be managed on behalf of others?" },
    ];
  }

  if (["auto repair shop", "body shop", "car dealership", "motorcycle repair", "auto parts store", "vehicle rental", "car wash", "tire shop"].some(k => bt.includes(k))) {
    return [
      { id: "vehicles_repaired", text: "Will vehicles be repaired?" },
      { id: "hazardous_fluids", text: "Will hazardous fluids be stored?" },
      { id: "customers_visit", text: "Will customers visit the facility?" },
    ];
  }

  if (["farm", "livestock operation", "aquaculture", "food production", "agricultural services", "nursery / plant business"].some(k => bt.includes(k))) {
    return [
      { id: "food_products_sold", text: "Will food products be sold?" },
      { id: "chemicals_stored", text: "Will chemicals be stored?" },
      { id: "employees_hired", text: "Will employees be hired?" },
    ];
  }

  if (["gym / fitness studio", "dance studio", "music venue", "event venue", "theater", "art gallery", "sports facility", "recreation facility", "entertainment venue"].some(k => bt.includes(k))) {
    return [
      { id: "customers_visit", text: "Will customers visit the location?" },
      { id: "employees_hired", text: "Will employees be hired?" },
      { id: "live_entertainment", text: "Will there be live entertainment?" },
    ];
  }

  if (["solar installer", "energy consulting", "utility contractor", "battery storage installer", "electrical services", "renewable energy company"].some(k => bt.includes(k))) {
    return [
      { id: "physical_office", text: "Will employees work from a physical office?" },
      { id: "hazardous_materials", text: "Will hazardous materials be stored?" },
      { id: "employees_hired", text: "Will employees be hired?" },
    ];
  }

  if (["wholesale food distributor", "wholesale goods distributor", "import / export business", "warehouse distributor", "beverage distributor"].some(k => bt.includes(k))) {
    return [
      { id: "goods_stored", text: "Will goods be stored?" },
      { id: "hazardous_materials", text: "Will hazardous materials be stored?" },
      { id: "employees_hired", text: "Will employees be hired?" },
    ];
  }

  if (["professional services contractor", "construction contractor", "it contractor", "staffing contractor", "facilities contractor", "security contractor"].some(k => bt.includes(k))) {
    return [
      { id: "clients_visit", text: "Will clients visit the office?" },
      { id: "employees_hired", text: "Will employees be hired?" },
      { id: "physical_location", text: "Will the business operate from a physical location?" },
    ];
  }

  if (["nonprofit organization", "religious organization", "community organization", "foundation", "charity"].some(k => bt.includes(k))) {
    return [
      { id: "clients_visit", text: "Will clients or members visit?" },
      { id: "employees_hired", text: "Will employees be hired?" },
      { id: "physical_location", text: "Will the business operate from a physical location?" },
    ];
  }

  // Default / universal for Other or unmatched
  return [
    { id: "employees_hired", text: "Will employees be hired?" },
    { id: "physical_location", text: "Will the business operate from a physical location?" },
    { id: "customers_visit", text: "Will customers visit the location?" },
    { id: "professional_licenses_required", text: "Will professional licenses be required?" },
  ];
}

// ---------------------------------------------------------------------------
// Conditional question filtering
//
// The KB list returned by getQuestionsForBusinessType() is the full catalogue
// for that business type. Several of those questions only make sense once you
// know the operating location_type — e.g. there's no point asking
// "Will customers visit the location?" or "Will inventory be stored?" when
// the user has already declared the business as Online Only.
//
// The filter is conservative: it skips questions whose answer is implied by
// the location choice. Anything ambiguous (e.g. employees_hired) is kept.
// ---------------------------------------------------------------------------
const PHYSICAL_PRESENCE_QUESTIONS = new Set<string>([
  "customers_visit",
  "customers_consume_on_site",
  "patients_visit",
  "clients_visit",
  "physical_office",
  "outdoor_seating",
  "live_entertainment",
  "food_prepared_on_site",
  "products_manufactured_on_site",
  "food_truck_or_mobile",
  "employees_work_on_site",
  "inventory_stored",
  "products_stored",
]);

const HOME_BASED_NOT_APPLICABLE = new Set<string>([
  "food_truck_or_mobile",
  "outdoor_seating",
  "live_entertainment",
  "patients_visit",
]);

interface DiscoveryQuestion { id: string; text: string }

export function filterQuestionsByContext(
  questions: DiscoveryQuestion[],
  locationType: string | undefined
): DiscoveryQuestion[] {
  const loc = (locationType || "").trim();
  if (loc === "Online Only") {
    return questions.filter((q) => !PHYSICAL_PRESENCE_QUESTIONS.has(q.id));
  }
  if (loc === "Home-Based Business") {
    return questions.filter((q) => !HOME_BASED_NOT_APPLICABLE.has(q.id));
  }
  return questions;
}

const LOCATION_TYPES_BY_BUSINESS_TYPE: Record<string, string[]> = {
  "Restaurant": ["Restaurant Location", "Retail Storefront", "Mixed Use Property", "Tourism Facility", "Commercial Office"],
  "Fast Food Restaurant": ["Restaurant Location", "Retail Storefront", "Mixed Use Property"],
  "Bakery": ["Restaurant Location", "Retail Storefront", "Commercial Kitchen", "Industrial Facility"],
  "Cafe": ["Restaurant Location", "Retail Storefront", "Mixed Use Property"],
  "Coffee Shop": ["Restaurant Location", "Retail Storefront", "Mixed Use Property"],
  "Bar": ["Restaurant Location", "Retail Storefront", "Entertainment Venue", "Tourism Facility"],
  "Nightclub": ["Entertainment Venue", "Retail Storefront", "Tourism Facility"],
  "Food Truck": ["Food Truck", "Mobile Business", "Commercial Kitchen"],
  "Catering Business": ["Commercial Kitchen", "Commercial Office", "Home-Based Business", "Industrial Facility"],
  "Commercial Kitchen": ["Commercial Kitchen", "Industrial Facility"],
  "Ice Cream Shop": ["Retail Storefront", "Restaurant Location"],
  "Juice Bar": ["Retail Storefront", "Restaurant Location"],
  "Convenience Store with Food": ["Retail Storefront"],
  "Grocery Store": ["Retail Storefront", "Commercial Facility"],
  "Supermarket": ["Retail Storefront", "Commercial Facility"],
  "Liquor Store": ["Retail Storefront", "Commercial Facility"],
  "Medical Office": ["Healthcare Facility", "Professional Office", "Commercial Office"],
  "Dental Office": ["Healthcare Facility", "Professional Office"],
  "Pharmacy": ["Healthcare Facility", "Retail Storefront"],
  "Laboratory": ["Healthcare Facility", "Industrial Facility"],
  "Mental Health Practice": ["Professional Office", "Commercial Office", "Healthcare Facility", "Shared Workspace"],
  "Psychologist Office": ["Professional Office", "Commercial Office", "Healthcare Facility", "Shared Workspace"],
  "Physical Therapy Clinic": ["Healthcare Facility", "Professional Office"],
  "Veterinary Clinic": ["Healthcare Facility", "Commercial Facility"],
  "Home Health Agency": ["Commercial Office", "Professional Office"],
  "Urgent Care Center": ["Healthcare Facility"],
  "Diagnostic Imaging Center": ["Healthcare Facility"],
  "Medical Spa": ["Healthcare Facility", "Commercial Office"],
  "Assisted Living Facility": ["Healthcare Facility"],
  "Elder Care Facility": ["Healthcare Facility"],
  "Attorney Office": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business"],
  "CPA Firm": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business"],
  "Tax Preparation Firm": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business"],
  "Consulting Firm": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business", "Online Only"],
  "Marketing Agency": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business", "Online Only"],
  "Engineering Firm": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business"],
  "Architecture Firm": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business"],
  "Insurance Agency": ["Professional Office", "Commercial Office", "Shared Workspace"],
  "Real Estate Brokerage": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business"],
  "Property Management Company": ["Professional Office", "Commercial Office"],
  "Staffing Agency": ["Professional Office", "Commercial Office"],
  "Bookkeeping Service": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business"],
  "Business Consulting Firm": ["Professional Office", "Commercial Office", "Shared Workspace", "Home-Based Business", "Online Only"],
  "Notary Services": ["Professional Office", "Commercial Office", "Home-Based Business"],
  "Translation Services": ["Home-Based Business", "Shared Workspace", "Online Only", "Professional Office"],
  "Clothing Store": ["Retail Storefront"],
  "Jewelry Store": ["Retail Storefront"],
  "Electronics Store": ["Retail Storefront"],
  "Furniture Store": ["Retail Storefront", "Warehouse"],
  "Hardware Store": ["Retail Storefront", "Warehouse"],
  "Sporting Goods Store": ["Retail Storefront"],
  "Pet Store": ["Retail Storefront"],
  "Gift Shop": ["Retail Storefront"],
  "Convenience Store": ["Retail Storefront"],
  "E-Commerce Business": ["Online Only", "Home-Based Business", "Warehouse", "Commercial Office"],
  "Cannabis Dispensary": ["Retail Storefront", "Healthcare Facility"],
  "Cosmetics Store": ["Retail Storefront"],
  "Pharmacy Retail": ["Retail Storefront"],
  "Home Goods Store": ["Retail Storefront"],
  "General Contractor": ["Commercial Office", "Warehouse", "Industrial Facility", "Home-Based Business"],
  "Electrical Contractor": ["Commercial Office", "Warehouse", "Home-Based Business"],
  "Plumbing Contractor": ["Commercial Office", "Warehouse", "Home-Based Business"],
  "HVAC Contractor": ["Commercial Office", "Warehouse", "Home-Based Business"],
  "Roofing Contractor": ["Commercial Office", "Warehouse", "Home-Based Business"],
  "Concrete Contractor": ["Commercial Office", "Warehouse", "Industrial Facility"],
  "Landscaping Company": ["Commercial Office", "Warehouse", "Home-Based Business"],
  "Surveying Company": ["Professional Office", "Commercial Office", "Home-Based Business"],
  "Engineering Contractor": ["Commercial Office", "Professional Office"],
  "Construction Management Firm": ["Professional Office", "Commercial Office"],
  "Specialty Trade Contractor": ["Commercial Office", "Warehouse", "Home-Based Business"],
  "Hotel": ["Tourism Facility"],
  "Resort": ["Tourism Facility"],
  "Guest House": ["Tourism Facility", "Mixed Use Property"],
  "Airbnb": ["Home-Based Business", "Tourism Facility", "Mixed Use Property"],
  "Short-Term Rental": ["Home-Based Business", "Tourism Facility", "Mixed Use Property"],
  "Vacation Rental Manager": ["Commercial Office", "Professional Office"],
  "Tour Operator": ["Commercial Office", "Tourism Facility"],
  "Excursion Company": ["Tourism Facility", "Commercial Office"],
  "Car Rental Business": ["Commercial Office", "Tourism Facility", "Commercial Facility"],
  "Water Sports Company": ["Tourism Facility"],
  "Marina": ["Tourism Facility"],
  "Travel Agency": ["Commercial Office", "Home-Based Business", "Online Only"],
  "Beauty Salon": ["Retail Storefront", "Commercial Office", "Mixed Use Property"],
  "Barbershop": ["Retail Storefront", "Commercial Office", "Mixed Use Property"],
  "Nail Salon": ["Retail Storefront", "Commercial Office"],
  "Spa": ["Commercial Office", "Retail Storefront"],
  "Massage Therapy": ["Professional Office", "Commercial Office"],
  "Tattoo Shop": ["Retail Storefront", "Commercial Office"],
  "Cosmetic Clinic": ["Healthcare Facility", "Commercial Office"],
  "Esthetics Studio": ["Commercial Office", "Retail Storefront"],
  "Makeup Studio": ["Commercial Office", "Retail Storefront", "Home-Based Business"],
  "Hair Removal Studio": ["Commercial Office", "Healthcare Facility"],
  "Food Manufacturing": ["Industrial Facility"],
  "Pharmaceutical Manufacturing": ["Industrial Facility"],
  "Medical Device Manufacturing": ["Industrial Facility"],
  "Textile Manufacturing": ["Industrial Facility"],
  "Furniture Manufacturing": ["Industrial Facility"],
  "Beverage Manufacturing": ["Industrial Facility"],
  "Consumer Products Manufacturing": ["Industrial Facility"],
  "Chemical Manufacturing": ["Industrial Facility"],
  "Industrial Manufacturing": ["Industrial Facility"],
  "Trucking Company": ["Warehouse", "Industrial Facility", "Commercial Office"],
  "Courier Service": ["Commercial Office", "Warehouse"],
  "Moving Company": ["Warehouse", "Commercial Office"],
  "Taxi Service": ["Commercial Office"],
  "Rideshare Fleet": ["Commercial Office"],
  "Logistics Company": ["Warehouse", "Industrial Facility", "Commercial Office"],
  "Warehouse Operator": ["Warehouse", "Industrial Facility"],
  "Maritime Transportation": ["Tourism Facility", "Industrial Facility"],
  "Delivery Service": ["Commercial Office", "Warehouse"],
  "Freight Forwarding": ["Warehouse", "Commercial Office"],
  "Private School": ["Educational Facility"],
  "Daycare": ["Educational Facility", "Mixed Use Property"],
  "Tutoring Center": ["Educational Facility", "Commercial Office"],
  "Vocational School": ["Educational Facility"],
  "Training Company": ["Educational Facility", "Commercial Office", "Online Only"],
  "Educational Services Company": ["Commercial Office", "Online Only"],
  "After-School Program": ["Educational Facility"],
  "Childcare Center": ["Educational Facility"],
  "Software Company": ["Online Only", "Home-Based Business", "Shared Workspace", "Commercial Office"],
  "SaaS Company": ["Online Only", "Home-Based Business", "Shared Workspace", "Commercial Office"],
  "IT Consulting Firm": ["Professional Office", "Shared Workspace", "Home-Based Business"],
  "Cybersecurity Firm": ["Professional Office", "Shared Workspace", "Home-Based Business"],
  "Managed Services Provider": ["Professional Office", "Commercial Office"],
  "Data Analytics Firm": ["Professional Office", "Shared Workspace", "Home-Based Business"],
  "AI Startup": ["Online Only", "Home-Based Business", "Shared Workspace", "Commercial Office"],
  "Technology Services Company": ["Professional Office", "Commercial Office"],
  "Web Development Agency": ["Home-Based Business", "Shared Workspace", "Commercial Office"],
  "Mortgage Broker": ["Professional Office", "Commercial Office"],
  "Financial Advisor": ["Professional Office", "Commercial Office"],
  "Accounting Firm": ["Professional Office", "Commercial Office"],
  "Tax Services": ["Professional Office", "Commercial Office", "Home-Based Business"],
  "Investment Firm": ["Professional Office", "Commercial Office"],
  "Credit Services": ["Professional Office", "Commercial Office"],
  "Bookkeeping Firm": ["Professional Office", "Commercial Office", "Home-Based Business"],
  "Payroll Services": ["Professional Office", "Commercial Office", "Home-Based Business"],
  "Real Estate Investment Company": ["Professional Office", "Commercial Office"],
  "Developer": ["Professional Office", "Commercial Office"],
  "Real Estate Consulting": ["Professional Office", "Commercial Office"],
  "Leasing Office": ["Professional Office", "Commercial Office"],
  "Auto Repair Shop": ["Industrial Facility", "Commercial Facility"],
  "Body Shop": ["Industrial Facility"],
  "Car Dealership": ["Commercial Facility"],
  "Motorcycle Repair": ["Industrial Facility"],
  "Auto Parts Store": ["Retail Storefront"],
  "Vehicle Rental": ["Commercial Facility"],
  "Car Wash": ["Commercial Facility"],
  "Tire Shop": ["Commercial Facility"],
  "Farm": ["Agricultural Property"],
  "Livestock Operation": ["Agricultural Property"],
  "Aquaculture": ["Agricultural Property"],
  "Food Production": ["Agricultural Property", "Industrial Facility"],
  "Agricultural Services": ["Agricultural Property"],
  "Nursery / Plant Business": ["Agricultural Property", "Retail Storefront"],
  "Gym / Fitness Studio": ["Commercial Facility", "Retail Storefront"],
  "Dance Studio": ["Commercial Facility"],
  "Music Venue": ["Entertainment Venue"],
  "Event Venue": ["Entertainment Venue"],
  "Theater": ["Entertainment Venue"],
  "Art Gallery": ["Retail Storefront", "Commercial Facility"],
  "Sports Facility": ["Commercial Facility"],
  "Recreation Facility": ["Commercial Facility"],
  "Entertainment Venue": ["Entertainment Venue"],
  "Solar Installer": ["Commercial Office", "Warehouse"],
  "Energy Consulting": ["Professional Office", "Home-Based Business"],
  "Utility Contractor": ["Commercial Office", "Warehouse"],
  "Battery Storage Installer": ["Commercial Office", "Warehouse"],
  "Electrical Services": ["Commercial Office", "Warehouse"],
  "Renewable Energy Company": ["Commercial Office", "Warehouse"],
  "Wholesale Food Distributor": ["Warehouse", "Industrial Facility"],
  "Wholesale Goods Distributor": ["Warehouse", "Industrial Facility"],
  "Import / Export Business": ["Warehouse", "Commercial Office"],
  "Warehouse Distributor": ["Warehouse"],
  "Beverage Distributor": ["Warehouse", "Industrial Facility"],
  "Professional Services Contractor": ["Professional Office", "Commercial Office"],
  "Construction Contractor": ["Commercial Office", "Warehouse"],
  "IT Contractor": ["Professional Office", "Home-Based Business"],
  "Staffing Contractor": ["Professional Office", "Commercial Office"],
  "Facilities Contractor": ["Commercial Office", "Warehouse"],
  "Security Contractor": ["Commercial Office", "Warehouse"],
  "Nonprofit Organization": ["Commercial Office", "Shared Workspace"],
  "Religious Organization": ["Religious Facility"],
  "Community Organization": ["Commercial Office", "Shared Workspace"],
  "Foundation": ["Commercial Office", "Shared Workspace"],
  "Charity": ["Commercial Office", "Shared Workspace"],
  "Other Business Type": ["Home-Based Business", "Commercial Office", "Retail Storefront", "Online Only"]
};


const LOCATION_TYPES = [
  "Home-Based Business",
  "Commercial Office",
  "Retail Storefront",
  "Industrial Facility",
  "Restaurant / Food Service Location",
  "Mobile Business",
  "Online / Remote Only",
  "Shared Workspace / Coworking",
  "Warehouse",
  "Mixed Use Property"
];

// Geographic subdivisions come from the active jurisdiction's knowledge base.
// No hardcoded town/county lists live in the UI anymore.
const MUNICIPALITIES = KB.municipalities.map((m) => m.name);

// ====================================================================
// GEO FLAG LOOKUP
// Base rules apply to all subdivisions; geo flags (e.g. coastal/tourism/
// historic/metro/island for Puerto Rico) drive conditional notices that
// combine with industry, business-type, and trigger rules. Flags are KB data,
// so a new jurisdiction defines its own subdivisions and flags — no code edit.
// ====================================================================
function municipalityFlagSet(name: string): Set<string> {
  const m = KB.municipalities.find(
    (x) => x.name.toLowerCase() === (name || '').toLowerCase()
  );
  return new Set<string>(m ? (m.flags as string[]) : []);
}

function municipalityFlags(name: string) {
  const f = municipalityFlagSet(name);
  return {
    coastal: f.has('coastal'),
    tourism: f.has('tourism'),
    historic: f.has('historic'),
    metro: f.has('metro'),
    island: f.has('island'),
  };
}

// Conditional municipality notices (English canonical; translated at display).
function computeMunicipalityNotices(profile: BusinessProfile): string[] {
  const name = profile.municipality;
  if (!name) return [];
  const flags = municipalityFlags(name);
  const bt = (profile.business_type || '').toLowerCase();
  const isShortTerm = profile.short_term_rental === true;
  const hasPhysical = profile.location_type !== 'Online Only';
  const notices: string[] = [];

  const coastalTrigger = /marina|water sport|tourism|short-term|short term|rental|excursion/.test(bt) || isShortTerm;
  if (flags.coastal && coastalTrigger) {
    notices.push('Additional coastal or environmental review may apply.');
  }

  const tourismTrigger = /hotel|airbnb|guest house|short-term|short term|rental|resort|tour operator/.test(bt) ||
    isShortTerm || profile.industry === 'Accommodation & Tourism';
  if (flags.tourism && tourismTrigger) {
    notices.push('Tourism registration and additional tourism-related requirements may apply.');
  }

  if (flags.historic && hasPhysical) {
    notices.push('Historic district restrictions may apply depending on business location.');
  }

  if (flags.island) {
    notices.push('Additional transportation and logistics requirements may apply for island municipalities.');
  }

  return notices;
}

// Core compute logic - matches the approved rules engine design + seed data
// Updated to use the new Step 1 fields (location_type, food_prepared_or_sold, alcohol_sold, professional_licenses_required, etc.)
function computeRequirements(profile: BusinessProfile, answers: Record<string, any>): Requirement[] {
  // Database-driven: requirements come entirely from the SmartPR Knowledge
  // Base tables via the rules engine (no hardcoded business rules here).
  return computeRequirementsFromKB(profile as any, answers) as Requirement[];
}

// Advisory historical insights shape (from /api/graph/similar).
interface AdvisoryInsights {
  enabled: boolean;
  similarCount: number;
  potentiallyOverlooked: { document: string; agency: string; pct: number }[];
  commonValidationFailures: { document_type: string; failures: number }[];
}

const FACTOR_COLOR: Record<string, string> = {
  business_type: '#2563eb', question: '#d97706', location: '#0891b2',
  municipality: '#0891b2', universal: '#6b7280', agency: '#0d9488',
};

// Expandable "Why is this required?" breakdown for a single requirement.
// Presentation-only; never affects whether the document is required.
function ReqReasons({ enr, language }: { enr: EnrichedRequirement; language: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-[#0D9488] hover:underline">
        {open ? L('Hide reasons', language) : L('Why is this required?', language)}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1">
          {enr.reasons.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-white rounded px-1.5 py-0.5" style={{ background: FACTOR_COLOR[r.factor] || '#6b7280' }}>
                {L(r.factorLabel, language)}{r.weight > 0 ? ` · ${r.weight}%` : ''}
              </span>
              <span className="text-xs text-[#0A2540]/80">{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Compose the reasoning from structured parts so it localizes correctly
// (the stored ext.reasoning is English-only for analytics consistency).
function localizedReasoning(ext: ExtractionResult, docType: string, language: any): string {
  const found = ext.fields_found.map(f => L(f.label, language));
  const missing = ext.fields_missing.map(f => L(f.label, language));
  const parts: string[] = [];
  parts.push(`${L('Classified as', language)} "${docType}" ${L('with', language)} ${ext.classification_confidence}% ${L('confidence', language)}.`);
  if (found.length) parts.push(`${L('Found', language)} ${found.length} ${L('fields', language)}: ${found.join(', ')}.`);
  if (missing.length) parts.push(`${L('Missing required', language)}: ${missing.join(', ')}.`);
  if (ext.expiration_status === 'Valid') parts.push(L('Expiration is valid.', language));
  else if (ext.expiration_status === 'Expired') parts.push(L('Expiration has passed.', language));
  parts.push(
    ext.validation_result === 'PASS' ? L('All required fields are present and valid.', language)
    : ext.validation_result === 'FAIL' ? L('Required fields are missing — this document cannot be validated yet.', language)
    : L('Present but needs review before it can be accepted.', language)
  );
  return parts.join(' ');
}

// Extraction-first results panel for an uploaded document. Replaces generic
// "needs review / missing information" messages with concrete Fields Found /
// Fields Missing / Validation Result / Confidence / Reasoning.
function ExtractionPanel({ ext, docType, language }: { ext: ExtractionResult; docType: string; language: any }) {
  const vr = ext.validation_result;
  const vrColor = vr === 'PASS' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : vr === 'FAIL' ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';
  const vrLabel = vr === 'PASS' ? L('Pass', language) : vr === 'FAIL' ? L('Fail', language) : L('Needs Review', language);
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="font-semibold text-[#0A2540]">{L('Classified as', language)}:</span>
        <span className="text-[#0A2540]">{docType}</span>
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${vrColor}`}>{L('Validation Result', language)}: {vrLabel}</span>
        <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[#0A2540]/80">{L('Confidence Score', language)}: {ext.classification_confidence}%</span>
      </div>

      {ext.fields_found.length > 0 && (
        <div className="mb-1.5">
          <div className="font-semibold text-emerald-700 mb-1">{L('Fields Found', language)}:</div>
          <div className="flex flex-col gap-0.5">
            {ext.fields_found.map((f, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[#0A2540]/60 min-w-[140px]">{L(f.label, language)}</span>
                <span className="text-[#0A2540] font-medium break-all">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ext.fields_missing.length > 0 && (
        <div className="mb-1.5">
          <div className="font-semibold text-red-700 mb-1">{L('Fields Missing', language)}:</div>
          <div className="flex flex-wrap gap-1.5">
            {ext.fields_missing.map((f, i) => (
              <span key={i} className="rounded-full bg-red-50 border border-red-200 text-red-700 px-2 py-0.5">{L(f.label, language)}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="font-semibold text-[#0A2540]">{L('Reasoning', language)}:</span>{' '}
        <span className="text-[#0A2540]/80">{localizedReasoning(ext, docType, language)}</span>
      </div>
    </div>
  );
}

// Save Progress + Email Capture panel. Signed-in users save directly; anonymous
// users provide an email so they can claim this submission on later sign-in.
function SaveProgressPanel({ me, saveState, setSaveState, claimEmail, setClaimEmail, onSave, language }: {
  me: { id: string; email: string | null; name: string | null } | null | undefined;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  setSaveState: (s: 'idle' | 'saving' | 'saved' | 'error') => void;
  claimEmail: string; setClaimEmail: (v: string) => void;
  onSave: () => void; language: any;
}) {
  // While we haven't loaded /api/me yet, render nothing to avoid a flash.
  if (me === undefined) return null;

  if (me) {
    return (
      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#0A2540]">{L('Save Progress', language)}</div>
          <div className="text-xs text-[#0A2540]/60">{L('Saved to your account — resume from History any time.', language)}</div>
        </div>
        <button onClick={onSave} disabled={saveState === 'saving'}
          className="bg-[#0A2540] text-white rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50">
          {saveState === 'saving' ? L('Saving…', language)
           : saveState === 'saved' ? `✓ ${L('Saved', language)}`
           : saveState === 'error' ? L('Retry', language)
           : L('Save Progress', language)}
        </button>
      </div>
    );
  }

  // Anonymous: capture email so they can claim this submission later.
  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="text-sm font-semibold text-amber-900">{L('Save this submission', language)}</div>
      <div className="text-xs text-amber-800/80 mt-0.5 mb-3">
        {L('Enter your email and we will save this assessment to your account when you sign in.', language)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="email" value={claimEmail} onChange={(e) => { setClaimEmail(e.target.value); setSaveState('idle'); }}
          placeholder="you@business.com"
          className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white" />
        <button onClick={onSave} disabled={!claimEmail || saveState === 'saving'}
          className="bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
          {saveState === 'saving' ? L('Saving…', language)
           : saveState === 'saved' ? `✓ ${L('Saved', language)}`
           : L('Save', language)}
        </button>
        <a href={`/auth/login?next=${encodeURIComponent('/dashboard')}`} className="bg-[#0A2540] text-white rounded-lg px-4 py-2 text-sm font-medium text-center">
          {L('Sign in', language)}
        </a>
      </div>
    </div>
  );
}

export default function SmartPR() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [profile, setProfile] = useState<BusinessProfile>({
    name: '',
    municipality: '',
    industry: '',
    business_type: '',
    location_type: '',
    business_structure: 'llc',
    number_of_employees: null,
    customers_visit: null,
    food_prepared_or_sold: null,
    alcohol_sold: null,
    professional_licenses_required: null,
    healthcare_services: null,
    hazardous_materials: null,
    employees_hired: null,
    physical_location: null,
    products_manufactured: null,
    vehicles_used: null,
    commercial_signage: null,
    outdoor_seating: null,
    live_entertainment: null,
    short_term_rental: null,
    medical_waste: null,
    import_export: null,
  });
  const [discoveryAnswers, setDiscoveryAnswers] = useState<Record<string, any>>({});
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  // Correlation id tying every capture event for this scenario together.
  const submissionIdRef = useRef<string>('');
  // The business this assessment belongs to (when signed in + /?business=<id>).
  const businessIdRef = useRef<string | null>(null);
  // For anonymous users: email used to claim this submission on later sign-in.
  const [claimEmail, setClaimEmail] = useState<string>('');
  // Signed-in user (null when anonymous, undefined while loading).
  const [me, setMe] = useState<{ id: string; email: string | null; name: string | null } | null | undefined>(undefined);
  // Save Progress state for user feedback.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // Advisory historical recommendations (never mandatory; rules stay authoritative).
  const [advisory, setAdvisory] = useState<AdvisoryInsights | null>(null);
  // User decisions on flag-derived "Potentially Required" items.
  const [potentialDecisions, setPotentialDecisions] = useState<Record<string, 'applies' | 'not_applies' | 'not_sure'>>({});

  // Explainability: confidence + weighted "why required" reasons per document.
  // Additive only — does not change which requirements are produced.
  const reasonsByDoc = React.useMemo(() => {
    try {
      const res = runRulesEngineForProfile(profile as any, discoveryAnswers);
      const map: Record<string, EnrichedRequirement> = {};
      for (const e of enrichRequirements(KB, res)) map[e.document_id] = e;
      return map;
    } catch {
      return {} as Record<string, EnrichedRequirement>;
    }
  }, [profile, discoveryAnswers]);

  // Fetch advisory historical insights once requirements exist (best-effort).
  // Load the signed-in user (if any) + capture ?business=<id> so this
  // assessment gets linked to a business on save.
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => setMe(d.user || null)).catch(() => setMe(null));
    const params = new URLSearchParams(window.location.search);
    const bizId = params.get('business');
    if (bizId) businessIdRef.current = bizId;
  }, []);

  // Resume a prior submission from History (?resume=<submissionId>): restore
  // the core profile and jump back to the requirements step.
  useEffect(() => {
    const resumeId = new URLSearchParams(window.location.search).get('resume');
    if (!resumeId) return;
    submissionIdRef.current = resumeId;

    // Prefer a full workflow snapshot when signed in (exact mid-flow state).
    (async () => {
      try {
        const snapRes = await fetch(`/api/snapshots/${resumeId}`);
        if (snapRes.ok) {
          const snap = await snapRes.json();
          const st = snap.state || {};
          if (st.profile) setProfile(p => ({ ...p, ...st.profile }));
          if (st.discoveryAnswers) setDiscoveryAnswers(st.discoveryAnswers);
          if (Array.isArray(st.requirements) && st.requirements.length) setRequirements(st.requirements);
          if (st.potentialDecisions) setPotentialDecisions(st.potentialDecisions);
          if (typeof st.readinessScore === 'number') setReadinessScore(st.readinessScore);
          if (typeof st.currentStep === 'number') setCurrentStep(st.currentStep);
          if (snap.business_id) businessIdRef.current = snap.business_id;
          return;
        }
      } catch { /* fall through */ }

      // Fallback: summary-based resume (anonymous + history-row resume).
      const d = await fetch(`/api/history/${resumeId}`).then(r => r.json()).catch(() => null);
      const su = d?.summary;
      if (!su) return;
      const restored = {
        name: su.business_name || '',
        municipality: su.municipality || '',
        industry: su.industry || '',
        business_type: su.business_type || '',
        business_structure: su.business_structure || '',
        location_type: su.location_type || '',
      };
      setProfile(prev => ({ ...prev, ...restored }));
      const computed = computeRequirements({ ...(profile as any), ...restored }, {});
      setRequirements(computed);
      if (su.business_id) businessIdRef.current = su.business_id;
      setCurrentStep(3);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!requirements.length || !profile.business_type) { setAdvisory(null); return; }
    let alive = true;
    fetch('/api/graph/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        municipality: profile.municipality || null,
        industry: profile.industry || null,
        business_type: profile.business_type,
        location_type: profile.location_type || null,
        currentDocuments: requirements.map(r => r.name),
      }),
    })
      .then(r => r.json())
      .then(d => { if (alive) setAdvisory(d); })
      .catch(() => { if (alive) setAdvisory(null); });
    return () => { alive = false; };
  }, [requirements, profile.business_type, profile.municipality]);

  // Single-service architecture: discovery/requirements are computed entirely
  // client-side, and LLM document analysis runs server-side in this same
  // Next.js app at /api/analyze-document. No separate backend service or
  // NEXT_PUBLIC_BACKEND_URL is required.
  const [language, setLanguage] = useState<'en' | 'es'>('en'); // Bilingual toggle

  const [questionList, setQuestionList] = useState<{id: string; text: string}[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Workspace / final deliverables
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  // Real file upload support for Step 2 / checklist uploads (opens local picker, sends to LLM)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingReqCode, setPendingReqCode] = useState<string | null>(null);

  // === Guided UX Refactor (adapted for current Validador + i18n base) ===
  // Addresses the 7 workflow problems while respecting the new design system.
  const PROCESS_STAGES = [
    'Uploading…', 'Extracting text…', 'Classifying document…', 'Validating required fields…', 'Updating readiness score…'
  ] as const;

  const [processingStates, setProcessingStates] = useState<Record<string, { stageIndex: number; fileName?: string }>>({});
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);
  const [highlightCode, setHighlightCode] = useState<string | null>(null);

  // Transient upload notification (toast) shown after a document is analyzed by the LLM.
  const [uploadNotice, setUploadNotice] = useState<
    { kind: 'success' | 'warning' | 'error'; title: string; detail?: string } | null
  >(null);
  useEffect(() => {
    if (!uploadNotice) return;
    const id = setTimeout(() => setUploadNotice(null), 6000);
    return () => clearTimeout(id);
  }, [uploadNotice]);

  // Hidden debug mode for the rules engine (enable with ?debug=1 in the URL).
  const [debugMode, setDebugMode] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setDebugMode(params.get('debug') === '1' || params.has('debug'));
    }
  }, []);

  const t = (key: string): string => {
    const dict: Record<string, { en: string; es: string }> = {
      title: { en: "Tell Us About Your Business", es: "Cuéntanos sobre tu Negocio" },
      subtitle: { en: "Answer a few questions and we'll determine which Puerto Rico licenses, permits, certifications, and documents you need.", es: "Responde algunas preguntas y determinaremos qué licencias, permisos, certificaciones y documentos de Puerto Rico necesitas." },
      businessName: { en: "Business Name", es: "Nombre del Negocio" },
      municipality: { en: "Municipality", es: "Municipio" },
      industry: { en: "Industry", es: "Industria" },
      businessType: { en: "Business Type", es: "Tipo de Negocio" },
      locationType: { en: "Business Location Type", es: "Tipo de Ubicación del Negocio" },
      businessStructure: { en: "Business Structure", es: "Estructura del Negocio" },
      numEmployees: { en: "Number of Employees", es: "Número de Empleados" },
      next: { en: "Next →", es: "Siguiente →" },
      q_customers: { en: "Will customers visit your location?", es: "¿Los clientes visitarán su ubicación?" },
      q_food: { en: "Will food be prepared or sold?", es: "¿Se preparará o venderá comida?" },
      q_alcohol: { en: "Will alcohol be sold?", es: "¿Se venderá alcohol?" },
      q_professional: { en: "Will professional licenses be required?", es: "¿Se requerirán licencias profesionales?" },
      q_healthcare: { en: "Will healthcare services be provided?", es: "¿Se proporcionarán servicios de atención médica?" },
      q_hazardous: { en: "Will hazardous materials be stored?", es: "¿Se almacenarán materiales peligrosos?" },
      q_employees: { en: "Will employees be hired?", es: "¿Se contratarán empleados?" },
      q_physical: { en: "Will the business operate from a physical location?", es: "¿Operará el negocio desde una ubicación física?" },
      q_manufactured: { en: "Will products be manufactured?", es: "¿Se fabricarán productos?" },
      q_vehicles: { en: "Will vehicles be used for business operations?", es: "¿Se utilizarán vehículos para operaciones comerciales?" },
      q_signage: { en: "Will the business have commercial signage?", es: "¿Tendrá el negocio letreros comerciales?" },
      q_outdoor: { en: "Will there be outdoor seating?", es: "¿Habrá asientos al aire libre?" },
      q_entertainment: { en: "Will there be live entertainment?", es: "¿Habrá entretenimiento en vivo?" },
      q_tourism: { en: "Will this be a short-term rental or tourism activity?", es: "¿Será un alquiler a corto plazo o actividad turística?" },
      q_medicalWaste: { en: "Will medical waste be generated?", es: "¿Se generarán residuos médicos?" },
      q_importExport: { en: "Will import/export activity occur?", es: "¿Ocurrirá actividad de importación/exportación?" },
      yes: { en: "Yes", es: "Sí" },
      no: { en: "No", es: "No" },
      selectIndustry: { en: "Select Industry", es: "Seleccionar Industria" },
      selectBusinessType: { en: "Select Business Type", es: "Seleccionar Tipo de Negocio" },
      selectLocationType: { en: "Select Location Type", es: "Seleccionar Tipo de Ubicación" },
      selectMunicipality: { en: "Select Municipality", es: "Seleccionar Municipio" },
    };
    return dict[key]?.[language] || key;
  };

  // Translate requirement name/reason, handling the dynamic Patente Municipal
  // strings (which embed the municipality and so can't be matched verbatim).
  const trReqName = (req: { code: string; name: string }) => {
    if (req.code === 'patente_municipal') return `Patente Municipal (${profile.municipality})`;
    return L(req.name, language);
  };
  const trReqReason = (req: { code: string; reason: string }) => {
    if (language === 'es') {
      if (req.code === 'patente_municipal')
        return `Impuesto/licencia municipal requerido en el municipio de ${profile.municipality}. Usualmente requiere primero el Permiso Único.`;
      if (req.code === 'municipal_registration')
        return `El registro con el gobierno municipal de ${profile.municipality} es requerido para operar dentro del municipio.`;
      if (req.code === 'municipal_tax_compliance')
        return `Se requiere prueba de cumplimiento de impuestos municipales; las tasas varían por municipio (${profile.municipality}).`;
    }
    return L(req.reason, language);
  };

  // Recompute requirements whenever profile or answers change (demo of the rules engine)
  const updateRequirements = (newProfile?: BusinessProfile, newAnswers?: Record<string, any>) => {
    const p = newProfile || profile;
    const a = newAnswers || discoveryAnswers;
    const computed = computeRequirements(p, a);
    setRequirements(computed);
  };

  // Dynamic follow-up questions / flags based on the new Step 1 fields
  const getFollowUpQuestions = (ind?: string) => {
    const industry = ind || profile.industry;
    const q: Record<string, any> = {
      has_food_service: profile.food_prepared_or_sold === true,
      alcohol_sales: profile.alcohol_sold === true,
      provides_healthcare: profile.healthcare_services === true || profile.industry === 'Healthcare' || profile.professional_licenses_required === true,
      customers_visit: profile.customers_visit,
      professional_licenses: profile.professional_licenses_required,
      location_type: profile.location_type,
      business_type: profile.business_type,
      hazardous_materials: profile.hazardous_materials,
      employees_hired: profile.employees_hired,
      physical_location: profile.physical_location,
      products_manufactured: profile.products_manufactured,
      vehicles_used: profile.vehicles_used,
      commercial_signage: profile.commercial_signage,
      outdoor_seating: profile.outdoor_seating,
      live_entertainment: profile.live_entertainment,
      short_term_rental: profile.short_term_rental,
      medical_waste: profile.medical_waste,
      import_export: profile.import_export,
    };
    return q;
  };

  // Dynamic question flow based on Business Type AND Location Type. We filter
  // out questions whose answer is implied by the location (e.g. nothing about
  // customers visiting "the location" when there is no physical location).
  useEffect(() => {
    if (profile.business_type) {
      const list = filterQuestionsByContext(
        getQuestionsForBusinessType(profile.business_type),
        profile.location_type
      );
      setQuestionList(list);
      setCurrentQuestionIndex(0);
    } else {
      setQuestionList([]);
      setCurrentQuestionIndex(0);
    }
  }, [profile.business_type, profile.location_type]);

  const handleQuestionAnswer = (yes: boolean) => {
    const q = questionList[currentQuestionIndex];
    if (!q) return;

    const updates: Partial<BusinessProfile> = {};

    if (q.id === "food_prepared_on_site") updates.food_prepared_or_sold = yes;
    if (q.id === "customers_consume_on_site" || q.id === "patients_visit" || q.id === "clients_visit" || q.id === "customers_visit") updates.customers_visit = yes;
    if (q.id === "alcohol_sold") updates.alcohol_sold = yes;
    if (q.id === "outdoor_seating") updates.outdoor_seating = yes;
    if (q.id === "live_entertainment") updates.live_entertainment = yes;
    if (q.id === "employees_work_on_site" || q.id === "employees_hired") updates.employees_hired = yes;
    if (q.id === "physical_office" || q.id === "physical_location") updates.physical_location = yes;
    if (q.id === "licensed_professionals" || q.id === "professional_licenses_required") updates.professional_licenses_required = yes;
    if (q.id === "medical_waste") updates.medical_waste = yes;
    if (q.id === "controlled_substances" || q.id === "hazardous_materials") updates.hazardous_materials = yes;
    if (q.id === "diagnostic_testing" || q.id === "healthcare_professionals" || q.id === "healthcare_services") updates.healthcare_services = yes;
    if (q.id === "services_online") updates.physical_location = !yes;
    if (q.id === "inventory_stored") updates.physical_location = yes;
    if (q.id === "hardware_sold") updates.products_manufactured = yes;
    if (q.id === "food_delivered") updates.food_prepared_or_sold = yes;
    if (q.id === "food_truck_or_mobile") {
      if (yes) setProfile(p => ({ ...p, location_type: "Food Truck" }));
    }
    if (q.id === "guests_stay_overnight" || q.id === "physical_location") updates.physical_location = yes;
    if (q.id === "food_served") updates.food_prepared_or_sold = yes;
    if (q.id === "alcohol_served") updates.alcohol_sold = yes;
    if (q.id === "water_activities") updates.physical_location = yes;
    if (q.id === "customers_receive_services") updates.customers_visit = yes;
    if (q.id === "needles_or_invasive") updates.hazardous_materials = yes;
    if (q.id === "biohazard_waste") updates.medical_waste = yes;
    if (q.id === "products_manufactured_on_site") updates.products_manufactured = yes;
    if (q.id === "commercial_vehicles" || q.id === "vehicles_repaired") updates.vehicles_used = yes;
    if (q.id === "goods_stored") updates.physical_location = yes;
    if (q.id === "children_present" || q.id === "classes_on_site") updates.physical_location = yes;
    if (q.id === "food_served" || q.id === "food_products_sold") updates.food_prepared_or_sold = yes;
    if (q.id === "chemicals_stored" || q.id === "hazardous_fluids" || q.id === "hazardous_materials_stored" || q.id === "hazardous_materials_transported") updates.hazardous_materials = yes;
    if (q.id === "properties_managed") updates.physical_location = yes;

    if (Object.keys(updates).length > 0) {
      setProfile(prev => ({ ...prev, ...updates }));
    }

    setDiscoveryAnswers(prev => ({ ...prev, [q.id]: yes }));
    setCurrentQuestionIndex(prev => prev + 1);
  };

  // Auto-recompute when key profile fields change
  useEffect(() => {
    if (currentStep >= 2) {
      const newAnswers = { ...discoveryAnswers, ...getFollowUpQuestions() };
      setDiscoveryAnswers(newAnswers);
      updateRequirements(profile, newAnswers);
    }
  }, [profile.industry, profile.municipality, profile.location_type, profile.food_prepared_or_sold, profile.alcohol_sold, profile.professional_licenses_required, profile.business_type, currentStep]);

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

  // Step 1: Save profile + compute discovery requirements (client-side)
  const handleStartDiscovery = async () => {
    setIsLoading(true);
    const answers = { 
      ...getFollowUpQuestions(),
      customers_visit: profile.customers_visit,
      food_prepared_or_sold: profile.food_prepared_or_sold,
      alcohol_sold: profile.alcohol_sold,
      professional_licenses_required: profile.professional_licenses_required,
      healthcare_services: profile.healthcare_services,
      hazardous_materials: profile.hazardous_materials,
      employees_hired: profile.employees_hired,
      physical_location: profile.physical_location,
      products_manufactured: profile.products_manufactured,
      vehicles_used: profile.vehicles_used,
      commercial_signage: profile.commercial_signage,
      outdoor_seating: profile.outdoor_seating,
      live_entertainment: profile.live_entertainment,
      short_term_rental: profile.short_term_rental,
      medical_waste: profile.medical_waste,
      import_export: profile.import_export,
      location_type: profile.location_type,
      business_type: profile.business_type,
      business_structure: profile.business_structure,
      number_of_employees: profile.number_of_employees,
    };

    // Discovery + requirements are computed entirely client-side.
    setBusinessId('local-' + Date.now());
    setDiscoveryAnswers(answers);
    const computed = computeRequirements(profile, answers);
    setRequirements(computed);

    // --- Knowledge-graph capture (observational, fire-and-forget) ---
    captureScenario(profile, answers, computed);

    setCurrentStep(3);
    setIsLoading(false);
  };

  // Build and emit a "submission" capture event from the current scenario.
  // Never throws — capture is best-effort and never affects the user flow.
  const captureScenario = (
    p: BusinessProfile,
    answers: Record<string, any>,
    computed: Requirement[]
  ) => {
    try {
      const submissionId = newSubmissionId();
      submissionIdRef.current = submissionId;
      const engineInput = buildEngineInput(p as any, answers);
      const qText = new Map(KB.questions.map((q) => [q.id, q.question]));
      // buildEngineInput expands the profile into EVERY canonical Q_* question,
      // defaulting the ones the user never engaged with to `false`. Capturing
      // those would make a submission's history list every question in the KB.
      // Only persist affirmative answers — the Yes responses that actually
      // drove requirements — so "Questions Answered" reflects real input.
      const isAnswered = (v: unknown) => {
        if (v === true) return true;
        if (typeof v === 'string') {
          const s = v.trim();
          return s !== '' && !/^(false|no)$/i.test(s);
        }
        return false;
      };
      const capturedAnswers: CapturedAnswer[] = Object.entries(engineInput.answers)
        .filter(([, v]) => isAnswered(v))
        .map(([qid, v]) => ({ question_id: qid, question: qText.get(qid) || qid, answer: v as any }));
      const capturedReqs: CapturedRequirement[] = computed.map((r) => ({
        document_id: r.document_id,
        document: r.name,
        agency: r.agency,
        reason: r.reason,
        source_rule: r.source_rule,
        mandatory: r.mandatory,
      }));
      captureEvent({
        kind: 'submission',
        submission_id: submissionId,
        municipality: p.municipality || null,
        industry: p.industry || null,
        business_type: p.business_type || null,
        business_structure: p.business_structure || null,
        location_type: p.location_type || null,
        business_name: p.name || null,
        business_id: businessIdRef.current || null,
        claim_email: claimEmail || null,
        answers: capturedAnswers,
        requirements: capturedReqs,
      });
    } catch {
      /* observational only */
    }
  };

  // Re-emit the current submission to capture (with claim_email if anonymous),
  // and store a workflow snapshot if signed in so resume restores exact state.
  const saveProgress = async () => {
    setSaveState('saving');
    try {
      captureScenario(profile, discoveryAnswers, requirements);
      if (me) {
        await fetch(`/api/snapshots/${submissionIdRef.current}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: businessIdRef.current,
            state: {
              profile, discoveryAnswers,
              requirements, potentialDecisions,
              currentStep, readinessScore,
            },
          }),
        });
      }
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3500);
    } catch {
      setSaveState('error');
    }
  };

  // Sign out: navigate to the server route IMMEDIATELY (it clears the httpOnly
  // cookies and 302s to /auth/login). The browser-side signOut is fired
  // best-effort WITHOUT awaiting — a hanging network call must never block the
  // redirect, which was the cause of "nothing happens on click".
  const handleSignOut = () => {
    setMenuOpen(false);
    try {
      if (isAuthConfigured()) {
        void createSupabaseBrowser().auth.signOut().catch(() => {});
      }
    } catch {
      /* ignore — the server route below is the source of truth */
    }
    window.location.assign('/auth/signout');
  };

  // Load / recompute requirements (powered by the design-accurate compute function)
  const loadRequirements = async () => {
    setIsLoading(true);
    const computed = computeRequirements(profile, discoveryAnswers);
    setRequirements(computed);
    setCurrentStep(3);
    setIsLoading(false);
  };

  // When business_type changes, also ensure location is valid (already handled in onChange)
  // The LOCATION_TYPES_BY_BUSINESS_TYPE drives the dynamic options for Field 5.

  // Legacy / internal - see processRealFileUpload for current upload logic
  const handleMockUpload = async (reqCode: string) => {
    const docName = `${reqCode.replace(/_/g, ' ')}.pdf`;
    
    // Simulated document text for the AI (in real use, this would come from OCR / file text). Tailored to the requirement.
    const simulatedContent = `This is a ${reqCode.replace(/_/g, ' ')} for ${profile.name || "the business"} located in ${profile.municipality}. Issued recently. Contains business name, dates, official stamps, license/permit numbers, and agency details.`;

    let analysis: any = null;
    let extracted = {
      business_name: profile.name || "ABC Restaurant LLC",
      entity_name: profile.name || "ABC Restaurant LLC",
      issue_date: "2024-03-15",
      expiration_date: reqCode.includes("insurance") ? "2025-03-14" : "2026-01-01",
    };

    // Legacy mock path (no longer used in the main upload flow — real LLM path is always preferred)
    analysis = {
      document_type: reqCode.includes('merchant') ? 'Merchant Registration Certificate' : 
                     reqCode.includes('permiso') ? 'Permiso Único' :
                     reqCode.includes('health') ? 'Health Permit' :
                     reqCode.includes('fire') ? 'Fire Certification' :
                     reqCode.includes('lease') ? 'Lease Agreement' : 'Unknown',
      confidence: 0.85,
      extracted,
      validation_checks: [
        { check: "Business Name Match", result: "pass", details: "Name matches profile" },
        { check: "Required Fields Present", result: "pass", details: "Key fields found" },
        { check: "Not Expired", result: reqCode.includes('insurance') ? "warning" : "pass", details: "" }
      ],
      overall_status: "Complete",
      notes: "Legacy simulation (real LLM path used in current upload flow)."
    };

    const newDoc = {
      id: Date.now(),
      requirement_code: reqCode,
      name: docName,
      extracted,
      ai_analysis: analysis
    };
    const newUploaded = [...uploadedDocs, newDoc];
    setUploadedDocs(newUploaded);

    // Update requirement status based on analysis
    const overall = analysis?.overall_status || 'Needs Review';
    let newStatus = 'uploaded';
    if (overall === 'Complete') newStatus = 'passed';
    else if (overall === 'Needs Review' || overall === 'Missing Information') newStatus = 'warning';
    else if (overall === 'Mismatch' || overall === 'Expired') newStatus = 'warning';

    const updatedReqs = requirements.map(r =>
      r.code === reqCode ? { ...r, status: newStatus as any } : r
    );
    setRequirements(updatedReqs);

    // === DETAILED READINESS SCORE per the SmartPR Document Validation Engine spec ===
    // Weight = 100 / total mandatory required documents
    // Stages: 0 (uploaded only), 25% (identified), 50% (fields extracted), 100% (verified)
    // Penalties applied for issues
    const mandatoryReqs = updatedReqs.filter(r => r.mandatory);
    const totalMand = mandatoryReqs.length || 1;
    const weight = 100 / totalMand;

    let score = 0;
    let penalties = 0;

    mandatoryReqs.forEach(req => {
      const doc = newUploaded.find(d => d.requirement_code === req.code);
      if (!doc || !doc.ai_analysis) {
        return; // 0 for not yet verified
      }
      const a = doc.ai_analysis;
      const checks = a.validation_checks || [];

      let stage = 0;
      const hasId = a.document_type && a.document_type !== 'Unknown';
      const hasExtract = a.extracted && Object.values(a.extracted).some((v: any) => v);
      const isVerified = (a.overall_status === 'Complete' || a.overall_status === 'Verified') &&
                         checks.every((c: any) => c.result === 'pass' || !c.check.includes('Match') && !c.check.includes('Expired'));

      if (isVerified) stage = 1.0;
      else if (hasExtract) stage = 0.5;
      else if (hasId) stage = 0.25;

      let contrib = stage * weight;

      // Penalties (from spec)
      const nameMismatch = checks.some((c: any) => c.check.includes('Name') && c.result !== 'pass');
      const addrMismatch = checks.some((c: any) => c.check.includes('Address') && c.result !== 'pass');
      const expired = checks.some((c: any) => c.check.includes('Expired') && c.result !== 'pass') ||
                      (a.extracted?.expiration_date && new Date(a.extracted.expiration_date) < new Date());
      const missingKey = checks.some((c: any) => (c.check.includes('Permit') || c.check.includes('Number') || c.check.includes('License')) && c.result !== 'pass');

      if (expired) penalties += weight;
      if (nameMismatch) penalties += 0.5 * weight;
      if (addrMismatch) penalties += 0.25 * weight;
      if (missingKey) penalties += 0.25 * weight;

      score += contrib;
    });

    score = Math.max(0, Math.min(100, Math.round(score - penalties)));
    setReadinessScore(score);

    // Add specific finding/message for this validation (UI will show in findings or as alert)
    const newFindings: Finding[] = [...findings];
    if (analysis) {
      const status = analysis.overall_status;
      let sev: 'critical' | 'warning' | 'informational' = 'informational';
      let title = `${docName} validated`;
      let desc = analysis.notes || `Document identified as ${analysis.document_type}. Confidence ${Math.round((analysis.confidence||0)*100)}%.`;
      let action = 'Document added to package.';

      if (status === 'Complete') {
        sev = 'informational';
        title = `${analysis.document_type} successfully verified`;
        action = 'Readiness score updated.';
      } else if (status === 'Needs Review' || status === 'Missing Information') {
        sev = 'warning';
        title = `${analysis.document_type} needs review`;
        action = 'Review extracted fields or re-upload clearer version.';
      } else if (status === 'Mismatch' || status === 'Expired') {
        sev = 'critical';
        title = `${analysis.document_type} has issues`;
        action = 'Address mismatches or expiration before submission.';
      }

      newFindings.push({
        severity: sev,
        title,
        description: desc,
        recommended_action: action
      });
    }
    setFindings(newFindings);
  };

  // === Real local file upload + LLM document identification (uses .env key + AI model via backend) ===
  const readAsPlainText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(`[Binary or unreadable content from ${file.name}]`);
      reader.readAsText(file);
    });
  };

  // Extract real text from a PDF using pdf.js so the LLM receives clean,
  // readable content (e.g. the EIN/permit numbers) instead of raw binary bytes.
  const extractPdfText = async (file: File): Promise<string> => {
    const pdfjs: any = await import('pdfjs-dist');
    // Point pdf.js at its bundled worker (Turbopack/webpack resolve this URL).
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const parts: string[] = [];
    const maxPages = Math.min(doc.numPages, 15); // cap for performance
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
        .join(' ');
      parts.push(pageText);
    }
    return parts.join('\n').trim();
  };

  // Returns the best available text for LLM analysis, choosing the right
  // extractor based on file type. PDFs go through pdf.js; everything else is
  // read as plain text.
  const readFileAsText = async (file: File): Promise<string> => {
    const isPdf =
      file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (isPdf) {
      try {
        const text = await extractPdfText(file);
        if (text && text.length > 0) return text;
        // Scanned/image-only PDF with no embedded text layer.
        return `[No selectable text found in PDF "${file.name}" — it may be a scanned image.]`;
      } catch (e) {
        console.warn('PDF text extraction failed, falling back to raw read', e);
        return readAsPlainText(file);
      }
    }
    return readAsPlainText(file);
  };

  const triggerFileUpload = (reqCode: string) => {
    setPendingReqCode(reqCode);
    // If using backend but no proper businessId yet, the process will attempt to create one
    fileInputRef.current?.click();
  };

  const processRealFileUpload = async (file: File, reqCode: string) => {
    setIsLoading(true);
    const filename = file.name;

    // Read both text (for LLM analysis) and binary blob (for ZIP packaging of original documents)
    const [textContent, arrayBuffer] = await Promise.all([
      readFileAsText(file),
      file.arrayBuffer()
    ]);
    let content = textContent;
    if (content.length > 7500) content = content.slice(0, 7500);
    const fileBlob = new Blob([arrayBuffer], { type: file.type || 'application/pdf' });

    let analysis: any = null;
    let llmRan = false;        // true only when the server-side AI call returned a result
    let llmError: string | null = null;
    let extracted: any = {
      business_name: profile.name || null,
      entity_name: profile.name || null,
    };

    // Real LLM analysis runs server-side in this same Next.js app
    // (route handler at /api/analyze-document). No separate backend or
    // NEXT_PUBLIC_BACKEND_URL needed. If the server key isn't configured or
    // the call fails, we fall back to client-side filename/text classification.
    try {
      const res = await fetch(`/api/analyze-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          content,
          requirement_code: reqCode,   // unique, targeted prompt per document type
          lang: language,              // so AI notes/findings come back in the selected language
          business_context: {
            name: profile.name || null,
            municipality: profile.municipality || null,
            industry: profile.industry || null,
            location_type: profile.location_type || null,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        analysis = data.analysis;
        llmRan = true;
        if (analysis?.extracted) {
          extracted = { ...extracted, ...analysis.extracted };
        }
      } else {
        const err = await res.json().catch(() => ({}));
        llmError = err?.error || `Analysis service returned ${res.status}`;
        console.warn('LLM analyze returned non-ok status', res.status, err);
      }
    } catch (e) {
      llmError = 'Could not reach the document analysis service';
      console.warn('LLM document analysis failed, falling back to filename-based classification', e);
    }

    if (!analysis) {
      // Client fallback (still uses the actual filename + any extracted text from file for better ID than pure mock)
      const lower = (filename + ' ' + content).toLowerCase();
      let docType = 'Unknown';
      if (/(inc|llc|corporation|articles|organization|formacion)/.test(lower)) docType = 'Certificate of Incorporation';
      else if (/ein|irs|employer identification/.test(lower)) docType = 'IRS EIN Letter';
      else if (/merchant|registro de comerciante|hacienda/.test(lower)) docType = 'Merchant Registration Certificate';
      else if (/permiso|ogpe|single business/.test(lower)) docType = 'Permiso Único';
      else if (/patente|municipal/.test(lower)) docType = 'Patente Municipal';
      else if (/lease|arrendamiento/.test(lower)) docType = 'Lease Agreement';
      else if (/deed|escritura|property/.test(lower)) docType = 'Property Deed';
      else if (/health|salud|sanitary/.test(lower)) docType = 'Health Permit';
      else if (/fire|bombero|seguridad/.test(lower)) docType = 'Fire Certification';
      else if (/cfpm|food protection|servsafe|prometric/.test(lower)) docType = 'CFPM Certificate';
      else if (/professional|license|licencia|colegio/.test(lower)) docType = 'Professional License';
      else if (/contractor|constructor/.test(lower)) docType = 'Contractor License';
      else if (/insurance|seguro/.test(lower)) docType = 'Insurance Certificate';
      else if (/alcohol|licor|bebidas/.test(lower)) docType = 'Alcohol Permit';

      const fbExtraction = buildExtraction(docType, extracted, 0.65, { businessName: profile.name || null });
      analysis = {
        document_type: docType,
        confidence: 0.65,
        extracted,
        extraction: fbExtraction,
        validation_checks: [],
        overall_status:
          fbExtraction.validation_result === 'PASS' ? 'Complete'
          : fbExtraction.validation_result === 'FAIL' ? 'Missing Information'
          : 'Needs Review',
        notes: fbExtraction.reasoning,
      };
    }

    // Ensure an extraction object always exists (older responses / safety).
    if (analysis && !analysis.extraction) {
      analysis.extraction = buildExtraction(
        analysis.document_type || 'Unknown',
        analysis.extracted || extracted,
        typeof analysis.confidence === 'number' ? analysis.confidence : 0.5,
        { businessName: profile.name || null }
      );
    }

    const newDoc = {
      id: Date.now(),
      requirement_code: reqCode,
      name: filename,
      extracted,
      ai_analysis: analysis,
      fileBlob,                 // original uploaded file for ZIP packaging
      originalName: filename
    };
    const newUploaded = [...uploadedDocs, newDoc];
    setUploadedDocs(newUploaded);

    // Update requirement status + detailed score + findings (same logic as before for consistency)
    const overall = analysis?.overall_status || 'Needs Review';
    let newStatus: 'pending' | 'uploaded' | 'passed' | 'warning' = 'uploaded';
    if (overall === 'Complete' || overall === 'Verified') newStatus = 'passed';
    else if (overall === 'Needs Review' || overall === 'Missing Information') newStatus = 'warning';
    else if (overall === 'Mismatch' || overall === 'Expired') newStatus = 'warning';

    const updatedReqs = requirements.map(r =>
      r.code === reqCode ? { ...r, status: newStatus } : r
    );
    setRequirements(updatedReqs);

    if (newStatus === 'warning') {
      autoFocusFailed(reqCode);
    }

    // Score calculation (weight 100/total_mandatory, stages, penalties) - from verified only
    const mandatoryReqs = updatedReqs.filter(r => r.mandatory);
    const totalMand = mandatoryReqs.length || 1;
    const weight = 100 / totalMand;

    let score = 0;
    let penalties = 0;

    mandatoryReqs.forEach(req => {
      const doc = newUploaded.find(d => d.requirement_code === req.code);
      if (!doc || !doc.ai_analysis) return;
      const a = doc.ai_analysis;
      // Extraction-first scoring: the readiness contribution is driven by the
      // structured extraction result (fields found vs. required), not by
      // generic statuses.
      const ext: ExtractionResult | undefined = a.extraction;
      let stage = 0;
      if (ext) {
        if (ext.validation_result === 'PASS') stage = 1.0;
        else if (ext.validation_result === 'NEEDS_REVIEW') stage = 0.6;
        else stage = ext.fields_found.length > 0 ? 0.3 : 0; // FAIL: partial credit for any extraction
      } else {
        const hasId = a.document_type && a.document_type !== 'Unknown';
        const hasExtract = a.extracted && Object.values(a.extracted).some((v: any) => v);
        stage = hasExtract ? 0.5 : hasId ? 0.25 : 0;
      }

      score += stage * weight;

      // Penalties for concrete extracted problems.
      if (ext?.expiration_status === 'Expired') penalties += weight;
      if (ext && ext.fields_missing.length > 0) penalties += 0.25 * weight;
    });

    score = Math.max(0, Math.min(100, Math.round(score - penalties)));
    setReadinessScore(score);

    // --- Knowledge-graph capture: document validation + readiness ---
    try {
      const ext: ExtractionResult | undefined = analysis?.extraction;
      const validationResult: 'PASS' | 'NEEDS_REVIEW' | 'FAIL' =
        ext?.validation_result || (newStatus === 'passed' ? 'PASS' : 'NEEDS_REVIEW');
      captureEvent({
        kind: 'validation',
        submission_id: submissionIdRef.current,
        business_type: profile.business_type || null,
        document_type: analysis?.document_type || reqCode,
        validation_result: validationResult,
        pass_fail: validationResult === 'PASS',
        confidence: ext ? ext.classification_confidence : Math.round((analysis?.confidence || 0) * 100),
        expiration_status: ext?.expiration_status || 'Unknown',
        extracted_fields: analysis?.extracted || undefined,
        fields_found: ext?.fields_found.map(f => f.label),
        fields_missing: ext?.fields_missing.map(f => f.label),
      });

      const missingDocuments = updatedReqs
        .filter((r) => r.mandatory && r.status !== 'passed')
        .map((r) => r.name);
      const readinessStatus =
        score >= 90 ? 'Ready For Submission' : score >= 70 ? 'Nearly Ready' : score >= 40 ? 'In Progress' : 'Getting Started';
      captureEvent({
        kind: 'readiness',
        submission_id: submissionIdRef.current,
        business_type: profile.business_type || null,
        score,
        status: readinessStatus,
        missing_documents: missingDocuments,
      });
    } catch {
      /* observational only */
    }

    // Findings from this analysis
    const newFindings: Finding[] = [...findings];
    const status = analysis.overall_status;
    let sev: 'critical' | 'warning' | 'informational' = 'informational';
    let title = `${filename} ${L('processed', language)}`;
    let desc = analysis.notes || `${L('Identified as', language)} ${analysis.document_type}. ${L('Confidence', language)} ${Math.round((analysis.confidence || 0) * 100)}%.`;
    let action = L('Document added and analyzed.', language);

    if (status === 'Complete' || status === 'Verified') {
      sev = 'informational';
      title = `${analysis.document_type} — ${L('verified', language)}`;
      action = L('Readiness score updated.', language);
    } else if (status === 'Needs Review' || status === 'Missing Information') {
      sev = 'warning';
      title = `${analysis.document_type} — ${L('needs review', language)}`;
      action = L('Review fields or re-upload.', language);
    } else if (status === 'Mismatch' || status === 'Expired') {
      sev = 'critical';
      title = `${analysis.document_type} — ${L('has issues', language)}`;
      action = L('Address before submission.', language);
    }

    newFindings.push({ severity: sev, title, description: desc, recommended_action: action });
    setFindings(newFindings);

    // Visible toast so the user immediately sees the LLM result for this upload.
    const reqObj = requirements.find(r => r.code === reqCode);
    const reqLabel = reqObj ? trReqName(reqObj) : (analysis.document_type || filename);
    if (!llmRan) {
      setUploadNotice({
        kind: 'error',
        title: L('Could not analyze with AI', language),
        detail: llmError
          ? `${llmError}. ${L('Add OPENROUTER_API_KEY in your environment to enable AI analysis.', language)}`
          : L('AI analysis unavailable. Using basic classification.', language),
      });
    } else {
      // Specific, extraction-first toast: counts of fields found/missing.
      const ext: ExtractionResult | undefined = analysis?.extraction;
      const found = ext?.fields_found.length ?? 0;
      const missing = ext?.fields_missing.length ?? 0;
      const vr = ext?.validation_result;
      const detail = `${found} ${L('fields found', language)}${missing ? `, ${missing} ${L('required missing', language)}` : ''} · ${analysis.document_type}`;
      if (vr === 'PASS') {
        setUploadNotice({ kind: 'success', title: `✓ ${reqLabel} — ${L('Pass', language)}`, detail });
      } else if (vr === 'FAIL') {
        setUploadNotice({ kind: 'warning', title: `${reqLabel} — ${L('Fields Missing', language)}`, detail });
      } else {
        setUploadNotice({ kind: 'warning', title: `${reqLabel} — ${L('Needs Review', language)}`, detail });
      }
    }

    setIsLoading(false);
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const code = pendingReqCode;
    setPendingReqCode(null);
    if (e.target) e.target.value = ''; // allow re-select same file later
    if (file && code) {
      await processRealFileUpload(file, code);
    } else if (code) {
      setProcessingStates(prev => { const n = { ...prev }; delete n[code]; return n; });
    }
  };

  // Start the visible 5-stage pipeline (fixes "uploads feel dead")
  const startProcessingPipeline = (reqCode: string, fileName: string) => {
    setProcessingStates(prev => ({ ...prev, [reqCode]: { stageIndex: 0, fileName } }));
    let current = 0;
    const advance = () => {
      current += 1;
      if (current < PROCESS_STAGES.length) {
        setProcessingStates(prev => {
          if (!prev[reqCode]) return prev;
          return { ...prev, [reqCode]: { ...prev[reqCode], stageIndex: current } };
        });
        setTimeout(advance, 380);
      } else {
        setTimeout(() => {
          setProcessingStates(prev => { const n = { ...prev }; delete n[reqCode]; return n; });
        }, 550);
      }
    };
    setTimeout(advance, 320);
  };

  // Enhanced trigger that also starts the visual pipeline
  const triggerFileUploadWithPipeline = (reqCode: string) => {
    const doc = uploadedDocs.find(d => d.requirement_code === reqCode);
    const name = doc?.name || `${reqCode}.pdf`;
    startProcessingPipeline(reqCode, name);
    triggerFileUpload(reqCode);
  };

  // Smart single next action (TurboTax-style)
  const getRecommendedNextAction = () => {
    const needsReview = requirements.filter(r => r.mandatory && r.status === 'warning');
    const uploadedCodes = new Set(uploadedDocs.map(d => d.requirement_code));

    if (needsReview.length > 0) {
      const first = needsReview[0];
      return {
        label: L(`${needsReview.length} document${needsReview.length > 1 ? 's' : ''} need review`, language),
        action: () => {
          const el = document.getElementById(`req-row-${first.code}`);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlightCode(first.code); setTimeout(() => setHighlightCode(null), 2000); }
          setReviewingCode(first.code);
        },
        cta: L('Review now', language)
      };
    }

    const missing = requirements.filter(r => r.mandatory && r.status === 'pending' && !uploadedCodes.has(r.code));
    if (missing.length > 0) {
      const next = missing[0];
      return {
        label: L(`Upload ${next.name}`, language),
        action: () => triggerFileUploadWithPipeline(next.code),
        cta: L('Upload', language)
      };
    }

    return {
      label: L('All mandatory items validated', language),
      action: () => setCurrentStep(9),
      cta: L('Continue to Deliverables', language)
    };
  };

  // Resolve a warning item
  const resolveAndMarkComplete = (reqCode: string) => {
    setRequirements(prev => prev.map(r => r.code === reqCode ? { ...r, status: 'passed' as const } : r));
    setFindings(prev => prev.filter(f => !f.title.toLowerCase().includes(reqCode.replace(/_/g, ' '))));
    setReviewingCode(null);
    if (readinessScore != null) setReadinessScore(Math.min(100, readinessScore + 10));
  };

  // Auto focus + open review for newly failed documents
  const autoFocusFailed = (reqCode: string) => {
    setTimeout(() => {
      const el = document.getElementById(`req-row-${reqCode}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightCode(reqCode);
        setReviewingCode(reqCode);
        setTimeout(() => setHighlightCode(null), 2200);
      }
    }, 600);
  };

  // Step 6-7: Run validation (calls backend mock or local logic)
  const runValidation = async () => {
    setIsLoading(true);
    try {
      let score = 68;
      let newFindings: Finding[] = [];

      {
        // Client-side Validation Engine (readiness score + findings).
        const missing = requirements.filter(r => r.mandatory && r.status === 'pending').length;
        score = Math.max(40, 95 - (missing * 12));

        newFindings = [];
        if (missing > 0) {
          newFindings.push({
            severity: 'critical',
            title: `${missing} ${L('Critical Items Missing', language)}`,
            description: L('Required documents or permits have not been uploaded or validated.', language),
            recommended_action: L('Upload the missing items shown in the checklist.', language)
          });
        }
        if (profile.industry === 'Restaurant') {
          newFindings.push({
            severity: 'warning',
            title: L('Insurance expires soon', language),
            description: L('One of your insurance certificates is approaching expiration.', language),
            recommended_action: L('Renew and re-upload the certificate before submission.', language)
          });
        }
        newFindings.push({
          severity: 'informational',
          title: L('Municipal recommendation recommended', language),
          description: L('Some municipalities require a local planning letter.', language),
          recommended_action: L('Contact your municipal Oficina de Planificación.', language)
        });
      }

      setReadinessScore(score);
      setFindings(newFindings);
      setCurrentStep(7);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 9: "Generate Package" now leads to the final SUBMISSION DELIVERABLES screen
  const generatePackage = async () => {
    setCurrentStep(9);
  };

  // --- Helper: ordered submission document names ---
  const getSubmissionFileName = (code: string, index: number): string => {
    const map: Record<string, string> = {
      certificate_of_incorporation: 'Entity_Formation',
      ein_letter: 'EIN_Letter',
      merchant_registration: 'Merchant_Registration',
      permiso_unico: 'Permiso_Unico',
      patente_municipal: 'Patente_Municipal',
      lease_or_property_docs: 'Lease_or_Property_Docs',
      floor_plan: 'Floor_Plan',
      health_permit: 'Health_Permit',
      fire_certification: 'Fire_Certification',
      cfpm_certificate: 'CFPM_Certificate',
      professional_license: 'Professional_License',
      contractor_license: 'Contractor_License',
      insurance_certificate: 'Insurance_Certificate',
      alcohol_permit: 'Alcohol_Permit',
      home_declaration: 'Home_Business_Declaration',
      residential_proof: 'Residential_Address_Proof',
    };
    const base = map[code] || code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, '_');
    return `${String(index).padStart(2, '0')}_${base}.pdf`;
  };

  const submissionPriorityOrder = [
    'certificate_of_incorporation', 'ein_letter', 'merchant_registration', 'permiso_unico',
    'patente_municipal', 'lease_or_property_docs', 'floor_plan', 'health_permit',
    'fire_certification', 'cfpm_certificate', 'professional_license', 'contractor_license',
    'insurance_certificate', 'alcohol_permit', 'home_declaration', 'residential_proof'
  ];

  // --- 1. Professional PDF Readiness Report (jsPDF) ---
  const generateReadinessReportPDF = async (): Promise<Blob> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PAGE_W = 210;
    const PAGE_H = 297;
    const MARGIN = 18;
    const CONTENT_W = PAGE_W - MARGIN * 2; // 174mm
    const navy: [number, number, number] = [10, 37, 64];
    const teal: [number, number, number] = [13, 148, 136];
    const slate: [number, number, number] = [71, 85, 105];

    // jsPDF's built-in fonts are WinAnsi (Latin-1) only. Unsupported glyphs
    // (✓ ⬜ • → emoji) trigger broken per-character spacing, so map them to safe
    // ASCII and strip anything outside Latin-1 (accents like ó/í are kept).
    const san = (s: any): string =>
      (s ?? '')
        .toString()
        .replace(/[✓✔]/g, '[x]')
        .replace(/[⬜☐▢]/g, '[ ]')
        .replace(/[→➔]/g, '->')
        .replace(/[•·]/g, '-')
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, '-')
        .replace(/[^\x00-\xFF]/g, '')
        .trim();

    let y = 0;
    const lineH = 5.2;
    const tr = (s: string) => L(s, language); // localize PDF text to selected language

    const ensureSpace = (needed: number) => {
      if (y + needed > PAGE_H - 16) {
        doc.addPage();
        y = MARGIN;
      }
    };

    // Wrapped paragraph writer with consistent spacing + auto page breaks.
    const writeText = (
      text: string,
      x: number,
      opts: { size?: number; color?: [number, number, number]; gap?: number; bold?: boolean } = {}
    ) => {
      const { size = 10, color = navy, gap = 1.5, bold = false } = opts;
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const maxW = CONTENT_W - (x - MARGIN);
      const lines = doc.splitTextToSize(san(text), maxW);
      lines.forEach((ln: string) => {
        ensureSpace(lineH);
        doc.text(ln, x, y);
        y += lineH;
      });
      y += gap;
    };

    // Section heading with a thin underline rule (government-document feel).
    const sectionHeading = (label: string) => {
      y += 2;
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(navy[0], navy[1], navy[2]);
      doc.text(san(label), MARGIN, y);
      y += 2.5;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
    };

    // ---- Header band ----
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, PAGE_W, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('SMARTPR', MARGIN, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(san(tr('PUERTO RICO BUSINESS LICENSING READINESS')), MARGIN + 34, 13);

    // ---- Title ----
    y = 32;
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(san(tr('Submission Readiness Report')), MARGIN, y);
    y += 9;

    // ---- Business meta ----
    const metaRows: [string, string][] = [
      [tr('Business Name'), profile.name || 'N/A'],
      [tr('Municipality'), profile.municipality || 'N/A'],
      [tr('Industry'), profile.industry || 'N/A'],
      [tr('Business Type'), profile.business_type || 'N/A'],
    ];
    doc.setFontSize(10);
    metaRows.forEach(([k, v]) => {
      ensureSpace(lineH);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(slate[0], slate[1], slate[2]);
      doc.text(`${san(k)}:`, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(navy[0], navy[1], navy[2]);
      doc.text(san(v), MARGIN + 38, y);
      y += lineH + 0.6;
    });
    y += 3;

    // ---- Status banner ----
    const completed = requirements.filter(
      r => r.mandatory && (r.status === 'passed' || r.status === 'uploaded')
    ).length;
    const total = requirements.filter(r => r.mandatory).length;
    const ready = total > 0 && completed === total;
    const statusText = ready ? tr('READY FOR SUBMISSION') : tr('NEEDS REVIEW');
    const band: [number, number, number] = ready ? teal : [217, 119, 6];
    ensureSpace(13);
    doc.setFillColor(band[0], band[1], band[2]);
    doc.rect(MARGIN, y, CONTENT_W, 11, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      san(`${statusText}   |   ${tr('Readiness')} ${readinessScore ?? 'N/A'}%   |   ${completed} ${tr('of')} ${total} ${tr('required documents validated')}`),
      MARGIN + 4,
      y + 7.2
    );
    y += 17;
    doc.setFont('helvetica', 'normal');

    // ---- Required documents ----
    sectionHeading(tr('REQUIRED DOCUMENTS'));
    requirements.slice(0, 12).forEach(r => {
      const done = r.status === 'passed' || r.status === 'uploaded';
      writeText(`${done ? '[x]' : '[ ]'}  ${trReqName(r)}  (${L(r.agency, language)})`, MARGIN + 2, { gap: 0.6 });
    });
    if (requirements.length > 12) {
      writeText(`${tr('... and')} ${requirements.length - 12} ${tr('more')}`, MARGIN + 2, { gap: 0.6, color: slate });
    }

    // ---- Uploaded documents ----
    sectionHeading(tr('UPLOADED & VALIDATED DOCUMENTS'));
    if (uploadedDocs.length === 0) {
      writeText(tr('No documents uploaded yet.'), MARGIN + 2, { color: slate });
    } else {
      uploadedDocs.slice(0, 12).forEach((d, i) => {
        const a = d.ai_analysis;
        const st = a?.overall_status || 'Unknown';
        writeText(`${i + 1}.  ${d.name} — ${a?.document_type || 'Document'}  (${L(st, language)})`, MARGIN + 2, {
          gap: 0.6,
        });
      });
    }

    // ---- Missing / pending ----
    const missing = requirements.filter(r => r.mandatory && r.status === 'pending');
    sectionHeading(tr('MISSING / PENDING DOCUMENTS'));
    if (missing.length === 0) {
      writeText(tr('None — all mandatory items validated.'), MARGIN + 2, { color: teal });
    } else {
      missing.forEach(m => writeText(`-  ${trReqName(m)}`, MARGIN + 2, { gap: 0.6 }));
    }

    // ---- Municipal notices ----
    const munNotices = computeMunicipalityNotices(profile);
    if (munNotices.length > 0) {
      sectionHeading(tr('MUNICIPAL NOTICES'));
      munNotices.forEach(n => writeText(`-  ${tr(n)}`, MARGIN + 2, { gap: 0.6 }));
    }

    // ---- Findings ----
    sectionHeading(tr('FINDINGS & RECOMMENDATIONS'));
    if (findings.length === 0) {
      writeText(tr('No findings recorded.'), MARGIN + 2, { color: slate });
    } else {
      findings.slice(0, 8).forEach(f => {
        writeText(`[${f.severity.toUpperCase()}]  ${L(f.title, language)}`, MARGIN + 2, { gap: 0.4, bold: true });
        if (f.description) writeText(L(f.description, language), MARGIN + 6, { gap: 0.4, color: slate });
        if (f.recommended_action)
          writeText(`-> ${L(f.recommended_action, language)}`, MARGIN + 6, { gap: 1.2, color: slate });
      });
    }

    // ---- Next steps ----
    sectionHeading(tr('RECOMMENDED NEXT STEPS'));
    [
      tr('1. Review any items marked Needs Review or Warning.'),
      tr('2. Address expiring documents or mismatches before submission.'),
      tr('3. Share the Submission Package ZIP with your attorney, accountant, or permit expediter.'),
      tr('4. Use the SmartPR Workspace to track updates and re-validate as needed.'),
    ].forEach(s => writeText(s, MARGIN + 2, { gap: 0.6 }));

    // ---- Disclaimer ----
    y += 3;
    ensureSpace(30);
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(252, 165, 165);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, CONTENT_W, 26, 'FD');
    const discStartY = y;
    y += 6;
    doc.setTextColor(153, 27, 30);
    doc.setFontSize(8.5);
    const disclaimer = tr(
      'SmartPR determines READINESS for submission to Puerto Rico government agencies. It does NOT approve, grant, or issue any license or permit. All approvals are made exclusively by the Government of Puerto Rico and its agencies. This package is for preparation and organization only. Platform scope: Prepare, Validate, Organize, Package.'
    );
    doc.splitTextToSize(san(disclaimer), CONTENT_W - 8).forEach((ln: string) => {
      doc.text(ln, MARGIN + 4, y);
      y += 4.2;
    });
    y = discStartY + 30;

    // ---- Footer on every page ----
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slate[0], slate[1], slate[2]);
      doc.text(
        san(`${tr('Generated')}: ${new Date().toLocaleString()}  |  SmartPR  |  ${tr('Powered by AI')}`),
        MARGIN,
        PAGE_H - 8
      );
      doc.text(san(`${tr('Page')} ${p} ${tr('of')} ${pages}`), PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
    }

    return doc.output('blob');
  };

  // --- 1. Download standalone professional PDF Report ---
  // Upload a generated deliverable to the user's library (no-op if anonymous).
  const archiveDeliverable = async (kind: 'report' | 'submission', filename: string, blob: Blob) => {
    if (!me) return;
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', new File([blob], filename, { type: blob.type || 'application/octet-stream' }));
      if (submissionIdRef.current) fd.append('submission_id', submissionIdRef.current);
      if (businessIdRef.current) fd.append('business_id', businessIdRef.current);
      await fetch('/api/deliverables', { method: 'POST', body: fd });
    } catch { /* observational */ }
  };

  const downloadReadinessReport = async () => {
    try {
      setIsLoading(true);
      const pdfBlob = await generateReadinessReportPDF();
      const filename = `SmartPR-Readiness-Report-${(profile.name || 'Business').replace(/\s+/g, '-')}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      void archiveDeliverable('report', filename, pdfBlob);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. Download full Submission Package ZIP (renamed docs + PDF) ---
  const downloadSubmissionPackage = async () => {
    try {
      setIsLoading(true);
      const zip = new JSZip();

      // Add the professional PDF report
      const pdfBlob = await generateReadinessReportPDF();
      zip.file('00_SmartPR_Readiness_Report.pdf', pdfBlob);

      // Collect validated docs that have real file blobs, sorted by submission priority
      const validatedWithFiles = uploadedDocs
        .filter(d => d.fileBlob)
        .map(d => {
          const req = requirements.find(r => r.code === d.requirement_code);
          const priority = submissionPriorityOrder.indexOf(d.requirement_code);
          return { ...d, priority: priority === -1 ? 999 : priority, reqStatus: req?.status };
        })
        .filter(d => d.reqStatus === 'passed' || d.reqStatus === 'uploaded' || d.reqStatus === 'warning')
        .sort((a, b) => a.priority - b.priority);

      let idx = 1;
      for (const d of validatedWithFiles) {
        const niceName = getSubmissionFileName(d.requirement_code, idx++);
        zip.file(niceName, d.fileBlob as Blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const filename = `SmartPR-Submission-Package-${(profile.name || 'Business').replace(/\s+/g, '-')}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      void archiveDeliverable('submission', filename, zipBlob);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. Open / create SmartPR Workspace (persistent link + localStorage snapshot) ---
  // Build a compact, self-contained workspace payload. Because the app runs as
  // a single service with no database, the approved-deliverables snapshot is
  // encoded into the link itself (URL hash) so it is a real, shareable page.
  const buildWorkspacePayload = () => {
    const completedM = requirements.filter(
      r => r.mandatory && (r.status === 'passed' || r.status === 'uploaded')
    ).length;
    const totalM = requirements.filter(r => r.mandatory).length;
    return {
      v: 1,
      lang: language,
      name: profile.name || 'Business',
      municipality: profile.municipality || '',
      industry: profile.industry || '',
      businessType: profile.business_type || '',
      score: readinessScore,
      completed: completedM,
      total: totalM,
      // Only the deliverables the LLM actually approved/processed.
      approved: uploadedDocs.map(d => ({
        name: d.originalName || d.name,
        type: d.ai_analysis?.document_type || 'Document',
        status: d.ai_analysis?.overall_status || 'Uploaded',
        req: d.requirement_code,
      })),
      requirements: requirements.map(r => ({
        name: r.name,
        agency: r.agency,
        status: r.status,
        mandatory: r.mandatory,
      })),
      findings: findings.slice(0, 10),
      notices: computeMunicipalityNotices(profile),
      generatedAt: new Date().toISOString(),
    };
  };

  // Unicode-safe base64 encoder for the URL hash.
  const encodePayload = (obj: any): string => {
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const openSmartPRWorkspace = () => {
    const wsId = (businessId || `ws-${Date.now().toString(36)}`).replace(/[^a-zA-Z0-9_-]/g, '');
    setActiveWorkspaceId(wsId);

    const payload = buildWorkspacePayload();

    // Keep a local copy for this browser (re-validation / continuity).
    try {
      localStorage.setItem(`smartpr-workspace-${wsId}`, JSON.stringify(payload));
    } catch {
      console.warn('Could not persist workspace to localStorage (storage quota).');
    }

    // The data travels in the hash fragment, so the link renders the approved
    // deliverables anywhere it is opened — no backend lookup required.
    const encoded = encodePayload(payload);
    const wsUrl = `/workspace/${wsId}#d=${encoded}`;
    const fullUrl = (typeof window !== 'undefined' ? window.location.origin : '') + wsUrl;

    navigator.clipboard?.writeText(fullUrl).catch(() => {});

    // Open the real, unique workspace page in a new tab.
    if (typeof window !== 'undefined') {
      window.open(wsUrl, '_blank', 'noopener,noreferrer');
    }
    setShowWorkspaceModal(true);
  };

  const municipalNotices = computeMunicipalityNotices(profile);
  const completedMandatory = requirements.filter(r => r.mandatory && (r.status === 'uploaded' || r.status === 'passed')).length;
  const totalMandatory = requirements.filter(r => r.mandatory).length;
  const checklistProgress = totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 0;

  // --- Potentially Required items (knowledge-graph / municipality flags) ---
  const municipalityFlags: string[] = (() => {
    const m = KB.municipalities.find(x => x.name.toLowerCase() === (profile.municipality || '').toLowerCase());
    return m ? (m.flags as string[]) : [];
  })();
  const mandatoryNames = new Set(requirements.filter(r => r.mandatory).map(r => r.name.toLowerCase()));
  // Show a potential item only if its document isn't already a mandatory rule output.
  const potentialItems: PotentialDef[] = requirements.length
    ? potentialItemsForFlags(municipalityFlags).filter(p => !mandatoryNames.has(p.document.toLowerCase()))
    : [];

  // Apply a user's decision; "Applies" promotes the item into the real
  // requirements list (mandatory, uploadable, counts toward completion).
  const decidePotential = (def: PotentialDef, decision: 'applies' | 'not_applies' | 'not_sure') => {
    setPotentialDecisions(prev => ({ ...prev, [def.flag]: decision }));
    const code = 'potential_' + def.flag;
    setRequirements(prev => {
      const exists = prev.some(r => r.code === code);
      if (decision === 'applies' && !exists) {
        return [...prev, {
          code, name: def.document, mandatory: true, status: 'pending' as const,
          agency: def.agency, reason: def.why, category: 'Potentially Required',
          source_rule: 'flag:' + def.flag,
        }];
      }
      if (decision !== 'applies' && exists) return prev.filter(r => r.code !== code);
      return prev;
    });
  };

  // Render one requirement row (shared by Mandatory + Recommended sections).
  // Pick a contextual document icon based on the requirement name/agency.
  const docIconFor = (name: string): React.ReactNode => {
    const n = name.toLowerCase();
    const cls = 'w-5 h-5';
    if (/(incorpor|corporat|registr.* state|estado|articles|charter)/.test(n)) return <Building2 className={cls} />;
    if (/(ein|irs|tax|hacienda|contribu|merchant|iva|sales)/.test(n)) return <Receipt className={cls} />;
    if (/(permiso|permit|use|uso|zoning|ocup)/.test(n)) return <Landmark className={cls} />;
    if (/(coast|environment|ambient|water|agua|dredge)/.test(n)) return <Waves className={cls} />;
    if (/(insur|seguro|cfse|workers|comp)/.test(n)) return <ShieldCheck className={cls} />;
    if (/(affidavit|declar|certificat|certif|compliance|cumplim)/.test(n)) return <ScrollText className={cls} />;
    return <FileText className={cls} />;
  };


  // =========================================================================
  // VALIDADOR UI LAYER
  // Everything below is presentation only — business logic, API contracts,
  // rules-engine calls, document analysis, capture, and deliverable
  // generation above are unchanged.
  // =========================================================================

  // Requirements list filter (All / To do / Done / Recommended).
  const [reqFilter, setReqFilter] = useState<'all' | 'todo' | 'done' | 'recommended'>('all');
  // App-bar user menu open state.
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the avatar menu on outside click via a document listener — NOT via
  // an overlay div. A full-viewport overlay sits in a different stacking
  // context than the menu (the .appbar is position:sticky with z-index:50,
  // which boxes the menu's z-index in), so the overlay ended up intercepting
  // clicks on menu items including Sign out.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('.user-menu') || t.closest('.avatar'))) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // Live rules-engine output while the user is still in intake, so the
  // intelligence panel and progress stats update as they answer.
  const liveReqs = React.useMemo(() => {
    try {
      return runRulesEngineForProfile(profile as any, discoveryAnswers).requirements;
    } catch {
      return [] as ReturnType<typeof runRulesEngineForProfile>['requirements'];
    }
  }, [profile, discoveryAnswers]);

  const liveAgencies = React.useMemo(
    () => Array.from(new Set(liveReqs.map(r => r.agency).filter(Boolean))),
    [liveReqs]
  );
  const obligationCount = (re: RegExp) =>
    liveReqs.filter(r => re.test(r.category || '') || re.test(r.document_name)).length;
  const liveLicenses = obligationCount(/licen/i);
  const livePermits = obligationCount(/permi/i);
  const liveCerts = obligationCount(/certif/i);
  const liveRegs = obligationCount(/regist/i);

  // Intake completion: 5 core profile fields + the dynamic question flow.
  const intakeFieldsDone = [profile.name, profile.municipality, profile.industry, profile.business_type, profile.location_type].filter(Boolean).length;
  const intakeTotal = 5 + questionList.length;
  const intakeDone = intakeFieldsDone + Math.min(currentQuestionIndex, questionList.length);
  const intakePct = Math.round((intakeDone / Math.max(1, intakeTotal)) * 100);

  const missingCount = requirements.filter(r => r.mandatory && r.status === 'pending').length;
  const reviewCount = requirements.filter(r => r.mandatory && r.status === 'warning').length;
  const doneCount = completedMandatory;
  const recommendedCount = requirements.filter(r => !r.mandatory).length;

  // Current view derives from the preserved step state machine so snapshots
  // and ?resume= links keep working: 1 = intake, 3–8 = requirements, 9 = deliverables.
  const view: 'intake' | 'requirements' | 'deliverables' =
    currentStep === 1 ? 'intake' : currentStep === 9 ? 'deliverables' : 'requirements';
  const goTo = (v: 'intake' | 'requirements' | 'deliverables') =>
    setCurrentStep(v === 'intake' ? 1 : v === 'deliverables' ? 9 : 3);

  const initials = me?.name
    ? me.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : me?.email ? me.email.slice(0, 2).toUpperCase() : '·';

  const ringScore = readinessScore !== null ? readinessScore : checklistProgress;
  const readinessEyebrow =
    ringScore >= 90 ? L('Ready For Submission', language)
    : ringScore >= 70 ? L('Nearly Ready', language)
    : ringScore >= 40 ? L('In Progress', language)
    : L('Getting Started', language);

  // One Validador-styled requirement row. Upload flow, reasons, and the
  // extraction panel are the same components/handlers as before.
  const renderReqRow = (req: Requirement) => {
    const doc = uploadedDocs.find(d => d.requirement_code === req.code);
    const analysis = doc?.ai_analysis;
    const ext: ExtractionResult | undefined = analysis?.extraction;
    let state: 'pending' | 'done' | 'review' = 'pending';
    if (ext) {
      state = ext.validation_result === 'PASS' ? 'done' : 'review';
    } else if (req.status === 'uploaded' || req.status === 'passed') {
      state = 'done';
    } else if (req.status === 'warning') {
      state = 'review';
    }
    const checkCls = state === 'done' ? 'done' : state === 'review' ? 'progress' : 'missing';
    const promoted = req.code.startsWith('potential_');
    return (
      <div id={`req-row-${req.code}`} key={req.code} className="req-row">
        <div className={`req-check ${checkCls}`}>
          {state === 'done' ? <CheckCircle className="i" style={{ width: 14, height: 14 }} />
            : state === 'review' ? <AlertTriangle className="i" style={{ width: 13, height: 13 }} />
            : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'block' }} />}
        </div>
        <div className="req-main">
          <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {docIconFor(trReqName(req))}
            {trReqName(req)}
          </div>
          <details>
            <summary className="why" style={{ color: 'var(--brand-2)', fontWeight: 500 }}>
              <Info className="i" style={{ width: 12, height: 12, display: 'inline', verticalAlign: '-1px' }} /> {L('Why is this required?', language)}
            </summary>
            <div className="why">{trReqReason(req)}</div>
            {req.document_id && reasonsByDoc[req.document_id] && (
              <ReqReasons enr={reasonsByDoc[req.document_id]} language={language} />
            )}
          </details>
          {ext && analysis && (
            <ExtractionPanel ext={ext} docType={analysis.document_type} language={language} />
          )}
        </div>
        <div className="req-tags">
          {req.agency && <span className="tag agency">{L(req.agency, language)}</span>}
          <span className={`tag ${req.mandatory ? 'due' : ''}`}>
            {promoted ? L('Confirmed', language) : req.mandatory ? L('Required', language) : L('Optional', language)}
          </span>
        </div>
        <button className={`req-action ${state !== 'done' ? 'primary' : ''}`} onClick={() => triggerFileUploadWithPipeline(req.code)}>
          <Upload className="i" style={{ width: 13, height: 13 }} /> {L(doc ? 'Re-upload' : 'Upload', language)}
        </button>

        {/* Multi-stage processing (visible inside card) */}
        {processingStates[req.code] && (
          <div style={{ gridColumn: '1 / -1', marginTop: 8, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12 }}>
            {PROCESS_STAGES.map((lab, i) => {
              const p = processingStates[req.code]!;
              const done = i < p.stageIndex;
              const active = i === p.stageIndex;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: done ? 'var(--accent)' : active ? 'var(--brand-2)' : 'var(--muted)' }}>
                  {done ? '✓' : active ? <RefreshCw className="i" style={{ animation: 'spin 1s linear infinite' }} /> : '○'} {lab}
                </div>
              );
            })}
          </div>
        )}

        {/* Inline review / AI findings when needs attention */}
        {(state === 'review' || reviewingCode === req.code) && analysis && (
          <div style={{ gridColumn: '1 / -1', marginTop: 8, padding: 10, background: 'var(--warn-soft)', border: '1px solid var(--warn)', borderRadius: 8, fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: 'var(--warn)' }}>AI Findings</div>
            <div style={{ marginTop: 4 }}>{analysis.notes || 'Required fields incomplete or mismatched per validation.'}</div>
            <button onClick={() => resolveAndMarkComplete(req.code)} style={{ marginTop: 6, fontSize: 12, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--warn)', background: 'white' }}>
              Resolve &amp; mark complete
            </button>
          </div>
        )}
      </div>
    );
  };

  const reqGroups: { key: string; label: string; pip: string; items: Requirement[] }[] = [
    { key: 'review', label: L('Needs Review — action required', language), pip: 'warn', items: requirements.filter(r => r.mandatory && r.status === 'warning') },
    { key: 'missing', label: L('Missing — handle these next', language), pip: 'amber', items: requirements.filter(r => r.mandatory && r.status === 'pending') },
    { key: 'done', label: L('Completed — looking good', language), pip: 'green', items: requirements.filter(r => r.mandatory && (r.status === 'passed' || r.status === 'uploaded')) },
    { key: 'recommended', label: L('Recommended Items', language), pip: 'blue', items: requirements.filter(r => !r.mandatory) },
  ];
  const groupVisible = (key: string) =>
    reqFilter === 'all' ? true
    : reqFilter === 'todo' ? key === 'missing' || key === 'review'
    : reqFilter === 'done' ? key === 'done'
    : key === 'recommended';

  const currentQuestion = questionList.length > 0 && currentQuestionIndex < questionList.length
    ? questionList[currentQuestionIndex]
    : null;

  const zipReadyDocs = uploadedDocs.filter(d => d.fileBlob);
  const deliverablesReady = totalMandatory > 0 && completedMandatory === totalMandatory;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Upload result toast (LLM document analysis feedback) */}
      {uploadNotice && (
        <div className="submit-toast show" role="status" style={{ maxWidth: 480 }}>
          <div className="check" style={{ background: uploadNotice.kind === 'success' ? 'var(--accent)' : uploadNotice.kind === 'warning' ? 'var(--warn)' : 'var(--danger)' }}>
            {uploadNotice.kind === 'success'
              ? <CheckCircle style={{ width: 12, height: 12, color: 'white' }} />
              : <AlertTriangle style={{ width: 12, height: 12, color: 'white' }} />}
          </div>
          <span>
            <b>{uploadNotice.title}</b>
            {uploadNotice.detail && <span style={{ opacity: 0.75, display: 'block', fontSize: 12 }}>{uploadNotice.detail}</span>}
          </span>
          <button onClick={() => setUploadNotice(null)} aria-label="Dismiss"
            style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginLeft: 6 }}>✕</button>
        </div>
      )}

      {/* ====================== APP BAR ====================== */}
      <header className="appbar">
        <div className="appbar-inner">
          <div className="appbar-left">
            <div className="brand">
              <div className="brand-mark">{(ACTIVE_JURISDICTION.meta.productName || 'V').slice(0, 1)}</div>
              <div className="brand-name">{ACTIVE_JURISDICTION.meta.productName}</div>
            </div>
            <div className="vdiv" />
            <div className="project-pill">
              <span className="dot" />
              <span className="name">{profile.name || L('Your Business', language)}</span>
              {profile.municipality && <><span className="sep">·</span><span>{profile.municipality}</span></>}
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Sections">
            <button className={`nav-tab ${view === 'intake' ? 'active' : ''}`} onClick={() => goTo('intake')}>
              <FileText className="tab-icon" /> {L('Intake', language)}
            </button>
            <button className={`nav-tab ${view === 'requirements' ? 'active' : ''}`} disabled={requirements.length === 0} onClick={() => goTo('requirements')}>
              <ScrollText className="tab-icon" /> {L('Requirements', language)}
            </button>
            <button className={`nav-tab ${view === 'deliverables' ? 'active' : ''}`} disabled={requirements.length === 0} onClick={() => goTo('deliverables')}>
              <Archive className="tab-icon" /> {L('Deliverables', language)}
            </button>
            <a className="nav-tab" href="/history">
              <RefreshCw className="tab-icon" /> {L('History', language)}
            </a>
          </nav>

          <div className="appbar-actions">
            {saveState === 'saved' && <span className="saved-pill">{L('Saved', language)}</span>}
            <div className="lang-toggle">
              <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
              <button className={language === 'es' ? 'active' : ''} onClick={() => setLanguage('es')}>ES</button>
            </div>
            <button className="avatar" onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }} title="Account">{initials}</button>
            <div className={`user-menu ${menuOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
              <div className="uhead">
                <div className="uname">{me?.name || (me ? me.email : L('Guest', language))}</div>
                <div className="uemail">{me?.email || L('Not signed in', language)}</div>
              </div>
              {me === null && <a className="uitem" href="/auth/login"><ExternalLink className="i" /> {L('Sign in', language)}</a>}
              {me && <button type="button" className="uitem" onClick={handleSignOut}><ExternalLink className="i" /> {L('Sign out', language)}</button>}
            </div>
          </div>
        </div>
      </header>

      {/* ====================== INTAKE ====================== */}
      {view === 'intake' && (
        <main className="shell">
          <div className="vgrid">
            <section>
              <div className="qcard">
                <div className="qcard-body">
                  <div className="pretitle">
                    <span className="chip">
                      {currentQuestion
                        ? `${L('Question', language)} ${currentQuestionIndex + 1} ${L('of', language)} ${questionList.length}`
                        : L('Business profile', language)}
                    </span>
                    <span>{L('Discovery', language)} · {profile.business_type || L('Business basics', language)}</span>
                  </div>
                  <h1 className="qtitle">{t('title')}</h1>
                  <p className="qhelper">{t('subtitle')}</p>

                  <div className="vform">
                    <div className="vfield full">
                      <label>{t('businessName')}</label>
                      <input
                        placeholder="Your Business Name"
                        value={profile.name}
                        onChange={e => setProfile({ ...profile, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="vfield">
                      <label>{t('municipality')}</label>
                      <select value={profile.municipality} onChange={e => setProfile({ ...profile, municipality: e.target.value })}>
                        <option value="">{t('selectMunicipality')}</option>
                        {MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="vfield">
                      <label>{t('industry')}</label>
                      <select
                        value={profile.industry}
                        onChange={e => setProfile({ ...profile, industry: e.target.value, business_type: '' })}
                      >
                        <option value="">{t('selectIndustry')}</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div className="vfield">
                      <label>{t('businessType')}</label>
                      <select
                        key={profile.industry || 'none'}
                        value={profile.business_type}
                        onChange={e => {
                          const newBt = e.target.value;
                          const allowed = LOCATION_TYPES_BY_BUSINESS_TYPE[newBt] || LOCATION_TYPES;
                          const newLoc = allowed.includes(profile.location_type || '') ? profile.location_type : '';
                          setProfile({ ...profile, business_type: newBt, location_type: newLoc });
                        }}
                      >
                        <option value="">{t('selectBusinessType')}</option>
                        {(BUSINESS_TYPES[profile.industry] || [profile.industry || 'Other']).map(bt => (
                          <option key={bt} value={bt}>{bt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="vfield">
                      <label>{t('locationType')}</label>
                      <select value={profile.location_type} onChange={e => setProfile({ ...profile, location_type: e.target.value })}>
                        <option value="">{t('selectLocationType')}</option>
                        {(LOCATION_TYPES_BY_BUSINESS_TYPE[profile.business_type] || LOCATION_TYPES).map(lt => (
                          <option key={lt} value={lt}>{lt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="vfield">
                      <label>{t('businessStructure')}</label>
                      <select value={profile.business_structure} onChange={e => setProfile({ ...profile, business_structure: e.target.value })}>
                        <option value="llc">LLC</option>
                        <option value="corporation">Corporation</option>
                        <option value="sole_proprietorship">Sole Proprietorship</option>
                        <option value="partnership">Partnership</option>
                        <option value="professional_corporation">Professional Corporation</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="vfield">
                      <label>{t('numEmployees')}</label>
                      <div className="range-row">
                        <input
                          type="range" min="0" max="100" step="1"
                          value={profile.number_of_employees ?? 0}
                          onChange={e => setProfile({ ...profile, number_of_employees: parseInt(e.target.value) || 0 })}
                        />
                        <div className="range-val">{profile.number_of_employees ?? 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic question flow — one at a time, Validador answer cards */}
                  {currentQuestion && (
                    <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                      <div className="pretitle">
                        <span className="chip">{L('Question', language)} {currentQuestionIndex + 1} {L('of', language)} {questionList.length}</span>
                      </div>
                      <h2 className="qtitle" style={{ fontSize: 24 }}>{L(currentQuestion.text, language)}</h2>
                      <div className="answers">
                        <button className="answer answer-reveal" onClick={() => handleQuestionAnswer(true)}>
                          <div className="answer-emoji">✅</div>
                          <div>
                            <div className="answer-title">{t('yes')}</div>
                            <div className="answer-sub">{L('This applies to my business', language)}</div>
                          </div>
                        </button>
                        <button className="answer answer-reveal" style={{ animationDelay: '30ms' }} onClick={() => handleQuestionAnswer(false)}>
                          <div className="answer-emoji">🚫</div>
                          <div>
                            <div className="answer-title">{t('no')}</div>
                            <div className="answer-sub">{L('This does not apply', language)}</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {questionList.length > 0 && currentQuestionIndex >= questionList.length && (
                    <div className="iq-chip" style={{ marginTop: 20 }}>
                      <div className="swatch" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>✓</div>
                      {L('All relevant questions answered for this business type.', language)}
                    </div>
                  )}

                  <div className="qfooter">
                    <div className="qfooter-left">
                      <span>{intakeDone}/{intakeTotal} {L('completed', language)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {currentQuestion && currentQuestionIndex > 0 && (
                        <button className="btn btn-secondary" onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}>
                          {L('Back', language)}
                        </button>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={handleStartDiscovery}
                        disabled={!profile.name || !profile.industry || (questionList.length > 0 && currentQuestionIndex < questionList.length) || isLoading}
                      >
                        {L('See my requirements', language)}
                        {isLoading ? <RefreshCw className="i" style={{ width: 14, height: 14, animation: 'vspin .7s linear infinite' }} /> : <ArrowRight className="i" style={{ width: 14, height: 14 }} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-progress row */}
              <div className="progress-row">
                <div className="pstat">
                  <div className="pstat-label">{L('Questions completed', language)}</div>
                  <div className="pstat-value">{intakePct}%</div>
                  <div className="barline"><span style={{ width: `${intakePct}%` }} /></div>
                </div>
                <div className="pstat">
                  <div className="pstat-label">{L('Agencies identified', language)}</div>
                  <div className="pstat-value">{liveAgencies.length}</div>
                </div>
                <div className="pstat">
                  <div className="pstat-label">{L('Requirements discovered', language)}</div>
                  <div className="pstat-value">{liveReqs.length}</div>
                </div>
                <div className="pstat">
                  <div className="pstat-label">{L('Licenses detected', language)}</div>
                  <div className="pstat-value">{liveLicenses}</div>
                </div>
              </div>

              <div className="helpbar">
                <div className="help-ic"><Lightbulb className="i-lg i" /></div>
                <div className="help-text">
                  <b>{L("You don't need to know everything yet.", language)}</b>
                  <small>{L('Anything missing is flagged later — you will always know what is next.', language)}</small>
                </div>
                {requirements.length > 0 && (
                  <button className="btn btn-secondary help-cta" onClick={() => void saveProgress()}>
                    {saveState === 'saving' ? L('Saving…', language) : L('Save Progress', language)}
                  </button>
                )}
              </div>
            </section>

            {/* Right: Regulatory intelligence panel */}
            <aside>
              <div className="iqpanel">
                <div className="iq-head">
                  <div className="iq-head-top">
                    <span className="iq-pulse" />
                    <span className="iq-live">{L('Reviewing live', language)}</span>
                  </div>
                  <div className="iq-title">{L('Regulatory intelligence', language)}</div>
                  <div className="iq-sub">{L('Updating as you answer — like a senior compliance reviewer over your shoulder.', language)}</div>
                </div>

                <div className="iq-section">
                  <div className="iq-section-title">{L('Business profile', language)}</div>
                  <div className="iq-kv"><span className="k">{t('businessType')}</span><span className="v">{profile.business_type || '—'}</span></div>
                  <div className="iq-kv"><span className="k">{t('industry')}</span><span className="v">{profile.industry || '—'}</span></div>
                  <div className="iq-kv"><span className="k">{t('municipality')}</span><span className="v">{profile.municipality || '—'}</span></div>
                  <div className="iq-kv"><span className="k">{t('locationType')}</span><span className="v">{profile.location_type || '—'}</span></div>
                  <div className="iq-kv"><span className="k">{t('numEmployees')}</span><span className="v">{profile.number_of_employees ?? '—'}</span></div>
                </div>

                <div className="iq-section">
                  <div className="iq-section-title">{L('Launch readiness', language)}</div>
                  <div className="ring-wrap">
                    <div className="ring" style={{ ['--p' as string]: intakePct }}><span>{intakePct}%</span></div>
                    <div className="ring-meta">
                      <div className="label">{L('Estimated', language)}</div>
                      <div className="val">
                        {intakePct < 35 ? L('Early discovery', language) : intakePct < 70 ? L('Mid discovery', language) : intakePct < 100 ? L('Late discovery', language) : L('Discovery complete', language)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="iq-section">
                  <div className="iq-section-title">{L('Agencies involved', language)} · {liveAgencies.length}</div>
                  <div className="iq-list">
                    {liveAgencies.slice(0, 7).map(a => (
                      <div key={a} className="iq-chip">
                        <div className="swatch">{a.replace(/[^A-Za-z ]/g, '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()}</div>
                        {a}
                      </div>
                    ))}
                    {liveAgencies.length === 0 && <div className="iq-sub">{L('Select a municipality and business type to begin.', language)}</div>}
                  </div>
                </div>

                <div className="iq-section">
                  <div className="iq-section-title">{L('Potential obligations', language)}</div>
                  <div className="iq-kv"><span className="k">{L('Licenses', language)}</span><span className="v">{liveLicenses} {L('detected', language)}</span></div>
                  <div className="iq-kv"><span className="k">{L('Permits', language)}</span><span className="v">{livePermits} {L('detected', language)}</span></div>
                  <div className="iq-kv"><span className="k">{L('Certifications', language)}</span><span className="v">{liveCerts} {L('detected', language)}</span></div>
                  <div className="iq-kv"><span className="k">{L('Registrations', language)}</span><span className="v">{liveRegs} {L('detected', language)}</span></div>
                </div>

                <div className="iq-section">
                  <div className="iq-section-title">{L('Live recommendations', language)}</div>
                  {municipalNotices.map((n, i) => (
                    <div key={`n-${i}`} className="reco">
                      <div className="reco-ic zone"><Landmark className="i" /></div>
                      <div className="reco-text"><b>{profile.municipality}</b><small>{L(n, language)}</small></div>
                    </div>
                  ))}
                  {potentialItems.slice(0, 3).map(p => (
                    <div key={p.flag} className="reco">
                      <div className="reco-ic health"><Lightbulb className="i" /></div>
                      <div className="reco-text"><b>{p.document}</b><small>{L(p.why, language)}</small></div>
                    </div>
                  ))}
                  {municipalNotices.length === 0 && potentialItems.length === 0 && (
                    <div className="iq-sub">{L('Recommendations appear as your profile takes shape.', language)}</div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </main>
      )}

      {/* ====================== REQUIREMENTS ====================== */}
      {view === 'requirements' && (
        <main className="shell">
          <button className="section-back" onClick={() => goTo('intake')}>
            ← {L('Back to intake', language)}
          </button>

          {/* Prominent Attention banner (Problem 5) — surfaces AI findings at the top */}
          {(() => {
            const reviewItems = requirements.filter(r => r.mandatory && r.status === 'warning');
            if (reviewItems.length === 0) return null;
            return (
              <div style={{ marginBottom: 16, padding: 14, background: 'var(--warn-soft)', border: '1px solid var(--warn)', borderRadius: 'var(--radius)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <AlertTriangle className="i-lg" style={{ color: 'var(--warn)', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--warn)' }}>⚠ Attention Required</div>
                  <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
                    {reviewItems.slice(0, 3).map((r, i) => (
                      <div key={i}>• {trReqName(r)} — review findings in the card below</div>
                    ))}
                  </div>
                  <button onClick={() => { const f = reviewItems[0]; const el = document.getElementById(`req-row-${f.code}`); el?.scrollIntoView({behavior:'smooth', block:'center'}); setReviewingCode(f.code); }} style={{ marginTop: 8, fontSize: 13, padding: '4px 12px', borderRadius: 8, background: 'var(--warn)', color: 'white', border: 'none', cursor: 'pointer' }}>
                    {L('Review now', language)}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Sticky Guidance / Next Action panel (Problems 3,4,7) — desktop friendly, uses Validador sticky patterns */}
          <div style={{ position: 'sticky', top: 80, zIndex: 40, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, boxShadow: 'var(--shadow-sm)' }}>
            {(() => {
              const nxt = getRecommendedNextAction();
              const rc = requirements.filter(r => r.mandatory && r.status === 'warning').length;
              const mc = requirements.filter(r => r.mandatory && r.status === 'pending').length;
              const dc = doneCount;
              return (
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>GUIDANCE</div>
                    <div style={{ fontWeight: 700 }}>{nxt.label}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span>Done: <strong>{dc}</strong></span>
                    <span style={{ color: 'var(--warn)' }}>Review: <strong>{rc}</strong></span>
                    <span>Missing: <strong>{mc}</strong></span>
                  </div>
                  <button onClick={nxt.action} style={{ marginLeft: 'auto', padding: '8px 18px', borderRadius: 10, background: 'var(--navy)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                    {nxt.cta}
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Compact readiness banner */}
          <div className="req-banner">
            <div className="mini-ring" style={{ ['--p' as string]: ringScore }}>
              <div className="num">{ringScore}%</div>
            </div>
            <div className="headline">
              <div className="eyebrow">{readinessEyebrow}</div>
              <h1>{profile.name || L('Your Business', language)}{profile.municipality ? ` — ${profile.municipality}` : ''}</h1>
              <p>{completedMandatory} {L('of', language)} {totalMandatory} {L('required documents validated', language)}.</p>
            </div>
            <div className="banner-stat">
              <div className="lab">{L('Required', language)}</div>
              <div className="val">{totalMandatory}</div>
            </div>
            <div className="banner-stat">
              <div className="lab">{L('Completed', language)}</div>
              <div className="val">{doneCount}</div>
            </div>
            <div className="banner-stat">
              <div className="lab">{L('Missing', language)}</div>
              <div className="val amber">{missingCount}</div>
            </div>
            <div className="banner-stat">
              <div className="lab">{L('Recommended', language)}</div>
              <div className="val">{recommendedCount}</div>
            </div>
          </div>

          {/* Municipal notices */}
          {municipalNotices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {municipalNotices.map((n, i) => (
                <div key={i} className="reco">
                  <div className="reco-ic zone"><Landmark className="i" /></div>
                  <div className="reco-text"><b>{L('Municipal Notices', language)} — {profile.municipality}</b><small>{L(n, language)}</small></div>
                </div>
              ))}
            </div>
          )}

          {/* Requirements section */}
          <div className="req-section">
            <div className="req-head">
              <div className="left">
                <h2>{L('Your requirements', language)}</h2>
                <p>{L('Every license, permit, inspection, and document discovered for your business — grouped by what to do next.', language)}</p>
              </div>
              <div className="filter">
                <button className={reqFilter === 'all' ? 'active' : ''} onClick={() => setReqFilter('all')}>
                  {L('All', language)} · {requirements.length}
                </button>
                <button className={reqFilter === 'todo' ? 'active' : ''} onClick={() => setReqFilter('todo')}>
                  {L('To do', language)} · {missingCount + reviewCount}
                </button>
                <button className={reqFilter === 'done' ? 'active' : ''} onClick={() => setReqFilter('done')}>
                  {L('Done', language)} · {doneCount}
                </button>
                <button className={reqFilter === 'recommended' ? 'active' : ''} onClick={() => setReqFilter('recommended')}>
                  {L('Recommended', language)} · {recommendedCount}
                </button>
              </div>
            </div>

            {requirements.length === 0 && (
              <div style={{ padding: 24 }}>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={loadRequirements}>
                  {L('Compute Requirements from Rules Engine', language)} <ArrowRight className="i" style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}

            {reqGroups.map(g => {
              if (!groupVisible(g.key) || g.items.length === 0) return null;
              return (
                <div key={g.key} className="req-group">
                  <div className="req-group-title">
                    <span className={`pip ${g.pip}`} />{g.label}<span className="count">{g.items.length}</span>
                  </div>
                  {g.items.map(req => renderReqRow(req))}
                </div>
              );
            })}

            {/* Potentially required — decision cards */}
            {potentialItems.length > 0 && reqFilter !== 'done' && reqFilter !== 'recommended' && (
              <div className="req-group">
                <div className="req-group-title">
                  <span className="pip amber" />{L('Additional Requirements Based on Your Answers', language)}<span className="count">{potentialItems.length}</span>
                </div>
                {potentialItems.map(p => {
                  const decision = potentialDecisions[p.flag];
                  if (decision === 'applies') return null; /* promoted into Missing above */
                  if (decision === 'not_applies') {
                    return (
                      <div key={p.flag} className="req-row" style={{ opacity: 0.65 }}>
                        <div className="req-check done"><CheckCircle className="i" style={{ width: 14, height: 14 }} /></div>
                        <div className="req-main">
                          <div className="name">{p.document}</div>
                          <div className="why">{L('Does Not Apply', language)}</div>
                        </div>
                        <div className="req-tags"><span className="tag">{L('Does Not Apply', language)}</span></div>
                        <button className="req-action" onClick={() => decidePotential(p, 'not_sure')}>{L('Undo', language)}</button>
                      </div>
                    );
                  }
                  return (
                    <div key={p.flag} className="req-row">
                      <div className="req-check missing">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
                      </div>
                      <div className="req-main">
                        <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{docIconFor(p.document)}{p.document}</div>
                        <div className="why">{L('Triggered because', language)} {L(p.flagLabel, language)}. {L(p.why, language)}</div>
                        <div className="why" style={{ color: 'var(--ink)', fontWeight: 550 }}>{L(p.followUp, language)}</div>
                        <div className="decide-row">
                          <button className="btn applies" onClick={() => decidePotential(p, 'applies')}>{L('Applies', language)}</button>
                          <button className="btn btn-secondary" onClick={() => decidePotential(p, 'not_applies')}>{L('Does Not Apply', language)}</button>
                          <button className="btn btn-secondary" style={decision === 'not_sure' ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined} onClick={() => decidePotential(p, 'not_sure')}>{L('Not Sure', language)}</button>
                        </div>
                        {decision === 'not_sure' && (
                          <div className="why" style={{ color: 'var(--warn)' }}>{L('Kept as potentially required. Revisit before submission.', language)}</div>
                        )}
                      </div>
                      <div className="req-tags"><span className="tag due">{L('Potentially Required', language)}</span></div>
                      <span />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recommendation panel — advisory historical insights (never mandatory) */}
          {advisory && advisory.enabled && advisory.similarCount > 0 &&
            (advisory.potentiallyOverlooked.length > 0 || advisory.commonValidationFailures.length > 0) && (
            <div className="req-section" style={{ marginTop: 16 }}>
              <div className="req-head">
                <div className="left">
                  <h2 style={{ fontSize: 20 }}>{L('Recommendations', language)}</h2>
                  <p>{L('Based on', language)} {advisory.similarCount} {L('similar businesses processed before. Suggestions only — these never change what the rules require.', language)}</p>
                </div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {advisory.potentiallyOverlooked.map(d => (
                  <div key={d.document} className="reco">
                    <div className="reco-ic health"><Lightbulb className="i" /></div>
                    <div className="reco-text">
                      <b>{d.document}</b>
                      <small>{d.pct}% {L('of similar businesses required this.', language)} · {d.agency}</small>
                    </div>
                  </div>
                ))}
                {advisory.commonValidationFailures.length > 0 && (
                  <div className="reco">
                    <div className="reco-ic fire"><AlertTriangle className="i" /></div>
                    <div className="reco-text">
                      <b>{L('Documents that commonly fail validation', language)}</b>
                      <small>{advisory.commonValidationFailures.map(f => f.document_type).join(' · ')}</small>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Findings (validation results) */}
          {findings.length > 0 && (
            <div className="req-section" style={{ marginTop: 16 }}>
              <div className="req-head">
                <div className="left"><h2 style={{ fontSize: 20 }}>{L('Findings', language)}</h2></div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {findings.map((f, i) => (
                  <div key={i} className="reco">
                    <div className={`reco-ic ${f.severity === 'critical' ? 'fire' : f.severity === 'warning' ? 'tax' : 'zone'}`}>
                      <AlertTriangle className="i" />
                    </div>
                    <div className="reco-text">
                      <b>{L(f.title, language)}</b>
                      <small>{L(f.description, language)} → {L(f.recommended_action, language)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save & Resume — anonymous email-capture or signed-in save */}
          {requirements.length > 0 && (
            <SaveProgressPanel
              me={me}
              saveState={saveState}
              setSaveState={setSaveState}
              claimEmail={claimEmail}
              setClaimEmail={setClaimEmail}
              onSave={() => saveProgress()}
              language={language}
            />
          )}

          <div className="helpbar">
            <div className="help-ic"><Info className="i-lg i" /></div>
            <div className="help-text">
              <b>{L('Focus on the missing items first.', language)}</b>
              <small>{L('They move your readiness score the most and unblock everything downstream.', language)}</small>
            </div>
            <div className="help-cta" style={{ display: 'flex', gap: 8 }}>
              {requirements.length > 0 && currentStep < 7 && (
                <button className="btn btn-secondary" onClick={runValidation} disabled={isLoading}>
                  {L('Run Validation Engine', language)}
                  {isLoading && <RefreshCw className="i" style={{ width: 13, height: 13, animation: 'vspin .7s linear infinite' }} />}
                </button>
              )}
              <button className="btn btn-primary" onClick={() => goTo('deliverables')}>
                {L('Continue to deliverables', language)} <ArrowRight className="i" style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ====================== DELIVERABLES ====================== */}
      {view === 'deliverables' && (
        <main className="shell">
          <button className="section-back" onClick={() => goTo('requirements')}>
            ← {L('Back to Checklist', language)}
          </button>

          <div className="section-head">
            <div>
              <h2>{L('SUBMISSION DELIVERABLES', language)}</h2>
              <p>{L('All validated materials are ready. This platform prepares you for submission — it does not file with government.', language)}</p>
            </div>
            <span className={`pkg-status-pill ${deliverablesReady && (readinessScore || 0) >= 70 ? 'ready' : 'missing'}`} style={{ marginLeft: 0 }}>
              {deliverablesReady && (readinessScore || 0) >= 70 ? L('READY FOR SUBMISSION', language) : L('IN PROGRESS — REVIEW REQUIRED', language)}
            </span>
          </div>

          {/* Business summary banner */}
          <div className="req-banner" style={{ marginBottom: 20 }}>
            <div className="mini-ring" style={{ ['--p' as string]: readinessScore ?? 0 }}>
              <div className="num">{readinessScore ?? '—'}{readinessScore !== null ? '%' : ''}</div>
            </div>
            <div className="headline">
              <div className="eyebrow">{L('Readiness Score', language)}</div>
              <h1>{profile.name || '—'}</h1>
              <p>{completedMandatory} {L('of', language)} {totalMandatory} {L('Required Documents Validated', language)}{findings.filter(f => f.severity === 'critical').length === 0 ? ` · ${L('No Critical Issues Found', language)}` : ''}</p>
            </div>
            <div className="banner-stat">
              <div className="lab">{t('municipality')}</div>
              <div className="val" style={{ fontSize: 15 }}>{profile.municipality || '—'}</div>
            </div>
            <div className="banner-stat">
              <div className="lab">{t('businessType')}</div>
              <div className="val" style={{ fontSize: 15 }}>{profile.business_type || '—'}</div>
            </div>
            <div className="banner-stat">
              <div className="lab">{L('Documents', language)}</div>
              <div className="val">{uploadedDocs.length}</div>
            </div>
          </div>

          <div className="packages">
            {/* 1. PDF Readiness Report */}
            <div className="pkg indigo">
              <div className="pkg-head">
                <div className="pkg-ic"><FileText className="i-lg i" /></div>
                <div>
                  <div className="pkg-title">{L('Readiness Report (PDF)', language)}</div>
                  <div className="pkg-sub">{L('Human-readable summary for your records, attorney, or consultant.', language)}</div>
                </div>
                <span className="pkg-status-pill ready">{L('Ready', language)}</span>
              </div>
              <div className="pkg-list">
                <div className="pkg-item ok"><span className="ic"><CheckCircle className="i" style={{ width: 13, height: 13 }} /></span>{L('Business profile & readiness score', language)}</div>
                <div className="pkg-item ok"><span className="ic"><CheckCircle className="i" style={{ width: 13, height: 13 }} /></span>{L('Required, uploaded & missing documents', language)}</div>
                <div className="pkg-item ok"><span className="ic"><CheckCircle className="i" style={{ width: 13, height: 13 }} /></span>{L('Findings & recommended next steps', language)}</div>
              </div>
              <div className="pkg-foot">
                <span className="pkg-sub">{language === 'es' ? 'Español' : 'English'} · PDF</span>
                <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={downloadReadinessReport} disabled={isLoading}>
                  <Download className="i" style={{ width: 14, height: 14 }} /> {L('Download PDF Report', language)}
                </button>
              </div>
            </div>

            {/* 2. Submission Package ZIP */}
            <div className="pkg green">
              <div className="pkg-head">
                <div className="pkg-ic"><Archive className="i-lg i" /></div>
                <div>
                  <div className="pkg-title">{L('Submission Package (ZIP)', language)}</div>
                  <div className="pkg-sub">{L('Report + validated documents, renamed and sorted in submission order.', language)}</div>
                </div>
                <span className={`pkg-status-pill ${zipReadyDocs.length > 0 ? 'ready' : 'missing'}`}>
                  {zipReadyDocs.length > 0 ? L('Ready', language) : L('Waiting', language)}
                </span>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12.5, color: 'var(--muted)' }}>
                  <span>{L('Package readiness', language)}</span>
                  <b style={{ color: 'var(--ink)', fontWeight: 650 }}>{checklistProgress}%</b>
                </div>
                <div className="pkg-bar"><span style={{ width: `${checklistProgress}%` }} /></div>
              </div>
              <div className="pkg-list">
                {zipReadyDocs.slice(0, 4).map((d, i) => (
                  <div key={i} className="pkg-item ok">
                    <span className="ic"><CheckCircle className="i" style={{ width: 13, height: 13 }} /></span>
                    {d.ai_analysis?.document_type || d.name}
                  </div>
                ))}
                {requirements.filter(r => r.mandatory && r.status === 'pending').slice(0, Math.max(0, 4 - zipReadyDocs.length) + 2).map(r => (
                  <div key={r.code} className="pkg-item missing">
                    <span className="ic"><AlertTriangle className="i" style={{ width: 13, height: 13 }} /></span>
                    {trReqName(r)}
                    <span className="miss-label">{L('Missing', language)}</span>
                  </div>
                ))}
              </div>
              <div className="pkg-foot">
                <span className="pkg-sub">{zipReadyDocs.length} {L('documents', language)}</span>
                <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={downloadSubmissionPackage} disabled={isLoading || zipReadyDocs.length === 0}>
                  <Download className="i" style={{ width: 14, height: 14 }} /> {L('Download ZIP Package', language)}
                </button>
              </div>
            </div>

            {/* 3. Workspace */}
            <div className="pkg purple">
              <div className="pkg-head">
                <div className="pkg-ic"><Building2 className="i-lg i" /></div>
                <div>
                  <div className="pkg-title">{L('Workspace', language)}</div>
                  <div className="pkg-sub">{L('Permanent, shareable link to your readiness workspace.', language)}</div>
                </div>
                <span className="pkg-status-pill draft">{L('Shareable', language)}</span>
              </div>
              <div className="pkg-list">
                <div className="pkg-item ok"><span className="ic"><CheckCircle className="i" style={{ width: 13, height: 13 }} /></span>{L('Profile & questionnaire responses', language)}</div>
                <div className="pkg-item ok"><span className="ic"><CheckCircle className="i" style={{ width: 13, height: 13 }} /></span>{L('Requirements & validation results', language)}</div>
                <div className="pkg-item ok"><span className="ic"><CheckCircle className="i" style={{ width: 13, height: 13 }} /></span>{L('Renders anywhere without a login', language)}</div>
              </div>
              <div className="pkg-foot">
                <span className="pkg-sub" style={{ fontFamily: 'monospace', fontSize: 11 }}>{activeWorkspaceId ? `/workspace/${activeWorkspaceId}` : '/workspace/…'}</span>
                <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={openSmartPRWorkspace}>
                  {L('Open Workspace', language)} <ExternalLink className="i" style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          </div>

          {/* Official disclaimer */}
          <div className="disclaimer">
            <b>{L('IMPORTANT DISCLAIMER — READ CAREFULLY', language)}</b>
            <ul>
              <li>{L('Do NOT submit this package or any SmartPR output to government agencies as an official filing.', language)}</li>
              <li>{L('Do NOT claim that SmartPR approves, grants, or issues any license or permit.', language)}</li>
              <li>{L('Do NOT file permits or applications using these materials as the sole source.', language)}</li>
              <li>{L('SmartPR is a', language)} <strong>{L('readiness and compliance preparation platform', language)}</strong>, {L('not a government filing system.', language)}</li>
              <li>{L('All final approvals are made exclusively by the Government of Puerto Rico and its agencies.', language)}</li>
            </ul>
          </div>

          <div className="helpbar">
            <div className="help-ic"><RefreshCw className="i-lg i" /></div>
            <div className="help-text">
              <b>{L('Need to make changes?', language)}</b>
              <small>{L('Go back to the checklist to upload more documents, or start a new assessment.', language)}</small>
            </div>
            <div className="help-cta" style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => goTo('requirements')}>← {L('Back to Checklist', language)}</button>
              <button className="btn btn-secondary" onClick={() => goTo('intake')}>{L('Start New Business', language)}</button>
            </div>
          </div>
        </main>
      )}

      {/* Hidden file input: powers the Upload buttons (LLM document workflow) */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        style={{ display: 'none' }}
        accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.md"
        onChange={onFileInputChange}
      />

      {/* Workspace Modal */}
      {showWorkspaceModal && activeWorkspaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', maxWidth: 520, width: '100%', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{ACTIVE_JURISDICTION.meta.productName}</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{L('Workspace', language)}</div>
              </div>
              <button onClick={() => setShowWorkspaceModal(false)} style={{ background: 'transparent', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 15 }}>✕</button>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-tint)', padding: '8px 12px', borderRadius: 8, marginBottom: 16, wordBreak: 'break-all' }}>
              {typeof window !== 'undefined' ? window.location.origin : ''}/workspace/{activeWorkspaceId}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 16 }}>
              {L('Your readiness workspace opened in a new tab. This is a shareable, self-contained link showing your AI-approved deliverables, requirements checklist, and findings. The link has also been copied to your clipboard.', language)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  const url = `/workspace/${activeWorkspaceId}#d=${encodePayload(buildWorkspacePayload())}`;
                  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                {L('Open Workspace Again', language)}
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowWorkspaceModal(false)}>
                {L('Close', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden rules-engine debug panel (enable with ?debug=1) */}
      {debugMode && (() => {
        const dbg = runRulesEngineForProfile(profile as any, discoveryAnswers).debug;
        return (
          <div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 400, width: 440, maxWidth: '100%', maxHeight: '60vh', overflow: 'auto', background: 'var(--navy)', color: 'white', fontSize: 11, fontFamily: 'monospace', boxShadow: 'var(--shadow-lg)', borderLeft: '1px solid rgba(255,255,255,0.2)', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ padding: '8px 12px', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{ACTIVE_JURISDICTION.meta.productName} Rules Engine — Debug</span>
              <span style={{ opacity: 0.6 }}>?debug=1</span>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><span style={{ opacity: 0.6 }}>Municipality Selected:</span> {dbg.municipalitySelected || '—'}</div>
              <div><span style={{ opacity: 0.6 }}>Municipality Flags:</span> {dbg.municipalityFlags.join(', ') || '—'}</div>
              <div><span style={{ opacity: 0.6 }}>Business Type:</span> {dbg.businessType || '—'} {dbg.businessTypeId ? `(${dbg.businessTypeId})` : ''}</div>
              <div>
                <div style={{ opacity: 0.6 }}>Questions Triggered ({dbg.questionsTriggered.length}):</div>
                {dbg.questionsTriggered.map((q, i) => (
                  <div key={i} style={{ paddingLeft: 8 }}>• {q.question_id} = {String(q.answer)}</div>
                ))}
              </div>
              <div>
                <div style={{ opacity: 0.6 }}>Rules Matched ({dbg.rulesMatched.length}):</div>
                {dbg.rulesMatched.map((r, i) => (
                  <div key={i} style={{ paddingLeft: 8 }}>• {r.rule_id} [{r.rule_type}] → {r.document_id} — {r.reason}</div>
                ))}
              </div>
              <div>
                <div style={{ opacity: 0.6 }}>Documents Generated ({dbg.documentsGenerated.length}):</div>
                <div style={{ paddingLeft: 8 }}>{dbg.documentsGenerated.join(', ') || '—'}</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
