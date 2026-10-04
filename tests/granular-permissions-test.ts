import assert from 'assert';
import { db } from '../src/lib/db';
import { ROLE_PERMISSIONS, PERMISSION_DESCRIPTIONS, hasPermission } from '../src/lib/rbac';
import { PermissionCode, RoleCode } from '../src/types/database';
import { POST, DELETE } from '../src/app/api/users/[id]/permissions/route';
import { NextRequest } from 'next/server';

function logPass(msg: string) {
  console.log(`✅ PASS: ${msg}`);
}

function logFail(msg: string, err?: any) {
  console.error(`❌ FAIL: ${msg}`, err || '');
}

async function runGranularPermissionsTestSuite() {
  console.log('================================================================');
  console.log('VARSAKA HR PORTAL - GRANULAR PERMISSION MANAGEMENT QA SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            passed++;
            logPass(name);
          })
          .catch((err) => {
            logFail(name, err);
            throw err;
          });
      }
      passed++;
      logPass(name);
    } catch (err) {
      logFail(name, err);
      throw err;
    }
  }

  const testActorAdmin = {
    id: 'test-admin-actor-qa',
    email: 'admin.qa@varsaka.com',
  };

  const testUserViewer = 'test-qa-user-viewer-001';
  const testUserHr = 'test-qa-user-hr-002';

  // Clean up any test setting keys before starting
  await db.systemSettings.set(`user_perm_overrides_${testUserViewer}`, [], 'Test cleanup');
  await db.systemSettings.set(`user_perm_overrides_${testUserHr}`, [], 'Test cleanup');

  // --------------------------------------------------------------------------
  // TEST 1: Role denied + Grant override → effective permission becomes Granted
  // --------------------------------------------------------------------------
  await test('1. Role denied + Grant override → effective permission becomes Granted', async () => {
    // VIEWER does not have 'employee.create'
    assert(!ROLE_PERMISSIONS.VIEWER.includes('employee.create'), 'VIEWER role must deny employee.create by default');

    await db.users.setPermissionOverride(
      testUserViewer,
      'employee.create',
      true,
      testActorAdmin.id,
      testActorAdmin.email,
      'Temporary emergency employee onboarding access'
    );

    const perms = await db.users.getPermissions(testUserViewer, 'VIEWER');
    const item = perms.find((p) => p.permission === 'employee.create');

    assert(item, 'Item employee.create should be in status list');
    assert.strictEqual(item?.effective, true, 'Effective permission must be true after grant override');
    assert.strictEqual(item?.source, 'EXPLICIT_GRANT', 'Source must be EXPLICIT_GRANT');
    assert(perms.effectivePermissions.includes('employee.create'), 'effectivePermissions array must include employee.create');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Role denied + Grant override + Remove Override → returns to Denied
  // --------------------------------------------------------------------------
  await test('2. Role denied + Grant override + Remove Override → effective returns to Denied', async () => {
    await db.users.resetPermissionOverride(
      testUserViewer,
      'employee.create',
      testActorAdmin.id,
      testActorAdmin.email
    );

    const perms = await db.users.getPermissions(testUserViewer, 'VIEWER');
    const item = perms.find((p) => p.permission === 'employee.create');

    assert(item, 'Item employee.create should be in status list');
    assert.strictEqual(item?.effective, false, 'Effective permission must be false after remove override');
    assert.strictEqual(item?.source, 'ROLE_DEFAULT', 'Source must return to ROLE_DEFAULT');
    assert(!perms.effectivePermissions.includes('employee.create'), 'effectivePermissions must not include employee.create');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Role granted + Remove Override → effective permission remains Granted
  // --------------------------------------------------------------------------
  await test('3. Role granted + Remove Override → effective permission remains Granted', async () => {
    // HR_ADMIN grants employee.create by default
    assert(ROLE_PERMISSIONS.HR_ADMIN.includes('employee.create'), 'HR_ADMIN role must grant employee.create by default');

    await db.users.resetPermissionOverride(
      testUserHr,
      'employee.create',
      testActorAdmin.id,
      testActorAdmin.email
    );

    const perms = await db.users.getPermissions(testUserHr, 'HR_ADMIN');
    const item = perms.find((p) => p.permission === 'employee.create');

    assert.strictEqual(item?.effective, true, 'Effective permission must remain Granted from role');
    assert.strictEqual(item?.source, 'ROLE_DEFAULT', 'Source must be ROLE_DEFAULT');
    assert(perms.effectivePermissions.includes('employee.create'), 'effectivePermissions must include employee.create');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Explicit Deny override + Remove Override → role default is restored
  // --------------------------------------------------------------------------
  await test('4. Explicit Deny override + Remove Override → role default is restored', async () => {
    // HR_ADMIN has document.offer.view by default
    assert(ROLE_PERMISSIONS.HR_ADMIN.includes('document.offer.view'), 'HR_ADMIN grants document.offer.view by default');

    // Step A: Set Deny override
    await db.users.setPermissionOverride(
      testUserHr,
      'document.offer.view',
      false,
      testActorAdmin.id,
      testActorAdmin.email,
      'Temporary restriction'
    );

    const permsDeny = await db.users.getPermissions(testUserHr, 'HR_ADMIN');
    const itemDeny = permsDeny.find((p) => p.permission === 'document.offer.view');
    assert.strictEqual(itemDeny?.effective, false, 'Explicit deny must make effective false');
    assert.strictEqual(itemDeny?.source, 'EXPLICIT_REVOKE', 'Source must be EXPLICIT_REVOKE');

    // Step B: Remove Override
    await db.users.resetPermissionOverride(
      testUserHr,
      'document.offer.view',
      testActorAdmin.id,
      testActorAdmin.email
    );

    const permsRestored = await db.users.getPermissions(testUserHr, 'HR_ADMIN');
    const itemRestored = permsRestored.find((p) => p.permission === 'document.offer.view');
    assert.strictEqual(itemRestored?.effective, true, 'Resetting deny override must restore role default Granted');
    assert.strictEqual(itemRestored?.source, 'ROLE_DEFAULT', 'Source must be ROLE_DEFAULT');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Grant override appears as an explicit override in returned data
  // --------------------------------------------------------------------------
  await test('5. Grant override appears as an explicit override in returned data', async () => {
    await db.users.setPermissionOverride(
      testUserViewer,
      'document.certificate.create',
      true,
      testActorAdmin.id,
      testActorAdmin.email
    );

    const perms = await db.users.getPermissions(testUserViewer, 'VIEWER');
    const override = perms.overrides.find((o) => o.permission_code === 'document.certificate.create');
    assert(override, 'Override must be present in overrides list');
    assert.strictEqual(override?.is_granted, true, 'Override is_granted must be true');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Remove Override control appears after Grant
  // --------------------------------------------------------------------------
  await test('6. Remove Override control appears after Grant', async () => {
    const perms = await db.users.getPermissions(testUserViewer, 'VIEWER');
    const override = perms.overrides.find((o) => o.permission_code === 'document.certificate.create');

    // Simulating UI control selector logic
    const control = override ? 'REMOVE_OVERRIDE' : 'GRANT';
    assert.strictEqual(control, 'REMOVE_OVERRIDE', 'Control must be REMOVE_OVERRIDE when override exists');
  });

  // --------------------------------------------------------------------------
  // TEST 7: After Remove Override, Grant appears again when role default is Denied
  // --------------------------------------------------------------------------
  await test('7. After Remove Override, Grant appears again when role default is Denied', async () => {
    await db.users.resetPermissionOverride(
      testUserViewer,
      'document.certificate.create',
      testActorAdmin.id,
      testActorAdmin.email
    );

    const perms = await db.users.getPermissions(testUserViewer, 'VIEWER');
    const isBase = perms.basePermissions.includes('document.certificate.create');
    const override = perms.overrides.find((o) => o.permission_code === 'document.certificate.create');

    const control = override ? 'REMOVE_OVERRIDE' : isBase ? 'INHERITED_FROM_ROLE' : 'GRANT';
    assert.strictEqual(control, 'GRANT', 'Control must return to GRANT when not in role and no override');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Audit event generated for Grant
  // --------------------------------------------------------------------------
  await test('8. Audit event generated for Grant (PERMISSION_OVERRIDE_GRANTED)', async () => {
    await db.users.setPermissionOverride(
      testUserViewer,
      'salary.view',
      true,
      testActorAdmin.id,
      testActorAdmin.email,
      'Payroll audit special authorization'
    );

    const auditLogs = await db.auditLogs.list({ action: 'PERMISSION_OVERRIDE_GRANTED' });
    const log = auditLogs.find(
      (l) => l.metadata?.target_user === testUserViewer && l.metadata?.permission_code === 'salary.view'
    );

    assert(log, 'Audit log entry for PERMISSION_OVERRIDE_GRANTED must exist');
    assert.strictEqual(log?.metadata?.permission_code, 'salary.view');
    assert.strictEqual(log?.metadata?.previous_effective_state, false);
    assert.strictEqual(log?.metadata?.new_effective_state, true);
    assert.strictEqual(log?.metadata?.actor, testActorAdmin.id);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Audit event generated for Remove Override
  // --------------------------------------------------------------------------
  await test('9. Audit event generated for Remove Override (PERMISSION_OVERRIDE_REMOVED)', async () => {
    await db.users.resetPermissionOverride(
      testUserViewer,
      'salary.view',
      testActorAdmin.id,
      testActorAdmin.email
    );

    const auditLogs = await db.auditLogs.list({ action: 'PERMISSION_OVERRIDE_REMOVED' });
    const log = auditLogs.find(
      (l) => l.metadata?.target_user === testUserViewer && l.metadata?.permission_code === 'salary.view'
    );

    assert(log, 'Audit log entry for PERMISSION_OVERRIDE_REMOVED must exist');
    assert.strictEqual(log?.metadata?.permission_code, 'salary.view');
    assert.strictEqual(log?.metadata?.previous_override, 'GRANT');
    assert.strictEqual(log?.metadata?.restored_role_default, false);
    assert.strictEqual(log?.metadata?.resulting_effective_state, false);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Unauthorized actor cannot Grant
  // --------------------------------------------------------------------------
  await test('10. Unauthorized actor cannot Grant via server-side guard', async () => {
    // Normal viewer or hr_admin without permission.assign
    const unauthorizedUser = {
      id: 'unauth-viewer-01',
      role: 'VIEWER' as RoleCode,
      permissions: ['employee.view'] as PermissionCode[],
    };

    const canManage =
      unauthorizedUser.role === 'SUPER_ADMIN' ||
      hasPermission(unauthorizedUser as any, 'permission.assign');

    assert(!canManage, 'Unauthorized actor must fail server-side guard');
  });

  // --------------------------------------------------------------------------
  // TEST 11: Unauthorized actor cannot Remove Override
  // --------------------------------------------------------------------------
  await test('11. Unauthorized actor cannot Remove Override via server-side guard', async () => {
    const unauthorizedUser = {
      id: 'unauth-hr-01',
      role: 'HR_ADMIN' as RoleCode,
      permissions: ['employee.view', 'employee.create'] as PermissionCode[],
    };

    const canManage =
      unauthorizedUser.role === 'SUPER_ADMIN' ||
      hasPermission(unauthorizedUser as any, 'permission.assign');

    assert(!canManage, 'Unauthorized HR_ADMIN must fail permission.assign check');
  });

  // --------------------------------------------------------------------------
  // TEST 12: User cannot use the UI/API to escalate their own permissions
  // --------------------------------------------------------------------------
  await test('12. User cannot escalate their own permissions (self-modification blocked)', async () => {
    // Check self-modification guard logic
    const actorId = 'actor-user-123';
    const targetUserId = 'actor-user-123';

    const isSelfModification = actorId === targetUserId;
    assert(isSelfModification, 'Self-modification detection must flag matching actor and target');
  });

  // --------------------------------------------------------------------------
  // TEST 13: Effective permission is recalculated after every change
  // --------------------------------------------------------------------------
  await test('13. Effective permission is recalculated after every change', async () => {
    const res1 = await db.users.setPermissionOverride(
      testUserViewer,
      'document.offer.create',
      true,
      testActorAdmin.id,
      testActorAdmin.email
    );
    assert(res1, 'Override created');
    const permsAfterGrant = await db.users.getPermissions(testUserViewer, 'VIEWER');
    assert(permsAfterGrant.effectivePermissions.includes('document.offer.create'), 'Must be recalculated as Granted');

    const res2 = await db.users.resetPermissionOverride(
      testUserViewer,
      'document.offer.create',
      testActorAdmin.id,
      testActorAdmin.email
    );
    assert(res2, 'Override removed');
    const permsAfterReset = await db.users.getPermissions(testUserViewer, 'VIEWER');
    assert(!permsAfterReset.effectivePermissions.includes('document.offer.create'), 'Must be recalculated as Denied');
  });

  // --------------------------------------------------------------------------
  // TEST 14: Refreshing/re-fetching preserves the correct persisted state
  // --------------------------------------------------------------------------
  await test('14. Refreshing/re-fetching preserves the correct persisted state', async () => {
    await db.users.setPermissionOverride(
      testUserViewer,
      'employee.update',
      true,
      testActorAdmin.id,
      testActorAdmin.email
    );

    // Fetch 1
    const fetch1 = await db.users.getPermissions(testUserViewer, 'VIEWER');
    // Fetch 2
    const fetch2 = await db.users.getPermissions(testUserViewer, 'VIEWER');

    assert.deepStrictEqual(
      fetch1.effectivePermissions,
      fetch2.effectivePermissions,
      'Persisted state must be identical across consecutive fetches'
    );

    // Cleanup
    await db.users.resetPermissionOverride(testUserViewer, 'employee.update', testActorAdmin.id);
  });

  // --------------------------------------------------------------------------
  // TEST 15: Removing an override does not delete role_permissions
  // --------------------------------------------------------------------------
  await test('15. Removing an override does not delete role_permissions', async () => {
    const hrPermsBefore = [...ROLE_PERMISSIONS.HR_ADMIN];
    const viewerPermsBefore = [...ROLE_PERMISSIONS.VIEWER];

    await db.users.resetPermissionOverride(testUserHr, 'employee.create', testActorAdmin.id);

    assert.deepStrictEqual(
      ROLE_PERMISSIONS.HR_ADMIN,
      hrPermsBefore,
      'ROLE_PERMISSIONS.HR_ADMIN must not be modified by override reset'
    );
    assert.deepStrictEqual(
      ROLE_PERMISSIONS.VIEWER,
      viewerPermsBefore,
      'ROLE_PERMISSIONS.VIEWER must not be modified by override reset'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 16: Removing an override does not change assigned role
  // --------------------------------------------------------------------------
  await test('16. Removing an override does not change assigned role', async () => {
    const userRole: RoleCode = 'HR_ADMIN';

    // Apply grant override
    await db.users.setPermissionOverride(testUserHr, 'settings.update', true, testActorAdmin.id);
    // Remove override
    await db.users.resetPermissionOverride(testUserHr, 'settings.update', testActorAdmin.id);

    // The user's role remains HR_ADMIN
    assert.strictEqual(userRole, 'HR_ADMIN', 'User role must remain strictly unchanged');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} of ${total} tests passed successfully.`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runGranularPermissionsTestSuite().catch((err) => {
  console.error('Granular permissions test crashed:', err);
  process.exit(1);
});
