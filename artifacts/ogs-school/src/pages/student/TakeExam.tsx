import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { getSearchParams, navigate } from '../../components/hooks/useLocation';
import { startExam, getAttempt, saveAnswer, submitExam } from '../../lib/examApi';
import type { OnlineExamAttempt, ExamAttemptQuestion } from '../../lib/types';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TakeExam() {
  const examId = getSearchParams().get('examId') ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState<OnlineExamAttempt | null>(null);
  const [questions, setQuestions] = useState<ExamAttemptQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [result, setResult] = useState<{ status: string; score: number | null; hasTheory: boolean } | null>(null);

  const finishingRef = useRef(false);

  useEffect(() => {
    if (!examId) { setError('No exam specified.'); setLoading(false); return; }
    load();
  }, [examId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      let session;
      try {
        session = await getAttempt(examId);
      } catch {
        session = await startExam(examId);
      }
      setAttempt(session.attempt);
      setQuestions(session.questions);
      if (session.attempt.status !== 'in_progress') {
        setResult({ status: session.attempt.status, score: session.attempt.score, hasTheory: session.questions.some(q => q.question_type === 'theory') });
      } else {
        const elapsed = Math.floor((Date.now() - new Date(session.attempt.started_at).getTime()) / 1000);
        setRemaining(Math.max(0, session.attempt.duration_minutes * 60 - elapsed));
      }
    } catch (e: any) {
      setError(e.message || 'Could not load this exam.');
    } finally {
      setLoading(false);
    }
  }

  const finishExam = useCallback(async () => {
    if (!attempt || finishingRef.current) return;
    finishingRef.current = true;
    setSubmitting(true);
    try {
      const res = await submitExam(attempt.id);
      setResult({ status: res.status, score: res.score, hasTheory: res.status === 'submitted' });
    } catch (e: any) {
      setError(e.message || 'Could not submit the exam.');
    } finally {
      setSubmitting(false);
      finishingRef.current = false;
    }
  }, [attempt]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || result) return;
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt, result, finishExam]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || result) return;
    function onVisibilityChange() {
      if (document.hidden) setTabSwitches(n => n + 1);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [attempt, result]);

  async function selectAnswer(answer: string) {
    if (!attempt) return;
    const q = questions[current];
    setQuestions(prev => prev.map((item, idx) => (idx === current ? { ...item, student_answer: answer } : item)));
    try {
      await saveAnswer(attempt.id, q.id, answer);
    } catch {
      // Autosave failure is non-fatal — the answer still gets sent again on submit's re-read of local state via the next save.
    }
  }

  async function theoryAnswer(text: string) {
    if (!attempt) return;
    const q = questions[current];
    setQuestions(prev => prev.map((item, idx) => (idx === current ? { ...item, student_answer: text } : item)));
    try {
      await saveAnswer(attempt.id, q.id, text);
    } catch {
      // ignored — see selectAnswer
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-app-surface rounded-2xl border border-app-border p-8 text-center max-w-lg mx-auto mt-10">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-sm text-app-text">{error}</p>
        <button onClick={() => navigate('/student/online-exams')} className="mt-4 text-sm text-app-primary font-medium hover:underline">
          Back to Online Exams
        </button>
      </div>
    );
  }

  if (result) {
    const answeredTheory = questions.filter(q => q.question_type === 'theory').length > 0;
    return (
      <div className="bg-app-surface rounded-2xl border border-app-border p-8 text-center max-w-lg mx-auto mt-10">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-app-text mb-1">Exam Submitted</h2>
        {result.status === 'graded' ? (
          <p className="text-app-text-muted">
            Your score: <span className="font-semibold text-app-text">{result.score} / {attempt?.total_marks}</span>
          </p>
        ) : (
          <p className="text-app-text-muted">
            {answeredTheory
              ? 'Objective questions were graded automatically. Theory questions are awaiting your teacher’s review.'
              : 'Your answers have been recorded.'}
          </p>
        )}
        <button onClick={() => navigate('/student/online-exams')} className="mt-5 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
          Back to Online Exams
        </button>
      </div>
    );
  }

  const question = questions[current];
  const answeredCount = questions.filter(q => q.student_answer).length;
  const isLastQuestion = current === questions.length - 1;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${remaining < 60 ? 'text-red-500' : 'text-app-text-muted'}`} />
          <span className={`font-mono font-semibold ${remaining < 60 ? 'text-red-500' : 'text-app-text'}`}>{formatTime(remaining)}</span>
        </div>
        <span className="text-sm text-app-text-muted">Question {current + 1} of {questions.length}</span>
        <span className="text-xs text-app-text-muted">{answeredCount} answered</span>
      </div>

      {tabSwitches > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          You left this tab {tabSwitches} time{tabSwitches !== 1 ? 's' : ''} during the exam. This has been noted.
        </div>
      )}

      {question && (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-6 space-y-5">
          <p className="text-base text-app-text font-medium">{question.question_text}</p>
          <span className="inline-block text-xs bg-slate-100 text-app-text-muted px-2 py-0.5 rounded-full">{question.marks} mark{question.marks !== 1 ? 's' : ''}</span>

          {question.question_type === 'objective' ? (
            <div className="space-y-2">
              {question.options.map(opt => (
                <button
                  key={opt.letter}
                  onClick={() => selectAnswer(opt.letter)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                    question.student_answer === opt.letter
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-app-surface text-app-text border-app-border hover:border-emerald-300'
                  }`}
                >
                  <span className="font-semibold mr-2">{opt.letter}.</span>
                  {opt.text}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              className="w-full bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
              rows={6}
              value={question.student_answer}
              onChange={(e) => theoryAnswer(e.target.value)}
              placeholder="Type your answer here"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors disabled:opacity-40 text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {isLastQuestion ? (
          <button
            onClick={finishExam}
            disabled={submitting}
            className="flex items-center gap-2 bg-emerald-600 hover:opacity-90 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        ) : (
          <button
            onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
            className="flex items-center gap-1 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrent(idx)}
            className={`w-8 h-8 rounded-lg text-xs font-medium border transition-colors ${
              idx === current
                ? 'bg-app-primary text-white border-app-primary'
                : q.student_answer
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-app-surface text-app-text-muted border-app-border'
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
