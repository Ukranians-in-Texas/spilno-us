import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { categories } from '../../data/categories';
import { getCloudinaryPublicId } from '../../utils/imageUrl';

const allSubcategories = categories.flatMap((c) => c.subcategories);

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
];

function EditPanel({ service, onClose, onSave }) {
  const [form, setForm] = useState({ ...service });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const imageUrls = form.images ? form.images.split(',').map((u) => u.trim()).filter(Boolean) : [];

  const handleImageDragStart = (e, idx) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIdx(idx);
  };

  const handleImageDragOver = (e, idx) => {
    e.preventDefault();
    if (idx !== draggingIdx) setDragOverIdx(idx);
  };

  const handleImageDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggingIdx === null || draggingIdx === targetIdx) {
      setDraggingIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...imageUrls];
    next.splice(targetIdx, 0, next.splice(draggingIdx, 1)[0]);
    set('images', next.join(', '));
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  const handleImageDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const { error } = await supabase
      .from('services')
      .update({
        title: form.title,
        description_en: form.description_en,
        description_ua: form.description_ua,
        category: form.category,
        address: form.address,
        phone: form.phone,
        email: form.email,
        website: form.website,
        instagram: form.instagram,
        facebook: form.facebook,
        linkedin: form.linkedin,
        messenger: form.messenger,
        approved: form.approved,
        featured: form.featured,
        featured_order: form.featured ? (form.featured_order ?? null) : null,
        notes: form.notes,
        images: form.images,
      })
      .eq('id', form.id);

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      onSave(form);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${form.title}"?`)) return;
    if (form.images) {
      const urls = form.images.split(',').map((u) => u.trim()).filter((u) => u.startsWith('https://res.cloudinary.com/'));
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await Promise.allSettled(
        urls.map((url) => {
          const publicId = getCloudinaryPublicId(url);
          if (!publicId) return Promise.resolve();
          return fetch('/api/delete-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify({ publicId }),
          });
        })
      );
    }
    const { error } = await supabase.from('services').delete().eq('id', form.id);
    if (!error) onSave(null);
  };

  const inputClass =
    'w-full rounded-xl border border-stroke bg-white dark:bg-[#0A1628] text-text dark:text-white px-3 py-2 text-sm focus:outline-none focus:border-brand-blue';
  const labelClass = 'block text-xs font-bold text-text/60 dark:text-white/60 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-[#0F2040] shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stroke">
          <h2 className="font-bold text-dark-blue truncate pr-4">{service.title}</h2>
          <button onClick={onClose} className="text-text/40 hover:text-text transition-colors text-xl leading-none cursor-pointer">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Status toggles */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.approved || false}
                onChange={(e) => set('approved', e.target.checked)}
                className="w-4 h-4 accent-brand-blue"
              />
              <span className="text-sm font-semibold text-dark-blue">Approved</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured || false}
                onChange={(e) => set('featured', e.target.checked)}
                className="w-4 h-4 accent-brand-red"
              />
              <span className="text-sm font-semibold text-dark-blue">Featured</span>
            </label>
            {form.featured && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text/50">Order</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  placeholder="—"
                  value={form.featured_order ?? ''}
                  onChange={(e) => set('featured_order', e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-14 rounded-lg border border-stroke bg-white dark:bg-[#0A1628] text-text dark:text-white px-2 py-1 text-sm focus:outline-none focus:border-brand-blue"
                />
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className={labelClass}>Business name</label>
            <input className={inputClass} value={form.title || ''} onChange={(e) => set('title', e.target.value)} />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Category</label>
            <select
              className={inputClass}
              value={form.category || ''}
              onChange={(e) => set('category', e.target.value)}
            >
              <option value="">— no category —</option>
              {allSubcategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Description EN */}
          <div>
            <label className={labelClass}>Description (EN)</label>
            <textarea
              className={inputClass}
              rows={3}
              value={form.description_en || ''}
              onChange={(e) => set('description_en', e.target.value)}
            />
          </div>

          {/* Description UA */}
          <div>
            <label className={labelClass}>Description (UA)</label>
            <textarea
              className={inputClass}
              rows={3}
              value={form.description_ua || ''}
              onChange={(e) => set('description_ua', e.target.value)}
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Phone', 'phone'],
              ['Email', 'email'],
              ['Address', 'address'],
              ['Website', 'website'],
              ['Instagram', 'instagram'],
              ['Facebook', 'facebook'],
              ['LinkedIn', 'linkedin'],
              ['Messenger', 'messenger'],
            ].map(([label, field]) => (
              <div key={field}>
                <label className={labelClass}>{label}</label>
                <input
                  className={inputClass}
                  value={form[field] || ''}
                  onChange={(e) => set(field, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes (internal)</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          {/* Images */}
          {imageUrls.length > 0 && (
            <div>
              <label className={labelClass}>Images</label>
              <div className="flex gap-2 flex-wrap">
                {imageUrls.map((url, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => handleImageDragStart(e, i)}
                    onDragOver={(e) => handleImageDragOver(e, i)}
                    onDrop={(e) => handleImageDrop(e, i)}
                    onDragEnd={handleImageDragEnd}
                    className={`relative w-20 h-20 cursor-grab active:cursor-grabbing select-none transition-opacity ${draggingIdx === i ? 'opacity-40' : ''} ${dragOverIdx === i ? 'ring-2 ring-brand-blue rounded-lg' : ''}`}
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => { e.target.style.opacity = '0.3'; }}
                    />
                    {i === 0 && imageUrls.length > 1 && (
                      <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 text-white text-[10px] text-center py-0.5 leading-tight pointer-events-none">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-brand-red text-sm">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-stroke flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand-blue text-white font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity text-sm cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2.5 rounded-xl text-sm text-brand-red hover:bg-brand-red/10 transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (!error) setServices(data || []);
      setLoading(false);
    };

    fetchAll();
  }, []);

  const handleSave = (updated) => {
    if (updated === null) {
      setServices((prev) => prev.filter((s) => s.id !== selected.id));
    } else {
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    }
    setSelected(null);
  };

  const filtered = services.filter((s) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'approved' && s.approved) ||
      (statusFilter === 'pending' && !s.approved);

    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.title?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-dark-blue mb-4">All Services</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="search"
          placeholder="Search by name, category, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-xl border border-stroke bg-white dark:bg-[#0F2040] text-text dark:text-white px-4 py-2 text-sm focus:outline-none focus:border-brand-blue"
        />
        <div className="flex rounded-xl border border-stroke overflow-hidden bg-white dark:bg-[#0F2040]">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-2 text-sm transition-colors ${
                statusFilter === opt.value
                  ? 'bg-brand-blue text-white'
                  : 'text-text/60 dark:text-white/60 hover:bg-gray dark:hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-text/50">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-text/50 text-sm">No results</p>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white dark:bg-[#0F2040] rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke text-left">
                <th className="px-4 py-3 font-semibold text-text/60 dark:text-white/60">Name</th>
                <th className="px-4 py-3 font-semibold text-text/60 dark:text-white/60 hidden md:table-cell">Category</th>
                <th className="px-4 py-3 font-semibold text-text/60 dark:text-white/60 hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 font-semibold text-text/60 dark:text-white/60">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="border-b border-stroke last:border-0 hover:bg-light-gray dark:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-dark-blue">{s.title}</td>
                  <td className="px-4 py-3 text-text/60 dark:text-white/60 hidden md:table-cell">{s.category || '—'}</td>
                  <td className="px-4 py-3 text-text/60 dark:text-white/60 hidden sm:table-cell">
                    {new Date(s.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.approved
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {s.approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <EditPanel
          service={selected}
          onClose={() => setSelected(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
