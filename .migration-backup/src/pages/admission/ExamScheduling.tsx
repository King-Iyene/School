import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { navigate, getSearchParams } from '../../components/hooks/useLocation';
import { Calendar, Clock, Users, CheckCircle, AlertCircle } from 'lucide-react';

function getParams() {
  const p = getSearchParams();
  return { id: p.get('id') ?? '', ref: p.get('ref') ?? '' };
}

export default function ExamScheduling() {
  const { id, ref } = getParams();
  const [slots, setSlots] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState('');
  const [applicant, setApplicant] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [slotsRes, appRes] = await Promise.all([
      supabase.from('admission_exam_slots').select('*').eq('is_active', true).gte('exam_date', new Date().toISOString().split('T')[0]).order('exam_date').order('start_time'),
      id ? supabase.from('prospective_students').select('*').eq('id', id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const available = (slotsRes.data ?? []).filter(s => s.booked_count < s.capacity);
    setSlots(available);
    setApplicant((appRes as any).data);

    const existingBooking = await supabase.from('admission_exam_bookings').select('slot_id').eq('prospective_student_id', id).maybeSingle();
    if (existingBooking.data?.slot_id) {
      setBooked(true);
    }

    setLoading(false);
  }

  async function bookSlot() {
    if (!selected || !id) return;
    setBooking(true);
    setError('');

    const { error: bookErr } = await supabase.from('admission_exam_bookings').insert({
      prospective_student_id: id,
      slot_id: selected,
    });

    if (bookErr) {
      setError(bookErr.code === '23505' ? 'You have already booked an exam slot.' : bookErr.message);
      setBooking(false);
      return;
    }

    await supabase.rpc('increment_exam_slot_bookings', { slot_id_param: selected });
    await supabase.rpc('final_update_prospective_student', {
      uuid_param: id,
      status_param: 'exam_scheduled'
    });

    setBooked(true);
    setBooking(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const display = hour > 12 ? hour - 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  const selectedSlot = slots.find(s => s.id === selected);

  if (booked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Exam Scheduled!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your admission examination has been successfully scheduled.<br /><br />
            The exam details, including the date, time, and exam link, will be sent to <strong>{applicant?.guardian_email}</strong> on the morning of your exam day.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Application Ref</span>
              <span className="font-mono font-bold text-slate-700">{applicant?.application_ref ?? ref}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Applicant</span>
              <span className="font-semibold text-slate-800">{applicant?.first_name} {applicant?.last_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <span className="text-emerald-600 font-semibold">Exam Scheduled</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">Keep your application reference safe. You may need it for future correspondence with the school.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img src="/ogs_logo_bg.png" alt="OGS Logo" className="w-16 h-16 object-contain rounded-xl bg-white p-1.5 shadow-lg mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Schedule Admission Exam</h1>
          <p className="text-slate-400 text-sm mt-1">Choose a convenient date and time for your entrance examination</p>
        </div>

        {applicant && (
          <div className="bg-white/10 backdrop-blur rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">{applicant.first_name} {applicant.last_name}</p>
              <p className="text-slate-400 text-xs">Applying for {applicant.class_applying_for} · {applicant.student_type === 'boarding' ? 'Boarding' : 'Day'} Student</p>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500/30">Paid</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Available Exam Slots
            </h2>
            <p className="text-emerald-100 text-sm mt-0.5">Select one exam session. You will receive the exam link via email.</p>
          </div>

          <div className="p-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <div className="py-12 text-center">
                <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No exam slots available at the moment</p>
                <p className="text-slate-400 text-sm mt-1">Please check back later or contact the admissions office</p>
              </div>
            ) : (
              <div className="space-y-3">
                {slots.map(slot => {
                  const remaining = slot.capacity - slot.booked_count;
                  const isSelected = selected === slot.id;
                  return (
                    <button key={slot.id} onClick={() => setSelected(slot.id)}
                      className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all text-left ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>{formatDate(slot.exam_date)}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{formatTime(slot.start_time)} — {formatTime(slot.end_time)}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Users className="w-3 h-3" />{remaining} seat{remaining !== 1 ? 's' : ''} left
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                        {isSelected && <div className="w-full h-full flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full" /></div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-emerald-800 mb-1">Exam Instructions</p>
                <p className="text-emerald-700">{selectedSlot.instructions || 'You will receive full instructions and the exam link via email on the morning of your exam.'}</p>
              </div>
            )}

            <button
              onClick={bookSlot}
              disabled={!selected || booking || slots.length === 0}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              {booking ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Booking...</>
              ) : (
                <><CheckCircle className="w-5 h-5" /> Confirm Exam Booking</>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-5">
          Questions? Contact admissions at <span className="text-emerald-400">admissions@okrikagrammars.edu.ng</span>
        </p>
      </div>
    </div>
  );
}
