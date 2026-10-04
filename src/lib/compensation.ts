// ==============================================================================
// VARSAKA HR DOCUMENT MANAGEMENT & VERIFICATION PORTAL
// Authoritative Shared Compensation Calculation Utility
// ==============================================================================
// Single source of truth for salary calculations across:
// - Salary & Compensation Module
// - Offer Letter Generator
// - Salary Slip
// - Employee Onboarding / Profile
// ==============================================================================

import { numberToWordsINR } from './utils';

export interface SalaryBreakdownResult {
  annualCtc: number;
  variablePay: number;
  monthlyGross: number;
  basic: number;
  hra: number;
  communicationAllowance: number;
  travelAllowance: number;
  foodAllowance: number;
  otherAllowances: number;
  employeePf: number;
  employerPf: number;
  professionalTax: number;
  gratuity: number;
  tds: number;
  totalDeductions: number;
  netSalary: number;
  netSalaryWords: string;
  annualCtcWords: string;
}

export interface NetInHandCalculationInput {
  monthlyGross: number;
  employeePf: number;
  employerPf?: number;
  professionalTax: number;
  gratuity?: number;
  tds?: number;
  esic?: number;
  otherDeductions?: number;
}

export interface NetInHandCalculationResult {
  totalDeductions: number;
  netSalary: number;
  netSalaryWords: string;
}

/**
 * Authoritative Indian CTC Compensation Calculation Formula (Varsaka Labs standard)
 * 
 * Standard Structure:
 * - Gross = (Annual CTC - Variable Pay) / 12
 * - Basic = 40% of Gross
 * - HRA = 50% of Basic (20% of Gross)
 * - Remaining allowances distributed across Communication, Travel, Food, and Other Allowances
 * - Employee PF = 12% of Basic up to stat limit (capped at 1,800 if basic > 15,000)
 * - Employer PF = Matching 12% (statutory contribution)
 * - Professional Tax = ₹200 (>20k gross) or ₹150 (>15k)
 * - Gratuity = (Basic * 15) / (26 * 12)
 * - TDS = Estimated based on annual slab
 * 
 * Monthly Net In-Hand = Monthly Gross - Total Deductions
 */
export function calculateCompensation(annualCtc: number, variablePay: number = 0): SalaryBreakdownResult {
  const safeAnnualCtc = Math.max(0, Number(annualCtc) || 0);
  const safeVariable = Math.max(0, Number(variablePay) || 0);
  const fixedAnnual = Math.max(0, safeAnnualCtc - safeVariable);
  const monthlyGross = Math.round(fixedAnnual / 12);

  // Basic: 40% of Gross
  const basic = Math.round(monthlyGross * 0.40);
  // HRA: 50% of Basic (20% of Gross)
  const hra = Math.round(basic * 0.50);

  // Allowances balance across Communication, Travel, Food, Other (10% each)
  const remainingAllowance = Math.max(0, monthlyGross - basic - hra);
  const communicationAllowance = Math.round(remainingAllowance * 0.25);
  const travelAllowance = Math.round(remainingAllowance * 0.25);
  const foodAllowance = Math.round(remainingAllowance * 0.25);
  const otherAllowances = Math.max(0, remainingAllowance - (communicationAllowance * 3));

  // Statutory Deductions
  const employeePf = basic > 15000 ? 1800 : Math.round(basic * 0.12);
  const employerPf = employeePf;
  const professionalTax = monthlyGross > 20000 ? 200 : (monthlyGross > 15000 ? 150 : 0);
  const gratuity = Math.round((basic * 15) / (26 * 12)); // Statutory Gratuity provision
  const tds = safeAnnualCtc > 750000 ? Math.round(((safeAnnualCtc - 750000) * 0.10) / 12) : 0;

  const totalDeductions = employeePf + employerPf + professionalTax + gratuity + tds;
  const netSalary = Math.max(0, monthlyGross - totalDeductions);

  return {
    annualCtc: safeAnnualCtc,
    variablePay: safeVariable,
    monthlyGross,
    basic,
    hra,
    communicationAllowance,
    travelAllowance,
    foodAllowance,
    otherAllowances,
    employeePf,
    employerPf,
    professionalTax,
    gratuity,
    tds,
    totalDeductions,
    netSalary,
    netSalaryWords: numberToWordsINR(netSalary),
    annualCtcWords: numberToWordsINR(safeAnnualCtc),
  };
}

/**
 * Calculates Net In-Hand and Total Deductions from explicit component inputs.
 * Ensures 100% mathematical parity across Offer Letter, Salary Slip, and Compensation Module.
 * 
 * Example:
 * Monthly Gross: ₹50,000
 * Employee PF: ₹1,800
 * Employer PF: ₹1,800
 * Professional Tax: ₹200
 * Gratuity: ₹962
 * Total Deductions = ₹4,762
 * Net In-Hand = ₹50,000 - ₹4,762 = ₹45,238
 */
export function calculateNetInHand(input: NetInHandCalculationInput): NetInHandCalculationResult {
  const gross = Math.max(0, Number(input.monthlyGross) || 0);
  const empPf = Math.max(0, Number(input.employeePf) || 0);
  const emplyrPf = Math.max(0, Number(input.employerPf) || 0);
  const pt = Math.max(0, Number(input.professionalTax) || 0);
  const grat = Math.max(0, Number(input.gratuity) || 0);
  const tds = Math.max(0, Number(input.tds) || 0);
  const esic = Math.max(0, Number(input.esic) || 0);
  const otherDed = Math.max(0, Number(input.otherDeductions) || 0);

  const totalDeductions = empPf + emplyrPf + pt + grat + tds + esic + otherDed;
  const netSalary = Math.max(0, gross - totalDeductions);

  return {
    totalDeductions,
    netSalary,
    netSalaryWords: numberToWordsINR(netSalary),
  };
}
