import React from 'react';

export interface AuthorizedSignatoryBlockProps {
  signatoryName?: string;
  signatoryTitle?: string;
  companyName?: string;
  signatureUrl?: string;
  stampUrl?: string;
  showSeal?: boolean;
  className?: string;
}

/**
 * Standardized Corporate Authorized Signatory & Official Seal Block
 * 
 * Complies with strict document quality requirements:
 * 1. Signature and Seal are positioned side-by-side ABOVE the horizontal line.
 * 2. Signature line cleanly separates visual assets from typography.
 * 3. Guaranteed NO OVERLAP between seal/signature and name/designation.
 * 4. Controlled bounded dimensions (object-fit: contain) preventing distortion.
 * 5. Pixel-identical rendering across browser preview, print, and PDF.
 */
export const AuthorizedSignatoryBlock: React.FC<AuthorizedSignatoryBlockProps> = ({
  signatoryName = 'Authorized Signatory',
  signatoryTitle = 'HR Operations / Talent Acquisition',
  companyName = 'Varsaka Labs Pvt. Ltd.',
  signatureUrl = '/brand/sign.jpeg',
  stampUrl = '/brand/varsaka-seal.png',
  showSeal = true,
  className = '',
}) => {
  return (
    <div className={`inline-block text-left ${className}`} style={{ minWidth: '240px', maxWidth: '300px' }}>
      {/* Asset Display Zone (Above the line) */}
      <div 
        className="flex items-end gap-4 pb-1.5"
        style={{ height: '56px', minHeight: '56px', maxHeight: '56px' }}
      >
        {/* Signature Area */}
        <div className="flex items-end justify-start" style={{ height: '50px', width: '130px' }}>
          {signatureUrl ? (
            <img
              src={signatureUrl}
              alt="Authorized Signature"
              width={125}
              height={46}
              style={{
                maxHeight: '46px',
                maxWidth: '125px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
              }}
              className="object-contain opacity-95 shrink-0"
            />
          ) : (
            <div className="w-24 h-6 border-b border-dashed border-slate-300" />
          )}
        </div>

        {/* Corporate Seal Area (Beside Signature, never overlapping) */}
        {showSeal && stampUrl && (
          <div className="flex items-end justify-center pl-1" style={{ height: '54px', width: '64px' }}>
            <img
              src={stampUrl}
              alt="Corporate Seal"
              width={54}
              height={54}
              style={{
                maxHeight: '52px',
                maxWidth: '54px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
              }}
              className="object-contain opacity-90 drop-shadow-xs shrink-0"
            />
          </div>
        )}
      </div>

      {/* Signature Line */}
      <div className="w-64 border-t-2 border-slate-800 pt-1.5" />

      {/* Structured Signatory Typography (Below the line) */}
      <div className="space-y-0.5 pt-0.5 text-left">
        <div className="text-[9pt] uppercase tracking-wider text-slate-500 font-bold leading-tight">
          Authorized Signatory
        </div>
        <div className="text-[10pt] font-bold text-blue-950 uppercase tracking-wide leading-tight">
          {signatoryName}
        </div>
        <div className="text-[9pt] text-slate-700 font-medium leading-tight">
          {signatoryTitle}
        </div>
        <div className="text-[8.5pt] text-slate-600 leading-tight">
          {companyName}
        </div>
      </div>
    </div>
  );
};

export interface CandidateSignatoryBlockProps {
  candidateName: string;
  className?: string;
}

/**
 * Standardized Candidate Acceptance Signature Block
 * 
 * Complies with strict corporate A4 layout:
 * - Clear "Accepted Candidate" section header
 * - Fixed width label columns for pixel-consistent alignment
 * - Clean underlined entry fields for Signature and Date
 * - Dynamic recipient full name
 */
export const CandidateSignatoryBlock: React.FC<CandidateSignatoryBlockProps> = ({
  candidateName,
  className = '',
}) => {
  return (
    <div className={`inline-block text-left ${className}`} style={{ minWidth: '240px', maxWidth: '300px' }}>
      <div className="text-[9.5pt] font-bold text-blue-950 uppercase tracking-wide mb-3">
        Accepted Candidate
      </div>

      <div className="space-y-2.5 text-xs text-slate-800">
        <div className="flex items-end gap-2">
          <span className="font-semibold text-slate-700 w-20 shrink-0">Signature:</span>
          <span className="border-b-2 border-slate-800 inline-block w-44 h-5"></span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-slate-700 w-20 shrink-0">Full Name:</span>
          <span className="font-bold text-slate-900">{candidateName}</span>
        </div>

        <div className="flex items-end gap-2">
          <span className="font-semibold text-slate-700 w-20 shrink-0">Date:</span>
          <span className="border-b-2 border-slate-800 inline-block w-44 h-5"></span>
        </div>
      </div>
    </div>
  );
};

export interface DualSignatureGridProps {
  candidateName: string;
  signatoryName?: string;
  signatoryTitle?: string;
  companyName?: string;
  signatureUrl?: string;
  stampUrl?: string;
  showSeal?: boolean;
  showThankYou?: boolean;
  className?: string;
}

