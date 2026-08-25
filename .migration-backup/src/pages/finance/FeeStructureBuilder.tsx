import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface AcademicYear { id: string; name: string; start_date: string; is_current: boolean; }
interface Term { id: string; name: string; }
interface ClassRecord { id: string; name: string; }
interface FeesGroup { id: string; name: string; }
interface FeesType { id: string; name: string; fees_group_id: string; }

interface CellData {
  amount: number;
  due_date: string;
}

type GridData = Record<string, Record<string, CellData>>;

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';
const STEPS = ['Select Year', 'Boarding Fees', 'Day Fees', 'Review & Confirm'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
}

interface FeeStructureBuilderProps {
  onClose: () => void;
}

export default function FeeStructureBuilder({ onClose }: FeeStructureBuilderProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [groups, setGroups] = useState<FeesGroup[]>([]);
  const [types, setTypes] = useState<FeesType[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [copyFromYear, setCopyFromYear] = useState('');
  const [boardingGrid, setBoardingGrid] = useState<GridData>({});
  const [dayGrid, setDayGrid] = useState<GridData>({});
  const [isMandatory, setIsMandatory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [selectedBoardingTypeId, setSelectedBoardingTypeId] = useState('');
  const [selectedDayTypeId, setSelectedDayTypeId] = useState('');

  const [bulkBoardingAmount, setBulkBoardingAmount] = useState<Record<string, string>>({});
  const [bulkBoardingDate, setBulkBoardingDate] = useState<Record<string, string>>({});
  const [bulkDayAmount, setBulkDayAmount] = useState<Record<string, string>>({});
  const [bulkDayDate, setBulkDayDate] = useState<Record<string, string>>({});

  useEffect(() => { loadLookups(); }, []);

  async function loadLookups() {
    const [{ data: yrs }, { data: trms }, { data: cls }, { data: grps }, { data: tps }] = await Promise.all([
      supabase.from('academic_years').select('id, name, start_date, is_current').order('start_date', { ascending: false }),
      supabase.from('terms').select('id, name').order('name'),
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('fees_groups').select('id, name').order('name'),
      supabase.from('fees_types').select('id, name, fees_group_id').order('name'),
    ]);
    if (yrs) setAcademicYears(yrs);
    if (trms) setTerms(trms);
    if (cls) setClasses(cls);
    if (grps) setGroups(grps);
    if (tps) {
      setTypes(tps);
      const boardingGrp = (grps || []).find((g: FeesGroup) => g.name.toLowerCase().includes('boarding'));
      const dayGrp = (grps || []).find((g: FeesGroup) => g.name.toLowerCase().includes('day'));
      const defaultBoardingType = (tps || []).find((t: FeesType) => t.fees_group_id === boardingGrp?.id);
      const defaultDayType = (tps || []).find((t: FeesType) => t.fees_group_id === dayGrp?.id);
      if (defaultBoardingType) setSelectedBoardingTypeId(defaultBoardingType.id);
      if (defaultDayType) setSelectedDayTypeId(defaultDayType.id);
    }
  }

  function initGrid(): GridData {
    const grid: GridData = {};
    for (const cls of classes) {
      grid[cls.id] = {};
      for (const term of terms) {
        grid[cls.id][term.id] = { amount: 0, due_date: '' };
      }
    }
    return grid;
  }

  function handleYearSelect(yearId: string) {
    setSelectedYear(yearId);
    if (!Object.keys(boardingGrid).length) {
      setBoardingGrid(initGrid());
      setDayGrid(initGrid());
    }
  }

  async function handleCopyFromYear() {
    if (!copyFromYear) return;
    const { data } = await supabase
      .from('fees_master')
      .select('fees_group_id, fees_type_id, class_id, term_id, amount, due_date')
      .eq('academic_year_id', copyFromYear);

    if (!data || data.length === 0) { setError('No records found in selected year.'); return; }

    const boardingGroupId = groups.find(g => g.name.toLowerCase().includes('boarding'))?.id;
    const dayGroupId = groups.find(g => g.name.toLowerCase().includes('day'))?.id;

    const newBoarding = initGrid();
    const newDay = initGrid();

    for (const rec of data) {
      if (!rec.class_id || !rec.term_id) continue;
      const target = rec.fees_group_id === boardingGroupId ? newBoarding : rec.fees_group_id === dayGroupId ? newDay : null;
      if (target && target[rec.class_id] && target[rec.class_id][rec.term_id]) {
        target[rec.class_id][rec.term_id] = { amount: Number(rec.amount), due_date: rec.due_date || '' };
      }
    }

    setBoardingGrid(newBoarding);
    setDayGrid(newDay);
    setError('');
  }

  function applyBulkToColumn(grid: GridData, setGrid: (g: GridData) => void, termId: string, amount: string, dueDate: string) {
    const updated = { ...grid };
    for (const classId of Object.keys(updated)) {
      updated[classId] = { ...updated[classId] };
      updated[classId][termId] = {
        amount: amount ? Number(amount) : updated[classId][termId].amount,
        due_date: dueDate || updated[classId][termId].due_date,
      };
    }
    setGrid(updated);
  }

  function updateCell(grid: GridData, setGrid: (g: GridData) => void, classId: string, termId: string, field: keyof CellData, value: string) {
    const updated = { ...grid };
    updated[classId] = { ...updated[classId] };
    updated[classId][termId] = { ...updated[classId][termId], [field]: field === 'amount' ? Number(value) || 0 : value };
    setGrid(updated);
  }

  function countEntries(grid: GridData): number {
    let count = 0;
    for (const classId of Object.keys(grid)) {
      for (const termId of Object.keys(grid[classId])) {
        if (grid[classId][termId].amount > 0) count++;
      }
    }
    return count;
  }

  function totalAmount(grid: GridData): number {
    let sum = 0;
    for (const classId of Object.keys(grid)) {
      for (const termId of Object.keys(grid[classId])) {
        sum += grid[classId][termId].amount;
      }
    }
    return sum;
  }

  async function handleSubmit() {
    setSaving(true);
    setError('');

    const boardingGroup = groups.find(g => g.name.toLowerCase().includes('boarding'));
    const dayGroup = groups.find(g => g.name.toLowerCase().includes('day'));

    if (!boardingGroup || !dayGroup) {
      setError('Missing fee groups configuration.');
      setSaving(false);
      return;
    }

    if (boardingEntries > 0 && !selectedBoardingTypeId) {
      setError('Please select a Fee Type for Boarding Fees.');
      setSaving(false);
      return;
    }

    if (dayEntries > 0 && !selectedDayTypeId) {
      setError('Please select a Fee Type for Day Fees.');
      setSaving(false);
      return;
    }

    const records: any[] = [];

    for (const classId of Object.keys(boardingGrid)) {
      for (const termId of Object.keys(boardingGrid[classId])) {
        const cell = boardingGrid[classId][termId];
        if (cell.amount > 0) {
          records.push({
            school_id: profile?.school_id,
            fees_group_id: boardingGroup.id,
            fees_type_id: selectedBoardingTypeId,
            class_id: classId,
            academic_year_id: selectedYear,
            term_id: termId,
            amount: cell.amount,
            due_date: cell.due_date || null,
            is_mandatory: isMandatory,
          });
        }
      }
    }

    for (const classId of Object.keys(dayGrid)) {
      for (const termId of Object.keys(dayGrid[classId])) {
        const cell = dayGrid[classId][termId];
        if (cell.amount > 0) {
          records.push({
            school_id: profile?.school_id,
            fees_group_id: dayGroup.id,
            fees_type_id: selectedDayTypeId,
            class_id: classId,
            academic_year_id: selectedYear,
            term_id: termId,
            amount: cell.amount,
            due_date: cell.due_date || null,
            is_mandatory: isMandatory,
          });
        }
      }
    }

    if (records.length === 0) {
      setError('No fee entries to create. Please enter amounts.');
      setSaving(false);
      return;
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from('fees_master').insert(batch);
      if (insertErr) {
        setError(`Error inserting batch: ${insertErr.message}`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSuccess(true);
  }

  const boardingEntries = countEntries(boardingGrid);
  const dayEntries = countEntries(dayGrid);

  function renderGrid(grid: GridData, setGrid: (g: GridData) => void, bulkAmount: Record<string, string>, setBulkAmount: (v: Record<string, string>) => void, bulkDate: Record<string, string>, setBulkDate: (v: Record<string, string>) => void) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 border border-slate-200 w-36">Class</th>
              {terms.map(term => (
                <th key={term.id} className="px-3 py-2 text-center text-xs font-medium text-slate-600 border border-slate-200" colSpan={2}>
                  {term.name}
                </th>
              ))}
            </tr>
            <tr className="bg-slate-50/50">
              <th className="px-3 py-1.5 text-left text-xs text-slate-500 border border-slate-200 font-normal">Apply to all</th>
              {terms.map(term => (
                <td key={term.id} className="border border-slate-200 p-0" colSpan={2}>
                  <div className="flex gap-1 p-1.5">
                    <input
                      type="number"
                      placeholder="Amount"
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      value={bulkAmount[term.id] || ''}
                      onChange={e => setBulkAmount({ ...bulkAmount, [term.id]: e.target.value })}
                    />
                    <input
                      type="date"
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      value={bulkDate[term.id] || ''}
                      onChange={e => setBulkDate({ ...bulkDate, [term.id]: e.target.value })}
                    />
                    <button
                      onClick={() => applyBulkToColumn(grid, setGrid, term.id, bulkAmount[term.id] || '', bulkDate[term.id] || '')}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Apply
                    </button>
                  </div>
                </td>
              ))}
            </tr>
            <tr className="bg-slate-50/30">
              <th className="px-3 py-1 border border-slate-200"></th>
              {terms.map(term => (
                <td key={term.id} className="border border-slate-200 p-0" colSpan={2}>
                  <div className="flex text-xs text-slate-400 px-1.5">
                    <span className="w-24 text-center">Amount (N)</span>
                    <span className="flex-1 text-center">Due Date</span>
                  </div>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map(cls => (
              <tr key={cls.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 whitespace-nowrap">{cls.name}</td>
                {terms.map(term => (
                  <td key={term.id} className="border border-slate-200 p-0" colSpan={2}>
                    <div className="flex gap-1 p-1">
                      <input
                        type="number"
                        min="0"
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        value={grid[cls.id]?.[term.id]?.amount || ''}
                        onChange={e => updateCell(grid, setGrid, cls.id, term.id, 'amount', e.target.value)}
                      />
                      <input
                        type="date"
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        value={grid[cls.id]?.[term.id]?.due_date || ''}
                        onChange={e => updateCell(grid, setGrid, cls.id, term.id, 'due_date', e.target.value)}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Fee Structure Created Successfully</h2>
          <p className="text-slate-500 mb-6">{boardingEntries + dayEntries} fee records have been created for {academicYears.find(y => y.id === selectedYear)?.name}.</p>
          <button onClick={onClose} className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-2.5 rounded-xl transition-colors">
            Back to Fees Master
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fee Structure Builder</h1>
          <p className="text-sm text-slate-500">Set up fees for an entire academic year in one workflow</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-emerald-500 text-white ring-4 ring-emerald-100' : 'bg-slate-100 text-slate-400'
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden md:inline ${i <= step ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`w-8 lg:w-16 h-0.5 ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-600">{error}</div>}

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {step === 0 && (
          <div className="space-y-6 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Academic Year</label>
              <select className={INPUT_CLASS} value={selectedYear} onChange={e => handleYearSelect(e.target.value)}>
                <option value="">Select academic year</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (Current)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="border-t border-slate-100 pt-5">
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Copy className="w-4 h-4 text-slate-400" /> Copy from previous year (optional)
              </label>
              <div className="flex gap-2">
                <select className={INPUT_CLASS} value={copyFromYear} onChange={e => setCopyFromYear(e.target.value)}>
                  <option value="">Select year to copy from</option>
                  {academicYears.filter(y => y.id !== selectedYear).map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleCopyFromYear}
                  disabled={!copyFromYear || !selectedYear}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">This will pre-fill amounts from the selected year. You can adjust them in the next steps.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-slate-800">Boarding Fees</h3>
              <span className="text-xs text-slate-400 ml-2">{boardingEntries} entries configured</span>
            </div>
            <p className="text-sm text-slate-500 mb-4">Enter boarding fee amounts for each class per term. Use "Apply" to bulk-fill a column.</p>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee Type</label>
              <select
                className={INPUT_CLASS}
                value={selectedBoardingTypeId}
                onChange={e => setSelectedBoardingTypeId(e.target.value)}
              >
                <option value="">Select fee type</option>
                {types.filter(t => t.fees_group_id === groups.find(g => g.name.toLowerCase().includes('boarding'))?.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {renderGrid(boardingGrid, setBoardingGrid, bulkBoardingAmount, setBulkBoardingAmount, bulkBoardingDate, setBulkBoardingDate)}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-teal-500" />
              <h3 className="text-lg font-semibold text-slate-800">Day Student Fees</h3>
              <span className="text-xs text-slate-400 ml-2">{dayEntries} entries configured</span>
            </div>
            <p className="text-sm text-slate-500 mb-4">Enter day student fee amounts for each class per term. Use "Apply" to bulk-fill a column.</p>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee Type</label>
              <select
                className={INPUT_CLASS}
                value={selectedDayTypeId}
                onChange={e => setSelectedDayTypeId(e.target.value)}
              >
                <option value="">Select fee type</option>
                {types.filter(t => t.fees_group_id === groups.find(g => g.name.toLowerCase().includes('day'))?.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {renderGrid(dayGrid, setDayGrid, bulkDayAmount, setBulkDayAmount, bulkDayDate, setBulkDayDate)}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800">Review & Confirm</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-500">Academic Year</p>
                <p className="text-lg font-bold text-slate-800">{academicYears.find(y => y.id === selectedYear)?.name}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-500">Boarding Entries</p>
                <p className="text-lg font-bold text-emerald-700">{boardingEntries} records</p>
                <p className="text-xs text-slate-400 mt-1">Type: {types.find(t => t.id === selectedBoardingTypeId)?.name || '--'}</p>
                <p className="text-xs text-slate-400">Total: {formatCurrency(totalAmount(boardingGrid))}</p>
              </div>
              <div className="bg-teal-50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-500">Day Entries</p>
                <p className="text-lg font-bold text-teal-700">{dayEntries} records</p>
                <p className="text-xs text-slate-400 mt-1">Type: {types.find(t => t.id === selectedDayTypeId)?.name || '--'}</p>
                <p className="text-xs text-slate-400">Total: {formatCurrency(totalAmount(dayGrid))}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-800">Total: {boardingEntries + dayEntries} fee records will be created</p>
              <p className="text-xs text-amber-600 mt-1">This will insert new records into the Fees Master table. Existing records for this year will not be modified.</p>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMandatory(!isMandatory)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isMandatory ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isMandatory ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-slate-600">Mark all entries as mandatory</span>
            </div>

            {/* Summary tables */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700">Boarding Fees Summary</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Class</th>
                      {terms.map(t => <th key={t.id} className="px-3 py-2 text-center font-medium text-slate-600">{t.name}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map(cls => {
                      const hasData = terms.some(t => boardingGrid[cls.id]?.[t.id]?.amount > 0);
                      if (!hasData) return null;
                      return (
                        <tr key={cls.id}>
                          <td className="px-3 py-2 font-medium text-slate-700">{cls.name}</td>
                          {terms.map(t => (
                            <td key={t.id} className="px-3 py-2 text-center text-slate-600">
                              {boardingGrid[cls.id]?.[t.id]?.amount > 0 ? formatCurrency(boardingGrid[cls.id][t.id].amount) : '--'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h4 className="text-sm font-semibold text-slate-700">Day Fees Summary</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Class</th>
                      {terms.map(t => <th key={t.id} className="px-3 py-2 text-center font-medium text-slate-600">{t.name}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map(cls => {
                      const hasData = terms.some(t => dayGrid[cls.id]?.[t.id]?.amount > 0);
                      if (!hasData) return null;
                      return (
                        <tr key={cls.id}>
                          <td className="px-3 py-2 font-medium text-slate-700">{cls.name}</td>
                          {terms.map(t => (
                            <td key={t.id} className="px-3 py-2 text-center text-slate-600">
                              {dayGrid[cls.id]?.[t.id]?.amount > 0 ? formatCurrency(dayGrid[cls.id][t.id].amount) : '--'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => step === 0 ? onClose() : setStep(step - 1)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < 3 ? (
          <button
            onClick={() => {
              if (step === 0 && !selectedYear) { setError('Please select an academic year.'); return; }
              setError('');
              setStep(step + 1);
            }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-5 py-2.5 text-sm rounded-xl transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving || (boardingEntries + dayEntries === 0)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-2.5 text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : `Confirm & Create ${boardingEntries + dayEntries} Records`}
          </button>
        )}
      </div>
    </div>
  );
}
