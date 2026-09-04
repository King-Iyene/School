import { useState, useEffect } from 'react';
import { Building2, BedDouble, Users, CalendarCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function DormitoryPanel() {
  const { profile } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [roommates, setRoommates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('dormitory_assignments')
        .select('*, dormitory_rooms(id, room_number, room_type, capacity, floor, dormitory_building_id, dormitory_buildings(id, name, gender, contact_number))')
        .eq('student_id', profile.id)
        .maybeSingle();

      if (!data) {
        const { data: basicData } = await supabase
          .from('dormitory_assignments')
          .select('*')
          .eq('student_id', profile.id)
          .maybeSingle();
        setAssignment(basicData);
        setLoading(false);
        return;
      }

      setAssignment(data);
      const roomId = (data?.dormitory_rooms as any)?.id;
      if (roomId) {
        const { data: roommateData } = await supabase
          .from('dormitory_assignments')
          .select('*, students!student_id(id, first_name, last_name, admission_number)')
          .eq('room_id', roomId)
          .neq('student_id', profile.id)
          .eq('status', 'active');
        setRoommates(roommateData ?? []);
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const room = assignment?.dormitory_rooms as any;
  const building = room?.dormitory_buildings as any;

  if (!assignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-app-text">Dormitory</h1>
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-app-text-muted" />
          </div>
          <h3 className="font-semibold text-app-text text-lg">Not Assigned to Dormitory</h3>
          <p className="text-sm text-app-text-muted mt-2 max-w-sm mx-auto">You have not been assigned to any dormitory room. Contact the school administration for dormitory arrangements.</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 text-sm w-fit mx-auto">
            <AlertCircle className="w-4 h-4" />
            Contact school administration
          </div>
        </div>
      </div>
    );
  }

  const statusColor = assignment.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-app-text-muted';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-app-text">Dormitory</h1>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-app-surface/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-300 text-sm">Dormitory Assignment</p>
                <h3 className="text-lg font-bold">{building?.name || 'Building —'}</h3>
              </div>
            </div>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize ${statusColor}`}>
              {assignment.status || 'Active'}
            </span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-app-surface-alt rounded-xl p-3.5">
              <p className="text-xs text-app-text-muted mb-1">Room Number</p>
              <p className="font-semibold text-app-text">{room?.room_number || assignment.room_number || '—'}</p>
            </div>
            <div className="bg-app-surface-alt rounded-xl p-3.5">
              <p className="text-xs text-app-text-muted mb-1">Room Type</p>
              <p className="font-semibold text-app-text capitalize">{room?.room_type || '—'}</p>
            </div>
            <div className="bg-app-surface-alt rounded-xl p-3.5">
              <p className="text-xs text-app-text-muted mb-1">Bed Number</p>
              <p className="font-semibold text-app-text">{assignment.bed_number || '—'}</p>
            </div>
            <div className="bg-app-surface-alt rounded-xl p-3.5">
              <p className="text-xs text-app-text-muted mb-1">Floor</p>
              <p className="font-semibold text-app-text">{room?.floor != null ? `Floor ${room.floor}` : '—'}</p>
            </div>
            <div className="bg-app-surface-alt rounded-xl p-3.5">
              <p className="text-xs text-app-text-muted mb-1">Building Gender</p>
              <p className="font-semibold text-app-text capitalize">{building?.gender || '—'}</p>
            </div>
            <div className="bg-app-surface-alt rounded-xl p-3.5">
              <p className="text-xs text-app-text-muted mb-1">Room Capacity</p>
              <p className="font-semibold text-app-text">{room?.capacity ? `${room.capacity} beds` : '—'}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 bg-emerald-50 rounded-xl p-3.5">
            <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs text-emerald-700 font-medium">Check-in Date: </span>
              <span className="text-sm text-emerald-800 font-semibold">
                {assignment.check_in_date ? new Date(assignment.check_in_date).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {roommates.length > 0 && (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
          <h3 className="font-semibold text-app-text mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Roommates
            <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">{roommates.length}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roommates.map((rm, i) => {
              const rp = Array.isArray(rm.students) ? rm.students[0] : rm.students;
              const colors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700'];
              const color = colors[i % colors.length];
              return (
                <div key={rm.id} className="flex items-center gap-3 p-3 bg-app-surface-alt rounded-xl">
                  <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center text-sm font-bold shrink-0`}>
                    {rp?.first_name?.[0]}{rp?.last_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-app-text truncate">{rp?.first_name} {rp?.last_name}</p>
                    {rp?.admission_number && <p className="text-xs text-app-text-muted">ID: {rp.admission_number}</p>}
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className="text-xs bg-app-surface border border-app-border text-app-text-muted px-2 py-0.5 rounded-full">
                      Bed {rm.bed_number || '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {building && (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
          <h3 className="font-semibold text-app-text mb-3 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-emerald-600" />
            Building Information
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-2 border-b border-app-border">
              <span className="text-sm text-app-text-muted">Building Name</span>
              <span className="text-sm font-semibold text-app-text">{building.name || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-app-border">
              <span className="text-sm text-app-text-muted">Gender</span>
              <span className="text-sm font-semibold text-app-text capitalize">{building.gender || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-app-text-muted">Contact</span>
              <span className="text-sm font-semibold text-app-text">{building.contact_number || 'Contact School'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
