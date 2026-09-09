import { useState, useEffect } from 'react';
import { Monitor, Clock, HelpCircle, PlayCircle, CheckCircle2, Hourglass } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

interface OnlineExamRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  online_exam_settings: {
    question_count: number;
    duration_minutes: number;
    is_published: boolean;
    instructions: string;
  } | null;
  online_exam_attempts: {
    id: string;
    status: 'in_progress' | 'submitted' | 'graded';
    score: number | null;
    total_marks: number;
  }[];
}

export default function StudentOnlineExams() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<OnlineExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (profile?.school_id) fetchExams(); }, [profile?.school_id]);

  async function fetchExams() {
    setLoading(true);
    const { data } = await supabase
      .from('exams')
      .select('id, name, start_date, end_date, online_exam_settings(*), online_exam_attempts!exam_id(id, status, score, total_marks)')
      .eq('school_id', profile?.school_id)
      .eq('type', 'online')
      .order('start_date', { ascending: false });

    const published = ((data ?? []) as any[]).filter(e => e.online_exam_settings?.is_published);
    setExams(published as OnlineExamRow[]);
    setLoading(false);
  }

  function statusFor(exam: OnlineExamRow) {
    const attempt = exam.online_exam_attempts?.[0];
    if (!attempt) return 'not_started' as const;
    return attempt.status;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Monitor className="w-5 h-5 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-app-text">Online Exams</h1>
      </div>

      {exams.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
          <Monitor className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-app-text-muted">No online exams are available right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map(exam => {
            const status = statusFor(exam);
            const attempt = exam.online_exam_attempts?.[0];
            return (
              <div key={exam.id} className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <h2 className="font-semibold text-app-text">{exam.name}</h2>
                  {status === 'in_progress' && (
                    <span className="flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                      <Hourglass className="w-3 h-3" /> In progress
                    </span>
                  )}
                  {(status === 'submitted' || status === 'graded') && (
                    <span className="flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> {status === 'graded' ? 'Graded' : 'Submitted'}
                    </span>
                  )}
                </div>

                {exam.online_exam_settings?.instructions && (
                  <p className="text-xs text-app-text-muted line-clamp-2">{exam.online_exam_settings.instructions}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-app-text-muted">
                  <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> {exam.online_exam_settings?.question_count} questions</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {exam.online_exam_settings?.duration_minutes} min</span>
                </div>

                {status === 'graded' && attempt?.score !== null && (
                  <p className="text-sm font-medium text-app-text">Score: {attempt?.score} / {attempt?.total_marks}</p>
                )}

                <button
                  onClick={() => navigate(`/student/take-exam?examId=${exam.id}`)}
                  className="mt-1 flex items-center justify-center gap-2 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                >
                  <PlayCircle className="w-4 h-4" />
                  {status === 'not_started' ? 'Start Exam' : status === 'in_progress' ? 'Resume Exam' : 'View Result'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
