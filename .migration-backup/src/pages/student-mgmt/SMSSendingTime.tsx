import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Clock, Save, Bell, DollarSign, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface SMSConfig {
  enabled: boolean;
  time: string;
}

interface SMSSettings {
  attendance_alert: SMSConfig;
  fee_reminder: SMSConfig;
  exam_results: SMSConfig;
}

const DEFAULT_SETTINGS: SMSSettings = {
  attendance_alert: { enabled: false, time: '08:00' },
  fee_reminder: { enabled: false, time: '10:00' },
  exam_results: { enabled: false, time: '09:00' },
};

const STORAGE_KEY = 'smsSettings';

const SMS_TYPES = [
  {
    key: 'attendance_alert' as const,
    label: 'Attendance Alerts',
    description: 'Send SMS to parents when a student is marked absent or late',
    icon: Bell,
    color: 'emerald',
  },
  {
    key: 'fee_reminder' as const,
    label: 'Fee Reminders',
    description: 'Send fee payment reminders to parents before due dates',
    icon: DollarSign,
    color: 'blue',
  },
  {
    key: 'exam_results' as const,
    label: 'Exam Results',
    description: 'Notify parents when exam results are published',
    icon: FileText,
    color: 'purple',
  },
];

const colorMap = {
  emerald: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
    ring: 'focus:ring-emerald-500 focus:border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    toggle_on: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    ring: 'focus:ring-blue-500 focus:border-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    toggle_on: 'bg-blue-500',
    border: 'border-blue-200',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    ring: 'focus:ring-purple-500 focus:border-purple-500',
    badge: 'bg-purple-100 text-purple-700',
    toggle_on: 'bg-purple-500',
    border: 'border-purple-200',
  },
};

const SMSSendingTime: React.FC = () => {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<SMSSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings(parsed.settings || DEFAULT_SETTINGS);
        setLastSaved(parsed.savedAt || null);
      } catch {}
    }
  }, []);

  const handleToggle = (key: keyof SMSSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  const handleTimeChange = (key: keyof SMSSettings, time: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], time },
    }));
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, savedAt: now }));
    setSaved(true);
    setLastSaved(now);
    setTimeout(() => setSaved(false), 3000);
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const configuredCount = Object.values(settings).filter((s) => s.enabled).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <MessageSquare className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">SMS Sending Time</h1>
              <p className="text-gray-500 text-sm">Configure scheduled SMS alert times</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
          >
            <Save size={16} />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{configuredCount}</p>
            <p className="text-sm text-gray-500 mt-1">Active Alerts</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-3xl font-bold text-gray-400">{SMS_TYPES.length - configuredCount}</p>
            <p className="text-sm text-gray-500 mt-1">Inactive Alerts</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-sm font-medium text-gray-700 mt-1">Last Saved</p>
            <p className="text-xs text-gray-400 mt-1">
              {lastSaved
                ? new Date(lastSaved).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Never'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {SMS_TYPES.map((smsType) => {
            const config = settings[smsType.key];
            const colors = colorMap[smsType.color];
            const Icon = smsType.icon;

            return (
              <div
                key={smsType.key}
                className={`bg-white rounded-xl shadow-sm border ${
                  config.enabled ? `border-l-4 ${colors.border} border-r border-t border-b border-gray-200` : 'border-gray-200'
                } overflow-hidden`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`${colors.bg} p-2 rounded-lg`}>
                        <Icon className={colors.text} size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{smsType.label}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{smsType.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle(smsType.key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.enabled ? colors.toggle_on : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          config.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className={`transition-all ${config.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
                      <Clock size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Send Time</label>
                        <input
                          type="time"
                          value={config.time}
                          onChange={(e) => handleTimeChange(smsType.key, e.target.value)}
                          className={`border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 outline-none ${colors.ring}`}
                        />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Formatted</p>
                        <p className="text-sm font-semibold text-gray-700">{formatTime(config.time)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {config.enabled ? (
                      <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${colors.badge}`}>
                        <CheckCircle size={12} />
                        Configured - sends at {formatTime(config.time)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                        <AlertCircle size={12} />
                        Not Configured
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">SMS Gateway Required</p>
              <p className="text-sm text-amber-700">
                These settings configure the scheduled times for SMS alerts. An SMS gateway service must be configured separately for actual message delivery. Contact your system administrator to set up SMS integration.
              </p>
            </div>
          </div>
        </div>

        {saved && (
          <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">SMS settings saved successfully!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SMSSendingTime;
