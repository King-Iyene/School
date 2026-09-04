import { useState, useEffect } from 'react';
import { ClipboardList, Users, BedDouble, DoorOpen, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Building {
  id: string;
  name: string;
}

interface AssignmentRow {
  id: string;
  check_in_date: string;
  status: string;
  students: { first_name: string; last_name: string } | null;
  dormitory_rooms: {
    room_number: string;
    building_id: string;
    dormitory_buildings: { name: string } | null;
    room_types: { name: string } | null;
  } | null;
}

interface SummaryCard {
  totalRooms: number;
  occupiedRooms: number;
  availableCapacity: number;
  totalStudents: number;
}

export default function DormitoryReport() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [filterBuilding, setFilterBuilding] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryCard>({
    totalRooms: 0,
    occupiedRooms: 0,
    availableCapacity: 0,
    totalStudents: 0,
  });

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [filterBuilding]);

  async function fetchBuildings() {
    const { data } = await supabase
      .from('dormitory_buildings')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setBuildings(data as Building[]);
  }

  async function fetchAssignments() {
    setLoading(true);

    const roomsQuery = supabase
      .from('dormitory_rooms')
      .select('id, room_number, capacity, building_id')
      .eq('school_id', profile?.school_id);

    const { data: rooms } = await roomsQuery;

    let assignQuery = supabase
      .from('dormitory_assignments')
      .select(`
        id,
        check_in_date,
        status,
        students(first_name, last_name),
        dormitory_rooms(
          room_number,
          building_id,
          dormitory_buildings(name),
          room_types(name)
        )
      `)
      .eq('school_id', profile?.school_id)
      .order('check_in_date', { ascending: false });

    if (filterBuilding) {
      assignQuery = assignQuery.eq('dormitory_rooms.building_id', filterBuilding);
    }

    const { data } = await assignQuery;
    const rawData = data || [];
    const filtered = filterBuilding
      ? rawData.filter((a: any) => a.dormitory_rooms?.building_id === filterBuilding)
      : rawData;

    const mapped = filtered.map((a: any) => ({
      ...a,
      students: Array.isArray(a.students) ? a.students[0] : a.students,
      dormitory_rooms: Array.isArray(a.dormitory_rooms) ? a.dormitory_rooms[0] : a.dormitory_rooms,
    }));
    setAssignments(mapped as AssignmentRow[]);

    const totalRooms = rooms?.length ?? 0;
    const activeAssignments = mapped.filter((a: any) => a.status === 'active');
    const occupiedSet = new Set(activeAssignments.map((a: any) => a.dormitory_rooms?.room_number));
    const occupiedRooms = occupiedSet.size;
    const totalCapacity = rooms?.reduce((sum, r: any) => sum + (r.capacity ?? 0), 0) ?? 0;
    const totalStudents = activeAssignments.length;

    setSummary({
      totalRooms,
      occupiedRooms,
      availableCapacity: totalCapacity - totalStudents,
      totalStudents,
    });

    setLoading(false);
  }

  function statusBadge(status: string) {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700';
    if (status === 'inactive') return 'bg-slate-100 text-app-text-muted';
    return 'bg-red-100 text-red-700';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-app-primary text-white p-2 rounded-xl">
          <ClipboardList size={20} />
        </div>
        <h1 className="text-2xl font-bold text-app-text">Dormitory Report</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-app-surface rounded-2xl border border-app-border p-4 flex items-center gap-4">
          <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
            <BedDouble size={20} />
          </div>
          <div>
            <p className="text-xs text-app-text-muted">Total Rooms</p>
            <p className="text-2xl font-bold text-app-text">{summary.totalRooms}</p>
          </div>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border p-4 flex items-center gap-4">
          <div className="bg-amber-100 text-amber-600 p-3 rounded-xl">
            <DoorOpen size={20} />
          </div>
          <div>
            <p className="text-xs text-app-text-muted">Occupied Rooms</p>
            <p className="text-2xl font-bold text-app-text">{summary.occupiedRooms}</p>
          </div>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border p-4 flex items-center gap-4">
          <div className="bg-emerald-100 text-emerald-600 p-3 rounded-xl">
            <BedDouble size={20} />
          </div>
          <div>
            <p className="text-xs text-app-text-muted">Available Capacity</p>
            <p className="text-2xl font-bold text-app-text">{summary.availableCapacity}</p>
          </div>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border p-4 flex items-center gap-4">
          <div className="bg-purple-100 text-purple-600 p-3 rounded-xl">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-app-text-muted">Total Students</p>
            <p className="text-2xl font-bold text-app-text">{summary.totalStudents}</p>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-app-text mb-1">Filter by Building</label>
          <select
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full"
            value={filterBuilding}
            onChange={e => setFilterBuilding(e.target.value)}
          >
            <option value="">All Buildings</option>
            {buildings.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No assignments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Student Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Room Number</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Building</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Room Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Check-in Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">
                      {a.students ? `${a.students.first_name} ${a.students.last_name}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {a.dormitory_rooms?.room_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {a.dormitory_rooms?.dormitory_buildings?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {a.dormitory_rooms?.room_types?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {a.check_in_date ? new Date(a.check_in_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${statusBadge(a.status)}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
