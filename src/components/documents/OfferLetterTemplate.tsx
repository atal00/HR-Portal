import React from 'react';
import { OfferLetterData } from '@/types/document';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  data: OfferLetterData;
  documentNumber?: string;
  verificationId?: string;
  verificationUrl?: string;
}

export const OfferLetterTemplate: React.FC<Props> = ({
  data,
  documentNumber = 'VAR-OFF-2026-000001',
  verificationId = 'VVR-OFF-PREVIEW',
  verificationUrl = 'http://localhost:3000/verify/VVR-OFF-PREVIEW',
}) => {
  const firstName = data.candidateName.split(' ')[0] || data.candidateName;

  return (
    <div className="bg-white text-slate-900 font-sans text-[11pt] leading-relaxed max-w-[850px] mx-auto shadow-sm print:shadow-none print:max-w-full">
      
      {/* ========================================================================= */}
      {/* PAGE 1: OFFER LETTER COVER & INTRODUCTION                                */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-blue-900 pb-4 mb-6">
            <div className="flex items-center gap-4">
              <img 
                src="/brand/varsaka-logo.png" 
                alt="Varsaka Labs" 
                width={64}
                height={64}
                style={{ height: '64px', width: 'auto', maxHeight: '64px' }}
                className="h-16 w-auto object-contain shrink-0" 
              />
              <div>
                <h1 className="text-2xl font-black text-blue-950 tracking-wider">VARSAKA LABS</h1>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest">
                  {data.offerType === 'internship' ? 'Internship Offer Letter' : 'Full-Time Employment Offer'}
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div className="font-mono font-semibold text-slate-800">{documentNumber}</div>
              <div>Ref: VL/HR/OFF/{new Date().getFullYear()}</div>
            </div>
          </div>

          {/* Date & Address */}
          <div className="mb-6 text-sm">
            <div className="font-semibold text-slate-700">{formatDate(data.offerDate)}</div>
            <div className="mt-3 font-semibold text-slate-900">Mr./Ms. {data.candidateName},</div>
            <div className="text-slate-600 whitespace-pre-line text-xs mt-1 leading-relaxed">
              {data.candidateAddress}
            </div>
            <div className="mt-4 font-bold text-slate-900">
              Dear {firstName},
            </div>
          </div>

          {/* Letter Body */}
          <div className="space-y-4 text-justify text-sm leading-relaxed text-slate-800">
            {data.offerType === 'internship' ? (
              <>
                <p>
                  We are delighted to offer you an internship opportunity as a <strong>{data.designation}</strong> Intern at Varsaka Labs. Your joining date will be <strong>{formatDate(data.joiningDate)}</strong>.
                </p>
                <p>
                  During your internship, which will run for a duration of <strong>{data.internDuration || '6 months'}</strong>, you will be reporting directly to your respective Manager. You will be provided with a monthly stipend of <strong>{formatCurrency(data.internStipend || 15000)}/-</strong> during this period.
                </p>
                <p>
                  This internship is designed to evaluate your skills, dedication, and alignment with our company values. We offer a <strong>Pre-Placement Offer (PPO)</strong> based strictly on your performance during the internship period. Upon successful completion and meeting all performance metrics, you may be considered for a full-time role.
                </p>
                <p>
                  If you wish to terminate this internship before completion, a notice period of <strong>{data.internNoticePeriod || '15 days'}</strong> must be served.
                </p>
              </>
            ) : (
              <>
                <p>
                  With reference to your application and subsequent interviews with us, Varsaka Labs is pleased to offer you the position of <strong>{data.designation}</strong>; your joining date is <strong>{formatDate(data.joiningDate)}</strong>.
                </p>
                <p>
                  Your compensation will be an annual CTC of <strong>{formatCurrency(data.annualCtc)} ({data.annualCtcWords})</strong>. Please refer to <strong>Annexure 1A</strong> for the comprehensive salary structure.
                </p>
                <p>
                  If you resign within three months of receiving this employment offer, three months of notice period has to be served. Any salary adjustments will be reflected in subsequent payments time.
                </p>
                <p>
                  Your employment with Varsaka Labs will be considered subject to verification of all your documents and reference checks and also based on company policies, procedures, and other rules currently applicable in India, which are subject to amendments and adjustments from time to time.
                </p>
              </>
            )}

            <p className="font-semibold text-slate-900 pt-2">Also provided with this offer letter are:</p>
            <div className="bg-slate-50 p-4 rounded border border-slate-200 text-xs space-y-1 font-medium text-slate-700">
              <div>Annexure – I B (Checklist of documents to be submitted)</div>
              <div>Annexure - II A (Terms and Conditions of Employment)</div>
              <div>Annexure - II B (Confidentiality and Non-Disclosure Agreement)</div>
              <div>Annexure – II C (Work from Home Guideline’s Acceptance and Agreement)</div>
              <div>Annexure – II D (Social Media Guidelines and Agreement)</div>
              <div>Annexure – III A (Job Description)</div>
              <div>Annexure – III B (Performance Measurement Agreement)</div>
            </div>
          </div>
        </div>

        {/* Running Footer */}
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="text-[8pt] text-slate-400 mt-1">
            Email: info@varsakalabs.com &nbsp;|&nbsp; Web: https://varsaka.com/ &nbsp;|&nbsp; Phone: +91 40 6000 0000
          </div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 1 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2: BOND PERIOD & ACCEPTANCE SIGNATURES                              */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
            <img 
              src="/brand/varsaka-logo.png" 
              alt="Varsaka Labs" 
              width={40}
              height={40}
              style={{ height: '40px', width: 'auto', maxHeight: '40px' }}
              className="h-10 w-auto object-contain shrink-0" 
            />
            <span className="text-xs font-mono text-slate-400">{documentNumber}</span>
          </div>

          <div className="space-y-4 text-justify text-sm leading-relaxed text-slate-800">
            <p>
              We expect that your commitment, dedication, and technical expertise will drive the organization to greater heights and provide growth opportunities for you on the professional front. We are confident that you and Varsaka Labs will make a great team going forward. If you have any questions, please do not hesitate to contact us.
            </p>

            <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-md my-4">
              <h3 className="font-bold text-blue-950 underline mb-2">Bond Period: {data.bondPeriodMonths || 24} months</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-blue-900">
                <li>You will sign the bond period of <strong>{data.bondPeriodMonths || 24} months</strong> from your date of joining in the organization.</li>
                <li>You must pay the company <strong>{formatCurrency(data.bondPenaltyAmount || 300000)}</strong> if the bond is broken by you.</li>
              </ul>
            </div>

            <p>
              Please send us an email confirming receipt of this offer letter as a token of acceptance of the terms and conditions mentioned therein.
            </p>
            <p>
              Again, congratulations and welcome to the Varsaka Labs family.
            </p>

            <div className="pt-4">
              <p>Thank you,</p>
              <p className="font-bold text-blue-950">For Varsaka Labs Pvt. Ltd.</p>
            </div>

            {/* Dual Signatures */}
            <div className="pt-16 flex items-end justify-between">
              <div className="w-64 border-t border-slate-900 pt-2 text-xs">
                <div className="h-12 flex items-center">
                  <img 
                    src="/brand/sign.jpeg" 
                    alt="Sign" 
                    width={100}
                    height={40}
                    style={{ height: '40px', width: 'auto', maxHeight: '40px' }}
                    className="h-10 w-auto opacity-80" 
                  />
                </div>
                <div className="font-bold text-blue-950 uppercase tracking-wide">Authorized Signatory</div>
                <div className="text-slate-600">Varsaka Labs Pvt. Ltd.</div>
                <div className="text-[8pt] text-slate-400 italic">(Signature & Corporate Seal)</div>
              </div>

              <div className="w-64 border-t border-slate-900 pt-2 text-xs text-right">
                <div className="h-12"></div>
                <div className="font-bold text-blue-950 uppercase tracking-wide">Accepted By</div>
                <div className="text-slate-800 font-semibold">{data.candidateName}</div>
                <div className="text-[8pt] text-slate-400 italic">(Candidate Signature & Date)</div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 2 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 3: ANNEXURE I A - SALARY STRUCTURE                                 */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <img 
              src="/brand/varsaka-logo.png" 
              alt="Varsaka Labs" 
              width={40} 
              height={40} 
              style={{ height: '40px', width: 'auto', maxHeight: '40px' }} 
              className="h-10 w-auto object-contain shrink-0" 
            />
            <span className="text-xs font-mono text-slate-400">{documentNumber}</span>
          </div>

          <h2 className="text-lg font-bold text-center text-blue-950 underline mb-4">
            Annexure I A: Salary Structure
          </h2>

          <div className="bg-slate-50 border border-slate-300 rounded p-3 mb-4 text-xs grid grid-cols-2 gap-2">
            <div><strong>Employee Name:</strong> {data.candidateName}</div>
            <div><strong>Employee Code:</strong> {data.employeeCode}</div>
            <div><strong>Designation:</strong> {data.designation}</div>
            <div><strong>Department:</strong> {data.department}</div>
          </div>

          {/* Salary Table */}
          <table className="w-full text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-blue-950 text-white font-semibold">
                <th className="p-2 text-left border border-slate-300">Salary Component</th>
                <th className="p-2 text-right border border-slate-300 w-44">Monthly (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              <tr>
                <td className="p-2 border border-slate-300">Basic Earnings</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{formatCurrency(data.basic)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300">House Rent Allowance (HRA)</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{formatCurrency(data.hra)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300">Communication & Internet Allowance</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{formatCurrency(data.communicationAllowance)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300">Travel Allowance</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{formatCurrency(data.travelAllowance)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300">Food Allowance</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{formatCurrency(data.foodAllowance)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300">Other Allowances</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{formatCurrency(data.otherAllowances)}</td>
              </tr>
              <tr className="bg-blue-50/70 font-bold text-blue-950">
                <td className="p-2 border border-slate-300">Monthly Gross Salary</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{formatCurrency(data.monthlyGrossSalary)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 text-red-800">(-) PF Contribution of Employee</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-red-800">{formatCurrency(data.employeePf)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 text-red-800">(-) PF Contribution of Employer</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-red-800">{formatCurrency(data.employerPf)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 text-red-800">(-) Professional Tax (PT)</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-red-800">{formatCurrency(data.professionalTax)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 text-red-800">(-) Gratuity Provision</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-red-800">{formatCurrency(data.gratuity)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 text-red-800">(-) Tax Deducted at Source (TDS)</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-red-800">{formatCurrency(data.tds)}</td>
              </tr>
              <tr className="bg-emerald-50/80 font-bold text-emerald-950">
                <td className="p-2 border border-slate-300">Monthly Net Salary (Take-home)</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-emerald-800">{formatCurrency(data.monthlyNetSalary)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300">Yearly Variable Component</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{formatCurrency(data.yearlyVariable)}</td>
              </tr>
              <tr className="bg-slate-900 text-white font-bold text-sm">
                <td className="p-3 border border-slate-400">
                  Total Annual Cost to Company (CTC)<br />
                  <span className="text-[9pt] font-normal text-slate-300">({data.annualCtcWords})</span>
                </td>
                <td className="p-3 border border-slate-400 text-right font-mono text-emerald-400 text-base">
                  {formatCurrency(data.annualCtc)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-[9pt] text-amber-900 leading-normal">
            <strong>Tax & Deductions Disclaimer:</strong> Statutory tax deductions like PF, professional tax, and income tax are subject to prevailing government regulations. Tax calculations are based on statutory declarations submitted.
          </div>
        </div>

        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 3 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 4: ANNEXURE I B - DOCUMENT CHECKLIST                                */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <img 
              src="/brand/varsaka-logo.png" 
              alt="Varsaka Labs" 
              width={40} 
              height={40} 
              style={{ height: '40px', width: 'auto', maxHeight: '40px' }} 
              className="h-10 w-auto object-contain shrink-0" 
            />
            <span className="text-xs font-mono text-slate-400">{documentNumber}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded text-xs space-y-2 mb-6">
            <h4 className="font-bold text-slate-900 underline">Important Operational Notes:</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>Variable pay will be paid with the 13th, 14th, and 15th month payroll upon performance appraisal.</li>
              <li>Standard tax deductions like PF, professional tax, etc. will be made on the monthly gross salary.</li>
              <li>Please note that it is not a remote job; you are expected to work from an office location unless explicitly authorized.</li>
              <li>Please submit your internet connection bill copy to avail communication allowance by the 30th of every month (minimum 50 Mbps).</li>
              <li>Your working hours are governed by applicable law and organizational exigencies.</li>
              <li>Please mention your acceptance with signature on each page.</li>
            </ul>
          </div>

          <h2 className="text-base font-bold text-blue-950 underline mb-3">
            Annexure I B: Checklist of Documents to be Submitted
          </h2>
          <p className="text-xs text-slate-600 mb-4">
            You are expected to furnish us the following mentioned documents (whichever are applicable) by your date of joining with us:
          </p>

          <div className="grid grid-cols-1 gap-2 text-xs text-slate-800">
            {[
              'Offer letters and relieving letters from all previous employers (if any)',
              'Experience letters from all previous employers (if any)',
              "Last 3 months' salary slips from the most recent employer (if any)",
              'Last 6 months’ bank statements if you have previous work experience',
              'Proofs of Academic Qualification (Class 10 equivalent and above, Degree certificates)',
              'Passport size photographs (3 copies)',
              'Government Identity Proof (Aadhaar Card / Voter ID)',
              'Address Proof (Electricity bill / Rental agreement)',
              'Permanent Account Number (PAN Card)',
              'Photocopy of Passport (first and last pages)',
              'Form 16 / Tax deduction certificate from previous employer',
              'Internet broadband connection bill copy (for remote/hybrid allowance validation)',
              'Medical Fitness Certificate from registered medical practitioner',
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 border border-slate-200 rounded bg-white">
                <span className="h-4 w-4 rounded-sm border border-slate-400 flex items-center justify-center text-[10px] font-bold text-blue-600">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 4 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGES 5-9: ANNEXURE II A - TERMS AND CONDITIONS                          */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II A: Terms and Conditions of Employment (Part 1)
          </h2>
          <div className="space-y-3 text-xs leading-relaxed text-justify text-slate-800">
            <p><strong>1. Background Verification:</strong> The Company will have the right to carry out background checks on the documents and information provided by you after your reporting at our office. As a result of reference checks or any subsequent inputs, if any information or documents supplied by you are found to be false or misleading, this employment contract will be rendered null and void, and you will be liable to pay/repay all the expenses borne by the company towards your hire, relocation, onboarding, training, and any salary paid to you.</p>
            <p><strong>2. Company’s Right to Information:</strong> Any false or misrepresented information or any willfully suppressed material information can lead to your termination from the services of the company, without any notice. You are requested to keep Varsaka Labs informed of any changes related to personal particulars, such as address (permanent and temporary), contact telephone number (mobile and landline—if any), additional qualifications, marital status, etc.</p>
            <p><strong>3. Confidential Information:</strong> You are restricted from divulging, communicating, or passing on any information in any form linked to the company in any way to anyone not employed by the company. You are required to sign the Confidentiality and Non-Disclosure Agreement given in Annexure II B. Indulgence in such activity shall render you liable for termination with immediate effect, notwithstanding any other terms and conditions mentioned in the appointment letter.</p>
            <p><strong>4. Transfer and Deputation:</strong> It is a condition of employment that you can be transferred / deputed to any office / division / project of Varsaka Labs and / or its subsidiaries / associates or clients across India or abroad, on the exigencies of business and company needs. Such transfers and deputations will not award you the right to demand a revision in your compensation or other terms and conditions of employment, but the company may provide you the Basic Facilities / Added Compensation / Expenses Reimbursement in addition to your salary as per the existing company policies applicable at that time.</p>
            <p><strong>5. Responsibility:</strong> In view of the responsibility entrusted upon you by us, we expect you to perform, in turn ensuring the right results. You shall be expected “to do what it takes” to ensure that you deliver high-quality work and keep up commitments made to supervisors/clients (internal and external). You may also be required to work in shifts depending on the project or organizational requirements.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 5 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II A: Terms and Conditions of Employment (Part 2)
          </h2>
          <div className="space-y-3 text-xs leading-relaxed text-justify text-slate-800">
            <p><strong>6. Company Property:</strong> You shall be responsible for the safekeeping and return in good condition and order of all Varsaka Labs property, which is in your possession, use, custody, or charge. If you are found guilty at any point in time of moral turpitude or of dishonesty in dealing with a company's material document or theft or misappropriation regardless of the value involved, your services would be terminated with immediate effect. In the event of your termination of employment with Varsaka Labs, you shall promptly return all such Varsaka Labs property in your possession on the same day.</p>
            <p><strong>7. Accountability:</strong> You are expected to adhere to all company policies and procedures, whether written or oral, and always act in the interests of the company. As an employee of Varsaka Labs, you have been vested in the authority to help you carry out your responsibilities effectively. You will be accountable and responsible for all your acts performed that are not in the interest of the company, irrespective of whether they have been caused by negligence, carelessness, oversight, ignorance of policies, or willful actions.</p>
            <p><strong>8. Claim of Damages due to Behavior Issues:</strong> If during the continuance of this agreement, you are found to be grossly negligent or careless or inefficient in performing your duties, Varsaka Labs reserves the right to terminate your services without assigning any reasons. If you have been intentionally found to be inefficient or guilty of misconduct, Varsaka Labs will have the right to recover three months’ salary plus any other expenses incurred by way of damages.</p>
            <p><strong>9. Unfair Competition:</strong> If you have been deputed / assigned to a client, you shall not seek / accept employment / contract assignment with the client(s) of the company either during such deputation or for a period of 18 months from the date of your leaving us or termination by the company. You will not, either directly or indirectly, solicit, divert, or take away any of the existing clients, employees, contractors, or consultants from Varsaka Labs. If you do not abide by this, then a penalty of INR 5 L has to be paid to Varsaka Labs.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 6 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II A: Terms and Conditions of Employment (Part 3)
          </h2>
          <div className="space-y-3 text-xs leading-relaxed text-justify text-slate-800">
            <p><strong>10. Duty to abide by all Company Agreements:</strong> All agreements, confidential and non-disclosure information, contracts, covenants, and obligations entered into by Varsaka Labs with any other person or entity are also binding on you.</p>
            <p><strong>11. Discipline:</strong> Your services will be liable for termination by way of simple discharge for the specific reasons:<br />
            a) Failure to achieve and adhere to the required performance standards.<br />
            b) Breach of the company’s standards with respect to integrity, ethics, honesty, sincerity, and loss of confidence.<br />
            c) Failure to follow the rules and regulations of the company, as defined in the standing orders.</p>
            <p><strong>12. Work From Home Consideration:</strong> You are allowed to work from home only 6 working days in a calendar year (WFH will be offered after careful consideration, only if it is necessary). If you take more than 6 days of WFH, your compensation will be reduced by half for those WFH days. (These WFH allowance days will not be carried forward after a year).</p>
            <p><strong>13. Leave Policy:</strong> Each employee will be allocated 1 paid leave per month. Unused leaves will carry forward to the next month and, after a year, will carry forward to the next year.</p>
            <p><strong>14. Leave Policy During Notice Period:</strong> No leave or work-from-home arrangements will be granted during the notice period. However, if you need to take leave due to an emergency, your last working day will be extended by the number of leave days taken.</p>
            <p><strong>15. Notice Period and Final Settlement:</strong> You need to serve a notice period of 3 months to terminate the employment. The final settlement amount will be transferred to you 2 months after the last working day.</p>
            <p><strong>16. Comp Off Encashment:</strong> Your comp offs would be cashed only after your employment with Varsaka Labs ends. The comp-off amount will be determined exclusively based on basic pay.</p>
            <p><strong>17. Variable Pay Policy:</strong> Upon completion of 12 months of employment, employees are eligible to receive a variable pay, which will be distributed along with the 13th-month, 14th-month, and 15th-month payroll. Variable pay is dependent on employee performance (50%), company performance (30%), and macroeconomic factors (20%).</p>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 7 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II A: Terms and Conditions of Employment (Part 4)
          </h2>
          <div className="space-y-3 text-xs leading-relaxed text-justify text-slate-800">
            <p><strong>18. Self-Appraisal Forms Policy:</strong> Regularly updating and taking performance feedback sheets seriously is crucial to ensure that you and management are aligned. Neglecting this responsibility can have serious consequences, including negative performance appraisals and possible termination.</p>
            <p><strong>19. Claim of Damages:</strong> In case you leave the services of the company without furnishing proper notice and without mutual consent, you will be liable to pay the company a <strong>lump sum amount of 2 lakh rupees (two lakh rupees only)</strong> for damages caused on account of business loss. In cases of abandonment, no employment certificate will be issued, and last month's salary will not be paid.</p>
            <p><strong>20. Annual Leave/Public Holidays:</strong> Leave policies are applicable as they appear in the Varsaka Labs Employee Manual. Public holidays are applicable as per statutory regulations and client policy.</p>
            <p><strong>21. Work Hours Policy:</strong> All resources are expected to adhere to work hours which are 9:30 am to 7:00 pm (2:00 pm to 2:45 pm lunch break). UK shift runs from 2:00 pm to 11:00 pm as per business requirement. Extra hours worked earn comp time off.</p>
            <p><strong>22. Return of Material:</strong> On termination of employment with Varsaka Labs, you will immediately return to the company all confidential information, laptops, software, and physical assets.</p>
            <p><strong>23. Obligations upon Termination:</strong> Your obligations with respect to Confidential Information and security shall continue and survive even after your employment with Varsaka Labs.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 8 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II A: Terms and Conditions of Employment (Part 5 - Acceptance)
          </h2>
          <div className="space-y-4 text-xs leading-relaxed text-justify text-slate-800">
            <p><strong>24. Performance Clause:</strong> If your performance fails to meet the required standards after giving several written and/or verbal warnings, your employment may be terminated. However, you will remain entitled to receive your basic salary for the current month.</p>
            <p><strong>25. Maternity Leave Policy:</strong> Currently, leave is governed by company policies as detailed in the employee manual.</p>
            <p><strong>26. Social Media Confidentiality Policy:</strong> Employees must not disclose any client information, project names, or details related to work with Varsaka on social media without prior approval.</p>
            <p><strong>27. Violation of Terms and Conditions:</strong> If you violate the terms and conditions laid out in this letter, Varsaka Labs shall be entitled to take legal action against you.</p>

            <div className="bg-slate-50 p-4 border border-slate-300 rounded mt-6">
              <p className="font-semibold text-slate-900 mb-6">
                I accept this offer of employment on the terms and conditions mentioned in the above letter. I understand that company policies can change based on conditions and requirements as determined by the company.
              </p>
              <div className="space-y-3">
                <div><strong>Signature:</strong> _________________________________________________</div>
                <div><strong>Full Name:</strong> <span className="font-semibold">{data.candidateName}</span></div>
                <div><strong>Date:</strong> _________________________________________________</div>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 9 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGES 10-11: ANNEXURE II B - CONFIDENTIALITY & NDA                       */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II B: Confidentiality and Non-Disclosure Agreement (Part 1)
          </h2>
          <div className="space-y-4 text-xs leading-relaxed text-justify text-slate-800">
            <p>
              All employees of Varsaka Labs are required to undertake the following Confidentiality and Non-Disclosure Agreement. This agreement is intended to ensure all confidential information is not used either intentionally or unintentionally to undermine the interest of Varsaka Labs. During the course of employment at Varsaka Labs Pvt. Ltd., you will have access to information relating to the company (and its business and products), which has commercial and strategic value to Varsaka Labs and which Varsaka Labs desires to keep confidential.
            </p>
            <p>
              The term “Confidential Information” includes trade secrets, proprietary techniques, know-how, discoveries, inventions, marketing information, business strategies, client databases, and any other non-public company material.
            </p>
            <p><strong>1. Business Procedures:</strong> Internal business procedures, plans, technical data, vendor names, purchasing data, financial records (fees, hourly rates, billing), service manuals, employee salaries, and strategic concepts.</p>
            <p><strong>2. Marketing Plans and Client Information:</strong> Non-public client lists, financial data, and representation conditions obtained by the company.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 10 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II B: Confidentiality and Non-Disclosure Agreement (Part 2)
          </h2>
          <div className="space-y-4 text-xs leading-relaxed text-justify text-slate-800">
            <p><strong>3. Third Party Information:</strong> Any and all information in the Company’s possession from clients or third-party vendors which the company is obligated to hold as proprietary.</p>
            <p>All such Confidential Information is the sole property of Varsaka Labs. You will not disclose any Confidential Information to any unauthorized individual and will keep all information in strictest confidence. This obligation persists after employment ceases.</p>

            <div className="bg-slate-50 p-4 border border-slate-300 rounded mt-8">
              <p className="font-semibold text-slate-900 mb-6">
                I have read the above agreement covering confidential information and understand my obligations to the company.
              </p>
              <div className="space-y-3">
                <div><strong>Signature:</strong> _________________________________________________</div>
                <div><strong>Full Name:</strong> <span className="font-semibold">{data.candidateName}</span></div>
                <div><strong>Date:</strong> _________________________________________________</div>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 11 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 12: ANNEXURE II C - WORK FROM HOME GUIDELINES                       */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II C: Work From Home Guidelines Acceptance & Agreement
          </h2>
          <div className="space-y-2 text-xs leading-relaxed text-slate-800">
            <ul className="list-disc pl-6 space-y-1">
              <li>Do maintain regular contact with your team throughout the work day.</li>
              <li>Do dress appropriately for all scheduled video conferences.</li>
              <li>Don't turn the TV or non-work entertainment media on during work hours.</li>
              <li>Do invest in the right ergonomic equipment and high-speed broadband.</li>
              <li>Don't work from noisy public spaces or unsecured Wi-Fi networks.</li>
              <li>Do decorate your workspace to remain productive and inspired.</li>
              <li>Be punctual and maintain strict professional discipline.</li>
              <li>Do not run secondary parallel commercial activities or tuition centers during working hours.</li>
              <li>Do not conduct unrelated domestic errands or cooking during core business hours.</li>
              <li>Keep your office room closed at all times to eliminate domestic background noise.</li>
              <li>Do not work on an unstable internet connection (minimum 50 Mbps broadband verified).</li>
              <li>Maintain emotional resilience and focus on constructive professional collaboration.</li>
              <li>You will install remote management software on your work laptop to measure focus and project timelines.</li>
            </ul>

            <div className="bg-slate-50 p-4 border border-slate-300 rounded mt-8">
              <p className="font-semibold text-slate-900 mb-6">
                I have read the above agreement covering the ‘Work from Home Guidelines’ of the company, and I sincerely agree to adhere to the same.
              </p>
              <div className="space-y-3">
                <div><strong>Signature:</strong> _________________________________________________</div>
                <div><strong>Full Name:</strong> <span className="font-semibold">{data.candidateName}</span></div>
                <div><strong>Date:</strong> _________________________________________________</div>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 12 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGES 13-14: ANNEXURE II D - SOCIAL MEDIA GUIDELINES                     */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II D: Social Media Guidelines and Agreement (Part 1)
          </h2>
          <div className="space-y-3 text-xs leading-relaxed text-justify text-slate-800">
            <p>As part of your employment with Varsaka Labs, you are required to adhere to our policies regarding the use of IT resources, internet, email, and social media.</p>
            <p><strong>1. Internet Usage:</strong> The internet at Varsaka Labs is primarily for business purposes. Management reserves the right to monitor bandwidth usage to ensure network compliance and prevent malicious intrusions.</p>
            <p><strong>2. Email Use:</strong> Corporate email is strictly for formal business correspondence. Confidential records must be handled securely with necessary backups. All sent emails must carry the approved company disclaimer.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 13 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <h2 className="text-base font-bold text-blue-950 underline mb-4">
            Annexure II D: Social Media Guidelines and Agreement (Part 2)
          </h2>
          <div className="space-y-3 text-xs leading-relaxed text-justify text-slate-800">
            <p><strong>3. Professional Use of Social Media:</strong> Employees must maintain the highest standards of professionalism when mentioning Varsaka Labs publicly. Employees should never disclose proprietary client identities or code repositories on LinkedIn, Twitter, or public portals without written authorization.</p>
            <p><strong>4. Private/Personal Social Media:</strong> Content that identifies company affiliation in a manner detrimental to Varsaka Labs is strictly prohibited.</p>

            <div className="bg-slate-50 p-4 border border-slate-300 rounded mt-8">
              <p className="font-semibold text-slate-900 mb-6">
                I have read the above agreement covering IT and Social Media Guidelines and understand my obligations.
              </p>
              <div className="space-y-3">
                <div><strong>Signature:</strong> _________________________________________________</div>
                <div><strong>Full Name:</strong> <span className="font-semibold">{data.candidateName}</span></div>
                <div><strong>Date:</strong> _________________________________________________</div>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 14 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 15: ANNEXURE III A - JOB DESCRIPTION                                */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between border-b border-slate-200 print:border-none page-break-after">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <img 
              src="/brand/varsaka-logo.png" 
              alt="Varsaka Labs" 
              width={40} 
              height={40} 
              style={{ height: '40px', width: 'auto', maxHeight: '40px' }} 
              className="h-10 w-auto object-contain shrink-0" 
            />
            <span className="text-xs font-mono text-slate-400">{documentNumber}</span>
          </div>

          <h2 className="text-base font-bold text-center text-blue-950 underline mb-6">
            Annexure III A: Official Job Description - {data.designation}
          </h2>

          <p className="text-xs font-semibold text-slate-700 mb-4">
            Based on your skills assessment and role alignment, your core responsibilities include:
          </p>

          <div className="bg-slate-50 border border-slate-200 p-6 rounded text-xs space-y-3 text-slate-800 leading-relaxed">
            <ul className="list-disc pl-6 space-y-2">
              <li>Assist in maintaining accurate financial records, models, and departmental bookkeeping tasks.</li>
              <li>Learn and support the preparation of analytical balance sheets, cash flows, and operating reports.</li>
              <li>Perform meticulous transaction verification, data reconciliation, and audit trail maintenance.</li>
              <li>Utilize modern SaaS ERP packages, analytical tools, and cloud platforms for operational workflows.</li>
              <li>Collaborate closely with cross-functional software engineering and quality assurance squads.</li>
              <li>Organize documentation packages for periodic external statutory reviews and tax filings.</li>
              <li>Provide responsive administrative, operational, and research support to team leads as required.</li>
            </ul>
          </div>

          <p className="text-xs italic text-slate-600 mt-6 text-center font-medium">
            Note: Continuous learning, agility, and openness to constructive architectural feedback are essential for success at Varsaka Labs.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 15 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 16: ANNEXURE III B - PERFORMANCE MEASUREMENT & QR VERIFICATION      */}
      {/* ========================================================================= */}
      <div className="min-h-[1120px] p-12 flex flex-col justify-between print:border-none">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <img 
              src="/brand/varsaka-logo.png" 
              alt="Varsaka Labs" 
              width={40} 
              height={40} 
              style={{ height: '40px', width: 'auto', maxHeight: '40px' }} 
              className="h-10 w-auto object-contain shrink-0" 
            />
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-blue-900">{documentNumber}</span>
            </div>
          </div>

          <h2 className="text-base font-bold text-center text-blue-950 underline mb-4">
            Annexure III B: Performance Measurement Agreement
          </h2>

          <p className="text-xs text-justify leading-relaxed text-slate-800 mb-4">
            At Varsaka Labs, we continuously work towards achieving organizational excellence through structured monthly appraisals and transparent performance metrics. You will be evaluated on the following 12 key parameters (rated 1 to 5, total score out of 60):
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-800 mb-6">
            {[
              '1. Number of tools & technologies mastered',
              '2. Domain knowledge & depth',
              '3. Application of knowledge to assigned projects',
              '4. Task delivery & code quality',
              '5. Adherence to release schedules & deadlines',
              '6. Creative problem-solving & initiative',
              '7. Leadership & proactiveness',
              '8. Teamwork & cross-functional collaboration',
              '9. Technical presentation & communication skills',
              '10. Punctuality & professional discipline',
              '11. Recognition & awards received',
              '12. Dedication during critical business exigencies',
            ].map((metric, i) => (
              <div key={i} className="p-2 border border-slate-200 rounded bg-slate-50 font-medium">
                {metric}
              </div>
            ))}
          </div>

          {/* Secure Verification QR Block */}
          <div className="border border-blue-200 bg-blue-50/50 p-4 rounded-lg flex items-center justify-between mt-4">
            <div>
              <div className="text-xs font-bold text-blue-950 uppercase tracking-wider">Official Digital Verification</div>
              <div className="text-[10px] text-slate-600 mt-1 max-w-sm">
                This document is cryptographically registered in the Varsaka HR Registry. Scan QR code or visit verification portal with Verification ID:
              </div>
              <div className="font-mono font-bold text-xs text-blue-700 mt-2">{verificationId}</div>
            </div>
            <div className="bg-white p-2 border border-slate-200 rounded shadow-xs">
              <QRCodeSVG value={verificationUrl} size={72} level="M" />
            </div>
          </div>

          {/* Final Signatures */}
          <div className="mt-8 border-t border-slate-300 pt-4 text-xs space-y-2">
            <div className="flex justify-between items-end">
              <div>
                <div><strong>Accepted Candidate Signature:</strong> ___________________________</div>
                <div className="mt-1"><strong>Full Name:</strong> <span className="font-semibold">{data.candidateName}</span></div>
              </div>
              <div>
                <div><strong>Date:</strong> ___________________________</div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center flex flex-col items-center">
          <div>Address: APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
          <div className="mt-1 text-[8pt] font-mono text-slate-400">Page 16 of 16 • Doc: {documentNumber}</div>
        </div>
      </div>

    </div>
  );
};
