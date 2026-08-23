// Minimal client for the parts of GitHub's Contents API the admin editor
// needs (read/write/delete a single file), using one shared server-side
// token -- editors authenticate with Google, not GitHub; this token is
// what actually makes the commits on their behalf.

const GITHUB_API_ROOT = "https://api.github.com";

interface RepoConfig {
  repo: string; // "owner/name"
  branch: string;
  token: string;
}

function getRepoConfig(): RepoConfig {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_ADMIN_TOKEN;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!repo || !token) {
    throw new Error(
      "Missing GITHUB_REPO or GITHUB_ADMIN_TOKEN environment variable.",
    );
  }

  return { repo, branch, token };
}

/** GitHub's Contents API takes the path as literal segments -- encode each
 * segment but preserve the "/" separators between them. */
function encodeGitHubPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function githubRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const { token } = getRepoConfig();
  return fetch(`${GITHUB_API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
}

export interface RepoFile {
  sha: string;
}

/** Returns the file's sha (needed to update or delete it), or null if it doesn't exist. */
export async function getRepoFile(path: string): Promise<RepoFile | null> {
  const { repo, branch } = getRepoConfig();
  const response = await githubRequest(
    `/repos/${repo}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(branch)}`,
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `GitHub API error reading ${path}: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { sha: string };
  return { sha: data.sha };
}

/** Creates or updates a file. Pass the existing sha to update; omit to create. */
export async function putRepoFile(
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<void> {
  const { repo, branch } = getRepoConfig();
  const response = await githubRequest(`/repos/${repo}/contents/${encodeGitHubPath(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      // UTF-8 safe -- correct for the Hebrew-language content this site
      // also supports, not just ASCII.
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error writing ${path}: ${response.status} ${await response.text()}`,
    );
  }
}

export async function deleteRepoFile(path: string, message: string, sha: string): Promise<void> {
  const { repo, branch } = getRepoConfig();
  const response = await githubRequest(`/repos/${repo}/contents/${encodeGitHubPath(path)}`, {
    method: "DELETE",
    body: JSON.stringify({ message, sha, branch }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error deleting ${path}: ${response.status} ${await response.text()}`,
    );
  }
}
