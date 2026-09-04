import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, ClipboardPaste, Sparkles, Save, Search, Trash2, Edit2, CheckCircle, XCircle, ChevronDown, ChevronUp, BookOpen, Target, Filter, Plus, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { QuestionBankItem, Subject } from '../../lib/types';
import { apiUrl } from '../../lib/apiUrl';

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href;
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    pages.push(line);
  }
  return pages.join('\n\n');
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

type InputMode = 'upload' | 'paste';
type ActiveTab = 'add' | 'bank';
type QType = 'all' | 'objective' | 'theory';

interface DraftQuestion {
  id: string;
  question_text: string;
  question_type: 'objective' | 'theory';
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  selected: boolean;
}

const DIFF_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function QuestionBank() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('add');

  // ── Add tab state ──────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [pasteText, setPasteText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState('');
  const [extractError, setExtractError] = useState('');
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Bank tab state ─────────────────────────────────────────────────────────
  const [bankItems, setBankItems] = useState<QuestionBankItem[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankType, setBankType] = useState<QType>('all');
  const [bankSubject, setBankSubject] = useState('');
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Load subjects ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from('subjects').select('*').eq('school_id', profile.school_id).order('name')
      .then(({ data }) => setSubjects(data ?? []));
  }, [profile?.school_id]);

  // ── Load bank ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'bank') loadBank();
  }, [activeTab]);

  async function loadBank() {
    if (!profile?.school_id) return;
    setBankLoading(true);
    const { data } = await supabase
      .from('question_bank')
      .select('*, subjects(name)')
      .eq('school_id', profile.school_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setBankItems(data ?? []);
    setBankLoading(false);
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  // ── Extract ────────────────────────────────────────────────────────────────
  async function handleExtract() {
    setExtractError('');
    setExtractStatus('');
    setDrafts([]);
    setExtracting(true);

    try {
      let rawText = '';

      if (inputMode === 'paste') {
        if (!pasteText.trim()) throw new Error('Please paste some text first.');
        rawText = pasteText;
      } else {
        if (!selectedFile) throw new Error('Please select a file first.');
        const ext = selectedFile.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'docx', 'doc'].includes(ext ?? '')) {
          throw new Error('Only PDF and Word (.docx) files are supported.');
        }
        setExtractStatus('Reading file…');
        const arrayBuffer = await selectedFile.arrayBuffer();
        if (ext === 'pdf') {
          setExtractStatus('Parsing PDF…');
          rawText = await extractTextFromPDF(arrayBuffer);
        } else {
          setExtractStatus('Parsing document…');
          rawText = await extractTextFromDOCX(arrayBuffer);
        }
        if (!rawText.trim()) throw new Error('Could not extract any text from the file. The PDF may be image-based (scanned). Try copying and pasting the text instead.');
      }

      setExtractStatus('Extracting questions with AI…');
      const body: Record<string, string> = { text: rawText, fileType: 'text' };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const res = await fetch(apiUrl('/api/extract-questions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Extraction failed');
      }

      const { questions } = await res.json();
      if (!questions?.length) throw new Error('No questions found in the content.');

      setDrafts(questions.map((q: Omit<DraftQuestion, 'id' | 'selected'>) => ({
        ...q,
        id: uid(),
        option_a: q.option_a ?? '',
        option_b: q.option_b ?? '',
        option_c: q.option_c ?? '',
        option_d: q.option_d ?? '',
        correct_answer: q.correct_answer ?? '',
        topic: q.topic ?? '',
        difficulty: q.difficulty ?? 'medium',
        marks: q.marks ?? (q.question_type === 'objective' ? 1 : 5),
        selected: true,
      })));
    } catch (e: unknown) {
      setExtractError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExtracting(false);
      setExtractStatus('');
    }
  }

  function updateDraft(id: string, field: keyof DraftQuestion, value: unknown) {
    setDrafts(ds => ds.map(d => d.id === id ? { ...d, [field]: value } : d));
  }

  // ── Save to bank ───────────────────────────────────────────────────────────
  async function handleSave() {
    const selected = drafts.filter(d => d.selected);
    if (!selected.length) return;
    if (!profile?.school_id) return;
    setSaving(true);
    const rows = selected.map(d => ({
      school_id: profile.school_id,
      subject_id: subjectId || null,
      created_by: profile.id,
      question_text: d.question_text,
      question_type: d.question_type,
      option_a: d.option_a,
      option_b: d.option_b,
      option_c: d.option_c,
      option_d: d.option_d,
      correct_answer: d.correct_answer,
      marks: d.marks,
      difficulty: d.difficulty,
      topic: d.topic,
      source: selectedFile?.name ?? 'Pasted text',
    }));
    const { error } = await supabase.from('question_bank').insert(rows);
    setSaving(false);
    if (error) { setExtractError(error.message); return; }
    setSaveSuccess(true);
    setDrafts([]);
    setPasteText('');
    setSelectedFile(null);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  // ── Delete from bank ───────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeletingId(id);
    await supabase.from('question_bank').update({ is_active: false }).eq('id', id);
    setBankItems(prev => prev.filter(q => q.id !== id));
    setDeletingId(null);
  }

  // ── Filtered bank ──────────────────────────────────────────────────────────
  const filteredBank = bankItems.filter(q => {
    if (bankType !== 'all' && q.question_type !== bankType) return false;
    if (bankSubject && q.subject_id !== bankSubject) return false;
    if (bankSearch && !q.question_text.toLowerCase().includes(bankSearch.toLowerCase()) &&
        !q.topic.toLowerCase().includes(bankSearch.toLowerCase())) return false;
    return true;
  });

  const selectedCount = drafts.filter(d => d.selected).length;
  const objCount = bankItems.filter(q => q.question_type === 'objective').length;
  const theoryCount = bankItems.filter(q => q.question_type === 'theory').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Question Bank</h1>
          <p className="text-app-text-muted text-sm mt-1">Upload documents or paste text — AI extracts and classifies questions automatically</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-app-border">
        {([['add', 'Add Questions', Plus], ['bank', 'Question Bank', BookOpen]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-app-text-muted hover:text-app-text'}`}>
            <Icon className="w-4 h-4" />{label}
            {key === 'bank' && bankItems.length > 0 && (
              <span className="bg-slate-100 text-app-text-muted text-xs px-2 py-0.5 rounded-full">{bankItems.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ADD TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'add' && (
        <div className="space-y-6">
          {/* Input mode toggle */}
          <div className="bg-app-surface rounded-2xl border border-app-border p-6 shadow-sm">
            <div className="flex gap-3 mb-5">
              <button onClick={() => setInputMode('upload')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  inputMode === 'upload' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}>
                <Upload className="w-4 h-4" /> Upload File
              </button>
              <button onClick={() => setInputMode('paste')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  inputMode === 'paste' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}>
                <ClipboardPaste className="w-4 h-4" /> Paste Text
              </button>
            </div>

            {inputMode === 'upload' ? (
              <div ref={dropRef} onDragOver={onDragOver} onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  selectedFile ? 'border-blue-400 bg-blue-50' : 'border-app-border hover:border-blue-400 hover:bg-app-surface-alt'}`}>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-blue-500" />
                    <div className="text-left">
                      <p className="font-semibold text-app-text">{selectedFile.name}</p>
                      <p className="text-app-text-muted text-sm">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                      className="ml-4 text-app-text-muted hover:text-red-500 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-app-text-muted mx-auto mb-3" />
                    <p className="text-app-text-muted font-medium">Drop a file here or click to browse</p>
                    <p className="text-app-text-muted text-sm mt-1">Supports PDF and Word documents (.docx)</p>
                  </>
                )}
              </div>
            ) : (
              <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your questions here — from a textbook, past exam paper, notes, or any source. The AI will identify and extract all questions automatically."
                className="w-full h-52 rounded-xl border border-app-border bg-app-surface-alt px-4 py-3 text-sm text-app-text placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            )}

            {/* Subject + Extract */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Subject (optional) —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleExtract} disabled={extracting}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {extracting ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{extractStatus || 'Extracting…'}</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Extract Questions with AI</>
                )}
              </button>
            </div>

            {extractError && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{extractError}
              </div>
            )}
          </div>

          {/* Extracted questions review */}
          {drafts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-app-text">
                    {drafts.length} questions extracted
                  </h2>
                  <p className="text-app-text-muted text-sm">Review, edit, then save selected questions to the bank</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setDrafts(ds => ds.map(d => ({ ...d, selected: true })))}
                    className="text-sm text-blue-600 hover:underline">Select all</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setDrafts(ds => ds.map(d => ({ ...d, selected: false })))}
                    className="text-sm text-app-text-muted hover:underline">Deselect all</button>
                  <button onClick={handleSave} disabled={saving || selectedCount === 0}
                    className="flex items-center gap-2 bg-app-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-all disabled:opacity-50">
                    {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <Save className="w-4 h-4" />}
                    Save {selectedCount} to Bank
                  </button>
                </div>
              </div>

              {saveSuccess && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm">
                  <CheckCircle className="w-4 h-4" />Questions saved to bank successfully!
                </div>
              )}

              {drafts.map((d, i) => (
                <div key={d.id} className={`bg-app-surface rounded-xl border transition-all shadow-sm ${d.selected ? 'border-blue-200' : 'border-app-border opacity-60'}`}>
                  <div className="flex items-start gap-3 p-4">
                    <input type="checkbox" checked={d.selected} onChange={e => updateDraft(d.id, 'selected', e.target.checked)}
                      className="mt-1 w-4 h-4 rounded accent-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs font-bold text-app-text-muted">Q{i + 1}</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          d.question_type === 'objective' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {d.question_type === 'objective' ? <Target className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                          {d.question_type === 'objective' ? 'Objective' : 'Theory'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_COLORS[d.difficulty]}`}>
                          {d.difficulty}
                        </span>
                        <span className="text-xs text-app-text-muted bg-slate-100 px-2 py-0.5 rounded-full">{d.marks} mark{d.marks !== 1 ? 's' : ''}</span>
                        {d.topic && <span className="text-xs text-app-text-muted">📌 {d.topic}</span>}
                      </div>
                      <p className="text-sm text-app-text leading-relaxed">{d.question_text}</p>
                      {d.question_type === 'objective' && (
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {(['a', 'b', 'c', 'd'] as const).map(opt => (
                            <div key={opt} className={`text-xs px-2 py-1 rounded ${
                              d.correct_answer?.toLowerCase() === opt ? 'bg-green-100 text-green-700 font-semibold' : 'bg-app-surface-alt text-app-text-muted'}`}>
                              <span className="font-bold uppercase">{opt}.</span> {(d as Record<string, unknown>)[`option_${opt}`] as string || '—'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => setExpandedDraft(expandedDraft === d.id ? null : d.id)}
                      className="text-app-text-muted hover:text-app-text transition-colors flex-shrink-0">
                      {expandedDraft === d.id ? <ChevronUp className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Inline edit panel */}
                  {expandedDraft === d.id && (
                    <div className="border-t border-app-border p-4 bg-app-surface-alt rounded-b-xl space-y-3">
                      <textarea value={d.question_text} onChange={e => updateDraft(d.id, 'question_text', e.target.value)}
                        className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Question text" />
                      <div className="flex gap-3 flex-wrap">
                        <select value={d.question_type} onChange={e => updateDraft(d.id, 'question_type', e.target.value)}
                          className="rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="objective">Objective</option>
                          <option value="theory">Theory</option>
                        </select>
                        <select value={d.difficulty} onChange={e => updateDraft(d.id, 'difficulty', e.target.value)}
                          className="rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                        <input type="number" value={d.marks} onChange={e => updateDraft(d.id, 'marks', Number(e.target.value))}
                          className="w-20 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Marks" min={1} />
                        <input value={d.topic} onChange={e => updateDraft(d.id, 'topic', e.target.value)}
                          className="rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0" placeholder="Topic" />
                      </div>
                      {d.question_type === 'objective' && (
                        <div className="grid grid-cols-2 gap-2">
                          {(['a', 'b', 'c', 'd'] as const).map(opt => (
                            <div key={opt} className="flex items-center gap-2">
                              <span className="text-xs font-bold text-app-text-muted w-4 uppercase">{opt}.</span>
                              <input value={(d as Record<string, unknown>)[`option_${opt}`] as string}
                                onChange={e => updateDraft(d.id, `option_${opt}` as keyof DraftQuestion, e.target.value)}
                                className="flex-1 rounded-lg border border-app-border bg-app-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          ))}
                          <div className="col-span-2 flex items-center gap-2">
                            <span className="text-xs text-app-text-muted">Correct answer:</span>
                            {['A','B','C','D'].map(c => (
                              <button key={c} onClick={() => updateDraft(d.id, 'correct_answer', c)}
                                className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                                  d.correct_answer?.toUpperCase() === c ? 'bg-green-500 text-white' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}>
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BANK TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'bank' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total', value: bankItems.length, color: 'bg-slate-100 text-app-text' },
              { label: 'Objective', value: objCount, color: 'bg-blue-50 text-blue-700' },
              { label: 'Theory', value: theoryCount, color: 'bg-purple-50 text-purple-700' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-0 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
              <input value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                placeholder="Search questions or topics…"
                className="bg-app-surface text-app-text w-full pl-9 pr-3 py-2 rounded-lg border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(['all', 'objective', 'theory'] as const).map(t => (
                <button key={t} onClick={() => setBankType(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                    bankType === t ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-muted hover:text-app-text'}`}>
                  {t}
                </button>
              ))}
            </div>
            <select value={bankSubject} onChange={e => setBankSubject(e.target.value)}
              className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Questions list */}
          {bankLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="w-8 h-8 border-3 border-app-border border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : filteredBank.length === 0 ? (
            <div className="text-center py-16 text-app-text-muted">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{bankItems.length === 0 ? 'Your question bank is empty' : 'No questions match your filters'}</p>
              {bankItems.length === 0 && <p className="text-sm mt-1">Use the "Add Questions" tab to get started</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBank.map((q, i) => (
                <div key={q.id} className="bg-app-surface rounded-xl border border-app-border shadow-sm">
                  <div className="flex items-start gap-3 p-4">
                    <span className="text-xs font-bold text-app-text-muted mt-0.5 w-6 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          q.question_type === 'objective' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {q.question_type === 'objective' ? <Target className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                          {q.question_type === 'objective' ? 'Objective' : 'Theory'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_COLORS[q.difficulty]}`}>{q.difficulty}</span>
                        <span className="text-xs text-app-text-muted bg-slate-100 px-2 py-0.5 rounded-full">{q.marks}mk</span>
                        {(q.subjects as { name: string } | undefined)?.name && (
                          <span className="text-xs text-app-text-muted">📘 {(q.subjects as { name: string }).name}</span>
                        )}
                        {q.topic && <span className="text-xs text-app-text-muted">📌 {q.topic}</span>}
                      </div>
                      <p className="text-sm text-app-text leading-relaxed">{q.question_text}</p>
                      {q.question_type === 'objective' && expandedBank === q.id && (
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {(['a','b','c','d'] as const).map(opt => (
                            <div key={opt} className={`text-xs px-2 py-1 rounded ${
                              q.correct_answer?.toLowerCase() === opt ? 'bg-green-100 text-green-700 font-semibold' : 'bg-app-surface-alt text-app-text-muted'}`}>
                              <span className="font-bold uppercase">{opt}.</span> {q[`option_${opt}` as keyof QuestionBankItem] as string || '—'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {q.question_type === 'objective' && (
                        <button onClick={() => setExpandedBank(expandedBank === q.id ? null : q.id)}
                          className="text-app-text-muted hover:text-app-text p-1 rounded transition-colors">
                          {expandedBank === q.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <button onClick={() => handleDelete(q.id)} disabled={deletingId === q.id}
                        className="text-app-text-muted hover:text-red-500 p-1 rounded transition-colors disabled:opacity-40">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
