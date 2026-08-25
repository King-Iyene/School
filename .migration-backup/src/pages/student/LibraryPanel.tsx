import { useState, useEffect } from 'react';
import { BookOpen, AlertCircle, CheckCircle2, Clock, Library } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function LibraryPanel() {
  const { profile } = useAuth();
  const [membership, setMembership] = useState<any>(null);
  const [issuedBooks, setIssuedBooks] = useState<any[]>([]);
  const [availableBooks, setAvailableBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const [memberRes, issueRes, booksRes] = await Promise.all([
        supabase.from('library_members').select('*').eq('student_id', profile.id).maybeSingle(),
        supabase.from('book_issues').select('*, books(id, title, author, isbn)').eq('student_id', profile.id).order('issue_date', { ascending: false }),
        supabase.from('books').select('id, title, author, category, available_copies').order('created_at', { ascending: false }).limit(12),
      ]);
      setMembership(memberRes.data);
      setIssuedBooks(issueRes.data ?? []);
      setAvailableBooks(booksRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [profile]);

  const today = new Date();
  const booksIssued = issuedBooks.filter(b => !b.return_date).length;
  const overdue = issuedBooks.filter(b => !b.return_date && new Date(b.due_date) < today);
  const fineAmount = overdue.reduce((sum, b) => {
    const days = Math.floor((today.getTime() - new Date(b.due_date).getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);

  const calcFine = (item: any) => {
    if (item.return_date || !item.due_date) return 0;
    const diff = Math.floor((today.getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Library</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <BookOpen className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-800">{booksIssued}</p>
          <p className="text-xs text-slate-500 mt-0.5">Books Issued</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-800">{overdue.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Books Due</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-800">₦{fineAmount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Fine Amount</p>
        </div>
      </div>

      {membership ? (
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Library className="w-5 h-5 text-emerald-100" />
                <span className="text-emerald-100 text-sm font-medium">Library Membership</span>
              </div>
              <h3 className="text-xl font-bold">{profile?.first_name} {profile?.last_name}</h3>
              <p className="text-emerald-100 text-sm mt-0.5">Member No: {membership.membership_number || '—'}</p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${membership.status === 'active' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-800'}`}>
              {membership.status || 'Active'}
            </span>
          </div>
          <div className="flex gap-6 mt-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-emerald-200 text-xs">Issue Date</p>
              <p className="text-sm font-semibold mt-0.5">{membership.issue_date ? new Date(membership.issue_date).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-emerald-200 text-xs">Expiry Date</p>
              <p className="text-sm font-semibold mt-0.5">{membership.expiry_date ? new Date(membership.expiry_date).toLocaleDateString() : '—'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Library className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Not a Library Member</p>
            <p className="text-sm text-slate-500 mt-0.5">Contact your school librarian to get a library membership</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h2 className="font-semibold text-slate-800">My Issued Books</h2>
          <span className="ml-auto text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full">{issuedBooks.length}</span>
        </div>
        {issuedBooks.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No books issued</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Book Title</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Issue Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Return Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issuedBooks.map(item => {
                  const book = item.books as any;
                  const fine = calcFine(item);
                  const isOverdue = !item.return_date && item.due_date && new Date(item.due_date) < today;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{book?.title || '—'}</p>
                        {book?.author && <p className="text-xs text-slate-500">{book.author}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{item.issue_date ? new Date(item.issue_date).toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={isOverdue ? 'text-rose-600 font-medium' : 'text-slate-600'}>
                          {item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {item.return_date ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-slate-600">{new Date(item.return_date).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">Not Returned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {fine > 0 ? (
                          <span className="text-rose-600 font-semibold">₦{fine}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Available Books</h2>
          <p className="text-xs text-slate-500 mt-0.5">Recently added to the library</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
          {availableBooks.map(book => (
            <div key={book.id} className="bg-slate-50 rounded-xl p-3 hover:bg-emerald-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">{book.title}</p>
              {book.author && <p className="text-xs text-slate-500 mt-1 truncate">{book.author}</p>}
              {book.available_copies != null && (
                <p className="text-xs mt-1.5 font-medium text-emerald-600">{book.available_copies} available</p>
              )}
            </div>
          ))}
          {availableBooks.length === 0 && (
            <div className="col-span-full text-center py-6 text-sm text-slate-400">No books in catalog</div>
          )}
        </div>
      </div>
    </div>
  );
}
