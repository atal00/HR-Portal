import { localDb } from '@/lib/storage/mock-db';
import { AuditLog, SecurityLog } from '@/types/database';

export interface AuditParams {
  userId?: string;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityParams {
  eventType: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Logs an immutable audit event
 */
export async function logAuditEvent(params: AuditParams): Promise<AuditLog> {
  const state = localDb.getState();
  
  // Sanitize metadata to never store passwords or secrets
  const cleanMetadata = { ...params.metadata };
  delete cleanMetadata.password;
  delete cleanMetadata.token;
  delete cleanMetadata.secret;
  delete cleanMetadata.apiKey;

  const log: AuditLog = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: params.userId,
    user_email: params.userEmail || 'system@varsaka.com',
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    metadata: cleanMetadata,
    ip_address: params.ipAddress || '127.0.0.1',
    user_agent: params.userAgent || 'Portal-Client/1.0',
    created_at: new Date().toISOString(),
  };

  state.audit_logs.unshift(log);
  localDb.save();
  return log;
}

/**
 * Logs a high-priority security incident or access anomaly
 */
export async function logSecurityEvent(params: SecurityParams): Promise<SecurityLog> {
  const state = localDb.getState();

  const secLog: SecurityLog = {
    id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    event_type: params.eventType,
    severity: params.severity || 'MEDIUM',
    description: params.description,
    user_id: params.userId,
    ip_address: params.ipAddress || '127.0.0.1',
    user_agent: params.userAgent || 'Portal-Client/1.0',
    metadata: params.metadata || {},
    created_at: new Date().toISOString(),
  };

  state.security_logs.unshift(secLog);
  localDb.save();
  return secLog;
}
