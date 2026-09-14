const OWNER = 'Ukranians-in-Texas';
const REPO = 'spilno-us';
const BACKUP_PATH = 'backups/services.json';
const BACKUP_BRANCH = 'data-backups';

function githubRequest(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');

  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
}

async function ensureBackupBranch() {
  const existingRef = await githubRequest(`/git/ref/heads/${BACKUP_BRANCH}`);
  if (existingRef.ok) return;
  if (existingRef.status !== 404) {
    throw new Error(`Failed to check backup branch: ${existingRef.status}`);
  }

  const repoInfo = await githubRequest('').then((r) => r.json());
  const baseRef = await githubRequest(`/git/ref/heads/${repoInfo.default_branch}`).then((r) => r.json());

  const createResponse = await githubRequest('/git/refs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${BACKUP_BRANCH}`, sha: baseRef.object.sha }),
  });
  if (!createResponse.ok) {
    throw new Error(`Failed to create backup branch: ${createResponse.status}`);
  }
}

// Commits a full JSON snapshot of the services table to a dedicated `data-backups`
// branch (never main/dev, so a backup run never triggers a production deploy).
// Overwrites the same file each run — git history is the point-in-time archive.
export async function backupServicesToGitHub(services) {
  await ensureBackupBranch();

  const content = Buffer.from(JSON.stringify(services, null, 2)).toString('base64');

  const existingFile = await githubRequest(`/contents/${BACKUP_PATH}?ref=${BACKUP_BRANCH}`);
  const sha = existingFile.ok ? (await existingFile.json()).sha : undefined;

  const putResponse = await githubRequest(`/contents/${BACKUP_PATH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `chore: services backup (${new Date().toISOString().slice(0, 10)})`,
      content,
      branch: BACKUP_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putResponse.ok) {
    const body = await putResponse.text();
    throw new Error(`GitHub commit failed: ${putResponse.status} ${body.slice(0, 200)}`);
  }
}
