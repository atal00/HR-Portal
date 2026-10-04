import fs from 'fs';
import path from 'path';

// Load .env.local if present
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

import { db } from '../src/lib/db';
import { getSupabaseAdminClient } from '../src/lib/supabase';
import { canAccessSalary, canModifySalary, hasPermission } from '../src/lib/rbac';
import { calculateCompensation, calculateNetInHand } from '../src/lib/compensation';

async function runTest() {
  console.log('================================================================');
  console.log('SALARY & COMPENSATION ONBOARDING PERSISTENCE VERIFICATION TEST');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  const supabase = getSupabaseAdminClient();

  // 1. Verify HR_ADMIN user permissions
  const allUsers = await db.users.list();
  const hrUser = allUsers.find(u => u.role === 'HR_ADMIN');
  assert(Boolean(hrUser), '1. HR_ADMIN user exists in system', hrUser?.email);
  assert(
    canAccessSalary(hrUser),
    '2. HR_ADMIN has canAccessSalary clearance (salary.view)',
    JSON.stringify(hrUser?.permissions)
  );
  assert(
    canModifySalary(hrUser),
    '3. HR_ADMIN has canModifySalary clearance (salary.update)',
    JSON.stringify(hrUser?.permissions)
  );

  // 2. Fetch a valid department ID for onboarding test
  const departments = await db.departments.list();
  const deptId = departments[0]?.id;
  assert(Boolean(deptId), '4. Department catalog accessible', `Count: ${departments.length}`);

  // 3. Prepare full onboarding payload as entered in Section D
  const testEmpId = `TEST-SAL-${Date.now().toString().slice(-4)}`;
  const onboardingAnnualCtc = 1200000;
  const onboardingVariablePay = 100000;
  const comp = calculateCompensation(onboardingAnnualCtc, onboardingVariablePay);
  
  const inHand = calculateNetInHand({
    monthlyGross: comp.monthlyGross,
    employeePf: comp.employeePf,
    employerPf: comp.employerPf,
    professionalTax: comp.professionalTax,
    gratuity: comp.gratuity,
    tds: comp.tds,
    esic: 0,
    otherDeductions: 0,
  });

  const salaryPayload = {
    annual_ctc: onboardingAnnualCtc,
    variable_pay: onboardingVariablePay,
    monthly_gross: comp.monthlyGross,
    basic: comp.basic,
    hra: comp.hra,
    special_allowance: Math.max(0, comp.monthlyGross - (comp.basic + comp.hra + 1600)),
    conveyance: 1600,
    other_allowances: comp.otherAllowances,
    employee_pf: comp.employeePf,
    employer_pf: comp.employerPf,
    professional_tax: comp.professionalTax,
    gratuity: comp.gratuity,
    tds: comp.tds,
    esic: 0,
    other_deductions: 0,
    net_salary: inHand.netSalary,
    effective_date: '2026-04-01',
  };

  const employeeData = {
    employee_id: testEmpId,
    full_name: 'Test Salary Onboarding Employee',
    email: `test_salary_${Date.now()}@varsaka.internal`,
    phone: '9876543210',
    address: 'Plot 42, Hitec City, Hyderabad',
    department_id: deptId,
    designation: 'Senior Security Analyst',
    joining_date: '2026-04-01',
    employment_type: 'FULL_TIME' as const,
    work_location: 'Hyderabad - Corporate Office',
    status: 'ACTIVE' as const,
    bank_name: 'HDFC Bank',
    bank_account_holder_name: 'Test Salary Onboarding Employee',
    bank_account_number: '50100987654321',
    bank_ifsc: 'HDFC0001234',
    salary_structure: 'Standard Annual CTC',
  };

  let createdEmployee: any = null;

  try {
    // 4. Create employee via db.employees.create with HR_ADMIN actor
    createdEmployee = await db.employees.create(
      {
        ...employeeData,
        created_by: hrUser!.id,
      },
      hrUser!.id,
      hrUser!.email
    );
    assert(Boolean(createdEmployee?.id), '5. Employee record created in public.employees', createdEmployee?.id);

    // 5. Simulate Onboarding API salary persistence (POST /api/employees logic)
    const canManageSalary = 
      hasPermission(hrUser, 'salary.update') || 
      hasPermission(hrUser, 'employee.create') ||
      hrUser!.role === 'SUPER_ADMIN' ||
      hrUser!.role === 'HR_ADMIN' ||
      hrUser!.role === 'PAYROLL_ADMIN';

    assert(canManageSalary, '6. Onboarding user is authorized to persist salary structure');

    const upsertedSalary = await db.salary.upsert({
      employee_id: createdEmployee.id,
      annual_ctc: salaryPayload.annual_ctc,
      monthly_gross: salaryPayload.monthly_gross,
      basic: salaryPayload.basic,
      hra: salaryPayload.hra,
      special_allowance: salaryPayload.special_allowance,
      conveyance: salaryPayload.conveyance,
      communication_allowance: 0,
      travel_allowance: 0,
      food_allowance: 0,
      other_allowances: salaryPayload.other_allowances,
      employee_pf: salaryPayload.employee_pf,
      employer_pf: salaryPayload.employer_pf,
      professional_tax: salaryPayload.professional_tax,
      gratuity: salaryPayload.gratuity,
      tds: salaryPayload.tds,
      esic: salaryPayload.esic,
      other_deductions: salaryPayload.other_deductions,
      variable_pay: salaryPayload.variable_pay,
      net_salary: salaryPayload.net_salary,
      effective_date: salaryPayload.effective_date,
    }, hrUser!.id, hrUser!.email);

    assert(Boolean(upsertedSalary), '7. db.salary.upsert returned successfully');

    // 6. Direct database inspection in public.employee_salary (Supabase PostgreSQL)
    const { data: directDbSalary, error: directErr } = await supabase
      .from('employee_salary')
      .select('*')
      .eq('employee_id', createdEmployee.id)
      .single();

    assert(!directErr, '8. Direct DB query on public.employee_salary succeeded', directErr?.message);
    assert(
      Number(directDbSalary?.annual_ctc) === onboardingAnnualCtc,
      `9. Persisted Annual CTC matches onboarding input (₹${directDbSalary?.annual_ctc} === ₹${onboardingAnnualCtc})`
    );
    assert(
      Number(directDbSalary?.monthly_gross) === comp.monthlyGross,
      `10. Persisted Monthly Gross matches onboarding calculation (₹${directDbSalary?.monthly_gross} === ₹${comp.monthlyGross})`
    );
    assert(
      Number(directDbSalary?.basic) === comp.basic,
      `11. Persisted Basic Pay matches onboarding calculation (₹${directDbSalary?.basic} === ₹${comp.basic})`
    );
    assert(
      Number(directDbSalary?.net_salary) === inHand.netSalary,
      `12. Persisted Monthly Net matches onboarding calculation (₹${directDbSalary?.net_salary} === ₹${inHand.netSalary})`
    );

    // 7. Verify db.salary.getByEmployeeId(emp.id) as used by Salary & Compensation Management (/salary)
    const loadedSalary = await db.salary.getByEmployeeId(createdEmployee.id);
    assert(Boolean(loadedSalary), '13. db.salary.getByEmployeeId loaded non-null salary structure');
    assert(
      loadedSalary?.annual_ctc === onboardingAnnualCtc,
      `14. Loaded salary annual_ctc is ₹${loadedSalary?.annual_ctc} (NOT ₹0.00)`
    );
    assert(
      loadedSalary?.monthly_gross === comp.monthlyGross,
      `15. Loaded salary monthly_gross is ₹${loadedSalary?.monthly_gross} (NOT ₹0.00)`
    );
    assert(
      loadedSalary?.basic === comp.basic,
      `16. Loaded salary basic is ₹${loadedSalary?.basic} (NOT ₹0.00)`
    );
    assert(
      loadedSalary?.net_salary === inHand.netSalary,
      `17. Loaded salary net_salary is ₹${loadedSalary?.net_salary} (NOT ₹0.00)`
    );
    assert(
      loadedSalary?.conveyance === 1600,
      `18. Loaded extended conveyance allowance is ₹${loadedSalary?.conveyance}`
    );

    // 8. Test Edit Salary Form Save Flow (PUT /api/employees/[id])
    const revisedAnnualCtc = 1500000;
    const revisedComp = calculateCompensation(revisedAnnualCtc, 0);
    const revisedInHand = calculateNetInHand({
      monthlyGross: revisedComp.monthlyGross,
      employeePf: revisedComp.employeePf,
      employerPf: revisedComp.employerPf,
      professionalTax: revisedComp.professionalTax,
      gratuity: revisedComp.gratuity,
      tds: revisedComp.tds,
      esic: 0,
      otherDeductions: 0,
    });

    const updatedSalary = await db.salary.upsert({
      employee_id: createdEmployee.id,
      annual_ctc: revisedAnnualCtc,
      monthly_gross: revisedComp.monthlyGross,
      basic: revisedComp.basic,
      hra: revisedComp.hra,
      special_allowance: Math.max(0, revisedComp.monthlyGross - (revisedComp.basic + revisedComp.hra + 1600)),
      conveyance: 1600,
      communication_allowance: 0,
      travel_allowance: 0,
      food_allowance: 0,
      other_allowances: revisedComp.otherAllowances,
      employee_pf: revisedComp.employeePf,
      employer_pf: revisedComp.employerPf,
      professional_tax: revisedComp.professionalTax,
      gratuity: revisedComp.gratuity,
      tds: revisedComp.tds,
      esic: 0,
      other_deductions: 0,
      variable_pay: 0,
      net_salary: revisedInHand.netSalary,
      effective_date: '2026-05-01',
    }, hrUser!.id, hrUser!.email);

    assert(Boolean(updatedSalary), '19. Salary revision saved via upsert');

    // Reopen and verify updated values
    const reopenedSalary = await db.salary.getByEmployeeId(createdEmployee.id);
    assert(
      reopenedSalary?.annual_ctc === revisedAnnualCtc,
      `20. Reopened salary displays updated Annual CTC (₹${reopenedSalary?.annual_ctc} === ₹${revisedAnnualCtc})`
    );
    assert(
      reopenedSalary?.basic === revisedComp.basic,
      `21. Reopened salary displays updated Basic Pay (₹${reopenedSalary?.basic} === ₹${revisedComp.basic})`
    );
    assert(
      reopenedSalary?.net_salary === revisedInHand.netSalary,
      `22. Reopened salary displays updated Net In-Hand (₹${reopenedSalary?.net_salary} === ₹${revisedInHand.netSalary})`
    );

    // 9. Verify Bank Details preservation
    const refreshedEmp = await db.employees.getById(createdEmployee.id);
    assert(
      refreshedEmp?.bank_name === 'HDFC Bank' &&
      refreshedEmp?.bank_account_number === '50100987654321' &&
      refreshedEmp?.bank_ifsc === 'HDFC0001234',
      '23. Bank coordinates preserved intact on employee master record'
    );

  } finally {
    // 10. Clean up test data cleanly
    if (createdEmployee?.id) {
      console.log('\nCleaning up test employee & salary data...');
      await supabase.from('employee_salary').delete().eq('employee_id', createdEmployee.id);
      await supabase.from('system_settings').delete().eq('key', `sal_meta_${createdEmployee.id}`);
      await supabase.from('employees').delete().eq('id', createdEmployee.id);
      console.log('Cleanup completed successfully.');
    }
  }

  console.log(`\n================================================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================\n`);

  if (failed > 0) process.exit(1);
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
