import fs from "fs";
import path from "path";

// The site's member/role list, stored as versioned JSON in the repo
// (content/members.json) rather than a database -- edits go through the
// same GitHub-commit-then-redeploy flow as books, and the file is read
// from local disk at request time, same as content/books.

const membersFilePath = path.join(process.cwd(), "content/members.json");

/** Path used when reading/writing this file through GitHub's Contents API. */
export const MEMBERS_REPO_PATH = "content/members.json";

export type Role = "admin" | "editor";

export interface Member {
  email: string;
  role: Role;
  /** ISO timestamp of when this member was added. */
  addedAt: string;
  /** Email of the admin who added them (or "setup" for the initial seed). */
  addedBy: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRole(value: unknown): value is Role {
  return value === "admin" || value === "editor";
}

/** Every member listed in content/members.json, or [] if the file is missing or empty. */
export function getMembers(): Member[] {
  if (!fs.existsSync(membersFilePath)) return [];

  try {
    const raw = fs.readFileSync(membersFilePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is Member => {
      if (typeof entry !== "object" || entry === null) return false;
      const candidate = entry as Partial<Member>;
      return typeof candidate.email === "string" && isRole(candidate.role);
    });
  } catch {
    return [];
  }
}

/** Serializes the member list back to the same JSON shape stored in the repo. */
export function serializeMembers(members: Member[]): string {
  return JSON.stringify(members, null, 2) + "\n";
}

export function countAdmins(members: Member[]): number {
  return members.filter((member) => member.role === "admin").length;
}

/**
 * Bootstrap/failsafe allowlist, consulted only when content/members.json has
 * no entry at all for the signed-in email. This exists so the site owner
 * can never be fully locked out -- if members.json is ever empty, missing,
 * or misconfigured, anyone matching ADMIN_ALLOWED_EMAILS or
 * ADMIN_ALLOWED_DOMAIN still gets in, with the "admin" role. Keep your own
 * email in ADMIN_ALLOWED_EMAILS permanently as that safety net.
 */
function bootstrapAdminRole(email: string): Role | null {
  const normalized = normalizeEmail(email);

  const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.includes(normalized)) return "admin";

  const allowedDomain = process.env.ADMIN_ALLOWED_DOMAIN?.trim().toLowerCase();
  if (allowedDomain && normalized.endsWith(`@${allowedDomain}`)) return "admin";

  return null;
}

/**
 * The role a signed-in Google account should get, or null to deny sign-in.
 * content/members.json is authoritative; ADMIN_ALLOWED_EMAILS/DOMAIN is only
 * a failsafe for emails that aren't listed there at all.
 */
export function findMemberRole(email: string): Role | null {
  const normalized = normalizeEmail(email);
  const member = getMembers().find((entry) => normalizeEmail(entry.email) === normalized);
  if (member) return member.role;

  return bootstrapAdminRole(email);
}
