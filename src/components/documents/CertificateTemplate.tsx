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
  documentNumber = '',
  verificationId = '',
  verificationUrl = '/verify',
}) => {
  const signatureUrl = data.signatory?.signature_url !== undefined 
    ? data.signatory.signature_url 
    : '/brand/sign.jpeg';
  const stampUrl = data.stamp?.stamp_url !== undefined 
    ? data.stamp.stamp_url 
    : '/brand/varsaka-seal.png';
  const signatoryName = data.signatory?.name || data.authorizedSignatory || 'Authorized Signatory';
  const signatoryTitle = data.signatory?.title || 'HR Department';
  const companyName = data.signatory?.company || data.companyName || 'Varsaka Labs';

  return (
    <div className="a4-certificate-page text-slate-900">
      {/* Outer Decorative Frame */}
      <div className="border-[5px] border-blue-950 p-2 h-full box-border">
        <div className="border-[1.5px] border-amber-600/70 p-6 flex flex-col justify-between h-full relative bg-radial from-amber-50/20 via-white to-white box-border">
          
          {/* Top Header: Logo & Branding */}
          <div>
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-3 mb-4">
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
                  <h1 className="text-xl font-black text-blue-950 tracking-wider cert-font-cinzel">VARSAKA LABS</h1>
                  <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest">
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
            <div className="text-center my-4">
              <h2 className="text-2xl font-black tracking-widest text-blue-950 cert-font-cinzel uppercase">
                COMPLETION CERTIFICATE
              </h2>
              <div className="w-40 h-0.5 bg-gradient-to-r from-transparent via-amber-600 to-transparent mx-auto mt-1.5"></div>
            </div>

            {/* Body Certification Clauses */}
            <div className="space-y-3 text-center text-xs sm:text-sm text-slate-800 leading-relaxed px-4">
              <p className="cert-font-serif text-sm text-slate-600 italic">
                This is to certify that
              </p>

              <div className="text-xl font-black text-blue-950 tracking-wide border-b-2 border-slate-900 inline-block px-6 pb-0.5">
                {data.candidateName}
              </div>

              <p className="pt-1 text-xs">
                has successfully completed their {data.certificateType === 'INTERNSHIP_COMPLETION' ? 'Summer Internship' : 'Project Assignment'} with project title:
              </p>

              <div className="text-sm font-bold text-slate-900 bg-amber-50/60 border border-amber-200/80 rounded py-1.5 px-4 inline-block max-w-lg">
                "{data.projectTitle}"
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto text-xs text-left pt-1">
                <div>
                  <span className="text-slate-500">Under the guidance of:</span>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">{data.mentorName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Project Duration / Tenure:</span>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">{data.tenureStartDate} to {data.tenureEndDate}</div>
                </div>
              </div>

              <p className="text-[11px] text-slate-700 max-w-xl mx-auto pt-1 text-justify">
                The internship assessment fulfils the stated criteria and student findings are their original work. We hereby certify their work satisfactory to the best of our knowledge with an aggregate <strong>{data.performanceGrade}</strong>.
              </p>

              <div className="text-[11px] text-slate-600 pt-0.5">
                Location for internship: <span className="font-semibold text-slate-800">{data.workLocation}</span>
              </div>

              <p className="text-[11px] font-semibold text-slate-800 pt-1">
                We wish them all the best for future endeavours. Warm Regards.
              </p>
            </div>
          </div>

          {/* Bottom Row: Official Seal, Signature & QR Code */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-end justify-between px-2">
            
            {/* Signature Block */}
            <div className="text-left w-52">
              <div className="h-12 flex items-center">
                {signatureUrl && (
                  <img 
                    src={signatureUrl} 
                    alt="Sign" 
                    width={110} 
                    height={40} 
                    style={{ height: '40px', width: 'auto', maxHeight: '40px' }} 
                    className="h-10 w-auto opacity-85 object-contain" 
                  />
                )}
              </div>
              <div className="border-t border-slate-900 pt-1">
                <div className="text-xs font-bold text-blue-950 uppercase">{signatoryName}</div>
                <div className="text-[10px] text-slate-600">{signatoryTitle}</div>
                <div className="text-[10px] text-slate-600 font-semibold">{companyName}</div>
              </div>
            </div>

            {/* Official Seal Center */}
            <div className="flex flex-col items-center">
              {stampUrl && (
                <img 
                  src={stampUrl} 
                  alt="Official Seal" 
                  width={80} 
                  height={80} 
                  style={{ height: '80px', width: 'auto', maxHeight: '80px' }} 
                  className="h-18 w-auto object-contain opacity-95 drop-shadow-xs shrink-0" 
                />
              )}
              <span className="text-[8.5px] uppercase tracking-widest text-amber-800 font-bold mt-0.5">Official Corporate Seal</span>
            </div>

            {/* Secure QR Verification */}
            <div className="text-right flex flex-col items-end">
              <div className="bg-white p-1 border border-slate-300 rounded shadow-xs mb-1">
                <QRCodeSVG value={verificationUrl} size={54} level="M" />
              </div>
              <div className="text-[8.5px] uppercase tracking-wider text-slate-500 font-semibold">Scan to Verify Authenticity</div>
              <div className="text-[9.5px] font-mono font-bold text-blue-900">{verificationId}</div>
            </div>

          </div>

          {/* Bottom Micro Footer */}
          <div className="text-center text-[7.5pt] text-slate-400 mt-2 border-t border-slate-100 pt-1">
            Varsaka Labs • APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032 • {verificationUrl}
          </div>

        </div>
      </div>
    </div>
  );
};
