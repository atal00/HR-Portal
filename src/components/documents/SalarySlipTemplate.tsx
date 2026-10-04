import React from 'react';
import { SalarySlipData } from '@/types/document';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  data: SalarySlipData;
  documentNumber?: string;
  verificationId?: string;
  verificationUrl?: string;
}

export const SalarySlipTemplate: React.FC<Props> = ({
  data,
  documentNumber = 'VAR-SAL-DRAFT',
  verificationId = 'VVR-SAL-PREVIEW',
  verificationUrl = '',
}) => {
  return (
    <div className="a4-single-page text-slate-900 font-sans text-[9.5pt] leading-normal">
      
      <div>
        {/* Header */}
        <div className="border-b-2 border-blue-900 pb-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/brand/varsaka-logo.png" 
                alt="Varsaka Labs" 
                width={52}
                height={52}
                style={{ height: '52px', width: 'auto', maxHeight: '52px' }}
                className="h-13 w-auto object-contain shrink-0" 
              />
              <div>
                <h1 className="text-lg font-black text-blue-950 tracking-wider">VARSAKA LABS</h1>
                <p className="text-[10px] text-slate-600">APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032</p>
                <p className="text-[8.5pt] text-slate-500">Corporate Identity No: U72900TG2023PTC178920 • Web: https://varsaka.com</p>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block bg-blue-50 border border-blue-200 px-3 py-1 rounded text-xs font-bold text-blue-900 uppercase">
                Pay Slip
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-1">{data.month} {data.year}</div>
            </div>
          </div>
        </div>

        {/* Employee Metadata Grid */}
        <div className="border border-slate-300 rounded-md bg-slate-50 p-3 mb-4 text-xs grid grid-cols-2 gap-x-8 gap-y-1.5">
          <div className="flex justify-between border-b border-slate-200 pb-1">
            <span className="text-slate-500">Employee ID:</span>
            <span className="font-bold text-slate-900 font-mono">{data.employeeId || '—'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 pb-1">
            <span className="text-slate-500">Employee Name:</span>
            <span className="font-bold text-slate-900">{data.employeeName || '—'}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200 pb-1">
            <span className="text-slate-500">Designation:</span>
            <span className="font-semibold text-slate-800">{data.designation || '—'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 pb-1">
            <span className="text-slate-500">Department:</span>
            <span className="font-semibold text-slate-800">{data.department || '—'}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200 pb-1">
            <span className="text-slate-500">Date of Joining:</span>
            <span className="font-semibold text-slate-800">{data.joiningDate ? formatDate(data.joiningDate) : '—'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 pb-1">
            <span className="text-slate-500">Bank Account:</span>
            <span className="font-mono text-slate-800">{data.bankAccountNumber || '—'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">PAN Number:</span>
            <span className="font-mono text-slate-800">
              {data.panNumber ? (data.panNumber.length >= 10 ? `••••••${data.panNumber.slice(-4)}` : data.panNumber) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Paid Days / LOP:</span>
            <span className="font-semibold text-slate-800">{data.paidDays ?? 30} Days / {data.lossOfPayDays ?? 0} LOP</span>
          </div>
        </div>

        {/* Dual Column Boxed Salary Breakdown */}
        <div className="grid grid-cols-2 border border-slate-300 rounded-md overflow-hidden text-xs mb-4">
          
          {/* Earnings Column */}
          <div className="border-r border-slate-300">
            <div className="bg-slate-900 text-white font-bold px-3 py-1.5 text-center uppercase tracking-wider text-[10px]">
              Earnings
            </div>
            <div className="divide-y divide-slate-200 p-2.5 space-y-1">
              <div className="flex justify-between py-0.5">
                <span>Basic Salary</span>
                <span className="font-mono font-medium">{formatCurrency(data.basic)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>House Rent Allowance (HRA)</span>
                <span className="font-mono font-medium">{formatCurrency(data.hra)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Communication & Internet</span>
                <span className="font-mono font-medium">{formatCurrency(data.communicationAllowance)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Travel Allowance</span>
                <span className="font-mono font-medium">{formatCurrency(data.travelAllowance)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Food Allowance</span>
                <span className="font-mono font-medium">{formatCurrency(data.foodAllowance)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Other Special Allowances</span>
                <span className="font-mono font-medium">{formatCurrency(data.otherAllowances)}</span>
              </div>
            </div>
            <div className="bg-blue-50 border-t border-slate-300 px-3 py-1.5 flex justify-between font-bold text-blue-950 text-xs">
              <span>Gross Earnings</span>
              <span className="font-mono text-sm">{formatCurrency(data.grossSalary)}</span>
            </div>
          </div>

          {/* Deductions Column */}
          <div>
            <div className="bg-slate-900 text-white font-bold px-3 py-1.5 text-center uppercase tracking-wider text-[10px]">
              Deductions
            </div>
            <div className="divide-y divide-slate-200 p-2.5 space-y-1">
              <div className="flex justify-between py-0.5 text-slate-700">
                <span>Provident Fund (Employee PF)</span>
                <span className="font-mono font-medium text-red-700">{formatCurrency(data.employeePf)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-700">
                <span>PF Contribution (Employer PF)</span>
                <span className="font-mono font-medium text-red-700">{formatCurrency(data.employerPf)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-700">
                <span>Professional Tax (PT)</span>
                <span className="font-mono font-medium text-red-700">{formatCurrency(data.professionalTax)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-700">
                <span>Gratuity Statutory Provision</span>
                <span className="font-mono font-medium text-red-700">{formatCurrency(data.gratuity)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-700">
                <span>Income Tax / TDS</span>
                <span className="font-mono font-medium text-red-700">{formatCurrency(data.tds)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-400 italic">
                <span>Other Adjustments</span>
                <span className="font-mono">₹0.00</span>
              </div>
            </div>
            <div className="bg-red-50 border-t border-slate-300 px-3 py-1.5 flex justify-between font-bold text-red-950 text-xs">
              <span>Total Deductions</span>
              <span className="font-mono text-sm">{formatCurrency(data.totalDeductions)}</span>
            </div>
          </div>

        </div>

        {/* Net Salary Highlight Box */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-3 rounded-lg flex items-center justify-between mb-4 shadow-xs">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-blue-200 font-semibold">Net Disbursed Salary</div>
            <div className="text-lg font-black font-mono tracking-tight text-emerald-400 mt-0.5">
              {formatCurrency(data.netSalary)}
            </div>
          </div>
          <div className="text-right text-xs max-w-sm">
            <span className="text-slate-300">Amount in Words:</span>
            <div className="font-bold text-white text-[11px] mt-0.5">{data.netSalaryInWords}</div>
          </div>
        </div>

        {/* QR Code Verification Box */}
        <div className="flex items-center justify-between border border-slate-200 bg-slate-50 p-2.5 rounded-md text-xs">
          <div>
            <div className="font-bold text-slate-900 uppercase text-[11px]">Electronic Salary Slip Verification</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Document Number: <span className="font-mono font-semibold text-slate-800">{documentNumber}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Verification ID: <span className="font-mono font-bold text-blue-700">{verificationId}</span>
            </div>
          </div>
          <div className="bg-white p-1 border border-slate-300 rounded">
            <QRCodeSVG value={verificationUrl} size={48} level="M" />
          </div>
        </div>
      </div>

      {/* Footer Notes */}
      <div className="pt-4 border-t border-slate-300 text-[8pt] text-slate-500 text-center space-y-0.5">
        <div>Note: This is a system-generated electronic payroll document and requires no physical ink signature.</div>
        <div>Varsaka Labs • Registered Office: Hyderabad, Telangana, India • info@varsakalabs.com</div>
      </div>

    </div>
  );
};
