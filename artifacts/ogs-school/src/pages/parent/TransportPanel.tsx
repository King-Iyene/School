import { useState, useEffect } from 'react';
import { Bus, MapPin, Clock, User, AlertCircle, Navigation, Phone, ChevronDown, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TransportPanel() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [assignment, setAssignment] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [transLoading, setTransLoading] = useState(false);

  useEffect(() => {
    async function loadChildren() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('parent_student_links')
        .select('*, students!student_id(id, first_name, last_name)')
        .eq('parent_id', profile.id);
      const kids = (data ?? []).map(l => (l as any).students).filter(Boolean);
      setChildren(kids);
      if (kids.length > 0) setSelectedChild((kids[0] as any).id);
      setLoading(false);
    }
    loadChildren();
  }, [profile]);

  useEffect(() => {
    async function loadTransport() {
      if (!selectedChild) return;
      setTransLoading(true);
      const { data } = await supabase
        .from('transport_assignments')
        .select('*, routes(id, name, stops, start_point, end_point), vehicles(id, vehicle_number, type, capacity)')
        .eq('student_id', selectedChild)
        .maybeSingle();
      setAssignment(data);
      const routeStops = (data?.routes as any)?.stops;
      if (Array.isArray(routeStops)) {
        setStops(routeStops);
      } else if (typeof routeStops === 'string') {
        try { setStops(JSON.parse(routeStops)); } catch { setStops([]); }
      } else {
        setStops([]);
      }
      setTransLoading(false);
    }
    loadTransport();
  }, [selectedChild]);

  const selectedChildObj = children.find(c => c.id === selectedChild);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const route = assignment?.routes as any;
  const vehicle = assignment?.vehicles as any;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-app-text">Transport</h1>

      {children.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No children linked to your account</p>
        </div>
      ) : (
        <>
          {children.length > 1 && (
            <div className="relative w-64">
              <select
                value={selectedChild}
                onChange={e => setSelectedChild(e.target.value)}
                className="w-full appearance-none border border-app-border rounded-xl px-4 py-2.5 text-sm font-medium text-app-text focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-app-surface pr-9"
              >
                {children.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
            </div>
          )}

          {transLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !assignment ? (
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bus className="w-8 h-8 text-app-text-muted" />
              </div>
              <h3 className="font-semibold text-app-text text-lg">No Transport Assigned</h3>
              <p className="text-sm text-app-text-muted mt-2 max-w-sm mx-auto">
                {selectedChildObj ? `${(selectedChildObj as any).first_name} has not been assigned to any transport route.` : ''}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 text-sm w-fit mx-auto">
                <AlertCircle className="w-4 h-4" />
                Contact school administration
              </div>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-app-surface/20 rounded-xl flex items-center justify-center">
                    <Bus className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-emerald-100 text-sm">Assigned Route</p>
                    <h3 className="text-lg font-bold">{route?.name || '—'}</h3>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-app-surface/10 rounded-xl p-3">
                    <p className="text-emerald-200 text-xs mb-0.5">Vehicle Number</p>
                    <p className="font-semibold">{vehicle?.vehicle_number || '—'}</p>
                  </div>
                  <div className="bg-app-surface/10 rounded-xl p-3">
                    <p className="text-emerald-200 text-xs mb-0.5">Vehicle Type</p>
                    <p className="font-semibold capitalize">{vehicle?.type || 'Bus'}</p>
                  </div>
                  <div className="bg-app-surface/10 rounded-xl p-3">
                    <p className="text-emerald-200 text-xs mb-0.5">Pick-up Point</p>
                    <p className="font-semibold">{assignment.pickup_point || route?.start_point || '—'}</p>
                  </div>
                  <div className="bg-app-surface/10 rounded-xl p-3">
                    <p className="text-emerald-200 text-xs mb-0.5">Drop Point</p>
                    <p className="font-semibold">{assignment.drop_point || route?.end_point || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
                  <h3 className="font-semibold text-app-text mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Timing Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2.5 border-b border-app-border">
                      <span className="text-sm text-app-text-muted">Pick-up Time</span>
                      <span className="text-sm font-semibold text-app-text">{assignment.pickup_time || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-app-border">
                      <span className="text-sm text-app-text-muted">Drop-off Time</span>
                      <span className="text-sm font-semibold text-app-text">{assignment.drop_time || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-app-text-muted">Capacity</span>
                      <span className="text-sm font-semibold text-app-text">{vehicle?.capacity ? `${vehicle.capacity} seats` : '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
                  <h3 className="font-semibold text-app-text mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    Driver Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2.5 border-b border-app-border">
                      <span className="text-sm text-app-text-muted">Driver Name</span>
                      <span className="text-sm font-semibold text-app-text">{assignment.driver_name || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-app-border">
                      <span className="text-sm text-app-text-muted">Driver Phone</span>
                      <span className="text-sm font-semibold text-app-text">{assignment.driver_phone || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-app-text-muted">Status</span>
                      <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full capitalize">{assignment.status || 'Active'}</span>
                    </div>
                  </div>
                  {(assignment.driver_phone || assignment.driver_name) && (
                    <button className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded-xl transition-colors border border-emerald-100">
                      <Phone className="w-4 h-4" />
                      Contact Driver
                    </button>
                  )}
                </div>
              </div>

              {(stops.length > 0 || route) && (
                <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
                  <h3 className="font-semibold text-app-text mb-4 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-emerald-600" />
                    Route Stops
                  </h3>
                  {stops.length > 0 ? (
                    <div className="relative pl-6">
                      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-emerald-100" />
                      {stops.map((stop: any, i: number) => {
                        const stopName = typeof stop === 'string' ? stop : stop?.name || stop?.stop_name || JSON.stringify(stop);
                        const isFirst = i === 0;
                        const isLast = i === stops.length - 1;
                        return (
                          <div key={i} className="relative flex items-center gap-3 py-2">
                            <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${isFirst || isLast ? 'bg-emerald-500 border-emerald-500' : 'bg-app-surface border-emerald-300'}`} />
                            <span className={`text-sm ${isFirst || isLast ? 'font-semibold text-app-text' : 'text-app-text-muted'}`}>{stopName}</span>
                            {typeof stop === 'object' && stop?.time && (
                              <span className="text-xs text-app-text-muted ml-auto">{stop.time}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {route?.start_point && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-app-text-muted">Start: {route.start_point}</span>
                        </div>
                      )}
                      {route?.end_point && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-app-text-muted" />
                          <span className="text-sm text-app-text-muted">End: {route.end_point}</span>
                        </div>
                      )}
                      {!route?.start_point && !route?.end_point && (
                        <p className="text-sm text-app-text-muted">No route stop details available</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
