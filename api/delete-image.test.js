import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./_lib/cloudinary.js', () => ({
  deleteCloudinaryImageById: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./_lib/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(),
}));

import handler from './delete-image.js';
import { deleteCloudinaryImageById } from './_lib/cloudinary.js';
import { getSupabaseAdmin } from './_lib/supabase.js';

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  deleteCloudinaryImageById.mockClear();
});

afterEach(() => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});

function makeReq(overrides = {}) {
  return {
    method: 'POST',
    headers: {},
    body: { publicId: 'folder/my-image' },
    ...overrides,
  };
}

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

function mockAuth({ user = { id: 'user-1' }, error = null } = {}) {
  getSupabaseAdmin.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: error ? null : user },
        error,
      }),
    },
  });
}

// --- auth ---

describe('authentication', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(401);
    expect(res._body.error).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: 'Basic abc' } }), res);
    expect(res._status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth({ error: { message: 'invalid token' } });
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: 'Bearer bad-token' } }), res);
    expect(res._status).toBe(401);
  });

  it('returns 401 when getUser returns no user', async () => {
    getSupabaseAdmin.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: 'Bearer some-token' } }), res);
    expect(res._status).toBe(401);
  });
});

// --- method ---

describe('method check', () => {
  it('returns 405 for non-POST methods', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res);
    expect(res._status).toBe(405);
  });
});

// --- validation ---

function authedReq(overrides = {}) {
  return makeReq({ headers: { authorization: 'Bearer valid-token' }, ...overrides });
}

describe('validation', () => {
  beforeEach(() => mockAuth());

  it('returns 400 when publicId is missing', async () => {
    const res = makeRes();
    await handler(authedReq({ body: {} }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Missing publicId');
  });

  it('returns 400 when publicId is not a string', async () => {
    const res = makeRes();
    await handler(authedReq({ body: { publicId: 123 } }), res);
    expect(res._status).toBe(400);
  });
});

// --- upload folder restriction (opt-in) ---

describe('CLOUDINARY_UPLOAD_FOLDER restriction', () => {
  beforeEach(() => mockAuth());
  afterEach(() => { delete process.env.CLOUDINARY_UPLOAD_FOLDER; });

  it('is a no-op when CLOUDINARY_UPLOAD_FOLDER is not set', async () => {
    const res = makeRes();
    await handler(authedReq({ body: { publicId: 'other-folder/my-image' } }), res);
    expect(res._status).toBe(200);
  });

  it('rejects a publicId outside the configured folder', async () => {
    process.env.CLOUDINARY_UPLOAD_FOLDER = 'folder';
    const res = makeRes();
    await handler(authedReq({ body: { publicId: 'other-folder/my-image' } }), res);
    expect(res._status).toBe(403);
    expect(res._body.error).toBe('Forbidden');
    expect(deleteCloudinaryImageById).not.toHaveBeenCalled();
  });

  it('allows a publicId inside the configured folder', async () => {
    process.env.CLOUDINARY_UPLOAD_FOLDER = 'folder';
    const res = makeRes();
    await handler(authedReq({ body: { publicId: 'folder/my-image' } }), res);
    expect(res._status).toBe(200);
    expect(deleteCloudinaryImageById).toHaveBeenCalledWith('folder/my-image');
  });
});

// --- cloudinary ---

describe('cloudinary delete', () => {
  beforeEach(() => mockAuth());

  it('returns 500 when Cloudinary credentials are missing', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const res = makeRes();
    await handler(authedReq(), res);
    expect(res._status).toBe(500);
    expect(res._body.error).toBe('Server configuration error');
  });

  it('returns 500 when Cloudinary delete fails', async () => {
    deleteCloudinaryImageById.mockRejectedValueOnce(new Error('API error'));
    const res = makeRes();
    await handler(authedReq(), res);
    expect(res._status).toBe(500);
    expect(res._body.error).toBe('Failed to delete image');
  });

  it('returns 200 on successful delete', async () => {
    const res = makeRes();
    await handler(authedReq(), res);
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(deleteCloudinaryImageById).toHaveBeenCalledWith('folder/my-image');
  });
});
