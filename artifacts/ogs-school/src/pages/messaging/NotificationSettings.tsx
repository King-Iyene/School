import { useState, useEffect } from 'react';
import { Bell, MessageCircle, Mail, Smartphone, ToggleLeft, ToggleRight, Save, CheckCircle, AlertCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Trigger {
  id?: string;
  event_type: string;
  label: string;
  description: string;
  channels: string[];
  enabled: boolean;
}

const DEFAULT_TRIGGERS: Omit<Trigger, 'id'>[] = [
  { event_type: 'fee_due_reminder', label: 'Fee Due Reminder', description: 'Notify parents when school fees are approaching due date', channels: ['in_app'], enabled: true },
  { event_type: 'fee_overdue', label: 'Fee Overdue Alert', description: 'Alert parents when fees become overdue', channels: ['in_app', 'whatsapp'], enabled: true },
  { event_type: 'exam_results', label: 'Exam Results Published', description: 'Notify students and parents when exam marks are released', channels: ['in_app'], enabled: true },
  { event_type: 'new_announcement', label: 'New Announcement', description: 'Push notifications when a new school announcement is posted', channels: ['in_app'], enabled: true },
  { event_type: 'attendance_absent', label: 'Absence Alert', description: 'Notify parents when a student is marked absent', channels: ['in_app', 'whatsapp'], enabled: false },
  { event_type: 'homework_assigned', label: 'New Homework', description: 'Notify students when new homework is assigned', channels: ['in_app'], enabled: true },
  { event_type: 'order_ready', label: 'Store Order Ready', description: 'Notify students when their store order is ready for pickup', channels: ['in_app'], enabled: true },
  { event_type: 'order_confirmed', label: 'Order Confirmed', description: 'Confirm to students when their order has been accepted', channels: ['in_app'], enabled: true },
];

const CHANNEL_ICONS: Record<string, JSX.Element> = {
  in_app: <Bell className="w-3.5 h-3.5" />,
  whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  sms: <Smartphone className="w-3.5 h-3.5" />,
};

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-App',
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
};

const ALL_CHANNELS = ['in_app', 'whatsapp', 'email', 'sms'];

export default function NotificationSettings() {
  const { profile } = useAuth();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const sid = profile?.school_id;

  useEffect(() => { if (sid) load(); }, [sid]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('notification_triggers')
      .select('*')
      .eq('school_id', sid!);

    const existing = data ?? [];
    const merged = DEFAULT_TRIGGERS.map(def => {
      const found = existing.find(e => e.event_type === def.event_type);
      return found
        ? { ...def, ...found }
        : { ...def };
    });
    setTriggers(merged);
    setLoading(false);
  }

  function toggleEnabled(idx: number) {
    setTriggers(prev => prev.map((t, i) => i === idx ? { ...t, enabled: !t.enabled } : t));
  }

  function toggleChannel(idx: number, ch: string) {
    setTriggers(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      const has = t.channels.includes(ch);
      const channels = has ? t.channels.filter(c => c !== ch) : [...t.channels, ch];
      return { ...t, channels };
    }));
  }

  async function saveAll() {
    setSaving(true);
    for (const trigger of triggers) {
      await supabase.from('notification_triggers').upsert(
        { school_id: sid, event_type: trigger.event_type, label: trigger.label, channels: trigger.channels, enabled: trigger.enabled },
        { onConflict: 'school_id,event_type' }
      );
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function sendTestNotification(trigger: Trigger) {
    await supabase.from('notifications').insert({
      school_id: sid,
      user_id: profile?.id,
      title: `[Test] ${trigger.label}`,
      message: `This is a test notification for: ${trigger.description}`,
      type: 'info',
    });
    alert('Test notification sent! Check your notification bell.');
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Notification Settings</h1>
          <p className="text-app-text-muted text-sm mt-1">Configure automatic alerts for key school events</p>
        </div>
        <button
          onClick={saveAll}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save All'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How auto-notifications work</p>
          <p>In-App notifications are delivered immediately inside the portal. WhatsApp and SMS delivery requires those integrations to be configured in their respective settings pages. Email delivery requires Email Settings to be configured.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {triggers.map((trigger, idx) => (
            <div key={trigger.event_type} className={`bg-app-surface rounded-2xl border p-5 transition-all ${trigger.enabled ? 'border-app-border' : 'border-app-border opacity-70'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-semibold text-app-text">{trigger.label}</p>
                    {trigger.enabled ? (
                      <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-app-text-muted rounded-full font-medium">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-app-text-muted">{trigger.description}</p>
                </div>
                <button onClick={() => toggleEnabled(idx)} className="flex-shrink-0 mt-0.5">
                  {trigger.enabled
                    ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                    : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                </button>
              </div>

              {trigger.enabled && (
                <div className="mt-4 pt-4 border-t border-app-border">
                  <p className="text-xs font-semibold text-app-text-muted mb-2.5 uppercase tracking-wide">Delivery Channels</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CHANNELS.map(ch => {
                      const active = trigger.channels.includes(ch);
                      return (
                        <button
                          key={ch}
                          onClick={() => toggleChannel(idx, ch)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-app-surface-alt border-app-border text-app-text-muted hover:border-app-border'}`}
                        >
                          {CHANNEL_ICONS[ch]}
                          {CHANNEL_LABELS[ch]}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => sendTestNotification(trigger)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-app-text-muted hover:text-app-text transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" /> Send test notification
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
