import { supabase } from './supabase';

export interface ActivityEntry {
  action: string;              // e.g. 'student.admitted', 'student.graduated', 'fee.payment_recorded'
  entityType: string;          // e.g. 'student', 'user', 'fee_payment', 'result'
  entityId?: string | null;    // id of the affected record
  studentId?: string | null;   // set when the action concerns a specific student
  details?: Record<string, unknown>; // human-readable context, e.g. { name, class, amount }
}

interface Actor {
  id?: string | null;
  school_id?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
}

/**
 * Records a user action in the activity_logs table.
 * Never throws — logging must not break the action being logged.
 */
export async function logActivity(actor: Actor | null | undefined, entry: ActivityEntry): Promise<void> {
  try {
    const name =
      actor?.full_name ||
      [actor?.first_name, actor?.last_name].filter(Boolean).join(' ') ||
      'Unknown';
    const { error } = await supabase.from('activity_logs').insert({
      school_id: actor?.school_id ?? null,
      user_id: actor?.id ?? null,
      user_name: name,
      user_role: actor?.role ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      student_id: entry.studentId ?? null,
      details: entry.details ?? {},
    });
    if (error) console.warn('activity log failed:', error.message);
  } catch (e) {
    console.warn('activity log failed:', e);
  }
}

/** Maps an action code like 'student.admitted' to a friendly label. */
export function actionLabel(action: string): string {
  const map: Record<string, string> = {
    'student.admitted': 'Student admitted',
    'student.updated': 'Student record updated',
    'student.deleted': 'Student record deleted',
    'student.promoted': 'Student promoted',
    'student.graduated': 'Student graduated',
    'parent.account_created': 'Parent account created',
    'user.created': 'User account created',
    'user.deleted': 'User account deleted',
    'fee.payment_recorded': 'Fee payment recorded',
    'result.compiled': 'Results compiled',
    'result.published': 'Results published',
  };
  return map[action] || action.replace(/[._]/g, ' ');
}
