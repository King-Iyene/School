import { useState, useEffect } from 'react';
import { ArrowRightLeft, Search, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface InventoryItem {
  id: string;
  name: string;
  current_stock: number;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface IssueRow {
  id: string;
  item_id: string;
  issue_date: string;
  return_date: string | null;
  quantity: number;
  purpose: string;
  status: string;
  issued_to: string;
  issued_to_type: string;
  notes: string;
  inventory_items?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

export default function IssueItem() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [profileResults, setProfileResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [stockError, setStockError] = useState('');
  const [form, setForm] = useState({
    item_id: '',
    issued_to: '',
    issued_to_type: 'student' as 'student' | 'staff',
    quantity: '',
    issue_date: new Date().toISOString().split('T')[0],
    purpose: '',
    notes: '',
  });

  useEffect(() => {
    fetchItems();
    fetchIssues();
  }, []);

  useEffect(() => {
    const item = items.find(i => i.id === form.item_id);
    const qty = Number(form.quantity);
    if (item && qty > item.current_stock) {
      setStockError(`Insufficient stock. Available: ${item.current_stock}`);
    } else {
      setStockError('');
    }
  }, [form.quantity, form.item_id, items]);

  useEffect(() => {
    if (profileSearch.length < 2) {
      setProfileResults([]);
      return;
    }
    const timer = setTimeout(() => searchProfiles(profileSearch), 300);
    return () => clearTimeout(timer);
  }, [profileSearch]);

  async function fetchItems() {
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, current_stock')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setItems(data as InventoryItem[]);
  }

  async function fetchIssues() {
    setLoading(true);
    const { data } = await supabase
      .from('item_issues')
      .select('*, inventory_items(name), profiles!issued_to(first_name, last_name), students!issued_to(first_name, last_name)')
      .eq('school_id', profile?.school_id)
      .order('issue_date', { ascending: false })
      .limit(50);
    if (data) setIssues(data as IssueRow[]);
    setLoading(false);
  }

  async function searchProfiles(search: string) {
    const [{ data: pData }, { data: sData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .eq('school_id', profile?.school_id || '')
        .eq('role', 'teacher')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        .limit(5),
      supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('school_id', profile?.school_id || '')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%`)
        .limit(5)
    ]);

    const results: Profile[] = [
      ...(pData || []).map(p => ({ id: p.id, full_name: `${p.first_name} ${p.last_name}`, role: 'staff' })),
      ...(sData || []).map(s => ({ id: s.id, full_name: `${s.first_name} ${s.last_name}`, role: 'student' }))
    ];
    setProfileResults(results);
  }

  function selectProfile(p: Profile) {
    setSelectedProfile(p);
    setProfileSearch(p.full_name);
    setShowProfileDropdown(false);
    setForm(prev => ({ ...prev, issued_to: p.id, issued_to_type: p.role === 'staff' ? 'staff' : 'student' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stockError || !form.issued_to) return;
    setSaving(true);
    setSaveError('');
    const qty = Number(form.quantity);
    const payload = {
      item_id: form.item_id,
      issued_to: form.issued_to,
      issued_to_type: form.issued_to_type,
      quantity: qty,
      issue_date: form.issue_date,
      purpose: form.purpose,
      notes: form.notes,
      status: 'issued',
      school_id: profile?.school_id,
    };
    const res = await supabase.from('item_issues').insert([payload]);
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }

    const { data: currentItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', form.item_id)
      .single();
    if (currentItem) {
      await supabase
        .from('inventory_items')
        .update({ current_stock: (currentItem.current_stock || 0) - qty })
        .eq('id', form.item_id);
    }

    setSaving(false);
    setForm({
      item_id: '',
      issued_to: '',
      issued_to_type: 'student',
      quantity: '',
      issue_date: new Date().toISOString().split('T')[0],
      purpose: '',
      notes: '',
    });
    setSelectedProfile(null);
    setProfileSearch('');
    fetchIssues();
    fetchItems();
  }

  async function handleReturn(issue: IssueRow) {
    if (!confirm('Mark this item as returned?')) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('item_issues')
      .update({ return_date: today, status: 'returned' })
      .eq('id', issue.id);

    const { data: currentItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', issue.item_id)
      .single();

    if (currentItem) {
      await supabase
        .from('inventory_items')
        .update({ current_stock: (currentItem.current_stock || 0) + issue.quantity })
        .eq('id', issue.item_id);
    }

    fetchIssues();
    fetchItems();
  }

  function statusBadge(status: string) {
    if (status === 'issued') return 'bg-amber-100 text-amber-700';
    if (status === 'returned') return 'bg-emerald-100 text-emerald-700';
    return 'bg-red-100 text-red-700';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500 text-white p-2 rounded-xl">
          <ArrowRightLeft size={20} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Issue Items</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">New Issue</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
            <select
              required
              className={INPUT_CLASS}
              value={form.item_id}
              onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))}
            >
              <option value="">Select item</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock})</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Issue To</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
                placeholder="Search student or staff by name..."
                value={profileSearch}
                onChange={e => { setProfileSearch(e.target.value); setShowProfileDropdown(true); setSelectedProfile(null); setForm(p => ({ ...p, issued_to: '' })); }}
                onFocus={() => setShowProfileDropdown(true)}
              />
            </div>
            {showProfileDropdown && profileSearch.length >= 2 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {profileResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">No results found</div>
                ) : (
                  profileResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProfile(p)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors"
                    >
                      <span className="font-medium text-slate-800">{p.full_name}</span>
                      <span className="ml-2 capitalize text-slate-500 text-xs">{p.role}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Issued To Type</label>
              <select
                className={INPUT_CLASS}
                value={form.issued_to_type}
                onChange={e => setForm(p => ({ ...p, issued_to_type: e.target.value as 'student' | 'staff' }))}
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                className={INPUT_CLASS}
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="0"
              />
              {stockError && <p className="text-red-600 text-xs mt-1">{stockError}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date</label>
            <input
              type="date"
              required
              className={INPUT_CLASS}
              value={form.issue_date}
              onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
            <input
              className={INPUT_CLASS}
              value={form.purpose}
              onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}
              placeholder="Purpose of issue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              className={INPUT_CLASS}
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || !!stockError || !form.item_id || !form.issued_to}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60 transition-colors"
            >
              {saving ? 'Issuing...' : 'Issue Item'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-700">Issued Items</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowRightLeft size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No issued items yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Issued To</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Purpose</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map(issue => (
                  <tr key={issue.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-600">{issue.issue_date ? new Date(issue.issue_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{issue.inventory_items?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {(() => {
                        const i = issue as any;
                        if (i.issued_to_type === 'student') {
                          const s = Array.isArray(i.students) ? i.students[0] : i.students;
                          return s ? `${s.first_name} ${s.last_name}` : (i.profiles?.first_name ? `${i.profiles.first_name} ${i.profiles.last_name}` : '—');
                        }
                        const p = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
                        return p ? `${p.first_name} ${p.last_name}` : '—';
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${issue.issued_to_type === 'staff' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {issue.issued_to_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{issue.quantity}</td>
                    <td className="px-4 py-3 text-slate-600">{issue.purpose || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${statusBadge(issue.status)}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {issue.status === 'issued' && (
                        <button
                          onClick={() => handleReturn(issue)}
                          className="flex items-center gap-1 text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors text-xs"
                        >
                          <RotateCcw size={14} />
                          Return
                        </button>
                      )}
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