/**
 * Standardized Corporate Dual Signature & Stamp Block
 * 
 * Complies with strict reference visual specifications:
 * - LEFT SIDE:
 *   Thank you,
 *   For Varsaka Labs Pvt. Ltd.
 *   [signature]  [official stamp] (sitting close together, natural aspect ratio)
 *   ________________________________ (divider line)
 *   AUTHORIZED SIGNATORY
 *   ALISHA KAPOOR
 *   HR Director
 *   Varsaka Labs
 *   (Signature & Corporate Seal)
 * 
 * - RIGHT SIDE:
 *   ACCEPTED BY
 *   Employee Name
 *   [signing clearance area]
 *   ________________________________ (divider line)
 *   (Candidate Signature & Date)
 * 
 * Guarantees:
 * - Authorized Signatory is on the LEFT
 * - Candidate Acceptance is on the RIGHT
 * - Both blocks occupy the same overall signature section
 * - Symmetrically and vertically balanced
 * - Natural aspect ratio preserved (object-fit: contain, no stretching)
 * - Dynamic branding snapshot assets utilized
 */
export const DualSignatureGrid: React.FC<DualSignatureGridProps> = ({
  candidateName,
  signatoryName = 'Alisha Kapoor',
  signatoryTitle = 'HR Director',
  companyName = 'Varsaka Labs Pvt. Ltd.',
  signatureUrl = '/brand/sign.jpeg',
  stampUrl = '/brand/varsaka-seal.png',
  showSeal = true,
  showThankYou = true,
  className = '',
}) => {
  return (
    <div className={`w-full flex justify-between items-start ${className}`}>
      {/* ===================================================================== */}
      {/* LEFT SIDE: AUTHORIZED SIGNATORY BLOCK                                  */}
      {/* ===================================================================== */}
      <div className="w-64 text-left">
        {showThankYou && (
          <div className="text-xs text-slate-800 leading-tight mb-2">
            <div>Thank you,</div>
            <div className="font-bold text-blue-950 mt-0.5">
              For {companyName.includes('Pvt') ? companyName : `${companyName} Pvt. Ltd.`}
            </div>
          </div>
        )}

        {/* Signature & Official Stamp sitting close to each other */}
        <div className="flex items-end gap-2.5 h-[50px] my-2">
          {signatureUrl ? (
            <img
              src={signatureUrl}
              alt="Authorized Signature"
              width={120}
              height={44}
              style={{
                maxHeight: '44px',
                maxWidth: '120px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
              }}
              className="object-contain opacity-95 shrink-0"
            />
          ) : (
            <div className="w-24 h-6 border-b border-dashed border-slate-300" />
          )}

          {showSeal && stampUrl && (
            <img
              src={stampUrl}
              alt="Official Seal"
              width={48}
              height={48}
              style={{
                maxHeight: '48px',
                maxWidth: '48px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
              }}
              className="object-contain opacity-90 drop-shadow-xs shrink-0"
            />
          )}
        </div>

        {/* Horizontal Divider Line directly associated with authorized signatory */}
        <div className="w-64 border-t-2 border-slate-800 pt-1.5 mb-1" />

        {/* Structured Signatory Typography */}
        <div className="space-y-0.5 text-xs text-left">
          <div className="text-[8.5pt] font-bold text-slate-600 uppercase tracking-wider">
            AUTHORIZED SIGNATORY
          </div>
          <div className="text-[9.5pt] font-bold text-blue-950 uppercase tracking-wide">
            {signatoryName}
          </div>
          <div className="text-[9pt] text-slate-700 font-semibold">
            {signatoryTitle}
          </div>
          <div className="text-[8.5pt] text-slate-600">
            {companyName}
          </div>
          <div className="text-[8pt] text-slate-400 italic">
            (Signature & Corporate Seal)
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* RIGHT SIDE: CANDIDATE ACCEPTANCE BLOCK                                 */}
      {/* ===================================================================== */}
      <div className="w-64 text-left">
        <div className="text-xs text-slate-800 leading-tight mb-2">
          <div className="text-[8.5pt] font-bold text-blue-950 uppercase tracking-wider">
            ACCEPTED BY
          </div>
          <div className="text-[9.5pt] font-semibold text-slate-900 mt-0.5">
            {candidateName}
          </div>
        </div>

        {/* Candidate Signing Clearance Area (matches 50px signature height) */}
        <div className="h-[50px] my-2" />

        {/* Horizontal Divider Line directly associated with candidate signature */}
        <div className="w-64 border-t-2 border-slate-800 pt-1.5 mb-1" />

        {/* Candidate Signature & Date Label */}
        <div className="space-y-0.5 text-xs text-left">
          <div className="text-[8pt] text-slate-400 italic">
            (Candidate Signature & Date)
          </div>
          <div className="text-[8pt] text-transparent select-none leading-tight" aria-hidden="true">&nbsp;</div>
          <div className="text-[8pt] text-transparent select-none leading-tight" aria-hidden="true">&nbsp;</div>
          <div className="text-[8pt] text-transparent select-none leading-tight" aria-hidden="true">&nbsp;</div>
          <div className="text-[8pt] text-transparent select-none leading-tight" aria-hidden="true">&nbsp;</div>
        </div>
      </div>
    </div>
  );
};

