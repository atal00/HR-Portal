export interface DocumentSignatorySnapshot {
  name?: string;
  title?: string;
  department?: string;
  company?: string;
  signature_url?: string;
  version?: number;
}

export interface DocumentStampSnapshot {
  stamp_url?: string;
  version?: number;
}

export interface OfferLetterData {
  offerType: 'direct-fulltime' | 'fulltime-after-intern' | 'internship' | 'revised-offer';
  offerDate: string;
  candidateName: string;
  candidateAddress: string;
  designation: string;
  department: string;
  joiningDate: string;
  employeeCode: string;
  annualCtc: number;
  annualCtcWords: string;
  
  // Employment Bond Decision & Configuration
  bondIncluded?: boolean;
  bondPeriodMonths?: number;
  bondPenaltyAmount?: number;
  bondTerms?: string;
  bondEffectiveDate?: string;
  noticePeriodMonths: number;
  
  // Controlled Custom Authorized Clause
  additionalClauses?: string;

  // Salary Hike / Revision Workflow
  isSalaryRevision?: boolean;
  previousCtc?: number;
  revisedCtc?: number;
  revisionEffectiveDate?: string;
  previousDocumentNumber?: string;
  
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

  // Net In-Hand Calculation & Controlled Override Snapshot (Requirement E)
  calculatedNetInHand?: number;
  finalNetInHand?: number;
  netInHandMode?: 'AUTO' | 'MANUAL';
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;

  // Controlled Offer Letter Typography Setting (Requirement 5)
  fontFamily?: 'default' | 'old-style' | 'typewriter';

  // Signatory & Stamp Snapshot
  signatory?: DocumentSignatorySnapshot;
  stamp?: DocumentStampSnapshot;

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
  tenureText?: string; // e.g. "1 year, 8 months"
  employmentType: string;
  workLocation: string;
  conductAppreciation: string;
  additionalStatement?: string; // Controlled editable issuer wording
  customStatement?: string; // Controlled editable issuer wording alias
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
  signatory?: DocumentSignatorySnapshot;
  stamp?: DocumentStampSnapshot;
}

export interface RelievingLetterData {
  issueDate: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  joiningDate: string;
  lastWorkingDate: string;
  tenureText?: string; // e.g. "1 year, 8 months"
  employmentType: string;
  workLocation: string;
  resignationDate?: string;
  relievingDate: string;
  clearanceStatus: string;
  additionalRemarks?: string; // Controlled editable issuer wording
  customStatement?: string; // Controlled editable issuer wording alias
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
  signatory?: DocumentSignatorySnapshot;
  stamp?: DocumentStampSnapshot;
}

export interface SalarySlipData {
  month: string; // e.g. "September"
  year: number;  // e.g. 2026
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  joiningDate: string;
  bankName?: string;
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
  signatory?: DocumentSignatorySnapshot;
  stamp?: DocumentStampSnapshot;
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
  companyName: string;      // "Varsaka Labs"
  verificationUrl: string;  // canonical URL with verification ID
  signatory?: DocumentSignatorySnapshot;
  stamp?: DocumentStampSnapshot;
}
