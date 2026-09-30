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
