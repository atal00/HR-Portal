import React from 'react';
import { RelievingLetterData } from '@/types/document';
import { formatDate, calculateTenure } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { AuthorizedSignatoryBlock } from './AuthorizedSignatoryBlock';

interface Props {
  data: RelievingLetterData;
  documentNumber?: string;
  verificationId?: string;
  verificationUrl?: string;
}

export const RelievingLetterTemplate: React.FC<Props> = ({
  data,
  documentNumber = 'VAR-REL-DRAFT',
  verificationId = 'VVR-REL-PREVIEW',
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

  return (
    <div className="a4-single-page text-slate-900 font-sans text-[10pt] leading-relaxed">
      
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between border-b-2 border-blue-900 pb-3 mb-5">
          <div className="flex items-center gap-3">
            <img 
              src="/brand/varsaka-logo.png" 
              alt="Varsaka Labs" 
              width={56}
              height={56}
              style={{ height: '56px', width: 'auto', maxHeight: '56px' }}
              className="h-14 w-auto object-contain shrink-0" 
            />
            <div>
              <h1 className="text-xl font-black text-blue-950 tracking-wider">VARSAKA LABS</h1>
              <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">
                Excellence in Engineering & Quality Systems
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div className="font-mono font-bold text-slate-900">{documentNumber}</div>
            <div>Date of Issue: {formatDate(data.issueDate)}</div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-4">
          <h2 className="text-lg font-bold tracking-wider text-blue-950 border-b-2 border-slate-900 inline-block pb-0.5 uppercase">
            RELIEVING & SEPARATION ORDER
          </h2>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
            OFFICIAL HR SEPARATION RECORD
          </p>
        </div>

        {/* Recipient Block */}
        <div className="mb-4 text-xs bg-slate-50 p-2.5 rounded border border-slate-200 grid grid-cols-2 gap-2">
          <div><strong>To:</strong> {data.employeeName}</div>
          <div><strong>Employee ID:</strong> {data.employeeId}</div>
          <div><strong>Designation:</strong> {data.designation}</div>
          <div><strong>Department:</strong> {data.department}</div>
        </div>

        {/* Relieving Letter Text */}
        <div className="space-y-3.5 text-justify text-xs sm:text-[10.5pt] leading-relaxed text-slate-800">
          <p>
            Dear <strong>{data.employeeName}</strong>,
          </p>

          <p>
            With reference to your formal resignation letter{data.resignationDate ? ` submitted on ${formatDate(data.resignationDate)}` : ''}, this is to confirm that your resignation has been accepted by the management of <strong>Varsaka Labs Pvt. Ltd.</strong>
          </p>

          <p>
            You are hereby formally relieved from your employment and duties as <strong>{data.designation}</strong> in the <strong>{data.department}</strong> department at our <strong>{data.workLocation}</strong> center, effective from the close of business hours on <strong>{formatDate(data.relievingDate || data.lastWorkingDate)}</strong>.
          </p>

          <p>
            We confirm that all company assets, intellectual property, confidential documentation, and company properties in your custody have been surrendered, and full separation clearance has been recorded (Status: <strong>{data.clearanceStatus || 'Satisfactorily Completed'}</strong>). All final settlement dues have been accounted for and processed in accordance with company separation policy.
          </p>

          <p>
            You remain bound by your non-disclosure and confidentiality obligations regarding proprietary business information, intellectual property, and trade secrets as executed in your employment agreement.
          </p>

          <p>
            We take this opportunity to appreciate your contributions during your tenure with <strong>Varsaka Labs</strong> from <strong>{formatDate(data.joiningDate)}</strong> to <strong>{formatDate(data.lastWorkingDate)}</strong>{data.tenureText || (data.joiningDate && data.lastWorkingDate ? ` (Tenure: ${calculateTenure(data.joiningDate, data.lastWorkingDate)})` : '')}, and wish you every success in your future personal and professional pursuits.
          </p>

          {data.customStatement && (
            <div className="p-3 bg-slate-50 border-l-2 border-blue-900 rounded-r text-xs text-slate-900 italic leading-relaxed my-2">
              {data.customStatement}
            </div>
          )}
        </div>

        {/* Signature & Seal Section */}
        <div className="pt-6">
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
        <div className="mt-5 p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-blue-950 uppercase tracking-wide text-[11px]">Document Authenticity Verification</div>
            <div className="text-[10px] text-slate-500">Scan QR or verify online with Verification ID:</div>
            <div className="font-mono font-bold text-blue-700 text-xs mt-0.5">{verificationId}</div>
          </div>
          <div className="bg-white p-1 border border-slate-200 rounded">
            <QRCodeSVG value={verificationUrl} size={50} level="M" />
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="pt-2 border-t border-slate-300 text-[8pt] text-slate-500 text-center">
        <div>Varsaka Labs Pvt. Ltd. • APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
        <div className="text-[7.5pt] text-slate-400 mt-0.5">
          Email: info@varsakalabs.com • Web: https://varsaka.com/ • Verification: {verificationUrl}
        </div>
      </div>

    </div>
  );
};
