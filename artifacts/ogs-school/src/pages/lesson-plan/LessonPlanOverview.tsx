import { useState, useEffect } from 'react';
import { Eye, Calendar, User, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface LessonPlan {
  id: string;
  plan_date: string;
  introduction: string;
  development: string;
  conclusion: string;
  materials: string;
  evaluation: string;
  homework_notes: string;
  notes: string;
  status: 'draft' | 'active' | 'completed';
  topic_id: string;
  teacher_id: string;
  topics: {
    title: string;
    topic_number: number;
    lessons: { title: string; lesson_number: number } | null;
  } | null;
  profiles: { first_name: string; last_name: string } | null;
}

const statusConfig = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-app-text-muted' },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
};

function PlanDetailSection({ label, content }: { label: string; content: string }) {
  if (!content) return null;
  return (
    <div className="border border-app-border rounded-xl p-4">
      <h4 className="text-xs font-semibold text-app-text-muted uppercase tracking-wide mb-2">{label}</h4>
      <p className="text-sm text-app-text leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}

export default function LessonPlanOverview() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [viewPlan, setViewPlan] = useState<LessonPlan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (profile?.school_id) {
      fetchPlans();
    }
  }, [profile?.school_id, filterStatus]);

  async function fetchPlans() {
    setLoading(true);
    let query = supabase
      .from('lesson_plans')
      .select(`
        id, plan_date, introduction, development, conclusion,
        materials, evaluation, homework_notes, notes, status,
        topic_id, teacher_id,
        topics (
          title, topic_number,
          lessons ( title, lesson_number )
        ),
        profiles ( first_name, last_name )
      `)
      .eq('school_id', profile!.school_id)
      .order('plan_date', { ascending: false });

    if (filterStatus) query = query.eq('status', filterStatus);

    const { data } = await query;
    setPlans((data as unknown as LessonPlan[]) || []);
    setLoading(false);
  }

  function openView(plan: LessonPlan) {
    setViewPlan(plan);
    setModalOpen(true);
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Lesson Plan Overview</h1>
          <p className="text-sm text-app-text-muted mt-1">View and manage all lesson plans across topics</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading...</div>
      ) : (
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Plan Date</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Topic</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Lesson</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Teacher</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Status</th>
                <th className="text-right px-4 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-app-text-muted">No lesson plans found</td>
                </tr>
              ) : (
                plans.map((plan) => {
                  const status = statusConfig[plan.status] || statusConfig.draft;
                  return (
                    <tr key={plan.id} className="border-b border-app-border hover:bg-app-surface-alt">
                      <td className="px-4 py-3 text-app-text-muted">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-app-text-muted" />
                          {formatDate(plan.plan_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-app-text">
                        {plan.topics
                          ? `Topic ${plan.topics.topic_number}: ${plan.topics.title}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {plan.topics?.lessons
                          ? `Lesson ${plan.topics.lessons.lesson_number}: ${plan.topics.lessons.title}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-app-text-muted" />
                          {plan.profiles
                            ? `${plan.profiles.first_name} ${plan.profiles.last_name}`
                            : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => openView(plan)}
                            className="flex items-center gap-1.5 p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="View plan"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setViewPlan(null); }}
        title="Lesson Plan Details"
        size="xl"
      >
        {viewPlan && (
          <div className="space-y-4">
            <div className="bg-app-surface-alt rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-app-text-muted mb-0.5">
                    {viewPlan.topics?.lessons
                      ? `Lesson ${viewPlan.topics.lessons.lesson_number}: ${viewPlan.topics.lessons.title}`
                      : 'No lesson'}
                  </p>
                  <h3 className="font-semibold text-app-text">
                    {viewPlan.topics
                      ? `Topic ${viewPlan.topics.topic_number}: ${viewPlan.topics.title}`
                      : 'Unknown Topic'}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-app-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(viewPlan.plan_date)}
                    </span>
                    {viewPlan.profiles && (
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {viewPlan.profiles.first_name} {viewPlan.profiles.last_name}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[viewPlan.status]?.className || statusConfig.draft.className}`}>
                  {statusConfig[viewPlan.status]?.label || 'Draft'}
                </span>
              </div>
            </div>

            <PlanDetailSection label="Introduction" content={viewPlan.introduction} />
            <PlanDetailSection label="Development" content={viewPlan.development} />
            <PlanDetailSection label="Conclusion" content={viewPlan.conclusion} />

            <div className="grid grid-cols-2 gap-4">
              {viewPlan.materials && (
                <PlanDetailSection label="Materials" content={viewPlan.materials} />
              )}
              {viewPlan.evaluation && (
                <PlanDetailSection label="Evaluation" content={viewPlan.evaluation} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {viewPlan.homework_notes && (
                <PlanDetailSection label="Homework / Assignment Notes" content={viewPlan.homework_notes} />
              )}
              {viewPlan.notes && (
                <PlanDetailSection label="Additional Notes" content={viewPlan.notes} />
              )}
            </div>

            {!viewPlan.introduction && !viewPlan.development && !viewPlan.conclusion && (
              <div className="flex flex-col items-center justify-center py-8 text-app-text-muted">
                <FileText size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No content has been added to this plan yet</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
