import { db } from '../src/lib/db';
import { RoleCode } from '../src/types/database';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runSuperAdminProtectionTests() {
  console.log('================================================================');
  console.log('VARSAKA HR PORTAL - SUPER ADMINISTRATOR PROTECTION & RBAC SUITE');
  console.log('================================================================\n');

  // Retrieve primary admin user
  const adminUser = await db.users.getByEmail('admin@in.varsaka.com') || await db.users.getByEmail('admin@varsaka.com');
  assert(!!adminUser, 'Primary Super Administrator (admin@in.varsaka.com) exists');
  assert(adminUser?.role === 'SUPER_ADMIN', 'Primary admin has role SUPER_ADMIN');

  const adminId = adminUser!.id;

  // Create a regular user for testing normal management vs protected admin
  const testEmail = `test.staff.${Date.now()}@varsaka.com`;
  const normalUser = await db.users.create({
    full_name: 'Test Regular Staff',
    email: testEmail,
    role: 'HR_ADMIN',
    department: 'Engineering & Technology',
    is_active: true,
  }, adminId, adminUser!.email);
  assert(!!normalUser, `Normal user ${testEmail} created successfully`);

  // --------------------------------------------------------------------------
  // 1. Super Administrator Role Must Be Immutable
  // --------------------------------------------------------------------------
  console.log('\n--- 1. SUPER ADMIN ROLE IMMUTABILITY ---');
  let roleMutationBlocked = false;
  try {
    await db.users.updateRole(adminId, 'VIEWER', normalUser.id, normalUser.email);
  } catch (err: any) {
    roleMutationBlocked = true;
    assert(
      err.message.includes('Super Administrator role is immutable'),
      `Role downgrade attempt correctly blocked: "${err.message}"`
    );
  }
  assert(roleMutationBlocked, 'Server-side guard prevented changing Super Administrator role to VIEWER');

  // Verify role was NOT changed
  const adminAfterRoleAttempt = await db.users.getById(adminId);
  assert(adminAfterRoleAttempt?.role === 'SUPER_ADMIN', 'Super Administrator role remains strictly SUPER_ADMIN');

  // --------------------------------------------------------------------------
  // 2. Super Administrator Department Must Be Protected
  // --------------------------------------------------------------------------
  console.log('\n--- 2. SUPER ADMIN DEPARTMENT PROTECTION ---');
  let deptMutationBlocked = false;
  try {
    await db.users.updateDepartment(adminId, 'Marketing & Sales', normalUser.id, normalUser.email);
  } catch (err: any) {
    deptMutationBlocked = true;
    assert(
      err.message.includes('Super Administrator department is protected'),
      `Department change attempt correctly blocked: "${err.message}"`
    );
  }
  assert(deptMutationBlocked, 'Server-side guard prevented altering Super Administrator department');

  // --------------------------------------------------------------------------
  // 3. Super Administrator Must Not Be Deactivated
  // --------------------------------------------------------------------------
  console.log('\n--- 3. SUPER ADMIN DEACTIVATION PROTECTION ---');
  let deactivationBlocked = false;
  try {
    await db.users.updateStatusWithReason(adminId, false, 'Attempted deactivation by third-party', normalUser.id, normalUser.email);
  } catch (err: any) {
    deactivationBlocked = true;
    assert(
      err.message.includes('Super Administrator account is protected and cannot be deactivated'),
      `Deactivation attempt correctly blocked: "${err.message}"`
    );
  }
  assert(deactivationBlocked, 'Server-side guard prevented deactivating Super Administrator');

  const adminAfterDeactivationAttempt = await db.users.getById(adminId);
  assert(adminAfterDeactivationAttempt?.is_active === true, 'Super Administrator remains active');

  // --------------------------------------------------------------------------
  // 4. Super Administrator Must Not Be Deleted
  // --------------------------------------------------------------------------
  console.log('\n--- 4. SUPER ADMIN DELETION PROTECTION ---');
  let deletionBlocked = false;
  try {
    await db.users.deleteUser(adminId, 'Attempted deletion of admin', normalUser.id, normalUser.email);
  } catch (err: any) {
    deletionBlocked = true;
    assert(
      err.message.includes('Super Administrator account is protected and cannot be deleted'),
      `Deletion attempt correctly blocked: "${err.message}"`
    );
  }
  assert(deletionBlocked, 'Server-side guard prevented deleting Super Administrator');

  // --------------------------------------------------------------------------
  // 5. Prevent Self-Lockout (Self-Demotion, Self-Deactivation, Self-Deletion)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. PREVENT SELF-LOCKOUT SAFEGUARDS ---');
  // Self-demotion
  let selfDemotionBlocked = false;
  try {
    await db.users.updateRole(adminId, 'HR_ADMIN', adminId, adminUser!.email);
  } catch (err: any) {
    selfDemotionBlocked = true;
    assert(
      err.message.includes('Super Administrator role is immutable') || err.message.includes('Self-demotion'),
      `Self-demotion attempt correctly blocked: "${err.message}"`
    );
  }
  assert(selfDemotionBlocked, 'Super Administrator self-demotion strictly blocked');

  // Self-deactivation
  let selfDeactivationBlocked = false;
  try {
    await db.users.updateStatusWithReason(adminId, false, 'Accidental self-deactivation', adminId, adminUser!.email);
  } catch (err: any) {
    selfDeactivationBlocked = true;
    assert(
      err.message.includes('cannot be deactivated') || err.message.includes('Self-deactivation'),
      `Self-deactivation attempt correctly blocked: "${err.message}"`
    );
  }
  assert(selfDeactivationBlocked, 'Super Administrator self-deactivation strictly blocked');

  // Self-deletion
  let selfDeletionBlocked = false;
  try {
    await db.users.deleteUser(adminId, 'Accidental self-deletion', adminId, adminUser!.email);
  } catch (err: any) {
    selfDeletionBlocked = true;
    assert(
      err.message.includes('cannot be deleted') || err.message.includes('Self-deletion'),
      `Self-deletion attempt correctly blocked: "${err.message}"`
    );
  }
  assert(selfDeletionBlocked, 'Super Administrator self-deletion strictly blocked');

  // --------------------------------------------------------------------------
  // 6. Legitimate Management of Normal Users Must Remain Fully Functional
  // --------------------------------------------------------------------------
  console.log('\n--- 6. NORMAL USER MANAGEMENT FUNCTIONALITY ---');
  // Update normal user role
  const updatedNormalRole = await db.users.updateRole(normalUser.id, 'DOCUMENT_ADMIN', adminId, adminUser!.email);
  assert(updatedNormalRole.role === 'DOCUMENT_ADMIN', 'Normal user role successfully updated to DOCUMENT_ADMIN');

  // Update normal user department
  const updatedNormalDept = await db.users.updateDepartment(normalUser.id, 'Finance & Operations', adminId, adminUser!.email);
  assert(updatedNormalDept.department === 'Finance & Operations', 'Normal user department successfully updated');

  // Deactivate normal user with reason
  const deactivatedNormal = await db.users.updateStatusWithReason(normalUser.id, false, 'Temporary staff leave of absence', adminId, adminUser!.email);
  assert(deactivatedNormal.is_active === false, 'Normal user successfully deactivated with mandatory reason');

  // Reactivate normal user
  const reactivatedNormal = await db.users.updateStatusWithReason(normalUser.id, true, undefined, adminId, adminUser!.email);
  assert(reactivatedNormal.is_active === true, 'Normal user successfully reactivated');

  // Delete normal user with reason
  const deletedNormal = await db.users.deleteUser(normalUser.id, 'Employee resigned and offboarding complete', adminId, adminUser!.email);
  assert(deletedNormal.deletion_status === 'DELETED', 'Normal user deletion workflow executes successfully with mandatory reason');

  // --------------------------------------------------------------------------
  // 7. Controlled Break-Glass Emergency Recovery
  // --------------------------------------------------------------------------
  console.log('\n--- 7. CONTROLLED BREAK-GLASS EMERGENCY RECOVERY ---');
  const recoveredAdmin = await db.users.breakGlassRecover('SecOps-Emergency-Key', 'Drill verification of break-glass mechanism');
  assert(recoveredAdmin.email === 'admin@in.varsaka.com' || recoveredAdmin.email === 'admin@varsaka.com', 'Break-glass target resolved to primary Super Administrator');
  assert(recoveredAdmin.role === 'SUPER_ADMIN', 'Break-glass confirms SUPER_ADMIN role');
  assert(recoveredAdmin.is_active === true, 'Break-glass confirms active account status');

  console.log('\n================================================================');
  console.log('ALL SUPER ADMINISTRATOR PROTECTION TESTS PASSED SUCCESSFULLY');
  console.log('================================================================');
}

runSuperAdminProtectionTests().catch((err) => {
  console.error('\n❌ SUPER ADMIN PROTECTION SUITE CRASHED:', err);
  process.exit(1);
});
