import { useState, useEffect, useCallback } from 'react';
import { fetchServices } from '../services/api';

function cacheKey(lang) {
  return `services_cache_${lang || 'en'}`;
}

function readCache(lang) {
  try {
    const raw = localStorage.getItem(cacheKey(lang));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(lang, data) {
  try {
    localStorage.setItem(cacheKey(lang), JSON.stringify(data));
  } catch {
    // localStorage unavailable or full — caching is a nice-to-have, not required
  }
}

export function useServices({ lang } = {}) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServices({ lang });
      if (signal?.cancelled) return;
      setServices(data);
      writeCache(lang, data);
    } catch (err) {
      if (signal?.cancelled) return;
      // A transient failure (e.g. the DB waking from a pause) shouldn't blank a
      // directory that loaded fine a moment ago — fall back to the last good list.
      const cached = readCache(lang);
      if (cached) {
        setServices(cached);
      } else {
        setError(err.message);
      }
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]);

  return { services, loading, error, refetch: () => load() };
}
