import React from 'react';
import { ExperienceLetterData } from '@/types/document';
import { formatDate, calculateTenure } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { AuthorizedSignatoryBlock } from './AuthorizedSignatoryBlock';


interface Props {
  data: ExperienceLetterData;
  documentNumber?: string;
  verificationId?: string;
  verificationUrl?: string;
}

export const ExperienceLetterTemplate: React.FC<Props> = ({
  data,
  documentNumber = 'VAR-EXP-DRAFT',
  verificationId = 'VVR-EXP-PREVIEW',
  verificationUrl = '',
}) => {
  const signatureUrl = data.signatory?.signature_url !== undefined 
    ? data.signatory.signature_url 
    : '/brand/sign.jpeg';
  const stampUrl = data.stamp?.stamp_url !== undefined 
    ? data.stamp.stamp_url 
    : '/brand/varsaka-seal.png';
  const signatoryName = data.signatory?.name || data.authorizedSignatoryName || 'Authorized Signatory';
  const signatoryTitle = data.signatory?.title || data.authorizedSignatoryTitle || 'Head of Human Resources';
  const companyName = data.signatory?.company || 'Varsaka Labs Pvt. Ltd.';

  const tenureDuration = data.tenureText || (data.joiningDate && data.lastWorkingDate ? calculateTenure(data.joiningDate, data.lastWorkingDate) : '');

  return (
    <div className="a4-single-page text-slate-900 font-sans text-[10.5pt] leading-relaxed">
      
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between border-b-2 border-blue-900 pb-4 mb-6">
          <div className="flex items-center gap-4">
            <img 
              src="/brand/varsaka-logo.png" 
              alt="Varsaka Labs" 
              width={60}
              height={60}
              style={{ height: '60px', width: 'auto', maxHeight: '60px' }}
              className="h-15 w-auto object-contain shrink-0" 
            />
            <div>
              <h1 className="text-2xl font-black text-blue-950 tracking-wider">VARSAKA LABS</h1>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest">
                Excellence in Engineering & Quality Systems
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div className="font-mono font-bold text-slate-900">{documentNumber}</div>
            <div>Date: {formatDate(data.issueDate)}</div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-6">
          <h2 className="text-lg font-bold tracking-wider text-blue-950 border-b-2 border-slate-900 inline-block pb-1 uppercase">
            EXPERIENCE & RELIEVING CERTIFICATE
          </h2>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
            TO WHOMSOEVER IT MAY CONCERN
          </p>
        </div>

        {/* Certificate Text */}
        <div className="space-y-4 text-justify text-xs sm:text-sm leading-relaxed text-slate-800">
          <p>
            This is to formally certify that <strong>Mr./Ms. {data.employeeName}</strong> (Employee ID: <strong>{data.employeeId}</strong>) was employed with <strong>Varsaka Labs Pvt. Ltd.</strong> from <strong>{formatDate(data.joiningDate)}</strong> to <strong>{formatDate(data.lastWorkingDate)}</strong>{tenureDuration ? ` (Tenure: ${tenureDuration})` : ''}.
          </p>

          <p>
            During their tenure with us, they served in the role of <strong>{data.designation}</strong> within the <strong>{data.department}</strong> department, operating under <strong>{data.employmentType}</strong> engagement from our <strong>{data.workLocation}</strong> office.
          </p>

          <p>
            During their period of employment, {data.employeeName} demonstrated high professional commitment, technical diligence, and strong teamwork. They contributed significantly to their assigned organizational objectives, adhering to all professional ethics and company policies.
          </p>

          <p>
            {data.conductAppreciation || 'Their character, professional conduct, and demeanor during their tenure with Varsaka Labs were found to be exemplary.'} All organizational dues, assets, and liabilities have been settled in accordance with standard separation procedures, and they stand relieved of all obligations to Varsaka Labs as of the close of business on <strong>{formatDate(data.lastWorkingDate)}</strong>.
          </p>

          {data.customStatement && (
            <div className="p-3 bg-slate-50 border-l-2 border-blue-900 rounded-r text-xs text-slate-900 italic leading-relaxed my-2">
              {data.customStatement}
            </div>
          )}

          <p>
            We appreciate their valuable service and wish them the very best in all their future personal and professional endeavors.
          </p>
        </div>

        {/* Signature & Seal Section */}
        <div className="pt-8">
          <AuthorizedSignatoryBlock
            signatoryName={signatoryName}
            signatoryTitle={signatoryTitle}
            companyName={companyName}
            signatureUrl={signatureUrl}
            stampUrl={stampUrl}
            showSeal={true}
          />
        </div>

        {/* Verification Strip */}
        <div className="mt-6 p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-blue-950 uppercase tracking-wide">Document Authenticity Verification</div>
            <div className="text-[10px] text-slate-500">Scan QR or verify online with Verification ID:</div>
            <div className="font-mono font-bold text-blue-700 text-xs mt-0.5">{verificationId}</div>
          </div>
          <div className="bg-white p-1 border border-slate-200 rounded">
            <QRCodeSVG value={verificationUrl} size={54} level="M" />
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="pt-3 border-t border-slate-300 text-[8.5pt] text-slate-500 text-center">
        <div>Varsaka Labs Pvt. Ltd. • APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
        <div className="text-[7.5pt] text-slate-400 mt-0.5">
          Email: info@varsakalabs.com • Web: https://varsaka.com/ • Verification: {verificationUrl}
        </div>
      </div>

    </div>
  );
};
