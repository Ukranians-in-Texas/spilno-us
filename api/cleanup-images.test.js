import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./_lib/supabase.js', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('./_lib/cloudinary.js', () => ({
  getPublicIdFromUrl: vi.fn(),
  deleteCloudinaryImageById: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./_lib/telegram.js', () => ({
  sendTelegramAlert: vi.fn().mockResolvedValue(undefined),
}));

import handler from './cleanup-images.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { getPublicIdFromUrl, deleteCloudinaryImageById } from './_lib/cloudinary.js';
import { sendTelegramAlert } from './_lib/telegram.js';

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  deleteCloudinaryImageById.mockClear();
  getPublicIdFromUrl.mockClear();
  sendTelegramAlert.mockClear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

const OLD_DATE = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
const RECENT_DATE = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

function mockCloudinaryList(resources, nextCursor = null) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resources, next_cursor: nextCursor }),
  });
}

function mockSupabase({ data = [], error = null } = {}) {
  getSupabaseAdmin.mockReturnValue({
    from: () => ({
      select: () => ({
        not: () => Promise.resolve({ data, error }),
      }),
    }),
  });
}

// --- core logic ---

describe('orphan cleanup', () => {
  it('deletes orphaned images older than 48h', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'orphan1', created_at: OLD_DATE },
      { public_id: 'referenced1', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    mockSupabase({ data: [{ images: 'https://res.cloudinary.com/x/image/upload/v1/referenced1.jpg' }] });
    getPublicIdFromUrl.mockReturnValue('referenced1');

    const res = makeRes();
    await handler({}, res);

    expect(res._status).toBe(200);
    expect(deleteCloudinaryImageById).toHaveBeenCalledWith('orphan1');
    expect(deleteCloudinaryImageById).not.toHaveBeenCalledWith('referenced1');
  });

  it('skips images younger than 48h (grace period)', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'recent1', created_at: RECENT_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ data: [] });

    const res = makeRes();
    await handler({}, res);

    expect(res._status).toBe(200);
    expect(deleteCloudinaryImageById).not.toHaveBeenCalled();
  });

  it('preserves referenced images', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'kept', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    mockSupabase({ data: [{ images: 'https://res.cloudinary.com/x/image/upload/v1/kept.jpg' }] });
    getPublicIdFromUrl.mockReturnValue('kept');

    const res = makeRes();
    await handler({}, res);

    expect(deleteCloudinaryImageById).not.toHaveBeenCalled();
    expect(res._body.deleted).toBe(0);
  });
});

// --- pagination ---

describe('pagination', () => {
  it('fetches all pages of Cloudinary resources', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resources: [{ public_id: 'page1', created_at: OLD_DATE }],
          next_cursor: 'cursor-abc',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resources: [{ public_id: 'page2', created_at: OLD_DATE }],
          next_cursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ data: [] });

    const res = makeRes();
    await handler({}, res);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('cursor-abc');
    expect(deleteCloudinaryImageById).toHaveBeenCalledWith('page1');
    expect(deleteCloudinaryImageById).toHaveBeenCalledWith('page2');
  });
});

// --- edge cases ---

describe('edge cases', () => {
  it('deletes old orphans when no services exist', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'lonely', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ data: [] });

    const res = makeRes();
    await handler({}, res);

    expect(res._status).toBe(200);
    expect(deleteCloudinaryImageById).toHaveBeenCalledWith('lonely');
  });

  it('aborts with 500 when Supabase returns null data', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'img1', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ data: null });

    const res = makeRes();
    await handler({}, res);

    expect(res._status).toBe(500);
    expect(deleteCloudinaryImageById).not.toHaveBeenCalled();
  });

  it('aborts with 500 when Supabase query errors', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'img1', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ error: { message: 'connection refused' } });

    const res = makeRes();
    await handler({}, res);

    expect(res._status).toBe(500);
    expect(deleteCloudinaryImageById).not.toHaveBeenCalled();
  });

  it('aborts with 500 when Cloudinary listing fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    }));

    const res = makeRes();
    await handler({}, res);

    expect(res._status).toBe(500);
    expect(deleteCloudinaryImageById).not.toHaveBeenCalled();
  });

  it('continues deleting others when one individual delete fails', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'fail1', created_at: OLD_DATE },
      { public_id: 'ok1', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ data: [] });

    deleteCloudinaryImageById
      .mockRejectedValueOnce(new Error('delete failed'))
      .mockResolvedValueOnce(undefined);

    const res = makeRes();
    await handler({}, res);

    expect(res._status).toBe(200);
    expect(deleteCloudinaryImageById).toHaveBeenCalledTimes(2);
    expect(res._body.failed).toBe(1);
    expect(res._body.deleted).toBe(1);
  });
});

// --- telegram alerts ---

describe('telegram alerts', () => {
  it('sends alert on Supabase failure', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'img1', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ error: { message: 'timeout' } });

    const res = makeRes();
    await handler({}, res);

    expect(sendTelegramAlert).toHaveBeenCalledOnce();
    expect(sendTelegramAlert.mock.calls[0][0]).toMatch(/cleanup failed/i);
  });

  it('sends alert on partial delete failure', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'fail1', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ data: [] });
    deleteCloudinaryImageById.mockRejectedValueOnce(new Error('oops'));

    const res = makeRes();
    await handler({}, res);

    expect(sendTelegramAlert).toHaveBeenCalledOnce();
    expect(sendTelegramAlert.mock.calls[0][0]).toMatch(/partial failure/i);
  });

  it('sends summary when orphans are deleted successfully', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'orphan1', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ data: [] });

    const res = makeRes();
    await handler({}, res);

    expect(sendTelegramAlert).toHaveBeenCalledOnce();
    expect(sendTelegramAlert.mock.calls[0][0]).toMatch(/deleted 1/i);
  });

  it('does not send alert when no orphans found', async () => {
    const fetchMock = mockCloudinaryList([
      { public_id: 'kept', created_at: OLD_DATE },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    mockSupabase({ data: [{ images: 'https://res.cloudinary.com/x/image/upload/v1/kept.jpg' }] });
    getPublicIdFromUrl.mockReturnValue('kept');

    const res = makeRes();
    await handler({}, res);

    expect(sendTelegramAlert).not.toHaveBeenCalled();
  });
});
