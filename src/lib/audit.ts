import { localDb } from '@/lib/storage/mock-db';
import { getSupabaseAdminClient, isSupabaseConfigured, isProductionEnv } from '@/lib/supabase';
import { AuditLog, SecurityLog } from '@/types/database';

function isUuid(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function shouldUseSupabase(): boolean {
  if (process.env.STORAGE_MODE === 'mock') {
    if (isProductionEnv()) {
      return true; // Production must never use mock
    }
    return false;
  }
  return (
    process.env.STORAGE_MODE === 'supabase' ||
    process.env.NODE_ENV === 'production' ||
    isSupabaseConfigured()
  );
}

function isMockProhibited(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.STORAGE_MODE === 'supabase'
  );
}

export interface AuditParams {
  userId?: string;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  reason?: string;
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
  // Sanitize metadata to never store passwords or secrets
  const cleanMetadata = { ...params.metadata };
  if (params.reason && !cleanMetadata.reason) {
    cleanMetadata.reason = params.reason;
  }
  delete cleanMetadata.password;
  delete cleanMetadata.token;
  delete cleanMetadata.secret;
  delete cleanMetadata.apiKey;
  delete cleanMetadata.serviceRoleKey;
  delete cleanMetadata.totpSecret;
  delete cleanMetadata.mfaSecret;
  delete cleanMetadata.manualKey;
  delete cleanMetadata.secret_encrypted;
  delete cleanMetadata.otp;
  delete cleanMetadata.code;
  delete cleanMetadata.recoveryCode;
  delete cleanMetadata.recoveryCodes;

  // Mask sensitive financial identifiers if present in metadata
  if (typeof cleanMetadata.panNumber === 'string' && cleanMetadata.panNumber.length >= 6) {
    cleanMetadata.panNumber = `••••••${cleanMetadata.panNumber.slice(-4)}`;
  }
  if (typeof cleanMetadata.bankAccountNumber === 'string' && cleanMetadata.bankAccountNumber.length >= 4) {
    cleanMetadata.bankAccountNumber = `••••••••${cleanMetadata.bankAccountNumber.slice(-4)}`;
  }

  const inMemoryLog: AuditLog = {
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

  if (shouldUseSupabase()) {
    try {
      const supabase = getSupabaseAdminClient();
      const dbUserId = isUuid(params.userId) ? params.userId : null;
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: dbUserId,
          user_email: params.userEmail || 'system@varsaka.com',
          action: params.action,
          resource_type: params.resourceType,
          resource_id: params.resourceId || null,
          metadata: cleanMetadata,
          ip_address: params.ipAddress || '127.0.0.1',
          user_agent: params.userAgent || 'Portal-Client/1.0',
        })
        .select('*')
        .single();

      if (error) {
        console.error('Failed to persist audit log to Supabase:', error.message);
      } else if (data) {
        return {
          id: data.id,
          user_id: data.user_id,
          user_email: data.user_email,
          action: data.action,
          resource_type: data.resource_type,
          resource_id: data.resource_id,
          metadata: data.metadata,
          ip_address: data.ip_address,
          user_agent: data.user_agent,
          created_at: data.created_at,
        };
      }
    } catch (err: any) {
      console.error('Audit log persistence exception:', err.message);
    }

    if (isMockProhibited()) {
      return inMemoryLog;
    }
  }

  if (isMockProhibited()) {
    return inMemoryLog;
  }

  // Local fallback (strictly development / non-production mock mode)
  const state = localDb.getState();
  state.audit_logs.unshift(inMemoryLog);
  if (process.env.STORAGE_MODE !== 'supabase' && process.env.NODE_ENV !== 'production') {
    localDb.save();
  }
  return inMemoryLog;
}

/**
 * Logs a high-priority security incident or access anomaly
 */
export async function logSecurityEvent(params: SecurityParams): Promise<SecurityLog> {
  const cleanSecMetadata = { ...params.metadata };
  delete cleanSecMetadata.password;
  delete cleanSecMetadata.token;
  delete cleanSecMetadata.secret;
  delete cleanSecMetadata.apiKey;
  delete cleanSecMetadata.serviceRoleKey;
  delete cleanSecMetadata.totpSecret;
  delete cleanSecMetadata.mfaSecret;
  delete cleanSecMetadata.manualKey;
  delete cleanSecMetadata.secret_encrypted;
  delete cleanSecMetadata.otp;
  delete cleanSecMetadata.code;
  delete cleanSecMetadata.recoveryCode;
  delete cleanSecMetadata.recoveryCodes;

  const inMemorySecLog: SecurityLog = {
    id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    event_type: params.eventType,
    severity: params.severity || 'MEDIUM',
    description: params.description,
    user_id: params.userId,
    ip_address: params.ipAddress || '127.0.0.1',
    user_agent: params.userAgent || 'Portal-Client/1.0',
    metadata: cleanSecMetadata,
    created_at: new Date().toISOString(),
  };

  if (shouldUseSupabase()) {
    try {
      const supabase = getSupabaseAdminClient();
      const dbUserId = isUuid(params.userId) ? params.userId : null;
      const { data, error } = await supabase
        .from('security_logs')
        .insert({
          event_type: params.eventType,
          severity: params.severity || 'MEDIUM',
          description: params.description,
          user_id: dbUserId,
          ip_address: params.ipAddress || '127.0.0.1',
          user_agent: params.userAgent || 'Portal-Client/1.0',
          metadata: cleanSecMetadata,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Failed to persist security log to Supabase:', error.message);
      } else if (data) {
        return {
          id: data.id,
          event_type: data.event_type,
          severity: data.severity as any,
          description: data.description,
          user_id: data.user_id,
          ip_address: data.ip_address,
          user_agent: data.user_agent,
          metadata: data.metadata,
          created_at: data.created_at,
        };
      }
    } catch (err: any) {
      console.error('Security log persistence exception:', err.message);
    }

    if (isMockProhibited()) {
      return inMemorySecLog;
    }
  }

  if (isMockProhibited()) {
    return inMemorySecLog;
  }

  // Local fallback (strictly development / non-production mock mode)
  const state = localDb.getState();
  state.security_logs.unshift(inMemorySecLog);
  if (process.env.STORAGE_MODE !== 'supabase' && process.env.NODE_ENV !== 'production') {
    localDb.save();
  }
  return inMemorySecLog;
}
