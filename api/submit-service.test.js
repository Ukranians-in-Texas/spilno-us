import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./_lib/supabase.js', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('./_lib/telegram.js', () => ({ sendTelegramNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/data/categories.js', () => ({
  getAllSubcategories: () => ['Manicure / Nail Services', 'Haircuts / Hair Coloring', 'Doctors / Clinics'],
}));

import handler from './submit-service.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendTelegramNotification } from './_lib/telegram.js';

// --- helpers ---

function validBody() {
  return {
    category: 'Manicure / Nail Services',
    businessName: 'Test Business',
    descriptionEn: 'Description in English',
    descriptionUa: 'Опис українською',
    phone: '(512) 555-1234',
    email: 'test@example.com',
  };
}

function makeReq(overrides = {}) {
  return { method: 'POST', body: { ...validBody(), ...overrides } };
}

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

function mockSupabase({ count = 0, countError = null, insertError = null } = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ count, error: countError }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: insertError ? null : { id: 'test-uuid-123' },
          error: insertError ?? null,
        }),
      }),
    }),
  };
  getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) });
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- tests ---

describe('method validation', () => {
  it('returns 405 for non-POST requests', async () => {
    const res = makeRes();
    await handler({ method: 'GET', body: {} }, res);
    expect(res._status).toBe(405);
  });
});

describe('honeypot', () => {
  it('silently returns 200 when honeypot is filled', async () => {
    const res = makeRes();
    await handler(makeReq({ honeypot: 'bot was here' }), res);
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
  });
});

