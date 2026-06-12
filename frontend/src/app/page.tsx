"use client";

import React, { useState, useEffect, useRef } from 'react';
import { L } from './i18n';
import { computeRequirementsFromKB, runRulesEngineForProfile, buildEngineInput, KB } from './kb';
import { captureEvent, newSubmissionId } from './graph/client';
import type { CapturedAnswer, CapturedRequirement } from './graph/types';
import { enrichRequirements, type EnrichedRequirement } from './relationshipEngine';
import { potentialItemsForFlags, type PotentialDef } from './potentialRequirements';
import { buildExtraction, type ExtractionResult } from './documentFields';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { 
  CheckCircle, AlertTriangle, Info, Upload, FileText, 
  ArrowRight, RefreshCw, Download, Building2, Archive, ExternalLink 
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

const MUNICIPALITIES = [
  "Adjuntas", "Aguada", "Aguadilla", "Aguas Buenas", "Aibonito", "Añasco", "Arecibo", "Arroyo",
  "Barceloneta", "Barranquitas", "Bayamón", "Cabo Rojo", "Caguas", "Camuy", "Canóvanas", "Carolina",
  "Cataño", "Cayey", "Ceiba", "Ciales", "Cidra", "Coamo", "Comerío", "Corozal", "Culebra", "Dorado",
  "Fajardo", "Florida", "Guánica", "Guayama", "Guayanilla", "Guaynabo", "Gurabo", "Hatillo",
  "Hormigueros", "Humacao", "Isabela", "Jayuya", "Juana Díaz", "Juncos", "Lajas", "Lares", "Las Marías",
  "Las Piedras", "Loíza", "Luquillo", "Manatí", "Maricao", "Maunabo", "Mayagüez", "Moca", "Morovis",
  "Naguabo", "Naranjito", "Orocovis", "Patillas", "Peñuelas", "Ponce", "Quebradillas", "Rincón",
  "Río Grande", "Sabana Grande", "Salinas", "San Germán", "San Juan", "San Lorenzo", "San Sebastián",
  "Santa Isabel", "Toa Alta", "Toa Baja", "Trujillo Alto", "Utuado", "Vega Alta", "Vega Baja", "Vieques",
  "Villalba", "Yabucoa", "Yauco"
];

// ====================================================================
// MUNICIPALITY RULES ENGINE
// Base municipal rules apply to all 78 municipalities; municipality flags
// (coastal/tourism/historic/metro/island) drive conditional notices that
// combine with industry, business-type, and trigger rules. One engine —
// not 78 — per the design.
// ====================================================================
const COASTAL_MUNICIPALITIES = new Set([
  'Aguada', 'Aguadilla', 'Añasco', 'Arecibo', 'Arroyo', 'Cabo Rojo', 'Camuy', 'Carolina',
  'Ceiba', 'Culebra', 'Dorado', 'Fajardo', 'Guánica', 'Guayama', 'Guayanilla', 'Hatillo',
  'Humacao', 'Isabela', 'Loíza', 'Luquillo', 'Manatí', 'Maunabo', 'Mayagüez', 'Naguabo',
  'Patillas', 'Peñuelas', 'Quebradillas', 'Rincón', 'Río Grande', 'Salinas', 'Toa Baja',
  'Vega Alta', 'Vega Baja', 'Vieques', 'Yabucoa',
]);
const TOURISM_MUNICIPALITIES = new Set([
  'San Juan', 'Rincón', 'Vieques', 'Culebra', 'Dorado', 'Fajardo', 'Río Grande', 'Luquillo',
  'Cabo Rojo', 'Isabela', 'Aguadilla', 'Mayagüez', 'Humacao',
]);
const HISTORIC_MUNICIPALITIES = new Set(['San Juan', 'Ponce', 'San Germán', 'Mayagüez']);
const METRO_MUNICIPALITIES = new Set(['San Juan', 'Bayamón', 'Carolina', 'Guaynabo', 'Caguas', 'Ponce']);
const ISLAND_MUNICIPALITIES = new Set(['Vieques', 'Culebra']);

function municipalityFlags(name: string) {
  return {
    coastal: COASTAL_MUNICIPALITIES.has(name),
    tourism: TOURISM_MUNICIPALITIES.has(name),
    historic: HISTORIC_MUNICIPALITIES.has(name),
    metro: METRO_MUNICIPALITIES.has(name),
    island: ISLAND_MUNICIPALITIES.has(name),
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
  // Resume a prior submission from History (?resume=<submissionId>): restore
  // the core profile and jump back to the requirements step.
  useEffect(() => {
    const resumeId = new URLSearchParams(window.location.search).get('resume');
    if (!resumeId) return;
    fetch(`/api/history/${resumeId}`)
      .then(r => r.json())
      .then(d => {
        const su = d?.summary;
        if (!su) return;
        const restored = {
          municipality: su.municipality || '',
          industry: su.industry || '',
          business_type: su.business_type || '',
          business_structure: su.business_structure || '',
          location_type: su.location_type || '',
        };
        setProfile(prev => ({ ...prev, ...restored }));
        const computed = computeRequirements({ ...(profile as any), ...restored }, {});
        setRequirements(computed);
        submissionIdRef.current = resumeId;
        setCurrentStep(3);
      })
      .catch(() => {});
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

  // Dynamic question flow based on Business Type (per the prompt)
  useEffect(() => {
    if (profile.business_type) {
      const list = getQuestionsForBusinessType(profile.business_type);
      setQuestionList(list);
      setCurrentQuestionIndex(0);
    } else {
      setQuestionList([]);
      setCurrentQuestionIndex(0);
    }
  }, [profile.business_type]);

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
      const capturedAnswers: CapturedAnswer[] = Object.entries(engineInput.answers)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
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
        answers: capturedAnswers,
        requirements: capturedReqs,
      });
    } catch {
      /* observational only */
    }
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
    }
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
  const downloadReadinessReport = async () => {
    try {
      setIsLoading(true);
      const pdfBlob = await generateReadinessReportPDF();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SmartPR-Readiness-Report-${(profile.name || 'Business').replace(/\s+/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SmartPR-Submission-Package-${(profile.name || 'Business').replace(/\s+/g, '-')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
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
  const renderReqRow = (req: Requirement, idx: number) => {
    const doc = uploadedDocs.find(d => d.requirement_code === req.code);
    const analysis = doc?.ai_analysis;
    const ext: ExtractionResult | undefined = analysis?.extraction;
    let icon = <div className="w-4 h-4 rounded-full border-2 border-[#0A2540]/30 mt-0.5 flex-shrink-0" />;
    if (ext) {
      if (ext.validation_result === 'PASS') icon = <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />;
      else if (ext.validation_result === 'NEEDS_REVIEW') icon = <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />;
      else icon = <span className="text-red-600 mt-0.5 flex-shrink-0 font-bold">✕</span>;
    } else if (req.status === 'uploaded' || req.status === 'passed') {
      icon = <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />;
    }
    const promoted = req.code.startsWith('potential_');
    return (
      <div key={idx} className="border rounded-xl px-4 py-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {icon}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[#0A2540]">{trReqName(req)}</div>
              <div className="text-xs text-[#0A2540]/70 mt-0.5">
                <span className="font-semibold">{L(req.agency, language)}</span> • {promoted ? L('Confirmed — applies', language) : req.mandatory ? L('Mandatory', language) : L('Recommended', language)}
              </div>
              <div className="text-xs text-[#0A2540]/60 mt-1 leading-snug">{trReqReason(req)}</div>
              {req.document_id && reasonsByDoc[req.document_id] && (
                <ReqReasons enr={reasonsByDoc[req.document_id]} language={language} />
              )}
              {ext && analysis && (
                <ExtractionPanel ext={ext} docType={analysis.document_type} language={language} />
              )}
            </div>
          </div>
          <button
            onClick={() => triggerFileUpload(req.code)}
            className="text-xs px-3 py-1.5 rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white flex items-center gap-1 flex-shrink-0"
          >
            <Upload className="w-3.5 h-3.5" /> {L(doc ? 'Re-upload' : 'Upload', language)}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Upload result toast (LLM document analysis feedback) */}
      {uploadNotice && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div
            className={`rounded-xl shadow-lg border p-4 flex items-start gap-3 bg-white ${
              uploadNotice.kind === 'success'
                ? 'border-emerald-300'
                : uploadNotice.kind === 'warning'
                ? 'border-amber-300'
                : 'border-red-300'
            }`}
            role="status"
          >
            <div
              className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                uploadNotice.kind === 'success'
                  ? 'bg-emerald-500'
                  : uploadNotice.kind === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
            />
            <div className="min-w-0">
              <div className="font-semibold text-sm text-[#0A2540]">{uploadNotice.title}</div>
              {uploadNotice.detail && (
                <div className="text-xs text-[#0A2540]/70 mt-0.5">{uploadNotice.detail}</div>
              )}
            </div>
            <button
              onClick={() => setUploadNotice(null)}
              className="ml-auto text-[#0A2540]/40 hover:text-[#0A2540] text-sm leading-none"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0A2540] rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-xl tracking-tight text-[#0A2540]">SmartPR</div>
              <div className="text-[10px] text-[#0A2540]/60 -mt-1">Puerto Rico Business Licensing Readiness</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <a href="/history" className="text-[#0A2540]/70 hover:text-[#0A2540] font-medium">{L('History', language)}</a>
            <a href="/admin/knowledge-base" className="text-[#0A2540]/70 hover:text-[#0A2540] font-medium hidden sm:inline">{L('Knowledge Graph', language)}</a>
            {/* Language Toggle - kept as professional feature */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded ${language === 'en' ? 'bg-[#0A2540] text-white' : 'bg-[#0A2540]/10 text-[#0A2540] hover:bg-[#0A2540]/20'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-2 py-1 rounded ${language === 'es' ? 'bg-[#0A2540] text-white' : 'bg-[#0A2540]/10 text-[#0A2540] hover:bg-[#0A2540]/20'}`}
              >
                ES
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2 text-sm">
            <div className="font-medium text-[#0A2540]">{L('SmartPR Readiness Workflow', language)} — {L('Step', language)} {currentStep} {L('of', language)} 9</div>
            <div className="text-[#0A2540]/60">{progress}% complete</div>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#0D9488] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* STEP 1: Business Discovery - Full spec redo */}
        {currentStep === 1 && (
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0A2540] mb-2">{t('title')}</h1>
            <p className="text-[#0A2540]/80 mb-8">{t('subtitle')}</p>

            <div className="bg-white border rounded-2xl p-8 space-y-6">
              {/* Field 1: Business Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">{t('businessName')}</label>
                <input 
                  className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" 
                  placeholder="Your Business Name" 
                  value={profile.name} 
                  onChange={e => setProfile({ ...profile, name: e.target.value })} 
                  required
                />
              </div>

              {/* Field 2: Municipality */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">{t('municipality')}</label>
                <select 
                  className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" 
                  value={profile.municipality} 
                  onChange={e => setProfile({ ...profile, municipality: e.target.value })}
                >
                  <option value="">{t('selectMunicipality')}</option>
                  {MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Field 3: Industry */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">{t('industry')}</label>
                <select 
                  className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" 
                  value={profile.industry} 
                  onChange={e => {
                    const newIndustry = e.target.value;
                    setProfile({ 
                      ...profile, 
                      industry: newIndustry,
                      business_type: '' 
                    });
                  }}
                >
                  <option value="">{t('selectIndustry')}</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* Field 4: Business Type (Dynamic) */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">{t('businessType')}</label>
                <select 
                  key={profile.industry || 'none'}
                  className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" 
                  value={profile.business_type} 
                  onChange={e => {
                    const newBt = e.target.value;
                    const allowed = LOCATION_TYPES_BY_BUSINESS_TYPE[newBt] || LOCATION_TYPES;
                    const newLoc = allowed.includes(profile.location_type || '') ? profile.location_type : '';
                    setProfile({ ...profile, business_type: newBt, location_type: newLoc });
                  }}
                >
                  <option value="">{t('selectBusinessType')}</option>
                  {(BUSINESS_TYPES[profile.industry] || [profile.industry || 'Other']).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Field 5: Business Location Type (dynamic based on Business Type) */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">{t('locationType')}</label>
                <select 
                  className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" 
                  value={profile.location_type} 
                  onChange={e => setProfile({ ...profile, location_type: e.target.value })}
                >
                  <option value="">{t('selectLocationType')}</option>
                  {(LOCATION_TYPES_BY_BUSINESS_TYPE[profile.business_type] || LOCATION_TYPES).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Business Structure */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">{t('businessStructure')}</label>
                <select 
                  className="w-full border rounded-lg px-4 py-2.5 text-[#0A2540]" 
                  value={profile.business_structure} 
                  onChange={e => setProfile({ ...profile, business_structure: e.target.value })}
                >
                  <option value="llc">LLC</option>
                  <option value="corporation">Corporation</option>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="professional_corporation">Professional Corporation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Number of Employees - Slider (no arrows) */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#0A2540]">{t('numEmployees')}</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    className="flex-1 accent-[#0A2540]" 
                    value={profile.number_of_employees ?? 0} 
                    onChange={e => setProfile({ ...profile, number_of_employees: parseInt(e.target.value) || 0 })} 
                  />
                  <div className="w-12 text-center font-medium text-[#0A2540] border rounded px-2 py-1 bg-white">
                    {profile.number_of_employees ?? 0}
                  </div>
                </div>
                <div className="text-[10px] text-[#0A2540]/60 mt-1">Drag the slider (0–100+). For larger teams you can edit the number directly if needed.</div>
              </div>

              {/* Dynamic Questions - Large cards, one at a time, auto-advance on answer */}
              {questionList.length > 0 && currentQuestionIndex < questionList.length && (
                <div className="border-2 border-[#0A2540] rounded-2xl p-8 bg-white">
                  <div className="text-2xl font-semibold mb-8 text-[#0A2540]">
                    {L(questionList[currentQuestionIndex].text, language)}
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => handleQuestionAnswer(true)}
                      className="min-h-[64px] text-xl font-semibold border-2 border-[#0A2540] rounded-2xl hover:bg-[#0A2540] hover:text-white transition-all active:scale-[0.985] text-[#0A2540]"
                    >
                      {t('yes').toUpperCase()}
                    </button>
                    <button
                      onClick={() => handleQuestionAnswer(false)}
                      className="min-h-[64px] text-xl font-semibold border-2 border-[#0A2540] rounded-2xl hover:bg-[#0A2540] hover:text-white transition-all active:scale-[0.985] text-[#0A2540]"
                    >
                      {t('no').toUpperCase()}
                    </button>
                  </div>
                  <div className="text-center mt-4 text-sm text-[#0A2540]/60">
                    {L('Question', language)} {currentQuestionIndex + 1} {L('of', language)} {questionList.length}
                  </div>
                </div>
              )}

              {questionList.length > 0 && currentQuestionIndex >= questionList.length && (
                <div className="text-center text-sm text-[#0A2540]/70 py-2">
                  {L('All relevant questions answered for this business type.', language)}
                </div>
              )}

              <button 
                onClick={handleStartDiscovery} 
                disabled={!profile.name || !profile.industry || (questionList.length > 0 && currentQuestionIndex < questionList.length) || isLoading}
                className="mt-4 w-full bg-[#0A2540] hover:bg-black text-white rounded-full py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {t('next')} {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              </button>
            </div>


          </div>
        )}

        {/* STEP 3: Checklist (main experience) */}
        {currentStep >= 3 && currentStep < 9 && (
          <div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="text-sm text-[#0D9488] font-medium">{L('SMARTPR READINESS CHECKLIST', language)}</div>
                <h2 className="text-2xl font-semibold text-[#0A2540]">{profile.name || L('Your Business', language)} — {profile.municipality}</h2>
              </div>
              {readinessScore !== null && (
                <div className="text-right">
                  <div className="text-4xl font-semibold tabular-nums text-[#0A2540]">{readinessScore}<span className="text-2xl">%</span></div>
                  <div className="text-xs text-[#0A2540]/60">{L('READINESS SCORE', language)}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Checklist */}
              <div className="lg:col-span-7 bg-white border rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="font-medium text-[#0A2540]">{L('Required Items for this business', language)} ({completedMandatory}/{totalMandatory} {L('mandatory complete', language)})</div>
                  <div className="text-sm text-[#0D9488]">{checklistProgress}%</div>
                </div>

                {municipalNotices.length > 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 space-y-1">
                    <div className="font-semibold">{L('Municipal Notices', language)} — {profile.municipality}</div>
                    {municipalNotices.map((n, i) => (
                      <div key={i}>• {L(n, language)}</div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {requirements.length === 0 && currentStep === 3 && (
                    <button onClick={loadRequirements} className="w-full py-3 border border-dashed rounded-xl text-[#0D9488] hover:bg-slate-50 flex items-center justify-center gap-2">
                      {L('Compute Requirements from Rules Engine', language)} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {/* 1. MANDATORY (deterministic rules + confirmed potentials) */}
                  {requirements.filter(r => r.mandatory).length > 0 && (
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#0A2540]/50 pt-1">{L('Mandatory Required Items', language)}</div>
                  )}
                  {requirements.filter(r => r.mandatory).map((req, idx) => renderReqRow(req, idx))}

                  {/* 2. POTENTIALLY REQUIRED (knowledge-graph / municipality flags) */}
                  {potentialItems.length > 0 && (
                    <>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-amber-600 pt-3">{L('Potentially Required Items', language)}</div>
                      {potentialItems.map((p) => {
                        const decision = potentialDecisions[p.flag];
                        if (decision === 'applies') return null; // promoted into Mandatory above
                        const naMode = decision === 'not_applies';
                        return (
                          <div key={p.flag} className={`border rounded-xl px-4 py-3 text-sm ${naMode ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-amber-200 bg-amber-50/40'}`}>
                            <div className="flex items-start gap-3">
                              <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${naMode ? 'text-slate-400' : 'text-amber-500'}`} />
                              <div className="min-w-0 flex-1">
                                <div className={`font-medium ${naMode ? 'text-[#0A2540]/50 line-through' : 'text-[#0A2540]'}`}>{p.document}</div>
                                <div className="text-xs text-[#0A2540]/70 mt-0.5">
                                  <span className="font-semibold">{p.agency}</span> • {L('Potentially Required', language)}
                                </div>
                                <div className="text-[11px] text-amber-700 mt-0.5">{L('Trigger', language)}: {L(p.flagLabel, language)}</div>
                                {!naMode && (
                                  <>
                                    <div className="text-xs text-[#0A2540]/70 mt-1.5 leading-snug">
                                      <span className="font-semibold">{L('Why this may be required', language)}:</span> {L(p.why, language)}
                                    </div>
                                    <div className="text-xs text-[#0A2540] mt-2 font-medium">{L(p.followUp, language)}</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      <button onClick={() => decidePotential(p, 'applies')} className="text-xs px-3 py-1 rounded-full bg-[#0D9488] text-white hover:bg-[#0b7d72]">{L('Applies', language)}</button>
                                      <button onClick={() => decidePotential(p, 'not_applies')} className="text-xs px-3 py-1 rounded-full border border-slate-300 text-[#0A2540] hover:bg-slate-100">{L('Does Not Apply', language)}</button>
                                      <button onClick={() => decidePotential(p, 'not_sure')} className={`text-xs px-3 py-1 rounded-full border ${decision === 'not_sure' ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-slate-300 text-[#0A2540] hover:bg-slate-100'}`}>{L('Not Sure', language)}</button>
                                    </div>
                                    {decision === 'not_sure' && (
                                      <div className="text-[11px] text-amber-700 mt-1.5">{L('Kept as potentially required. Revisit before submission.', language)}</div>
                                    )}
                                  </>
                                )}
                                {naMode && (
                                  <button onClick={() => decidePotential(p, 'not_sure')} className="text-[11px] text-[#0D9488] hover:underline mt-1">{L('Undo — mark as not sure', language)}</button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* 3. RECOMMENDED (rule-based non-mandatory) */}
                  {requirements.filter(r => !r.mandatory).length > 0 && (
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#0A2540]/50 pt-3">{L('Recommended Items', language)}</div>
                  )}
                  {requirements.filter(r => !r.mandatory).map((req, idx) => renderReqRow(req, idx))}
                </div>

                {/* Advisory historical insights — suggestions only, never mandatory. */}
                {advisory && advisory.enabled && advisory.similarCount > 0 &&
                  (advisory.potentiallyOverlooked.length > 0 || advisory.commonValidationFailures.length > 0) && (
                  <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                    <div className="font-semibold text-amber-800">
                      {L('Recommended Based on Similar Businesses', language)} · {L('Advisory', language)}
                    </div>
                    <div className="text-xs text-amber-700/80 mt-0.5">
                      {L('Based on', language)} {advisory.similarCount} {L('similar businesses processed before. Suggestions only — these never change what the rules require.', language)}
                    </div>
                    {advisory.potentiallyOverlooked.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-amber-800 mb-1">{L('Documents similar businesses often also needed', language)}</div>
                        <div className="flex flex-col gap-1">
                          {advisory.potentiallyOverlooked.map(d => (
                            <div key={d.document} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-white bg-amber-500 rounded px-1.5 py-0.5">{d.pct}%</span>
                              <span className="text-xs text-[#0A2540]">{d.document}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {advisory.commonValidationFailures.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-amber-800 mb-1">{L('Documents that commonly fail validation', language)}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {advisory.commonValidationFailures.map(f => (
                            <span key={f.document_type} className="text-[11px] text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">{f.document_type}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {requirements.length > 0 && currentStep < 7 && (
                  <button onClick={runValidation} disabled={isLoading} className="mt-6 w-full bg-[#0D9488] text-white rounded-full py-3 font-medium flex items-center justify-center gap-2">
                    {L('Run Validation Engine', language)} {isLoading && <RefreshCw className="animate-spin w-4 h-4" />}
                  </button>
                )}

                {/* Prominent call-to-action when everything is validated */}
                {completedMandatory === totalMandatory && readinessScore !== null && currentStep < 9 && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                    <div className="font-medium text-emerald-800">{L('All required documents validated.', language)}</div>
                    <button 
                      onClick={() => setCurrentStep(9)}
                      className="mt-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg py-2 text-sm font-medium"
                    >
                      {L('View SUBMISSION DELIVERABLES', language)} →
                    </button>
                  </div>
                )}
              </div>

              {/* Side panel: Findings / Actions */}
              <div className="lg:col-span-5 space-y-4">
                {findings.length > 0 && (
                  <div className="bg-white border rounded-2xl p-6">
                    <div className="font-medium mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {L('Findings', language)}</div>
                    <div className="space-y-3 text-sm">
                      {findings.map((f, i) => (
                        <div key={i} className={`p-3 rounded-lg border-l-4 ${f.severity === 'critical' ? 'border-red-600 bg-red-50' : f.severity === 'warning' ? 'border-amber-600 bg-amber-50' : 'border-blue-600 bg-blue-50'}`}>
                          <div className="font-medium">{L(f.title, language)}</div>
                          <div className="text-[#0A2540]/80 mt-0.5">{L(f.description, language)}</div>
                          <div className="mt-1 text-xs text-[#0A2540]/60">→ {L(f.recommended_action, language)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {readinessScore !== null && (
                  <button 
                    onClick={() => setCurrentStep(9)} 
                    className="w-full bg-[#0A2540] text-white rounded-2xl py-4 flex items-center justify-center gap-3 text-sm font-medium hover:bg-black"
                  >
                    <Download className="w-4 h-4" /> {L('SUBMISSION DELIVERABLES', language)}
                  </button>
                )}

                <div className="text-[10px] text-[#0A2540]/60 px-1">
                  {L('SmartPR provides AI-assisted readiness assessment and document organization for Puerto Rico business licensing.', language)}
                </div>
              </div>
            </div>

            {/* Quick nav */}
            <div className="mt-8 flex gap-3 text-sm">
              <button onClick={() => setCurrentStep(1)} className="px-4 py-2 border rounded-full">← {L('Back to Discovery', language)}</button>
              {currentStep < 9 && <button onClick={() => setCurrentStep((currentStep + 1) as Step)} className="px-4 py-2 border rounded-full flex items-center gap-1">{L('Skip to next step', language)} <ArrowRight className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        )}

        {/* FINAL STEP: SUBMISSION DELIVERABLES (shown when currentStep === 9) */}
        {currentStep === 9 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-block px-4 py-1 rounded-full bg-[#0A2540] text-white text-sm tracking-[2px] mb-3">{L('FINAL STEP', language)}</div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#0A2540]">{L('SUBMISSION DELIVERABLES', language)}</h1>
              <p className="text-[#0A2540]/70 mt-2">{L('All validated materials are ready. This platform prepares you for submission — it does not file with government.', language)}</p>
            </div>

            {/* Business + Status Summary */}
            <div className="bg-white border-2 border-[#0A2540] rounded-2xl p-8 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div><span className="text-[#0A2540]/60">{L('Business Name', language)}</span><div className="font-medium text-[#0A2540] text-lg">{profile.name || '—'}</div></div>
                <div><span className="text-[#0A2540]/60">{L('Municipality', language)}</span><div className="font-medium text-[#0A2540] text-lg">{profile.municipality || '—'}</div></div>
                <div><span className="text-[#0A2540]/60">{L('Business Type', language)}</span><div className="font-medium text-[#0A2540] text-lg">{profile.business_type || '—'}</div></div>
                <div><span className="text-[#0A2540]/60">{L('Readiness Score', language)}</span><div className="font-semibold text-3xl text-[#0A2540] tabular-nums">{readinessScore ?? '—'}<span className="text-xl">%</span></div></div>
              </div>

              <div className="mt-6 pt-6 border-t">
                {(() => {
                  const completed = requirements.filter(r => r.mandatory && (r.status === 'passed' || r.status === 'uploaded')).length;
                  const total = requirements.filter(r => r.mandatory).length;
                  const isReady = completed === total && (readinessScore || 0) >= 70;
                  return (
                    <div>
                      <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium ${isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {isReady ? L('READY FOR SUBMISSION', language) : L('IN PROGRESS — REVIEW REQUIRED', language)}
                      </div>
                      <div className="mt-3 text-[#0A2540]">
                        {completed} {L('of', language)} {total} {L('Required Documents Validated', language)}
                        {findings.filter(f => f.severity === 'critical').length === 0 && ` • ${L('No Critical Issues Found', language)}`}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Three Deliverables */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {/* 1. PDF Report */}
              <div className="bg-white border rounded-2xl p-6 flex flex-col">
                <div className="flex-1">
                  <div className="w-9 h-9 rounded-lg bg-[#0A2540]/10 flex items-center justify-center mb-4">
                    <FileText className="w-5 h-5 text-[#0A2540]" />
                  </div>
                  <div className="font-semibold text-[#0A2540] text-lg mb-1">{L('1. DOWNLOAD READINESS REPORT', language)}</div>
                  <div className="text-sm text-[#0A2540]/70 mb-4">
                    {L('Professional PDF with Business Profile, Readiness Score, Validation Summary, Required/Uploaded/Missing Documents, Findings, Warnings, and Recommended Next Steps.', language)}
                  </div>
                  <div className="text-[11px] text-[#0A2540]/50">{L('Human-readable summary for your records, attorney, or consultant.', language)}</div>
                </div>
                <button
                  onClick={downloadReadinessReport}
                  disabled={isLoading}
                  className="mt-6 w-full bg-[#0A2540] hover:bg-black text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Download className="w-4 h-4" /> {L('Download PDF Report', language)}
                </button>
              </div>

              {/* 2. ZIP Package */}
              <div className="bg-white border rounded-2xl p-6 flex flex-col">
                <div className="flex-1">
                  <div className="w-9 h-9 rounded-lg bg-[#0A2540]/10 flex items-center justify-center mb-4">
                    <Archive className="w-5 h-5 text-[#0A2540]" />
                  </div>
                  <div className="font-semibold text-[#0A2540] text-lg mb-1">{L('2. DOWNLOAD SUBMISSION PACKAGE ZIP', language)}</div>
                  <div className="text-sm text-[#0A2540]/70 mb-4">
                    {L('Complete ZIP containing the Readiness Report PDF + all your validated uploaded documents, automatically renamed and sorted in submission order:', language)}
                  </div>
                  <div className="text-[11px] font-mono text-[#0A2540]/60 leading-tight mb-2">
                    01_Entity_Formation.pdf<br />
                    02_EIN_Letter.pdf<br />
                    03_Merchant_Registration.pdf<br />
                    04_Permiso_Unico.pdf<br />
                    ...
                  </div>
                  <div className="text-[11px] text-[#0A2540]/50">{L('Ready to share with accountants, attorneys, municipalities, or permit expediters.', language)}</div>
                </div>
                <button
                  onClick={downloadSubmissionPackage}
                  disabled={isLoading || uploadedDocs.filter(d => d.fileBlob).length === 0}
                  className="mt-6 w-full bg-[#0A2540] hover:bg-black text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Download className="w-4 h-4" /> {L('Download ZIP Package', language)}
                </button>
              </div>

              {/* 3. Workspace */}
              <div className="bg-white border rounded-2xl p-6 flex flex-col">
                <div className="flex-1">
                  <div className="w-9 h-9 rounded-lg bg-[#0A2540]/10 flex items-center justify-center mb-4">
                    <Building2 className="w-5 h-5 text-[#0A2540]" />
                  </div>
                  <div className="font-semibold text-[#0A2540] text-lg mb-1">{L('3. OPEN SMARTPR WORKSPACE', language)}</div>
                  <div className="text-sm text-[#0A2540]/70 mb-4">
                    {L('Permanent link to your readiness workspace. Stores profile, questionnaire responses, required & uploaded documents, validation results, reports, and activity history.', language)}
                  </div>
                  <div className="text-xs text-[#0A2540]/60">{L('Future uploads and re-validation supported.', language)}</div>
                </div>
                <button
                  onClick={openSmartPRWorkspace}
                  className="mt-6 w-full border-2 border-[#0A2540] hover:bg-[#0A2540] hover:text-white text-[#0A2540] rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {L('Open Workspace', language)} <ExternalLink className="w-4 h-4" />
                </button>
                {activeWorkspaceId && (
                  <div className="mt-2 text-[10px] text-center text-[#0A2540]/50 font-mono">/workspace/{activeWorkspaceId}</div>
                )}
              </div>
            </div>

            {/* Official Disclaimers */}
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-900">
              <div className="font-semibold mb-2">{L('IMPORTANT DISCLAIMER — READ CAREFULLY', language)}</div>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>{L('Do NOT submit this package or any SmartPR output to government agencies as an official filing.', language)}</li>
                <li>{L('Do NOT claim that SmartPR approves, grants, or issues any license or permit.', language)}</li>
                <li>{L('Do NOT file permits or applications using these materials as the sole source.', language)}</li>
                <li>{L('SmartPR is a', language)} <strong>{L('readiness and compliance preparation platform', language)}</strong>, {L('not a government filing system.', language)}</li>
                <li>{L("The platform's responsibility ends at:", language)} <strong>Prepare • Validate • Organize • Package</strong>.</li>
                <li>{L('All final approvals are made exclusively by the Government of Puerto Rico and its agencies.', language)}</li>
              </ul>
              <div className="mt-3 text-[10px] opacity-75">{L('Data is stored for this workspace session. All analysis uses the configured AI model.', language)}</div>
            </div>

            <div className="mt-6 flex gap-3 text-sm">
              <button onClick={() => setCurrentStep(3)} className="px-4 py-2 border rounded-full">← {L('Back to Checklist', language)}</button>
              <button onClick={() => setCurrentStep(1)} className="px-4 py-2 border rounded-full">{L('Start New Business', language)}</button>
            </div>
          </div>
        )}

        {/* Hidden file input: powers the real "Upload" buttons to open local machine files and send to LLM ID workflow */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.md"
          onChange={onFileInputChange}
        />
      </div>

      <footer className="border-t bg-white py-4 mt-12">
      </footer>

      {/* Workspace Modal */}
      {showWorkspaceModal && activeWorkspaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm uppercase tracking-widest text-[#0A2540]/60">SmartPR</div>
                <div className="text-2xl font-semibold text-[#0A2540]">{L('Workspace', language)}</div>
              </div>
              <button onClick={() => setShowWorkspaceModal(false)} className="text-[#0A2540]/40 hover:text-[#0A2540]">✕</button>
            </div>

            <div className="font-mono text-sm bg-slate-100 px-3 py-2 rounded mb-4 break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/workspace/{activeWorkspaceId}
            </div>

            <div className="text-sm text-[#0A2540]/80 mb-4">
              {L('Your readiness workspace opened in a new tab. This is a shareable, self-contained link showing your AI-approved deliverables, requirements checklist, and findings. The link has also been copied to your clipboard.', language)}
            </div>

            <div className="text-xs text-[#0A2540]/60 mb-6">
              {L('Share it with your attorney, accountant, or permit expediter — it renders anywhere without a login.', language)}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const url = `/workspace/${activeWorkspaceId}#d=${encodePayload(buildWorkspacePayload())}`;
                  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="flex-1 border border-[#0A2540] text-[#0A2540] rounded-xl py-2.5 text-sm hover:bg-[#0A2540] hover:text-white"
              >
                {L('Open Workspace Again', language)}
              </button>
              <button
                onClick={() => setShowWorkspaceModal(false)}
                className="flex-1 bg-[#0A2540] text-white rounded-xl py-2.5 text-sm"
              >
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
          <div className="fixed bottom-0 right-0 z-50 w-full sm:w-[440px] max-h-[60vh] overflow-auto bg-[#0A2540] text-white text-[11px] font-mono shadow-2xl border-l border-t border-white/20">
            <div className="px-3 py-2 font-bold border-b border-white/20 flex justify-between">
              <span>SmartPR Rules Engine — Debug</span>
              <span className="opacity-60">?debug=1</span>
            </div>
            <div className="p-3 space-y-2">
              <div><span className="opacity-60">Municipality Selected:</span> {dbg.municipalitySelected || '—'}</div>
              <div><span className="opacity-60">Municipality Flags:</span> {dbg.municipalityFlags.join(', ') || '—'}</div>
              <div><span className="opacity-60">Business Type:</span> {dbg.businessType || '—'} {dbg.businessTypeId ? `(${dbg.businessTypeId})` : ''}</div>
              <div>
                <div className="opacity-60">Questions Triggered ({dbg.questionsTriggered.length}):</div>
                {dbg.questionsTriggered.map((q, i) => (
                  <div key={i} className="pl-2">• {q.question_id} = {String(q.answer)}</div>
                ))}
              </div>
              <div>
                <div className="opacity-60">Rules Matched ({dbg.rulesMatched.length}):</div>
                {dbg.rulesMatched.map((r, i) => (
                  <div key={i} className="pl-2">• {r.rule_id} [{r.rule_type}] → {r.document_id} — {r.reason}</div>
                ))}
              </div>
              <div>
                <div className="opacity-60">Documents Generated ({dbg.documentsGenerated.length}):</div>
                <div className="pl-2">{dbg.documentsGenerated.join(', ') || '—'}</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
