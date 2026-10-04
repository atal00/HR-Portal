import fs from 'fs';
import path from 'path';

const tasks = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '.system_data/dump_tasks.json'), 'utf8'));

console.log(`=== ALL ${tasks.length} TASKS IN tasks_store ===`);
tasks.forEach((t: any, i: number) => {
  console.log(`[Task ${i + 1}] ID: ${t.id}`);
  console.log(`  Title: ${JSON.stringify(t.title)}`);
  console.log(`  Assigned: ${t.assigned_to} | CreatedBy: ${t.created_by}`);
  console.log(`  EmployeeID: ${t.employee_id} | DocumentID: ${t.document_id}`);
  console.log(`  Status: ${t.status} | Priority: ${t.priority} | CreatedAt: ${t.created_at}`);
  console.log(`  Description: ${JSON.stringify(t.description)}`);
});
