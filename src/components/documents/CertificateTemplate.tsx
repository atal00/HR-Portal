import React from 'react';
import { CertificateData } from '@/types/document';
import { formatDate } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  data: CertificateData;
  documentNumber?: string;
  verificationId?: string;
  verificationUrl?: string;
}

export const CertificateTemplate: React.FC<Props> = ({
  data,
  documentNumber = 'VAR-CERT-2026-000001',
  verificationId = 'VVR-CERT-7B9A2F',
  verificationUrl = 'http://localhost:3000/verify/VVR-CERT-7B9A2F',
}) => {
  return (
    <div className="bg-white text-slate-900 max-w-[900px] mx-auto p-4 shadow-md print:shadow-none print:max-w-full">
      {/* Outer Decorative Frame */}
      <div className="border-[6px] border-blue-950 p-2">
        <div className="border-[2px] border-amber-600/70 p-8 min-h-[640px] flex flex-col justify-between relative bg-radial from-amber-50/20 via-white to-white">
          
          {/* Top Header: Logo & Branding */}
          <div>
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <img 
                  src="/brand/varsaka-logo.png" 
                  alt="Varsaka Labs" 
                  width={64}
                  height={64}
                  style={{ height: '64px', width: 'auto', maxHeight: '64px' }}
                  className="h-16 w-auto object-contain shrink-0" 
                />
                <div>
                  <h1 className="text-2xl font-black text-blue-950 tracking-wider cert-font-cinzel">VARSAKA LABS</h1>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                    Centre for Advanced Software Systems & Engineering
                  </p>
                </div>
              </div>

              <div className="text-right text-xs">
                <div className="font-semibold text-slate-700">Date: <span className="font-mono text-slate-900">{formatDate(data.issueDate)}</span></div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">Doc ID: {documentNumber}</div>
              </div>
            </div>

            {/* Certificate Title */}
            <div className="text-center my-6">
              <h2 className="text-3xl font-black tracking-widest text-blue-950 cert-font-cinzel uppercase">
                COMPLETION CERTIFICATE
              </h2>
              <div className="w-48 h-0.5 bg-gradient-to-r from-transparent via-amber-600 to-transparent mx-auto mt-2"></div>
            </div>

            {/* Body Certification Clauses */}
            <div className="space-y-4 text-center text-sm text-slate-800 leading-relaxed px-6">
              <p className="cert-font-serif text-base text-slate-600 italic">
                This is to certify that
              </p>

              <div className="text-2xl font-black text-blue-950 tracking-wide border-b-2 border-slate-900 inline-block px-8 pb-1">
                {data.candidateName}
              </div>

              <p className="pt-2">
                has successfully completed their {data.certificateType === 'INTERNSHIP_COMPLETION' ? 'Summer Internship' : 'Project Assignment'} with project title:
              </p>

              <div className="text-base font-bold text-slate-900 bg-amber-50/60 border border-amber-200/80 rounded py-2 px-6 inline-block max-w-xl">
                "{data.projectTitle}"
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto text-xs text-left pt-2">
                <div>
                  <span className="text-slate-500">Under the guidance of:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{data.mentorName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Project Duration / Tenure:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{data.tenureStartDate} to {data.tenureEndDate}</div>
                </div>
              </div>

              <p className="text-xs text-slate-700 max-w-2xl mx-auto pt-2 text-justify">
                The internship assessment fulfils the stated criteria and student findings are their original work. We hereby certify their work satisfactory to the best of our knowledge with an aggregate <strong>{data.performanceGrade}</strong>.
              </p>

              <div className="text-xs text-slate-600 pt-1">
                Location for internship: <span className="font-semibold text-slate-800">{data.workLocation}</span>
              </div>

              <p className="text-xs font-semibold text-slate-800 pt-2">
                We wish them all the best for future endeavours. Warm Regards.
              </p>
            </div>
          </div>

          {/* Bottom Row: Official Seal, Signature & QR Code */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex items-end justify-between px-4">
            
            {/* Signature Block */}
            <div className="text-left w-56">
              <div className="h-14 flex items-center">
                <img 
                  src="/brand/sign.jpeg" 
                  alt="Sign" 
                  width={120} 
                  height={48} 
                  style={{ height: '48px', width: 'auto', maxHeight: '48px' }} 
                  className="h-12 w-auto opacity-85" 
                />
              </div>
              <div className="border-t border-slate-900 pt-1">
                <div className="text-xs font-bold text-blue-950 uppercase">{data.authorizedSignatory || 'Authorized Signatory'}</div>
                <div className="text-[10px] text-slate-600">HR Department</div>
                <div className="text-[10px] text-slate-600 font-semibold">{data.companyName || 'Varsaka Labs Pvt. Ltd.'}</div>
              </div>
            </div>

            {/* Official Seal Center */}
            <div className="flex flex-col items-center">
              <img 
                src="/brand/varsaka-seal.png" 
                alt="Official Seal" 
                width={96} 
                height={96} 
                style={{ height: '96px', width: 'auto', maxHeight: '96px' }} 
                className="h-24 w-auto object-contain opacity-95 drop-shadow-xs shrink-0" 
              />
              <span className="text-[9px] uppercase tracking-widest text-amber-800 font-bold mt-1">Official Corporate Seal</span>
            </div>

            {/* Secure QR Verification */}
            <div className="text-right flex flex-col items-end">
              <div className="bg-white p-1.5 border border-slate-300 rounded shadow-xs mb-1">
                <QRCodeSVG value={verificationUrl} size={68} level="M" />
              </div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Scan to Verify Authenticity</div>
              <div className="text-[10px] font-mono font-bold text-blue-900">{verificationId}</div>
            </div>

          </div>

          {/* Bottom Micro Footer */}
          <div className="text-center text-[8pt] text-slate-400 mt-4 border-t border-slate-100 pt-2">
            Varsaka Labs Pvt. Ltd. • APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032 • https://varsaka.com/verify/{verificationId}
          </div>

        </div>
      </div>
    </div>
  );
};
