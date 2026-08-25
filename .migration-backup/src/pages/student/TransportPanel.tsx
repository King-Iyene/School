import { useState, useEffect } from 'react';
import { Bus, MapPin, Clock, User, AlertCircle, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TransportPanel() {
  const { profile } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('transport_assignments')
        .select('*, routes(id, name, stops, start_point, end_point), vehicles(id, vehicle_number, type, capacity)')
        .eq('student_id', profile.id)
        .maybeSingle();
      setAssignment(data);
      const routeStops = (data?.routes as any)?.stops;
      if (Array.isArray(routeStops)) {
        setStops(routeStops);
      } else if (typeof routeStops === 'string') {
        try { setStops(JSON.parse(routeStops)); } catch { setStops([]); }
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

  const route = assignment?.routes as any;
  const vehicle = assignment?.vehicles as any;

  if (!assignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Transport</h1>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bus className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700 text-lg">No Transport Assigned</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">You have not been assigned to any transport route. Contact the school administration for transport arrangements.</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 text-sm w-fit mx-auto">
            <AlertCircle className="w-4 h-4" />
            Contact school administration
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Transport</h1>

      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-emerald-100 text-sm">Assigned Route</p>
            <h3 className="text-lg font-bold">{route?.name || '—'}</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-emerald-200 text-xs mb-0.5">Vehicle Number</p>
            <p className="font-semibold">{vehicle?.vehicle_number || '—'}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-emerald-200 text-xs mb-0.5">Vehicle Type</p>
            <p className="font-semibold capitalize">{vehicle?.type || 'Bus'}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-emerald-200 text-xs mb-0.5">Pick-up Point</p>
            <p className="font-semibold">{assignment.pickup_point || route?.start_point || '—'}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-emerald-200 text-xs mb-0.5">Drop Point</p>
            <p className="font-semibold">{assignment.drop_point || route?.end_point || '—'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            Timing Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <span className="text-sm text-slate-500">Pick-up Time</span>
              <span className="text-sm font-semibold text-slate-800">{assignment.pickup_time || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <span className="text-sm text-slate-500">Drop-off Time</span>
              <span className="text-sm font-semibold text-slate-800">{assignment.drop_time || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-500">Capacity</span>
              <span className="text-sm font-semibold text-slate-800">{vehicle?.capacity ? `${vehicle.capacity} seats` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            Driver Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <span className="text-sm text-slate-500">Driver Name</span>
              <span className="text-sm font-semibold text-slate-800">{assignment.driver_name || 'Not specified'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <span className="text-sm text-slate-500">Driver Phone</span>
              <span className="text-sm font-semibold text-slate-800">{assignment.driver_phone || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-500">Status</span>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full capitalize">{assignment.status || 'Active'}</span>
            </div>
          </div>
        </div>
      </div>

      {(stops.length > 0 || route) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
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
                    <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${isFirst || isLast ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-emerald-300'}`} />
                    <span className={`text-sm ${isFirst || isLast ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{stopName}</span>
                    {typeof stop === 'object' && stop?.time && (
                      <span className="text-xs text-slate-400 ml-auto">{stop.time}</span>
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
                  <span className="text-sm text-slate-600">Start: {route.start_point}</span>
                </div>
              )}
              {route?.end_point && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">End: {route.end_point}</span>
                </div>
              )}
              {!route?.start_point && !route?.end_point && (
                <p className="text-sm text-slate-400">No route stop details available</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
