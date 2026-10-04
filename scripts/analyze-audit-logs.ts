import fs from 'fs';
import path from 'path';

const auditLogs = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '.system_data/dump_audit_logs.json'), 'utf8'));

console.log(`=== AUDIT LOGS ANALYSIS: Total ${auditLogs.length} ===\n`);

const actionCounts: Record<string, number> = {};
auditLogs.forEach((a: any) => {
  actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
});
console.log('Action breakdown:', actionCounts);

console.log('\n--- SAMPLE OF EACH ACTION TYPE ---');
const seenActions = new Set<string>();
auditLogs.forEach((a: any, i: number) => {
  if (!seenActions.has(a.action)) {
    seenActions.add(a.action);
    console.log(`\nAction [${a.action}] (sample row ${i + 1}):`);
    console.log(`  User: ${a.user_email || a.user_id}`);
    console.log(`  Resource: ${a.resource_type}:${a.resource_id}`);
    console.log(`  CreatedAt: ${a.created_at}`);
    console.log(`  IP: ${a.ip_address} | UA: ${a.user_agent}`);
    console.log(`  Metadata:`, JSON.stringify(a.metadata));
  }
});
