import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface ExamName {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface ExamSetupRow {
  id?: string;
  subject_id: string;
  subject_name?: string;
  ca1_marks: string;
  ca2_marks: string;
  ca3_marks: string;
  exam_marks: string;
  full_marks: string;
  pass_marks: string;
  isNew?: boolean;
}

export default function ExamSetup() {
  const { user } = useAuth();
  const [examNames, setExamNames] = useState<ExamName[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [rows, setRows] = useState<ExamSetupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [newSubjectId, setNewSubjectId] = useState('');

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    if (selectedExam && selectedClass) {
      fetchSetups();
    } else {
      setRows([]);
    }
  }, [selectedExam, selectedClass]);

  async function fetchMeta() {
    const [examRes, classRes, subjectRes] = await Promise.all([
      supabase.from('exam_names').select('id, name').eq('is_active', true).order('name'),
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('subjects').select('id, name').order('name'),
    ]);
    if (examRes.data) setExamNames(examRes.data);
    if (classRes.data) setClasses(classRes.data);
    if (subjectRes.data) setSubjects(subjectRes.data);
  }

  async function fetchSetups() {
    setLoading(true);
    const { data } = await supabase
      .from('exam_setups')
      .select('*, subjects(name)')
      .eq('exam_name_id', selectedExam)
      .eq('class_id', selectedClass);

    if (data) {
      setRows(
        data.map((d) => ({
          id: d.id,
          subject_id: d.subject_id,
          subject_name: d.subjects?.name ?? '',
          ca1_marks: String(d.ca1_marks ?? ''),
          ca2_marks: String(d.ca2_marks ?? ''),
          ca3_marks: String(d.ca3_marks ?? ''),
          exam_marks: String(d.exam_marks ?? ''),
          full_marks: String(d.full_marks ?? ''),
          pass_marks: String(d.pass_marks ?? ''),
        }))
      );
    }
    setLoading(false);
  }

  function updateRow(index: number, field: keyof ExamSetupRow, value: string) {
    const updated = [...rows];
    (updated[index] as any)[field] = value;
    setRows(updated);
  }

  async function handleSaveAll() {
    if (!selectedExam || !selectedClass) return;
    setSaving(true);
    const upserts = rows.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      exam_name_id: selectedExam,
      class_id: selectedClass,
      subject_id: row.subject_id,
      ca1_marks: parseFloat(row.ca1_marks) || 0,
      ca2_marks: parseFloat(row.ca2_marks) || 0,
      ca3_marks: parseFloat(row.ca3_marks) || 0,
      exam_marks: parseFloat(row.exam_marks) || 0,
      full_marks: parseFloat(row.full_marks) || 0,
      pass_marks: parseFloat(row.pass_marks) || 0,
    }));
    await supabase.from('exam_setups').upsert(upserts, { onConflict: 'id' });
    setSaving(false);
    fetchSetups();
  }

  function handleAddSubject() {
    if (!newSubjectId) return;
    const subject = subjects.find((s) => s.id === newSubjectId);
    if (!subject) return;
    if (rows.some((r) => r.subject_id === newSubjectId)) {
      setAddSubjectModalOpen(false);
      return;
    }
    setRows([
      ...rows,
      {
        subject_id: newSubjectId,
        subject_name: subject.name,
        ca1_marks: '',
        ca2_marks: '',
        ca3_marks: '',
        exam_marks: '',
        full_marks: '',
        pass_marks: '',
        isNew: true,
      },
    ]);
    setNewSubjectId('');
    setAddSubjectModalOpen(false);
  }

  const inputClass =
    'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';
  const cellInputClass =
    'bg-app-surface text-app-text border border-app-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-20';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Exam Setup</h1>
      </div>

      <div className="bg-app-surface rounded-xl border border-app-border p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Exam</label>
            <select
              className={inputClass}
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
            >
              <option value="">Select exam</option>
              {examNames.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Class</label>
            <select
              className={inputClass}
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedExam && selectedClass && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setAddSubjectModalOpen(true)}
            className="flex items-center gap-2 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Subject Row
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving || rows.length === 0}
            className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedExam || !selectedClass ? (
        <div className="text-center py-16 text-app-text-muted bg-app-surface rounded-xl border border-app-border">
          <p className="text-lg font-medium">Select exam and class to continue</p>
          <p className="text-sm mt-1">Choose an exam and class from the filters above.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted bg-app-surface rounded-xl border border-app-border">
          <p className="text-lg font-medium">No subjects configured</p>
          <p className="text-sm mt-1">Click "Add Subject Row" to add subjects for this exam.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-app-border">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Subject</th>
                <th className="text-center px-3 py-3 font-semibold text-app-text-muted">CA1 Marks</th>
                <th className="text-center px-3 py-3 font-semibold text-app-text-muted">CA2 Marks</th>
                <th className="text-center px-3 py-3 font-semibold text-app-text-muted">CA3 Marks</th>
                <th className="text-center px-3 py-3 font-semibold text-app-text-muted">Exam Marks</th>
                <th className="text-center px-3 py-3 font-semibold text-app-text-muted">Full Marks</th>
                <th className="text-center px-3 py-3 font-semibold text-app-text-muted">Pass Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {rows.map((row, idx) => (
                <tr key={row.subject_id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">
                    {row.subject_name}
                    {row.isNew && (
                      <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                        New
                      </span>
                    )}
                  </td>
                  {(['ca1_marks', 'ca2_marks', 'ca3_marks', 'exam_marks', 'full_marks', 'pass_marks'] as const).map(
                    (field) => (
                      <td key={field} className="px-3 py-3 text-center">
                        <input
                          type="number"
                          className={cellInputClass}
                          value={row[field]}
                          onChange={(e) => updateRow(idx, field, e.target.value)}
                          placeholder="0"
                        />
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        title="Add Subject Row"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
            <select
              className={inputClass}
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
            >
              <option value="">Select subject</option>
              {subjects
                .filter((s) => !rows.some((r) => r.subject_id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setAddSubjectModalOpen(false)}
              className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSubject}
              disabled={!newSubjectId}
              className="px-4 py-2 text-sm rounded-xl bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
