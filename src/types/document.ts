// ==============================================================================
// Specific Document Schemas & Payloads
// ==============================================================================

export interface OfferLetterData {
  offerType: 'direct-fulltime' | 'fulltime-after-intern' | 'internship';
  offerDate: string;
  candidateName: string;
  candidateAddress: string;
  designation: string;
  department: string;
  joiningDate: string;
  employeeCode: string;
  annualCtc: number;
  annualCtcWords: string;
  bondPeriodMonths: number;
  bondPenaltyAmount: number;
  noticePeriodMonths: number;
  
  // Monthly Breakdown
  basic: number;
  hra: number;
  communicationAllowance: number;
  travelAllowance: number;
  foodAllowance: number;
  otherAllowances: number;
  monthlyGrossSalary: number;
  
  // Deductions
  employeePf: number;
  employerPf: number;
  professionalTax: number;
  gratuity: number;
  tds: number;
  monthlyNetSalary: number;
  yearlyVariable: number;

  // Internship Specific (if applicable)
  internDuration?: string;
  internStipend?: number;
  internNoticePeriod?: string;
}

export interface ExperienceLetterData {
  issueDate: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  joiningDate: string;
  lastWorkingDate: string;
  employmentType: string;
  workLocation: string;
  conductAppreciation: string;
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
}

export interface SalarySlipData {
  month: string; // e.g. "September"
  year: number;  // e.g. 2026
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  joiningDate: string;
  bankAccountNumber?: string;
  panNumber?: string;
  pfNumber?: string;
  paidDays: number;
  lossOfPayDays: number;
  
  // Earnings
  basic: number;
  hra: number;
  communicationAllowance: number;
  travelAllowance: number;
  foodAllowance: number;
  otherAllowances: number;
  grossSalary: number;

  // Deductions
  employeePf: number;
  employerPf: number;
  professionalTax: number;
  gratuity: number;
  tds: number;
  totalDeductions: number;

  netSalary: number;
  netSalaryInWords: string;
}

export interface CertificateData {
  certificateType: 'INTERNSHIP_COMPLETION' | 'PROJECT_EXCELLENCE' | 'APPRECIATION';
  candidateName: string;
  projectTitle: string;
  mentorName: string;
  performanceGrade: string; // e.g. "Grade 78" or "Grade A / Outstanding"
  tenureStartDate: string;  // e.g. "12 Jun, 2024"
  tenureEndDate: string;    // e.g. "12 Aug, 2024"
  workLocation: string;     // e.g. "New Delhi / Work from Home"
  issueDate: string;        // e.g. "06 Sep, 2024"
  authorizedSignatory: string; // "Authorized Signatory, HR Department"
  companyName: string;      // "Varsaka Labs Pvt. Ltd."
  verificationUrl: string;  // canonical URL with verification ID
}
