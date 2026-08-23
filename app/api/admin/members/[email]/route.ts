import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, type AdminSession } from "@/lib/adminAuth";
import { getRepoFile, putRepoFile } from "@/lib/github";
import { countAdmins, getMembers, serializeMembers, MEMBERS_REPO_PATH, type Role } from "@/lib/members";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ email: string }> };

type AdminAuthResult =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await getAdminSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  if (session.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Only admins can manage members." }, { status: 403 }),
    };
  }
  return { ok: true, session };
}

function isValidRole(role: unknown): role is Role {
  return role === "admin" || role === "editor";
}

/** Change an existing member's role. Admin-only; refuses to demote the last admin. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase();
  const payload = (await request.json()) as { role?: string };

  if (!isValidRole(payload.role)) {
    return NextResponse.json({ error: 'Role must be "admin" or "editor".' }, { status: 400 });
  }

  const members = getMembers();
  const index = members.findIndex((member) => member.email.toLowerCase() === email);
  if (index === -1) {
    return NextResponse.json({ error: `No member found for ${email}.` }, { status: 404 });
  }

  const updated = members.map((member, i) =>
    i === index ? { ...member, role: payload.role as Role } : member,
  );

  if (members[index].role === "admin" && payload.role !== "admin" && countAdmins(updated) === 0) {
    return NextResponse.json(
      { error: "Can't remove the last admin — promote someone else first." },
      { status: 400 },
    );
  }

  const existing = await getRepoFile(MEMBERS_REPO_PATH);
  await putRepoFile(
    MEMBERS_REPO_PATH,
    serializeMembers(updated),
    `Change ${email} to ${payload.role} (via admin, ${session.email})`,
    existing?.sha,
  );

  return NextResponse.json({ email });
}

/** Remove a member. Admin-only; refuses to remove the last admin. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase();

  const members = getMembers();
  const target = members.find((member) => member.email.toLowerCase() === email);
  if (!target) {
    return NextResponse.json({ error: `No member found for ${email}.` }, { status: 404 });
  }

  const updated = members.filter((member) => member.email.toLowerCase() !== email);

  if (target.role === "admin" && countAdmins(updated) === 0) {
    return NextResponse.json(
      { error: "Can't remove the last admin — promote someone else first." },
      { status: 400 },
    );
  }

  const existing = await getRepoFile(MEMBERS_REPO_PATH);
  if (!existing) {
    return NextResponse.json({ error: "members.json not found in the repo." }, { status: 404 });
  }

  await putRepoFile(
    MEMBERS_REPO_PATH,
    serializeMembers(updated),
    `Remove member ${email} (via admin, ${session.email})`,
    existing.sha,
  );

  return NextResponse.json({ email });
}
