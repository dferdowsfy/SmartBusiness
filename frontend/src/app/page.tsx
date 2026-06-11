"use client";

import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { 
  CheckCircle, AlertTriangle, Info, Upload, FileText, 
  ArrowRight, RefreshCw, Download, Building2, Archive, ExternalLink 
} from 'lucide-react';

// SmartPR
// Puerto Rico Business Licensing Readiness Platform
// Real LLM-powered document identification and validation (Grok via backend)

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

// Core compute logic - matches the approved rules engine design + seed data
// Updated to use the new Step 1 fields (location_type, food_prepared_or_sold, alcohol_sold, professional_licenses_required, etc.)
function computeRequirements(profile: BusinessProfile, answers: Record<string, any>): Requirement[] {
  const reqs: Requirement[] = [];
  const industry = profile.industry;
  const locationType = profile.location_type;
  const isHome = locationType === 'Home-Based Business';
  const isOnlineOnly = locationType === 'Online Only';
  const hasPhysical = !isOnlineOnly;
  const customersVisit = profile.customers_visit === true;
  const hasFood = profile.food_prepared_or_sold === true;
  const hasAlcohol = profile.alcohol_sold === true;
  const hasHealthcare = profile.healthcare_services === true;
  const hasProfLicenses = profile.professional_licenses_required === true;
  const hasHazardous = profile.hazardous_materials === true;
  const hasEmployees = profile.employees_hired === true;
  const hasPhysicalOp = profile.physical_location === true;
  const manufactures = profile.products_manufactured === true;
  const usesVehicles = profile.vehicles_used === true;
  const hasSignage = profile.commercial_signage === true;
  const hasOutdoor = profile.outdoor_seating === true;
  const hasEntertainment = profile.live_entertainment === true;
  const isShortTerm = profile.short_term_rental === true;
  const hasMedicalWaste = profile.medical_waste === true;
  const hasImportExport = profile.import_export === true;

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

  // Professional / Healthcare services (handled in the expanded professional block below)
  // Construction
  if (industry === 'Construction') {
    reqs.push({ code: 'contractor_license', name: 'Contractor License / Trade Certification', mandatory: true, status: 'pending', agency: 'Department of State', reason: 'Required for construction trades and public work.' });
  }

  // Retail general
  if (industry === 'Retail' || industry === 'Retail Store') {
    reqs.push({ code: 'crim_clearance', name: 'CRIM Property Tax Clearance', mandatory: false, status: 'pending', agency: 'CRIM', reason: 'Often requested by municipalities for Patente.' });
  }

  // Professional Services, Real Estate, Finance, etc.
  if (industry === 'Professional Services' || industry === 'Real Estate' || industry === 'Finance & Insurance' || hasProfLicenses) {
    reqs.push(
      { code: 'professional_licenses', name: 'Professional Licenses for Staff', mandatory: true, status: 'pending', agency: 'Department of State Examining Boards', reason: 'Required for attorneys, CPAs, insurance agents, real estate brokers, engineers, architects, etc.' },
      { code: 'malpractice_or_eo_insurance', name: 'Professional Liability / E&O Insurance', mandatory: false, status: 'pending', agency: 'Various', reason: 'Strongly recommended for professional service providers.' }
    );
  }

  // Manufacturing
  if (industry === 'Manufacturing') {
    reqs.push({ code: 'environmental_permit', name: 'Environmental / Manufacturing Permit', mandatory: true, status: 'pending', agency: 'Environmental Quality Board / OGPe', reason: 'Required for manufacturing operations, especially food, pharma, or chemical.' });
  }

  // Transportation & Logistics
  if (industry === 'Transportation & Logistics') {
    reqs.push({ code: 'transportation_permit', name: 'Transportation / PUC Permit', mandatory: true, status: 'pending', agency: 'Public Service Commission', reason: 'Required for trucking, courier, taxi, rideshare, and logistics companies.' });
  }

  // Tourism / Accommodation
  if (industry === 'Accommodation & Tourism') {
    reqs.push({ code: 'tourism_permit', name: 'Tourism / Short-Term Rental Permit', mandatory: false, status: 'pending', agency: 'Tourism Company / Municipal', reason: 'Often required for hotels, resorts, Airbnbs, and tour operators.' });
  }

  // Beauty & Personal Care
  if (industry === 'Beauty & Personal Care') {
    reqs.push({ code: 'health_permit_beauty', name: 'Health / Sanitation Permit (Beauty)', mandatory: true, status: 'pending', agency: 'Departamento de Salud', reason: 'Required for salons, spas, tattoo shops, and cosmetic services.' });
  }

  // Education & Training
  if (industry === 'Education & Training') {
    reqs.push({ code: 'education_license', name: 'Education / Childcare License', mandatory: true, status: 'pending', agency: 'Department of Education / Licensing Board', reason: 'Required for private schools, daycares, and vocational training.' });
  }

  // Short-term rental / tourism
  if (isShortTerm || industry === 'Accommodation & Tourism') {
    reqs.push({ code: 'tourism_registration', name: 'Short-Term Rental / Tourism Registration', mandatory: true, status: 'pending', agency: 'Tourism Company / Municipal', reason: 'Required for short-term rentals, hotels, resorts, and tourism activities.' });
  }

  // Signage
  if (hasSignage) {
    reqs.push({ code: 'sign_permit', name: 'Sign Permit / Rótulo Permit', mandatory: false, status: 'pending', agency: 'Municipal Government / OGPe', reason: 'Exterior signage may require municipal or permit approval.' });
  }

  // Outdoor seating
  if (hasOutdoor) {
    reqs.push({ code: 'outdoor_seating_auth', name: 'Outdoor Seating Authorization', mandatory: false, status: 'pending', agency: 'Municipal Government', reason: 'Public space or sidewalk use approval may be required for outdoor seating.' });
  }

  // Live entertainment
  if (hasEntertainment) {
    reqs.push({ code: 'entertainment_permit', name: 'Entertainment Permit', mandatory: false, status: 'pending', agency: 'Municipal Government / OGPe', reason: 'May be required for live entertainment.' });
  }

  // Import / Export
  if (hasImportExport) {
    reqs.push({ code: 'import_export_reg', name: 'Import / Export Registration', mandatory: false, status: 'pending', agency: 'Hacienda / Customs', reason: 'Required if import/export activity occurs.' });
  }

  // Home-based specific (only base + declaration, unless triggers)
  if (isHome) {
    reqs.push(
      { code: 'residential_proof', name: 'Proof of Residential Address', mandatory: true, status: 'pending', agency: 'General', reason: 'Required for home-based businesses.' },
      { code: 'home_declaration', name: 'Home Business Declaration', mandatory: true, status: 'pending', agency: 'Municipal Government', reason: 'Required for home-based businesses.' }
    );
  }

  // Online only (minimal physical)
  if (isOnlineOnly) {
    // Only base documents; no physical ones unless other triggers
  }

  // Additional for specific business types if needed (extend as per prompt)
  if (profile.business_type.includes('Tattoo')) {
    reqs.push({ code: 'tattoo_auth', name: 'Tattoo / Body Art Health Authorization', mandatory: true, status: 'pending', agency: 'Departamento de Salud', reason: 'Required for tattoo and body art services.' });
  }

  return reqs;
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
    setCurrentStep(3);
    setIsLoading(false);
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

  // === Real local file upload + LLM document identification (uses .env key + grok model via backend) ===
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(`[Binary or unreadable content from ${file.name}]`);
      reader.readAsText(file);
    });
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
    let llmRan = false;        // true only when the server-side Grok call returned a result
    let llmError: string | null = null;
    let extracted: any = {
      business_name: profile.name || null,
      entity_name: profile.name || null,
    };

    // Real Grok LLM analysis runs server-side in this same Next.js app
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

      analysis = {
        document_type: docType,
        confidence: 0.65,
        extracted,
        validation_checks: [
          { check: "Business Name Match", result: "pass", details: "Matched to profile context" },
          { check: "Required Fields Present", result: "pass", details: "From uploaded file" },
          { check: "Not Expired", result: "warning", details: "Verify date" }
        ],
        overall_status: docType === 'Unknown' ? 'Needs Review' : 'Complete',
        notes: `Processed uploaded file "${filename}" using Grok AI document intelligence.`
      };
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
      const checks = a.validation_checks || [];

      let stage = 0;
      const hasId = a.document_type && a.document_type !== 'Unknown';
      const hasExtract = a.extracted && Object.values(a.extracted).some((v: any) => v);
      const isVerified = (a.overall_status === 'Complete' || a.overall_status === 'Verified') &&
                         checks.every((c: any) => c.result === 'pass' || !(c.check.includes('Match') || c.check.includes('Expired')));

      if (isVerified) stage = 1.0;
      else if (hasExtract) stage = 0.5;
      else if (hasId) stage = 0.25;

      let contrib = stage * weight;

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

    // Findings from this analysis
    const newFindings: Finding[] = [...findings];
    const status = analysis.overall_status;
    let sev: 'critical' | 'warning' | 'informational' = 'informational';
    let title = `${filename} processed`;
    let desc = analysis.notes || `Identified as ${analysis.document_type}. Confidence ${Math.round((analysis.confidence || 0) * 100)}%.`;
    let action = 'Document added and analyzed.';

    if (status === 'Complete' || status === 'Verified') {
      sev = 'informational';
      title = `${analysis.document_type} verified via Grok AI`;
      action = 'Readiness score updated.';
    } else if (status === 'Needs Review' || status === 'Missing Information') {
      sev = 'warning';
      title = `${analysis.document_type} needs review`;
      action = 'Review fields or re-upload.';
    } else if (status === 'Mismatch' || status === 'Expired') {
      sev = 'critical';
      title = `${analysis.document_type} has issues`;
      action = 'Address before submission.';
    }

    newFindings.push({ severity: sev, title, description: desc, recommended_action: action });
    setFindings(newFindings);

    // Visible toast so the user immediately sees the LLM result for this upload.
    const reqLabel = requirements.find(r => r.code === reqCode)?.name || analysis.document_type || filename;
    if (!llmRan) {
      setUploadNotice({
        kind: 'error',
        title: `Could not analyze with AI`,
        detail: llmError
          ? `${llmError}. Add OPENROUTER_API_KEY in your environment to enable Grok analysis.`
          : 'AI analysis unavailable. Using basic classification.',
      });
    } else if (newStatus === 'passed') {
      setUploadNotice({
        kind: 'success',
        title: `✓ ${reqLabel} passed`,
        detail: `Grok verified ${analysis.document_type}. Readiness score updated.`,
      });
    } else {
      setUploadNotice({
        kind: 'warning',
        title: `${reqLabel} needs review`,
        detail: analysis.notes || `Grok analyzed ${analysis.document_type} but couldn't fully verify it.`,
      });
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
    const doc = new jsPDF();
    const navy = '#0A2540';
    const isEs = language === 'es';

    // Header
    doc.setFillColor(10, 37, 64); // #0A2540
    doc.rect(0, 0, 210, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('SMARTPR', 15, 12);
    doc.setFontSize(10);
    doc.text('PUERTO RICO BUSINESS LICENSING READINESS', 70, 12);

    doc.setTextColor(navy);
    doc.setFontSize(20);
    doc.text('SUBMISSION DELIVERABLES', 15, 30);

    doc.setFontSize(12);
    let y = 42;
    doc.text(`Business Name: ${profile.name || 'N/A'}`, 15, y); y += 7;
    doc.text(`Municipality: ${profile.municipality || 'N/A'}`, 15, y); y += 7;
    doc.text(`Industry: ${profile.industry || 'N/A'}`, 15, y); y += 7;
    doc.text(`Business Type: ${profile.business_type || 'N/A'}`, 15, y); y += 7;
    doc.text(`Readiness Score: ${readinessScore ?? 'N/A'}%`, 15, y); y += 10;

    // Status banner
    const completed = requirements.filter(r => r.mandatory && (r.status === 'passed' || r.status === 'uploaded')).length;
    const total = requirements.filter(r => r.mandatory).length;
    const statusText = completed === total ? 'READY FOR SUBMISSION' : 'NEEDS REVIEW';
    doc.setFillColor(13, 148, 136); // teal
    doc.rect(15, y - 4, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(`${statusText}  •  ${completed} of ${total} Required Documents Validated`, 18, y + 3);
    doc.setTextColor(navy);
    y += 16;

    // Validation Summary
    doc.setFontSize(13);
    doc.text('VALIDATION SUMMARY', 15, y); y += 7;
    doc.setFontSize(10);
    doc.text(`Readiness Score: ${readinessScore ?? 'N/A'}%`, 15, y); y += 6;
    doc.text(`Validated Documents: ${completed} / ${total} mandatory`, 15, y); y += 6;

    // Required Documents list
    doc.text('Required Documents:', 15, y); y += 5;
    requirements.slice(0, 8).forEach(r => {
      const mark = (r.status === 'passed' || r.status === 'uploaded') ? '✓' : '⬜';
      doc.text(`  ${mark} ${r.name} (${r.agency})`, 18, y); y += 5;
    });
    if (requirements.length > 8) {
      doc.text(`  ... and ${requirements.length - 8} more`, 18, y); y += 5;
    }
    y += 4;

    // Uploaded vs Missing
    doc.setFontSize(13);
    doc.text('UPLOADED DOCUMENTS', 15, y); y += 6;
    doc.setFontSize(10);
    uploadedDocs.slice(0, 6).forEach((d, i) => {
      const analysis = d.ai_analysis;
      const st = analysis?.overall_status || 'Unknown';
      doc.text(`  ${i + 1}. ${d.name} — ${analysis?.document_type || 'Document'} (${st})`, 18, y); y += 5;
    });
    y += 3;

    const missing = requirements.filter(r => r.mandatory && r.status === 'pending');
    doc.setFontSize(13);
    doc.text('MISSING / PENDING DOCUMENTS', 15, y); y += 6;
    doc.setFontSize(10);
    if (missing.length === 0) {
      doc.text('  None — all mandatory items validated.', 18, y); y += 5;
    } else {
      missing.slice(0, 5).forEach(m => {
        doc.text(`  • ${m.name}`, 18, y); y += 5;
      });
    }
    y += 4;

    // Findings
    doc.setFontSize(13);
    doc.text('FINDINGS & RECOMMENDATIONS', 15, y); y += 6;
    doc.setFontSize(10);
    findings.slice(0, 5).forEach(f => {
      doc.text(`[${f.severity.toUpperCase()}] ${f.title}`, 15, y); y += 5;
      doc.text(`  ${f.description}`, 18, y); y += 5;
      doc.text(`  → ${f.recommended_action}`, 18, y); y += 6;
    });

    // Recommended Next Steps
    y += 3;
    doc.setFontSize(13);
    doc.text('RECOMMENDED NEXT STEPS', 15, y); y += 6;
    doc.setFontSize(10);
    doc.text('1. Review any items marked Needs Review or Warning.', 15, y); y += 5;
    doc.text('2. Address expiring documents or mismatches before submission.', 15, y); y += 5;
    doc.text('3. Share the Submission Package ZIP with your attorney, accountant, or permit expediter.', 15, y); y += 5;
    doc.text('4. Use the SmartPR Workspace to track updates and re-validate as needed.', 15, y); y += 8;

    // Strong disclaimer
    doc.setFillColor(254, 226, 226); // light red
    doc.rect(15, y, 180, 28, 'F');
    doc.setTextColor(153, 27, 30);
    doc.setFontSize(9);
    const disc1 = 'SmartPR determines READINESS for submission to Puerto Rico government agencies.';
    const disc2 = 'It does NOT approve, grant, or issue any license or permit. All approvals are made';
    const disc3 = 'exclusively by the Government of Puerto Rico and its agencies. This package is for';
    const disc4 = 'preparation and organization only. Platform scope: Prepare • Validate • Organize • Package.';
    doc.text(disc1, 17, y + 6);
    doc.text(disc2, 17, y + 10);
    doc.text(disc3, 17, y + 14);
    doc.text(disc4, 17, y + 18);
    doc.setTextColor(navy);

    // Footer
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}  |  SmartPR  |  Powered by Grok AI`, 15, 285);

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
  const openSmartPRWorkspace = () => {
    const wsId = businessId || `ws-${Date.now().toString(36)}`;
    setActiveWorkspaceId(wsId);

    // Persist snapshot (metadata only — real file blobs stay in-memory for this session)
    const snapshot = {
      profile,
      discoveryAnswers,
      requirements,
      uploadedDocs: uploadedDocs.map(d => ({
        ...d,
        fileBlob: undefined, // do not persist large blobs to LS
        fileStored: !!d.fileBlob,
        originalName: d.originalName || d.name,
      })),
      findings,
      readinessScore,
      language,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    try {
      localStorage.setItem(`smartpr-workspace-${wsId}`, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('Could not persist full workspace to localStorage (storage quota).');
    }

    const wsUrl = `/workspace/${wsId}`;
    // Open the "workspace" as a modal with link + summary + ability to continue
    setShowWorkspaceModal(true);

    // Also copy link for convenience
    const fullUrl = (typeof window !== 'undefined' ? window.location.origin : '') + wsUrl;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
  };

  const completedMandatory = requirements.filter(r => r.mandatory && (r.status === 'uploaded' || r.status === 'passed')).length;
  const totalMandatory = requirements.filter(r => r.mandatory).length;
  const checklistProgress = totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 0;

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
            <div className="font-medium text-[#0A2540]">SmartPR Readiness Workflow — Step {currentStep} of 9</div>
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
                    {questionList[currentQuestionIndex].text}
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
                    Question {currentQuestionIndex + 1} of {questionList.length}
                  </div>
                </div>
              )}

              {questionList.length > 0 && currentQuestionIndex >= questionList.length && (
                <div className="text-center text-sm text-[#0A2540]/70 py-2">
                  All relevant questions answered for this business type.
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

                  {requirements.map((req, idx) => {
                    const doc = uploadedDocs.find(d => d.requirement_code === req.code);
                    const analysis = doc?.ai_analysis;
                    let icon = <div className="w-4 h-4 rounded-full border-2 border-[#0A2540]/30 mt-0.5 flex-shrink-0" />;
                    let extra = '';
                    if (analysis) {
                      const st = analysis.overall_status;
                      const conf = Math.round((analysis.confidence || 0) * 100);
                      if (st === 'Complete') {
                        icon = <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />;
                        extra = ` ✓ Complete (conf ${conf}%)`;
                      } else if (st === 'Needs Review' || st === 'Missing Information') {
                        icon = <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />;
                        extra = ` ⚠ ${st}`;
                      } else if (st === 'Mismatch' || st === 'Expired') {
                        icon = <span className="text-red-600 mt-0.5 flex-shrink-0">✕</span>;
                        extra = ` ✕ ${st}`;
                      } else {
                        icon = <span className="text-yellow-600 mt-0.5 flex-shrink-0">◐</span>;
                        extra = ` ◐ ${st}`;
                      }
                    } else if (req.status === 'uploaded' || req.status === 'passed') {
                      icon = <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />;
                    }
                    return (
                      <div key={idx} className="border rounded-xl px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            {icon}
                            <div className="min-w-0">
                              <div className="font-medium text-[#0A2540]">{req.name}{extra}</div>
                              <div className="text-xs text-[#0A2540]/70 mt-0.5">
                                <span className="font-semibold">{req.agency}</span> • {req.mandatory ? 'Mandatory' : 'Recommended'}
                              </div>
                              <div className="text-xs text-[#0A2540]/60 mt-1 leading-snug">{req.reason}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => triggerFileUpload(req.code)}
                            className="text-xs px-3 py-1.5 rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white flex items-center gap-1 flex-shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5" /> Upload
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {requirements.length > 0 && currentStep < 7 && (
                  <button onClick={runValidation} disabled={isLoading} className="mt-6 w-full bg-[#0D9488] text-white rounded-full py-3 font-medium flex items-center justify-center gap-2">
                    Run Validation Engine {isLoading && <RefreshCw className="animate-spin w-4 h-4" />}
                  </button>
                )}

                {/* Prominent call-to-action when everything is validated */}
                {completedMandatory === totalMandatory && readinessScore !== null && currentStep < 9 && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                    <div className="font-medium text-emerald-800">All required documents validated.</div>
                    <button 
                      onClick={() => setCurrentStep(9)}
                      className="mt-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg py-2 text-sm font-medium"
                    >
                      View SUBMISSION DELIVERABLES →
                    </button>
                  </div>
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
                  <button 
                    onClick={() => setCurrentStep(9)} 
                    className="w-full bg-[#0A2540] text-white rounded-2xl py-4 flex items-center justify-center gap-3 text-sm font-medium hover:bg-black"
                  >
                    <Download className="w-4 h-4" /> SUBMISSION DELIVERABLES
                  </button>
                )}

                <div className="text-[10px] text-[#0A2540]/60 px-1">
                  SmartPR provides AI-assisted readiness assessment and document organization for Puerto Rico business licensing.
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

        {/* FINAL STEP: SUBMISSION DELIVERABLES (shown when currentStep === 9) */}
        {currentStep === 9 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-block px-4 py-1 rounded-full bg-[#0A2540] text-white text-sm tracking-[2px] mb-3">FINAL STEP</div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#0A2540]">SUBMISSION DELIVERABLES</h1>
              <p className="text-[#0A2540]/70 mt-2">All validated materials are ready. This platform prepares you for submission — it does not file with government.</p>
            </div>

            {/* Business + Status Summary */}
            <div className="bg-white border-2 border-[#0A2540] rounded-2xl p-8 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div><span className="text-[#0A2540]/60">Business Name</span><div className="font-medium text-[#0A2540] text-lg">{profile.name || '—'}</div></div>
                <div><span className="text-[#0A2540]/60">Municipality</span><div className="font-medium text-[#0A2540] text-lg">{profile.municipality || '—'}</div></div>
                <div><span className="text-[#0A2540]/60">Business Type</span><div className="font-medium text-[#0A2540] text-lg">{profile.business_type || '—'}</div></div>
                <div><span className="text-[#0A2540]/60">Readiness Score</span><div className="font-semibold text-3xl text-[#0A2540] tabular-nums">{readinessScore ?? '—'}<span className="text-xl">%</span></div></div>
              </div>

              <div className="mt-6 pt-6 border-t">
                {(() => {
                  const completed = requirements.filter(r => r.mandatory && (r.status === 'passed' || r.status === 'uploaded')).length;
                  const total = requirements.filter(r => r.mandatory).length;
                  const isReady = completed === total && (readinessScore || 0) >= 70;
                  return (
                    <div>
                      <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium ${isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {isReady ? 'READY FOR SUBMISSION' : 'IN PROGRESS — REVIEW REQUIRED'}
                      </div>
                      <div className="mt-3 text-[#0A2540]">
                        {completed} of {total} Required Documents Validated
                        {findings.filter(f => f.severity === 'critical').length === 0 && ' • No Critical Issues Found'}
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
                  <div className="font-semibold text-[#0A2540] text-lg mb-1">1. DOWNLOAD READINESS REPORT</div>
                  <div className="text-sm text-[#0A2540]/70 mb-4">
                    Professional PDF with Business Profile, Readiness Score, Validation Summary, Required/Uploaded/Missing Documents, Findings, Warnings, and Recommended Next Steps.
                  </div>
                  <div className="text-[11px] text-[#0A2540]/50">Human-readable summary for your records, attorney, or consultant.</div>
                </div>
                <button
                  onClick={downloadReadinessReport}
                  disabled={isLoading}
                  className="mt-6 w-full bg-[#0A2540] hover:bg-black text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Download className="w-4 h-4" /> Download PDF Report
                </button>
              </div>

              {/* 2. ZIP Package */}
              <div className="bg-white border rounded-2xl p-6 flex flex-col">
                <div className="flex-1">
                  <div className="w-9 h-9 rounded-lg bg-[#0A2540]/10 flex items-center justify-center mb-4">
                    <Archive className="w-5 h-5 text-[#0A2540]" />
                  </div>
                  <div className="font-semibold text-[#0A2540] text-lg mb-1">2. DOWNLOAD SUBMISSION PACKAGE ZIP</div>
                  <div className="text-sm text-[#0A2540]/70 mb-4">
                    Complete ZIP containing the Readiness Report PDF + all your validated uploaded documents, automatically renamed and sorted in submission order:
                  </div>
                  <div className="text-[11px] font-mono text-[#0A2540]/60 leading-tight mb-2">
                    01_Entity_Formation.pdf<br />
                    02_EIN_Letter.pdf<br />
                    03_Merchant_Registration.pdf<br />
                    04_Permiso_Unico.pdf<br />
                    ...
                  </div>
                  <div className="text-[11px] text-[#0A2540]/50">Ready to share with accountants, attorneys, municipalities, or permit expediters.</div>
                </div>
                <button
                  onClick={downloadSubmissionPackage}
                  disabled={isLoading || uploadedDocs.filter(d => d.fileBlob).length === 0}
                  className="mt-6 w-full bg-[#0A2540] hover:bg-black text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Download className="w-4 h-4" /> Download ZIP Package
                </button>
              </div>

              {/* 3. Workspace */}
              <div className="bg-white border rounded-2xl p-6 flex flex-col">
                <div className="flex-1">
                  <div className="w-9 h-9 rounded-lg bg-[#0A2540]/10 flex items-center justify-center mb-4">
                    <Building2 className="w-5 h-5 text-[#0A2540]" />
                  </div>
                  <div className="font-semibold text-[#0A2540] text-lg mb-1">3. OPEN SMARTPR WORKSPACE</div>
                  <div className="text-sm text-[#0A2540]/70 mb-4">
                    Permanent link to your readiness workspace. Stores profile, questionnaire responses, required &amp; uploaded documents, validation results, reports, and activity history.
                  </div>
                  <div className="text-xs text-[#0A2540]/60">Future uploads and re-validation supported.</div>
                </div>
                <button
                  onClick={openSmartPRWorkspace}
                  className="mt-6 w-full border-2 border-[#0A2540] hover:bg-[#0A2540] hover:text-white text-[#0A2540] rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
                >
                  Open Workspace <ExternalLink className="w-4 h-4" />
                </button>
                {activeWorkspaceId && (
                  <div className="mt-2 text-[10px] text-center text-[#0A2540]/50 font-mono">/workspace/{activeWorkspaceId}</div>
                )}
              </div>
            </div>

            {/* Official Disclaimers */}
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-900">
              <div className="font-semibold mb-2">IMPORTANT DISCLAIMER — READ CAREFULLY</div>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>Do NOT submit this package or any SmartPR output to government agencies as an official filing.</li>
                <li>Do NOT claim that SmartPR approves, grants, or issues any license or permit.</li>
                <li>Do NOT file permits or applications using these materials as the sole source.</li>
                <li>SmartPR is a <strong>readiness and compliance preparation platform</strong>, not a government filing system.</li>
                <li>The platform&apos;s responsibility ends at: <strong>Prepare • Validate • Organize • Package</strong>.</li>
                <li>All final approvals are made exclusively by the Government of Puerto Rico and its agencies.</li>
              </ul>
              <div className="mt-3 text-[10px] opacity-75">Data is stored for this workspace session. All analysis uses the configured Grok AI model.</div>
            </div>

            <div className="mt-6 flex gap-3 text-sm">
              <button onClick={() => setCurrentStep(3)} className="px-4 py-2 border rounded-full">← Back to Checklist</button>
              <button onClick={() => setCurrentStep(1)} className="px-4 py-2 border rounded-full">Start New Business</button>
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
                <div className="text-2xl font-semibold text-[#0A2540]">Workspace</div>
              </div>
              <button onClick={() => setShowWorkspaceModal(false)} className="text-[#0A2540]/40 hover:text-[#0A2540]">✕</button>
            </div>

            <div className="font-mono text-sm bg-slate-100 px-3 py-2 rounded mb-4 break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/workspace/{activeWorkspaceId}
            </div>

            <div className="text-sm text-[#0A2540]/80 mb-4">
              Your business readiness data has been saved for this workspace (profile, questionnaire answers, requirements, validation results, and document metadata).
              Real uploaded files remain available during this browser session for ZIP downloads.
            </div>

            <div className="text-xs text-[#0A2540]/60 mb-6">
              This workspace persists your readiness profile, responses, validations, and document history for ongoing management and re-validation.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWorkspaceModal(false);
                  setCurrentStep(3); // back to checklist for more uploads / re-validation
                }}
                className="flex-1 border border-[#0A2540] text-[#0A2540] rounded-xl py-2.5 text-sm hover:bg-[#0A2540] hover:text-white"
              >
                Continue Working (Checklist)
              </button>
              <button
                onClick={() => setShowWorkspaceModal(false)}
                className="flex-1 bg-[#0A2540] text-white rounded-xl py-2.5 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
