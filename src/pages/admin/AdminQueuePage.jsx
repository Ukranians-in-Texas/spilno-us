import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getCloudinaryPublicId } from '../../utils/imageUrl';

export function AdminQueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPending = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('approved', false)
        .order('submitted_at', { ascending: false });

      if (!error) setItems(data || []);
      setLoading(false);
    };

    fetchPending();
  }, []);

  const approve = async (id) => {
    const { error } = await supabase.from('services').update({ approved: true }).eq('id', id);
    if (!error) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const remove = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    const item = items.find((i) => i.id === id);
    if (item?.images) {
      const urls = item.images.split(',').map((u) => u.trim()).filter((u) => u.startsWith('https://res.cloudinary.com/'));
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
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (!error) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (loading) return <p className="text-text/50">Loading…</p>;

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl mb-2">✓</p>
        <p className="text-text/50">No pending submissions</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-dark-blue mb-4">
        Pending Review <span className="text-brand-red">({items.length})</span>
      </h1>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white dark:bg-[#0F2040] rounded-2xl shadow-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-dark-blue">{item.title}</span>
                  {item.category && (
                    <span className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">
                      {item.category}
                    </span>
                  )}
                </div>
                <div className="text-sm text-text/60 dark:text-white/60 flex flex-wrap gap-x-4 gap-y-1 mb-2">
                  {item.phone && <span>{item.phone}</span>}
                  {item.email && <span>{item.email}</span>}
                  <span>{new Date(item.submitted_at).toLocaleDateString()}</span>
                </div>
                {item.description_en && (
                  <p className="text-sm text-text dark:text-white/80 line-clamp-2">
                    {item.description_en}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-text/50 mt-1 bg-gray dark:bg-white/5 px-2 py-1 rounded">
                    Note: {item.notes}
                  </p>
                )}
                {item.images && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {item.images.split(',').map((url, i) => (
                      <img
                        key={i}
                        src={url.trim()}
                        alt=""
                        className="w-14 h-14 object-cover rounded-lg"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => approve(item.id)}
                  className="bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Approve
                </button>
                <button
                  onClick={() => remove(item.id, item.title)}
                  className="bg-gray dark:bg-white/10 text-text/60 dark:text-white/60 text-sm px-4 py-2 rounded-xl hover:bg-brand-red/10 hover:text-brand-red transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
