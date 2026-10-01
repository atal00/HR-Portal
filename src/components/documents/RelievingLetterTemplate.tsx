import React from 'react';
import { RelievingLetterData } from '@/types/document';
import { formatDate } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  data: RelievingLetterData;
  documentNumber?: string;
  verificationId?: string;
  verificationUrl?: string;
}

export const RelievingLetterTemplate: React.FC<Props> = ({
  data,
  documentNumber = 'VAR-REL-2026-000001',
  verificationId = 'VVR-REL-PREVIEW',
  verificationUrl = 'http://localhost:3000/verify/VVR-REL-PREVIEW',
}) => {
  return (
    <div className="bg-white text-slate-900 font-sans text-[11pt] leading-relaxed max-w-[850px] mx-auto p-14 min-h-[1120px] flex flex-col justify-between shadow-sm print:shadow-none print:max-w-full">
      
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between border-b-2 border-blue-900 pb-5 mb-8">
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
        <div className="text-center my-8">
          <h2 className="text-xl font-bold tracking-wider text-blue-950 border-b-2 border-slate-900 inline-block pb-1 uppercase">
            RELIEVING & SEPARATION ORDER
          </h2>
          <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-semibold">
            OFFICIAL HR SEPARATION RECORD
          </p>
        </div>

        {/* Recipient Block */}
        <div className="mb-6 text-sm">
          <div><strong>To:</strong> {data.employeeName}</div>
          <div><strong>Employee ID:</strong> {data.employeeId}</div>
          <div><strong>Designation:</strong> {data.designation}</div>
          <div><strong>Department:</strong> {data.department}</div>
        </div>

        {/* Relieving Letter Text */}
        <div className="space-y-5 text-justify text-sm leading-relaxed text-slate-800">
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
            We take this opportunity to appreciate your contributions during your tenure with <strong>Varsaka Labs</strong> from <strong>{formatDate(data.joiningDate)}</strong> to <strong>{formatDate(data.lastWorkingDate)}</strong>, and wish you every success in your future personal and professional pursuits.
          </p>
        </div>

        {/* Signature & Seal Section */}
        <div className="pt-16 flex items-end justify-between">
          <div className="space-y-1">
            <div className="h-14 flex items-center">
              <img 
                src="/brand/sign.jpeg" 
                alt="Authorized Signatory" 
                width={120} 
                height={48} 
                style={{ height: '48px', width: 'auto', maxHeight: '48px' }} 
                className="h-12 w-auto opacity-85" 
              />
            </div>
            <div className="font-bold text-sm text-blue-950">{data.authorizedSignatoryName || 'Authorized Signatory'}</div>
            <div className="text-xs text-slate-700 font-semibold">{data.authorizedSignatoryTitle || 'Head of Human Resources'}</div>
            <div className="text-xs text-slate-600">Varsaka Labs Pvt. Ltd.</div>
          </div>

          <div className="flex flex-col items-center">
            <img 
              src="/brand/varsaka-seal.png" 
              alt="Official Seal" 
              width={96} 
              height={96} 
              style={{ height: '96px', width: 'auto', maxHeight: '96px' }} 
              className="h-24 w-auto object-contain opacity-90 shrink-0" 
            />
            <span className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">Official Company Seal</span>
          </div>
        </div>

        {/* Verification Strip */}
        <div className="mt-12 p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-blue-950 uppercase tracking-wide">Document Authenticity Verification</div>
            <div className="text-[10px] text-slate-500">Scan QR or verify online with Verification ID:</div>
            <div className="font-mono font-bold text-blue-700 text-xs mt-1">{verificationId}</div>
          </div>
          <div className="bg-white p-1.5 border border-slate-200 rounded">
            <QRCodeSVG value={verificationUrl} size={64} level="M" />
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="pt-4 border-t border-slate-300 text-[9pt] text-slate-500 text-center">
        <div>Varsaka Labs Pvt. Ltd. • APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032.</div>
        <div className="text-[8pt] text-slate-400 mt-0.5">
          Email: info@varsakalabs.com • Web: https://varsaka.com/ • Verification: {verificationUrl}
        </div>
      </div>

    </div>
  );
};
