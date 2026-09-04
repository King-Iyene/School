import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';

interface EventItem {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_type: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  location: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_TYPE_COLORS: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-700 border-blue-200',
  sports: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cultural: 'bg-amber-100 text-amber-700 border-amber-200',
  holiday: 'bg-rose-100 text-rose-700 border-rose-200',
  examination: 'bg-orange-100 text-orange-700 border-orange-200',
  general: 'bg-slate-100 text-app-text-muted border-app-border',
};

export default function DashboardCalendar() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchEvents();
  }, [year, month, profile?.school_id]);

  async function fetchEvents() {
    if (!profile?.school_id) return;
    
    // Fetch events for current month (+/- few days for padding)
    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('school_id', profile.school_id)
      .gte('event_date', startOfMonth.split('T')[0])
      .lte('event_date', endOfMonth.split('T')[0]);

    setEvents((data ?? []) as EventItem[]);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const cells = [];
  
  // Previous month padding
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthLastDay - i,
      month: month - 1,
      year: month === 0 ? year - 1 : year,
      currentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      day: i,
      month: month,
      year: year,
      currentMonth: true,
    });
  }

  // Next month padding
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      day: i,
      month: month + 1,
      year: month === 11 ? year + 1 : year,
      currentMonth: false,
    });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const eventsByDate = events.reduce((acc, ev) => {
    const d = ev.event_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(ev);
    return acc;
  }, {} as Record<string, EventItem[]>);

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    const { data, error } = await supabase.from('events').delete().eq('id', id).select();
    if (error) {
      alert('Error deleting event: ' + error.message);
    } else if (!data || data.length === 0) {
      alert('Event not deleted. This is almost certainly due to database RLS policies. Please ensure you have run the latest migration: 20260404021500_optimize_events_policies.sql');
    } else {
      setSelectedEvent(null);
      fetchEvents();
    }
  }

  const canManage = profile?.role === 'super_admin';

  return (
    <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-app-border flex items-center justify-between bg-app-surface-alt/50 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <h2 className="text-sm sm:text-lg font-bold text-app-text hidden sm:block">
            School Calendar
          </h2>
          <div className="flex items-center border border-app-border rounded-xl overflow-hidden bg-app-surface">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1.5 sm:p-2 hover:bg-app-surface-alt text-app-text-muted transition-colors border-r border-app-border"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="px-2 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-app-text min-w-[100px] sm:min-w-[140px] text-center">
              {MONTH_NAMES[month]} {year}
            </div>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1.5 sm:p-2 hover:bg-app-surface-alt text-app-text-muted transition-colors border-l border-app-border"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="text-xs font-semibold text-emerald-600 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors border border-emerald-100 shrink-0"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-app-border bg-app-surface-alt/30">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-1.5 sm:py-2 text-center text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-app-text-muted">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-100">
        {cells.map((cell, idx) => {
          const date = new Date(cell.year, cell.month, cell.day);
          const dateStr = date.toISOString().split('T')[0];
          const isToday = dateStr === todayStr;
          const dayEvents = eventsByDate[dateStr] ?? [];
          
          return (
            <div
              key={idx}
              className={`min-h-[48px] sm:min-h-[80px] lg:min-h-[100px] bg-app-surface p-1 sm:p-2 transition-colors hover:bg-app-surface-alt/50 ${!cell.currentMonth ? 'bg-app-surface-alt/30 text-slate-300' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-500 text-white' : 'text-app-text-muted'}`}>
                  {cell.day}
                </span>
                {dayEvents.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </div>
              <div className="space-y-0.5 hidden sm:block">
                {dayEvents.slice(0, 2).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${EVENT_TYPE_COLORS[ev.event_type] || 'bg-slate-100 text-app-text-muted border-app-border'}`}
                  >
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-app-text-muted px-1 font-medium italic">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
              {dayEvents.length > 0 && (
                <div className="sm:hidden mt-0.5">
                  <button
                    onClick={() => setSelectedEvent(dayEvents[0])}
                    className={`w-3 h-3 rounded-full mx-auto block ${EVENT_TYPE_COLORS[dayEvents[0].event_type]?.split(' ')[0] || 'bg-slate-200'}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-2 sm:p-3 bg-app-surface-alt border-t border-app-border flex flex-wrap gap-2 sm:gap-4">
        {Object.entries(EVENT_TYPE_COLORS).map(([type, colorCls]) => (
          <div key={type} className="flex items-center gap-1 sm:gap-1.5">
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border ${colorCls.split(' ')[0]} ${colorCls.split(' ')[2]}`} />
            <span className="text-[9px] sm:text-[10px] font-semibold text-app-text-muted uppercase tracking-tight">{type}</span>
          </div>
        ))}
      </div>

      <Modal 
        isOpen={!!selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
        title={selectedEvent?.title ?? 'Event Details'}
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${EVENT_TYPE_COLORS[selectedEvent.event_type]}`}>
                {selectedEvent.event_type}
              </span>
              <span className="text-xs text-app-text-muted font-medium italic">
                {new Date(selectedEvent.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            
            <p className="text-sm text-app-text-muted leading-relaxed bg-app-surface-alt p-4 rounded-2xl border border-app-border">
              {selectedEvent.description || 'No description provided.'}
            </p>

            {!selectedEvent.all_day && selectedEvent.start_time && (
              <div className="flex items-center gap-2 text-xs font-semibold text-app-text-muted">
                <span className="bg-slate-100 px-3 py-1 rounded-lg">Start: {selectedEvent.start_time}</span>
                {selectedEvent.end_time && <span className="bg-slate-100 px-3 py-1 rounded-lg">End: {selectedEvent.end_time}</span>}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors"
              >
                Close
              </button>
              {canManage && (
                <button 
                  onClick={() => handleDelete(selectedEvent.id)}
                  className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-medium transition-colors border border-red-100 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
