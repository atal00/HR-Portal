import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatNumber(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return "0";
  return new Intl.NumberFormat("en-IN").format(Number(amount));
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Converts numeric INR amount into official words
 * e.g. 500000 -> "Five Lakh Rupees Only"
 */
export function numberToWordsINR(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "Zero Rupees Only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", 
    "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", 
    "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    if (n === 0) return "";
    let str = "";
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + "Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + "Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + "Thousand ";
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + "Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (str !== "") str += "and ";
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : " ");
      }
    }
    return str;
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = inWords(integerPart).trim() + " Rupees";
  if (decimalPart > 0) {
    result += " and " + inWords(decimalPart).trim() + " Paise";
  }
  return result + " Only";
}

/**
 * Standard Indian CTC Auto-Calculation Formula (Varsaka Labs standard)
 */
export function calculateSalaryBreakdown(annualCtc: number, variablePay: number = 0) {
  const fixedAnnual = Math.max(0, annualCtc - variablePay);
  const monthlyGross = Math.round(fixedAnnual / 12);
  
  // Basic: 40% of Gross
  const basic = Math.round(monthlyGross * 0.40);
  // HRA: 50% of Basic (20% of Gross)
  const hra = Math.round(basic * 0.50);
  
  // Balanced remainder across allowances (10% each)
  const remainingAllowance = Math.max(0, monthlyGross - basic - hra);
  const communicationAllowance = Math.round(remainingAllowance * 0.25);
  const travelAllowance = Math.round(remainingAllowance * 0.25);
  const foodAllowance = Math.round(remainingAllowance * 0.25);
  const otherAllowances = Math.max(0, remainingAllowance - (communicationAllowance * 3));

  // Deductions
  const employeePf = basic > 15000 ? 1800 : Math.round(basic * 0.12);
  const employerPf = employeePf;
  const professionalTax = monthlyGross > 20000 ? 200 : (monthlyGross > 15000 ? 150 : 0);
  const gratuity = Math.round((basic * 15) / (26 * 12)); // Statutory Gratuity provision
  const tds = annualCtc > 750000 ? Math.round(((annualCtc - 750000) * 0.10) / 12) : 0;

  const totalDeductions = employeePf + employerPf + professionalTax + gratuity + tds;
  const netSalary = Math.max(0, monthlyGross - totalDeductions);

  return {
    annualCtc,
    variablePay,
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
    annualCtcWords: numberToWordsINR(annualCtc),
  };
}

/**
 * Dynamically calculates tenure between joining date and relieving/end date
 * Example: 20 Jan 2025 -> 01 Oct 2026 => "1 year, 8 months"
 */
export function calculateTenure(startDateStr?: string | null, endDateStr?: string | null): string {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }
  if (parts.length === 0) {
    return 'Less than 1 month';
  }
  return parts.join(', ');
}

/**
 * Returns the environment-configured canonical public verification base URL.
 * Automatically adapts across deployment domains without code modification.
 */
export function getPublicVerificationBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL || process.env.PUBLIC_VERIFICATION_BASE_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl && appUrl.trim()) {
    return appUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

/**
 * Validates that the public verification base URL is legitimate for production use
 */
export function validateVerificationDomain(isProduction: boolean = false): { valid: boolean; url: string; error?: string } {
  const url = getPublicVerificationBaseUrl();
  if (isProduction) {
    if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
      return {
        valid: false,
        url,
        error: 'CRITICAL CONFIGURATION ERROR: Public verification domain is not configured for production. Refusing to issue official QR verification URL with unverified domain.',
      };
    }
  }
  return { valid: true, url };
}

/**
 * Formats bank account number with privacy masking, showing only the last 4 digits
 * e.g. "1234567890", "HDFC Bank" -> "HDFC Bank - •••• 7890"
 */
export function maskBankNumber(accountNumber?: string, bankName?: string): string {
  if (!accountNumber) return '';
  const trimmed = accountNumber.trim();
  const last4 = trimmed.slice(-4);
  const prefix = bankName ? `${bankName} - ` : '';
  return `${prefix}••••${last4}`;
}

/**
 * Safely masks PAN number for presentation: e.g. "ABCDE1234F" -> "••••••1234" (or "ABCDE••••F" with middle mode)
 */
export function maskPanNumber(pan?: string): string {
  if (!pan) return '';
  const trimmed = pan.trim().toUpperCase();
  if (trimmed.length === 10) {
    return `••••••${trimmed.slice(5, 9)}`;
  }
  return trimmed;
}

