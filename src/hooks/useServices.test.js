// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useServices } from './useServices';
import { fetchServices } from '../services/api';

vi.mock('../services/api', () => ({
  fetchServices: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  fetchServices.mockReset();
});

describe('useServices', () => {
  it('loads services and caches them on success', async () => {
    const data = [{ id: '1', title: 'A' }];
    fetchServices.mockResolvedValue(data);

    const { result } = renderHook(() => useServices({ lang: 'en' }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.services).toEqual(data);
    expect(result.current.error).toBeNull();
    expect(JSON.parse(localStorage.getItem('services_cache_en'))).toEqual(data);
  });

  it('sets an error when the fetch fails and there is no cache', async () => {
    fetchServices.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useServices({ lang: 'en' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('network down');
    expect(result.current.services).toEqual([]);
  });

  it('falls back to the last cached services when the fetch fails', async () => {
    const cached = [{ id: '1', title: 'Cached' }];
    localStorage.setItem('services_cache_en', JSON.stringify(cached));
    fetchServices.mockRejectedValue(new Error('DB paused'));

    const { result } = renderHook(() => useServices({ lang: 'en' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.services).toEqual(cached);
    expect(result.current.error).toBeNull();
  });

  it('keeps the cache fallback working on refetch', async () => {
    const cached = [{ id: '1', title: 'Cached' }];
    localStorage.setItem('services_cache_en', JSON.stringify(cached));
    fetchServices.mockRejectedValue(new Error('DB paused'));

    const { result } = renderHook(() => useServices({ lang: 'en' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.services).toEqual(cached);
    expect(result.current.error).toBeNull();
  });

  it('caches services per language independently', async () => {
    fetchServices.mockResolvedValueOnce([{ id: '1', title: 'English' }]);
    const { result, rerender } = renderHook(({ lang }) => useServices({ lang }), {
      initialProps: { lang: 'en' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchServices.mockResolvedValueOnce([{ id: '1', title: 'Українська' }]);
    rerender({ lang: 'ua' });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(JSON.parse(localStorage.getItem('services_cache_en'))).toEqual([{ id: '1', title: 'English' }]);
    expect(JSON.parse(localStorage.getItem('services_cache_ua'))).toEqual([{ id: '1', title: 'Українська' }]);
  });
});
