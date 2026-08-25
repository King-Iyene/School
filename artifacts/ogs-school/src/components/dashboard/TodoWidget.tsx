import { useEffect, useState } from 'react';
import { Plus, Check, Trash2, Clock, User, AlertCircle, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TodoItem, Profile } from '../../lib/types';
import Modal from '../common/Modal';

interface TodoWidgetProps {
  userId: string | undefined;
  schoolId: string | undefined;
  isSuperAdmin?: boolean;
}

export default function TodoWidget({ userId, schoolId, isSuperAdmin }: TodoWidgetProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'incomplete' | 'completed'>('incomplete');
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'normal' as 'low' | 'normal' | 'high',
    assigned_to: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);

  useEffect(() => {
    if (userId) fetchTodos();
    if (isSuperAdmin && schoolId) fetchStaff();
  }, [userId, schoolId]);

  async function fetchTodos() {
    setLoading(true);
    try {
      // Try with the assigned_to join (requires migration to be applied)
      const { data, error } = await supabase
        .from('todo_items')
        .select('*, profiles!assigned_to(first_name, last_name)')
        .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: query only own todos if migration not yet applied
        const { data: fallbackData } = await supabase
          .from('todo_items')
          .select('*')
          .eq('user_id', userId!)
          .order('created_at', { ascending: false });
        setTodos(fallbackData ?? []);
      } else {
        setTodos(data ?? []);
      }
    } catch {
      setTodos([]);
    }
    setLoading(false);
  }

  async function fetchStaff() {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('school_id', schoolId)
      .in('role', ['teacher', 'admin', 'super_admin', 'accountant', 'librarian'])
      .order('first_name');
    setStaff((data as any) ?? []);
  }

  async function handleAdd() {
    if (!form.title.trim() || !userId || !schoolId) return;
    setSaving(true);
    const { error: err } = await supabase.from('todo_items').insert({
      user_id: userId,
      school_id: schoolId,
      title: form.title.trim(),
      description: form.description.trim(),
      due_date: form.due_date || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      created_by: userId,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setForm({ title: '', description: '', due_date: '', priority: 'normal', assigned_to: '' });
    setShowAdd(false);
    setSaving(false);
    fetchTodos();
  }

  async function handleUpdate() {
    if (!editingTodo || !form.title.trim()) return;
    setSaving(true);
    const { error: err } = await supabase
      .from('todo_items')
      .update({
        title: form.title.trim(),
        description: form.description.trim(),
        due_date: form.due_date || null,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
      })
      .eq('id', editingTodo.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setEditingTodo(null);
    setForm({ title: '', description: '', due_date: '', priority: 'normal', assigned_to: '' });
    setSaving(false);
    fetchTodos();
  }

  async function handleComplete(id: string) {
    await supabase
      .from('todo_items')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', id);
    fetchTodos();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task?')) return;
    await supabase.from('todo_items').delete().eq('id', id);
    fetchTodos();
  }

  const startEdit = (todo: TodoItem) => {
    setEditingTodo(todo);
    setForm({
      title: todo.title,
      description: todo.description || '',
      due_date: todo.due_date ? todo.due_date.split('T')[0] : '',
      priority: todo.priority,
      assigned_to: todo.assigned_to || '',
    });
  };

  const filtered = todos.filter(t => tab === 'completed' ? t.completed : !t.completed);

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white">
        <div>
          <h3 className="font-semibold text-slate-800">Todo List</h3>
          <p className="text-xs text-slate-500 mt-0.5">{todos.filter(t => !t.completed).length} pending tasks</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => {
              setForm({ title: '', description: '', due_date: '', priority: 'normal', assigned_to: '' });
              setShowAdd(true);
            }}
            className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setTab('incomplete')}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${tab === 'incomplete' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Pending
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${tab === 'completed' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Completed
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[500px]">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading tasks...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
              <Check className="w-6 h-6 text-slate-200" />
            </div>
            <p className="text-slate-400 text-sm">No {tab} tasks found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(todo => (
              <div key={todo.id} className="p-4 hover:bg-slate-50/50 transition-colors group">
                <div className="flex items-start gap-3">
                  {!todo.completed && (
                    <button
                      onClick={() => handleComplete(todo.id)}
                      className="mt-0.5 w-5 h-5 rounded border border-slate-300 flex items-center justify-center hover:border-blue-500 hover:text-blue-500 transition-colors"
                    >
                      <Check size={12} className="opacity-0 hover:opacity-100" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {todo.title}
                    </p>
                    {todo.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{todo.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${priorityColors[todo.priority]}`}>
                        {todo.priority}
                      </span>
                      {todo.due_date && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock size={10} />
                          {new Date(todo.due_date).toLocaleDateString()}
                        </div>
                      )}
                      {todo.assigned_to && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                          <User size={10} />
                          {todo.assigned_to === userId ? 'Assigned to me' : `Assigned to: ${(todo as any).profiles?.first_name} ${(todo as any).profiles?.last_name}`}
                        </div>
                      )}
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => startEdit(todo)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit task"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(todo.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showAdd || !!editingTodo} onClose={() => { setShowAdd(false); setEditingTodo(null); }} title={editingTodo ? 'Edit Task' : 'New Task'}>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Task Title</label>
            <input
              autoFocus
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="What needs to be done?"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description (Optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[80px]"
              placeholder="Add more details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as any })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          {isSuperAdmin && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Assign To (Optional)</label>
              <select
                value={form.assigned_to}
                onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
              >
                <option value="">Personal Task (Unassigned)</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.role.charAt(0).toUpperCase() + s.role.slice(1)})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setShowAdd(false); setEditingTodo(null); }}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={editingTodo ? handleUpdate : handleAdd}
              disabled={saving || !form.title.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? 'Saving...' : (editingTodo ? 'Update Task' : 'Create Task')}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
