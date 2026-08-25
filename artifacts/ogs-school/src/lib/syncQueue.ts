import { supabase } from './supabase';
import { offlineStore, PendingRecord } from './offlineStore';

export const syncQueue = {
  async sync(): Promise<{ synced: number; failed: number }> {
    const pending = await offlineStore.getAllPending();
    let synced = 0;
    let failed = 0;

    for (const record of pending) {
      try {
        const success = await processRecord(record);
        if (success) {
          await offlineStore.deletePending(record.id!);
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { synced, failed };
  },

  async getPendingCount(): Promise<number> {
    const pending = await offlineStore.getAllPending();
    return pending.length;
  },
};

async function processRecord(record: PendingRecord): Promise<boolean> {
  try {
    if (record.operation === 'upsert') {
      const { error } = await supabase
        .from(record.table as never)
        .upsert(record.data as never, record.conflictTarget ? { onConflict: record.conflictTarget } : undefined);
      return !error;
    }

    if (record.operation === 'insert') {
      const { error } = await supabase
        .from(record.table as never)
        .insert(record.data as never);
      return !error;
    }

    if (record.operation === 'update') {
      const data = record.data as Record<string, unknown>;
      const { id, ...rest } = data;
      const { error } = await supabase
        .from(record.table as never)
        .update(rest as never)
        .eq('id', id as never);
      return !error;
    }

    return false;
  } catch {
    return false;
  }
}
