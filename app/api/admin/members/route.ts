import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { getRepoFile, putRepoFile } from "@/lib/github";
import { getMembers, serializeMembers, MEMBERS_REPO_PATH, type Role } from "@/lib/members";

export const runtime = "nodejs";

interface AddMemberPayload {
  email?: string;
  role?: string;
}

function isValidRole(role: unknown): role is Role {
  return role === "admin" || role === "editor";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Add a new member. Admin-only. */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage members." }, { status: 403 });
  }

  const payload = (await request.json()) as AddMemberPayload;
  const email = payload.email?.trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (!isValidRole(payload.role)) {
    return NextResponse.json({ error: 'Role must be "admin" or "editor".' }, { status: 400 });
  }

  const members = getMembers();
  if (members.some((member) => member.email.toLowerCase() === email)) {
    return NextResponse.json({ error: `${email} is already a member.` }, { status: 409 });
  }

  const updated = [
    ...members,
    {
      email,
      role: payload.role,
      addedAt: new Date().toISOString(),
      addedBy: session.email,
    },
  ];

  const existing = await getRepoFile(MEMBERS_REPO_PATH);
  await putRepoFile(
    MEMBERS_REPO_PATH,
    serializeMembers(updated),
    `Add member ${email} as ${payload.role} (via admin, ${session.email})`,
    existing?.sha,
  );

  return NextResponse.json({ email });
}
