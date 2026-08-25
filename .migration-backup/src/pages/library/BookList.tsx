import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';
const SELECT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white';

interface BookCategory {
  id: string;
  name: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  category_id: string | null;
  publisher: string;
  edition: string;
  quantity: number;
  available_quantity: number;
  shelf_location: string;
  description: string;
}

export default function BookList() {
  const { profile } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<BookCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [form, setForm] = useState({
    title: '',
    author: '',
    isbn: '',
    category: '',
    category_id: '',
    publisher: '',
    edition: '',
    quantity: '',
    shelf_location: '',
    description: '',
  });

  useEffect(() => {
    if (profile?.school_id) fetchCategories();
  }, [profile?.school_id]);

  useEffect(() => {
    fetchBooks();
  }, [search, filterCategoryId]);

  async function fetchCategories() {
    const { data } = await supabase
      .from('book_categories')
      .select('id, name')
      .eq('school_id', profile.school_id)
      .order('name');
    if (data) setCategories(data as BookCategory[]);
  }

  async function fetchBooks() {
    setLoading(true);
    let query = supabase
      .from('books')
      .select('*')
      .order('title');
    if (search) {
      query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
    }
    if (filterCategoryId) {
      query = query.eq('category_id', filterCategoryId);
    }
    const { data } = await query;
    if (data) setBooks(data as Book[]);
    setLoading(false);
  }

  function categoryName(book: Book): string {
    if (book.category_id) {
      const found = categories.find((c) => c.id === book.category_id);
      if (found) return found.name;
    }
    return book.category || '-';
  }

  function openAdd() {
    setEditId(null);
    setSaveError('');
    setForm({
      title: '',
      author: '',
      isbn: '',
      category: '',
      category_id: '',
      publisher: '',
      edition: '',
      quantity: '',
      shelf_location: '',
      description: '',
    });
    setModalOpen(true);
  }

  function openEdit(book: Book) {
    setEditId(book.id);
    setSaveError('');
    setForm({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      category: book.category || '',
      category_id: book.category_id || '',
      publisher: book.publisher || '',
      edition: book.edition || '',
      quantity: book.quantity != null ? String(book.quantity) : '',
      shelf_location: book.shelf_location || '',
      description: book.description || '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const qty = form.quantity !== '' ? Number(form.quantity) : 0;
    const payload = {
      title: form.title,
      author: form.author,
      isbn: form.isbn,
      category: form.category,
      category_id: form.category_id || null,
      publisher: form.publisher,
      edition: form.edition,
      quantity: qty,
      available_quantity: editId ? undefined : qty,
      shelf_location: form.shelf_location,
      description: form.description,
    };
    let res;
    if (editId) {
      const { available_quantity, ...updatePayload } = payload;
      res = await supabase.from('books').update(updatePayload).eq('id', editId);
    } else {
      res = await supabase.from('books').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchBooks();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this book?')) return;
    await supabase.from('books').delete().eq('id', id);
    fetchBooks();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <BookOpen size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Book List</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Book
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, author or ISBN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
            />
          </div>
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No books found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Author</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">ISBN</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Available</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Shelf</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{book.title}</td>
                    <td className="px-4 py-3 text-slate-600">{book.author || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{book.isbn || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{categoryName(book)}</td>
                    <td className="px-4 py-3 text-slate-600">{book.quantity ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        (book.available_quantity ?? 0) > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {book.available_quantity ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{book.shelf_location || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(book)}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(book.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Book' : 'Add Book'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              required
              className={INPUT_CLASS}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Book title"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Author</label>
              <input
                className={INPUT_CLASS}
                value={form.author}
                onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                placeholder="Author name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ISBN</label>
              <input
                className={INPUT_CLASS}
                value={form.isbn}
                onChange={(e) => setForm((p) => ({ ...p, isbn: e.target.value }))}
                placeholder="ISBN"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                className={SELECT_CLASS}
                value={form.category_id}
                onChange={(e) => {
                  const selected = categories.find((c) => c.id === e.target.value);
                  setForm((p) => ({
                    ...p,
                    category_id: e.target.value,
                    category: selected ? selected.name : p.category,
                  }));
                }}
              >
                <option value="">Select category (optional)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Publisher</label>
              <input
                className={INPUT_CLASS}
                value={form.publisher}
                onChange={(e) => setForm((p) => ({ ...p, publisher: e.target.value }))}
                placeholder="Publisher"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Edition</label>
              <input
                className={INPUT_CLASS}
                value={form.edition}
                onChange={(e) => setForm((p) => ({ ...p, edition: e.target.value }))}
                placeholder="e.g. 3rd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="0"
                className={INPUT_CLASS}
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shelf Location</label>
            <input
              className={INPUT_CLASS}
              value={form.shelf_location}
              onChange={(e) => setForm((p) => ({ ...p, shelf_location: e.target.value }))}
              placeholder="e.g. A-12"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
