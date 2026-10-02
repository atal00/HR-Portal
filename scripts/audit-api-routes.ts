import fs from 'fs';
import path from 'path';

function findRouteFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findRouteFiles(fullPath));
    } else if (file === 'route.ts' || file === 'route.js') {
      results.push(fullPath);
    }
  });
  return results;
}

const apiDir = path.resolve(process.cwd(), 'src/app/api');
const files = findRouteFiles(apiDir);

console.log('=== ENHANCED API ROUTE SECURITY & AUTHORIZATION AUDIT ===');
console.log(`Auditing ${files.length} API route files.\n`);

const results: any[] = [];

files.forEach((f) => {
  const relPath = path.relative(process.cwd(), f).replace(/\\/g, '/');
  const content = fs.readFileSync(f, 'utf-8');

  // Methods detected
  const methods: string[] = [];
  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].forEach((m) => {
    if (new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(content)) {
      methods.push(m);
    }
  });

  const usesRequireAuthUser = content.includes('requireAuthUser');
  const usesRequireUserPerm = content.includes('requireUserPermission');
  const usesGetCurrentUser = content.includes('getCurrentUser');
  const usesVerifySession = content.includes('verifySessionToken');
  const hasAuthGuard = usesRequireAuthUser || usesRequireUserPerm || usesGetCurrentUser || usesVerifySession;

  const hasPermissionCheck = content.includes('hasPermission') || usesRequireUserPerm;
  const hasRoleCheck = /role\s*===|is_super_admin|isTargetSuperAdmin|SUPER_ADMIN|HR_ADMIN|PAYROLL_ADMIN/.test(content);
  
  // Status code handling on error
  const catchesAuthError = content.includes('error.status') || content.includes('instanceof AuthError') || (content.includes('401') && hasAuthGuard);
  const catchesWith500Only = /catch\s*\([^)]*\)\s*\{[^}]*500[^}]*\}/.test(content) && !content.includes('error.status');

  const hasRateLimit = content.includes('rateLimiter') || content.includes('isBlocked');

  // Classification
  let classification = 'UNKNOWN';
  if (relPath.includes('auth/login') || relPath.includes('auth/logout') || relPath.includes('verify/')) {
    classification = 'PUBLIC_ENTRYPOINT';
  } else if (relPath.includes('auth/break-glass')) {
    classification = 'EMERGENCY_RECOVERY_KEY';
  } else if (!hasAuthGuard) {
    classification = 'CRITICAL: UNPROTECTED (NO AUTH GUARD)';
  } else if (hasPermissionCheck || hasRoleCheck) {
    classification = 'PROTECTED (AUTH + RBAC)';
  } else {
    classification = 'AUTHENTICATED_ONLY (NO SPECIFIC ROLE/PERMISSION)';
  }

  // IDOR Risk
  const hasParamId = relPath.includes('[id]') || relPath.includes('[employeeId]') || relPath.includes('[verificationId]');
  let idorRisk = 'N/A';
  if (hasParamId && !relPath.includes('verify/')) {
    if (!hasAuthGuard) {
      idorRisk = 'CRITICAL (UNAUTHENTICATED IDOR)';
    } else if (!hasPermissionCheck && !hasRoleCheck) {
      idorRisk = 'HIGH (NO RBAC VERIFICATION ON TARGET ID)';
    } else {
      idorRisk = 'LOW / MITIGATED (RBAC REQUIRED)';
    }
  }

  results.push({
    route: `/${relPath.replace('src/app/', '').replace('/route.ts', '')}`,
    methods,
    classification,
    hasAuthGuard,
    guardType: usesRequireAuthUser ? 'requireAuthUser' : usesRequireUserPerm ? 'requireUserPermission' : usesGetCurrentUser ? 'getCurrentUser' : 'none',
    hasPermissionCheck,
    hasRoleCheck,
    catchesAuthError,
    catchesWith500Only,
    hasRateLimit,
    idorRisk,
  });
});

console.table(results.map(r => ({
  Route: r.route,
  Methods: r.methods.join(', '),
  Class: r.classification,
  Auth: r.hasAuthGuard ? r.guardType : 'NO',
  RBAC: (r.hasPermissionCheck || r.hasRoleCheck) ? 'YES' : 'NO',
  IDOR: r.idorRisk,
  RateLimit: r.hasRateLimit ? 'YES' : 'NO',
  Status401: r.catchesAuthError ? 'YES' : '500_FALLBACK',
})));
