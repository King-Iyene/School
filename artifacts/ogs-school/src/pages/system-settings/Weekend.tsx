import { useState, useEffect } from 'react';
import { CalendarCheck, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const DAYS = [
  { index: 0, name: 'Sunday' },
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
];

export default function Weekend() {
  const { profile } = useAuth();
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function fetchWeekendSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('weekend_settings')
      .select('day_of_week')
      .eq('school_id', profile.school_id);
    if (data) {
      setSelectedDays(new Set(data.map((r: { day_of_week: number }) => r.day_of_week)));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchWeekendSettings();
  }, []);

  function toggleDay(index: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('weekend_settings').delete().eq('school_id', profile.school_id);
    if (selectedDays.size > 0) {
      const rows = Array.from(selectedDays).map((day) => ({
        school_id: profile.school_id,
        day_of_week: day,
      }));
      const { error } = await supabase.from('weekend_settings').insert(rows);
      if (error) {
        setSaving(false);
        showToast('Error saving weekend settings: ' + error.message);
        return;
      }
    }
    setSaving(false);
    showToast('Weekend settings saved successfully.');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Weekend Settings</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Weekend Settings'}
        </button>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          {toast}
        </div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border p-4 text-sm text-app-text-muted">
        Select the days that are considered weekends. These days will be excluded from attendance and scheduling.
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading settings...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS.map((day) => {
            const isWeekend = selectedDays.has(day.index);
            return (
              <div
                key={day.index}
                onClick={() => toggleDay(day.index)}
                className={`cursor-pointer rounded-2xl border-2 p-5 flex items-center gap-4 transition-all select-none ${
                  isWeekend
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-app-border bg-app-surface hover:border-app-border'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isWeekend ? 'bg-emerald-500 border-emerald-500' : 'border-app-border'
                  }`}
                >
                  {isWeekend && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-semibold text-sm ${isWeekend ? 'text-emerald-700' : 'text-app-text'}`}>
                    {day.name}
                  </p>
                  <p className="text-xs text-app-text-muted mt-0.5">Day {day.index}</p>
                </div>
                {isWeekend && (
                  <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Weekend
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div className="bg-app-surface rounded-2xl border border-app-border p-4 text-sm text-app-text-muted">
          <span className="font-medium text-app-text">{selectedDays.size}</span> day{selectedDays.size !== 1 ? 's' : ''} selected as weekend.
          {selectedDays.size > 0 && (
            <span className="ml-2">
              ({DAYS.filter((d) => selectedDays.has(d.index)).map((d) => d.name).join(', ')})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
