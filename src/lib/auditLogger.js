import { base44 } from '@/api/base44Client';

/**
 * Log an audit action to the AuditLog entity.
 * @param {object} params
 * @param {string} params.userName - The acting user's full name
 * @param {string} params.userRole - The acting user's role
 * @param {string} params.action - Action type: login|logout|create|update|delete|view|print|approve|reject
 * @param {string} params.module - Module name: Patient|Visit|Lab|Prescription|Billing|Doctor|Staff
 * @param {string} params.description - Human-readable description
 * @param {string} [params.recordId] - ID of the affected record
 * @param {string} [params.recordName] - Name/identifier of the affected record
 */
export async function logAudit({ userName, userRole, action, module, description, recordId, recordName }) {
  try {
    await base44.entities.AuditLog.create({
      user_name: userName || 'Unknown',
      user_role: userRole || 'unknown',
      action,
      module,
      description,
      record_id: recordId || '',
      record_name: recordName || '',
      timestamp: new Date().toISOString(),
      ip_address: 'client'
    });
  } catch {
    // Audit logging should never break main functionality
  }
}