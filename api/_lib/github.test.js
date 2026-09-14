import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { backupServicesToGitHub } from './github.js';

beforeEach(() => {
  process.env.GITHUB_TOKEN = 'test-token';
});

afterEach(() => {
  delete process.env.GITHUB_TOKEN;
  vi.unstubAllGlobals();
});

function jsonResponse(body, { ok = true, status = ok ? 200 : 500 } = {}) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('backupServicesToGitHub', () => {
  it('throws immediately when GITHUB_TOKEN is not configured', async () => {
    delete process.env.GITHUB_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(backupServicesToGitHub([])).rejects.toThrow('GITHUB_TOKEN not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('commits without a branch-create step when the backup branch already exists', async () => {
    const fetchMock = vi
      .fn()
      // ensureBackupBranch: branch ref lookup
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }))
      // existing file lookup (no file yet)
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }))
      // PUT contents
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await backupServicesToGitHub([{ id: '1' }]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/git/ref/heads/data-backups');
    const putCall = fetchMock.mock.calls[2];
    expect(putCall[0]).toContain('/contents/backups/services.json');
    expect(putCall[1].method).toBe('PUT');
    const putBody = JSON.parse(putCall[1].body);
    expect(putBody.branch).toBe('data-backups');
    expect(putBody.sha).toBeUndefined();
    expect(JSON.parse(Buffer.from(putBody.content, 'base64').toString())).toEqual([{ id: '1' }]);
  });

  it('creates the backup branch first when it does not exist yet', async () => {
    const fetchMock = vi
      .fn()
      // ensureBackupBranch: branch ref lookup -> 404
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }))
      // repo info -> default branch
      .mockResolvedValueOnce(jsonResponse({ default_branch: 'main' }, { ok: true }))
      // base ref sha
      .mockResolvedValueOnce(jsonResponse({ object: { sha: 'base-sha' } }, { ok: true }))
      // create ref
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }))
      // existing file lookup
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }))
      // PUT contents
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await backupServicesToGitHub([]);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    const createRefCall = fetchMock.mock.calls[3];
    expect(createRefCall[0]).toContain('/git/refs');
    const createRefBody = JSON.parse(createRefCall[1].body);
    expect(createRefBody).toEqual({ ref: 'refs/heads/data-backups', sha: 'base-sha' });
  });

  it('throws when checking the backup branch fails unexpectedly', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(backupServicesToGitHub([])).rejects.toThrow('Failed to check backup branch: 500');
  });

  it('includes the existing file sha when overwriting a prior backup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }))
      .mockResolvedValueOnce(jsonResponse({ sha: 'existing-sha' }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await backupServicesToGitHub([{ id: '1' }]);

    const putBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(putBody.sha).toBe('existing-sha');
  });

  it('throws with the response body when the commit itself fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ message: 'sha mismatch' }, { ok: false, status: 409 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(backupServicesToGitHub([])).rejects.toThrow(/GitHub commit failed: 409/);
  });
});
