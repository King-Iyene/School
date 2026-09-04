import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, AlertTriangle, RotateCcw, Save, CheckCircle, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'behaviour_settings';

interface BehaviourSettingsData {
  warningThreshold: number;
  suspensionThreshold: number;
  expulsionThreshold: number;
  emailNotificationsEnabled: boolean;
  notifyOnMinor: boolean;
  notifyOnModerate: boolean;
  notifyOnMajor: boolean;
}

const defaultSettings: BehaviourSettingsData = {
  warningThreshold: 10,
  suspensionThreshold: 25,
  expulsionThreshold: 50,
  emailNotificationsEnabled: false,
  notifyOnMinor: false,
  notifyOnModerate: true,
  notifyOnMajor: true,
};

export default function BehaviourSettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<BehaviourSettingsData>({ ...defaultSettings });
  const [saved, setSaved] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${profile?.school_id || ''}`);
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {
        setSettings({ ...defaultSettings });
      }
    }
  }, [profile?.school_id]);

  function handleChange(field: keyof BehaviourSettingsData, value: number | boolean) {
    setSettings(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    setValidationError('');
  }

  function handleSave() {
    if (settings.warningThreshold >= settings.suspensionThreshold) {
      setValidationError('Warning threshold must be less than suspension threshold.');
      return;
    }
    if (settings.suspensionThreshold >= settings.expulsionThreshold) {
      setValidationError('Suspension threshold must be less than expulsion threshold.');
      return;
    }
    localStorage.setItem(`${STORAGE_KEY}_${profile?.school_id || ''}`, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    setSettings({ ...defaultSettings });
    setSaved(false);
    setValidationError('');
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">


      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app-text">Behaviour Module Settings</h1>
        <p className="text-sm text-app-text-muted mt-1">Configure behaviour management preferences and thresholds</p>
      </div>

      {saved && (
        <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-sm font-medium">
          <CheckCircle size={16} /> Settings saved successfully
        </div>
      )}
      {validationError && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {validationError}
        </div>
      )}

      <div className="space-y-5">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
          <div className="px-5 py-4 bg-app-surface-alt border-b border-app-border flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <AlertTriangle size={18} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-app-text">Point Thresholds</h2>
              <p className="text-xs text-app-text-muted mt-0.5">Define when students should receive warnings or disciplinary actions based on accumulated deducted points</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-sm font-medium text-app-text">Warning Level</label>
                <p className="text-xs text-app-text-muted mt-0.5">Student receives a formal warning when deducted points reach this value</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={settings.warningThreshold}
                  onChange={e => handleChange('warningThreshold', parseInt(e.target.value) || 1)}
                  className="bg-app-surface text-app-text w-20 border border-app-border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-app-primary font-medium"
                />
                <span className="text-sm text-app-text-muted">pts</span>
              </div>
            </div>

            <div className="border-t border-app-border" />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-sm font-medium text-app-text">Suspension Level</label>
                <p className="text-xs text-app-text-muted mt-0.5">Student is flagged for potential suspension when deducted points reach this value</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={settings.suspensionThreshold}
                  onChange={e => handleChange('suspensionThreshold', parseInt(e.target.value) || 1)}
                  className="bg-app-surface text-app-text w-20 border border-app-border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-app-primary font-medium"
                />
                <span className="text-sm text-app-text-muted">pts</span>
              </div>
            </div>

            <div className="border-t border-app-border" />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-sm font-medium text-app-text">Expulsion Level</label>
                <p className="text-xs text-app-text-muted mt-0.5">Student is flagged for expulsion consideration when deducted points reach this value</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={settings.expulsionThreshold}
                  onChange={e => handleChange('expulsionThreshold', parseInt(e.target.value) || 1)}
                  className="bg-app-surface text-app-text w-20 border border-app-border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-app-primary font-medium"
                />
                <span className="text-sm text-app-text-muted">pts</span>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-gray-100 rounded-full relative">
                  <div
                    className="absolute left-0 top-0 h-2 bg-yellow-400 rounded-full"
                    style={{ width: `${Math.min((settings.warningThreshold / settings.expulsionThreshold) * 100, 100)}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-2 bg-orange-400 rounded-full"
                    style={{ width: `${Math.min((settings.suspensionThreshold / settings.expulsionThreshold) * 100, 100)}%`, opacity: 0.7 }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-app-text-muted mt-1">
                <span className="text-yellow-600 font-medium">Warning: {settings.warningThreshold}pts</span>
                <span className="text-orange-600 font-medium">Suspension: {settings.suspensionThreshold}pts</span>
                <span className="text-red-600 font-medium">Expulsion: {settings.expulsionThreshold}pts</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
          <div className="px-5 py-4 bg-app-surface-alt border-b border-app-border flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell size={18} className="text-blue-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-app-text">Email Notifications</h2>
              <p className="text-xs text-app-text-muted mt-0.5">Configure automated email notifications sent to parents when incidents are assigned</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-app-text">Enable Parent Email Notifications</label>
                <p className="text-xs text-app-text-muted mt-0.5">Send email to parents/guardians when a behaviour incident is assigned to their child</p>
              </div>
              <button
                onClick={() => handleChange('emailNotificationsEnabled', !settings.emailNotificationsEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.emailNotificationsEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-app-surface rounded-full shadow transition-transform ${settings.emailNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {settings.emailNotificationsEnabled && (
              <div className="border-t border-app-border pt-4 space-y-3 pl-2">
                <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Notify on severity level</p>
                {[
                  { key: 'notifyOnMinor' as const, label: 'Minor Incidents', color: 'text-blue-700', bg: 'bg-blue-100' },
                  { key: 'notifyOnModerate' as const, label: 'Moderate Incidents', color: 'text-amber-700', bg: 'bg-amber-100' },
                  { key: 'notifyOnMajor' as const, label: 'Major Incidents', color: 'text-red-700', bg: 'bg-red-100' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${item.color}`}>
                      <span className={`w-2 h-2 rounded-full ${item.bg.replace('bg-', 'bg-').replace('-100', '-400')}`} />
                      {item.label}
                    </span>
                    <button
                      onClick={() => handleChange(item.key, !settings[item.key])}
                      className={`relative w-10 h-5 rounded-full transition-colors ${settings[item.key] ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-app-surface rounded-full shadow transition-transform ${settings[item.key] ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
          <div className="px-5 py-4 bg-app-surface-alt border-b border-app-border flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <RotateCcw size={18} className="text-purple-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-app-text">Academic Year Reset</h2>
              <p className="text-xs text-app-text-muted mt-0.5">Manage behaviour records at the start of a new academic year</p>
            </div>
          </div>
          <div className="p-5">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Academic Year Reset</p>
                <p className="text-sm text-amber-700 mt-1">
                  This action will archive all current behaviour records and reset incident tracking for the new academic year.
                  Student point totals will be cleared while historical records are preserved for reference.
                  This operation should only be performed at the start of a new academic year by an administrator.
                </p>
                <p className="text-xs text-amber-600 mt-2 font-medium">This feature is managed by the system administrator and requires additional confirmation.</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between p-3 border border-app-border rounded-lg">
              <div>
                <p className="text-sm font-medium text-app-text">Reset Behaviour Records for New Academic Year</p>
                <p className="text-xs text-app-text-muted mt-0.5">Contact your system administrator to perform this action</p>
              </div>
              <div className="flex items-center gap-1 text-gray-300">
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-app-text-muted border border-app-border rounded-lg hover:bg-app-surface-alt transition-colors"
          >
            <RotateCcw size={15} /> Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-app-primary text-white rounded-lg hover:opacity-90 transition-colors text-sm font-medium"
          >
            <Save size={16} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