describe('required fields', () => {
  it.each([
    ['category', { category: '' }],
    ['businessName', { businessName: '   ' }],
    ['descriptionEn', { descriptionEn: '' }],
    ['descriptionUa', { descriptionUa: '' }],
    ['email', { email: '' }],
  ])('returns 400 when %s is missing', async (_field, override) => {
    const res = makeRes();
    await handler(makeReq(override), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Missing required fields');
  });

  it('returns 400 when body is missing entirely', async () => {
    const res = makeRes();
    await handler({ method: 'POST' }, res);
    expect(res._status).toBe(400);
  });
});

describe('category validation', () => {
  it('returns 400 for an unknown category', async () => {
    const res = makeRes();
    await handler(makeReq({ category: 'Fake Category' }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Invalid category');
  });
});

describe('format validation', () => {
  it('returns 400 for invalid email', async () => {
    const res = makeRes();
    await handler(makeReq({ email: 'notanemail' }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Invalid email');
  });

  it('returns 400 for phone with letters', async () => {
    const res = makeRes();
    await handler(makeReq({ phone: 'call me maybe' }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Invalid phone');
  });

  it('returns 400 for website without http(s)://', async () => {
    const res = makeRes();
    await handler(makeReq({ website: 'example.com' }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Invalid website URL');
  });

  it('accepts website with https://', async () => {
    mockSupabase();
    const res = makeRes();
    await handler(makeReq({ website: 'https://example.com' }), res);
    expect(res._status).toBe(200);
  });

  it('returns 400 for Instagram URL that is not instagram.com', async () => {
    const res = makeRes();
    await handler(makeReq({ instagram: 'https://twitter.com/user' }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Invalid Instagram URL');
  });

  it('returns 400 for Facebook URL that is not facebook.com', async () => {
    const res = makeRes();
    await handler(makeReq({ facebook: 'https://instagram.com/user' }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Invalid Facebook URL');
  });

  it('returns 400 for LinkedIn URL that is not linkedin.com', async () => {
    const res = makeRes();
    await handler(makeReq({ linkedin: 'https://twitter.com/user' }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Invalid LinkedIn URL');
  });

  it('accepts valid social URLs', async () => {
    mockSupabase();
    const res = makeRes();
    await handler(makeReq({
      instagram: 'https://instagram.com/testuser',
      facebook: 'https://facebook.com/testpage',
      linkedin: 'https://linkedin.com/in/testuser',
    }), res);
    expect(res._status).toBe(200);
  });
});

describe('length limits', () => {
  it('returns 400 when businessName exceeds 100 chars', async () => {
    const res = makeRes();
    await handler(makeReq({ businessName: 'a'.repeat(101) }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Business name too long');
  });

  it('accepts businessName at exactly 100 chars', async () => {
    mockSupabase();
    const res = makeRes();
    await handler(makeReq({ businessName: 'a'.repeat(100) }), res);
    expect(res._status).toBe(200);
  });

  it('returns 400 when descriptionEn exceeds 600 chars', async () => {
    const res = makeRes();
    await handler(makeReq({ descriptionEn: 'a'.repeat(601) }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Description too long');
  });

  it('returns 400 when descriptionUa exceeds 600 chars', async () => {
    const res = makeRes();
    await handler(makeReq({ descriptionUa: 'a'.repeat(601) }), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Description too long');
  });
});

describe('rate limiting', () => {
  it('returns 429 when email has 3+ recent submissions', async () => {
    mockSupabase({ count: 3 });
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(429);
    expect(res._body.error).toMatch(/too many/i);
  });

  it('allows submission when count is 2', async () => {
    mockSupabase({ count: 2 });
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(200);
  });

  it('returns 500 when count query errors (fail closed)', async () => {
    mockSupabase({ countError: { message: 'connection refused' } });
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(500);
    expect(res._body.error).toMatch(/unable to process/i);
  });
});

describe('image URL filtering', () => {
  it('filters out non-Cloudinary URLs', async () => {
    const chain = mockSupabase();
    const res = makeRes();
    await handler(makeReq({
      imageUrls: [
        'https://res.cloudinary.com/demo/image/upload/a.jpg',
        'https://evil.com/image.jpg',
        'https://res.cloudinary.com/demo/image/upload/b.jpg',
      ],
    }), res);

    expect(res._status).toBe(200);
    const inserted = chain.insert.mock.calls[0][0];
    expect(inserted.images).toBe(
      'https://res.cloudinary.com/demo/image/upload/a.jpg,https://res.cloudinary.com/demo/image/upload/b.jpg'
    );
  });

  it('caps image URLs at 5', async () => {
    const chain = mockSupabase();
    const res = makeRes();
    await handler(makeReq({
      imageUrls: Array.from({ length: 8 }, (_, i) =>
        `https://res.cloudinary.com/demo/image/upload/${i}.jpg`
      ),
    }), res);

    expect(res._status).toBe(200);
    const inserted = chain.insert.mock.calls[0][0];
    expect(inserted.images.split(',').length).toBe(5);
  });

  it('omits images field when no valid URLs provided', async () => {
    const chain = mockSupabase();
    const res = makeRes();
    await handler(makeReq({ imageUrls: ['https://evil.com/image.jpg'] }), res);

    expect(res._status).toBe(200);
    const inserted = chain.insert.mock.calls[0][0];
    expect(inserted.images).toBeUndefined();
  });
});

describe('success and error paths', () => {
  it('returns 200 with success=true for a valid submission', async () => {
    mockSupabase();
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
  });

  it('returns 500 when Supabase insert fails', async () => {
    mockSupabase({ insertError: new Error('DB error') });
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(500);
  });

  it('trims fields before saving', async () => {
    const chain = mockSupabase();
    const res = makeRes();
    await handler(makeReq({ businessName: '  Trimmed Business  ' }), res);

    const inserted = chain.insert.mock.calls[0][0];
    expect(inserted.title).toBe('Trimmed Business');
  });

  it('always sets approved=false on new submissions', async () => {
    const chain = mockSupabase();
    const res = makeRes();
    await handler(makeReq(), res);

    const inserted = chain.insert.mock.calls[0][0];
    expect(inserted.approved).toBe(false);
  });

  it('passes the inserted row id to sendTelegramNotification', async () => {
    mockSupabase();
    const res = makeRes();
    await handler(makeReq(), res);
    expect(sendTelegramNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Business' }),
      'test-uuid-123'
    );
  });
});
