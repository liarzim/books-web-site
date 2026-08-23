"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./MembersManager.module.css";
import type { Member, Role } from "@/lib/members";

interface MembersManagerProps {
  members: Member[];
  /** The signed-in admin viewing this page -- used to block self-removal. */
  currentEmail: string;
}

const NEW_MEMBER_KEY = "__new__";

export default function MembersManager({ members, currentEmail }: MembersManagerProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusyEmail(NEW_MEMBER_KEY);

    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Failed (${response.status})`);

      setEmail("");
      setRole("editor");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyEmail(null);
    }
  };

  const handleRoleChange = async (memberEmail: string, newRole: Role) => {
    setError(null);
    setBusyEmail(memberEmail);

    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(memberEmail)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Failed (${response.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyEmail(null);
    }
  };

  const handleRemove = async (memberEmail: string) => {
    if (
      !window.confirm(
        `Remove ${memberEmail}? They'll lose admin access once the change deploys.`,
      )
    ) {
      return;
    }

    setError(null);
    setBusyEmail(memberEmail);

    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(memberEmail)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Failed (${response.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <ul className={styles.memberList}>
        {members.map((member) => {
          const isSelf = member.email.toLowerCase() === currentEmail.toLowerCase();
          const busy = busyEmail === member.email;

          return (
            <li key={member.email} className={styles.memberRow}>
              <div>
                <span>{member.email}</span>
                {isSelf && <span className={styles.you}> (you)</span>}
                <div className={styles.memberMeta}>
                  Added {new Date(member.addedAt).toLocaleDateString()} by {member.addedBy}
                </div>
              </div>

              <div className={styles.memberActions}>
                <label className={styles.roleSelect}>
                  <span className={styles.srOnly}>Role for {member.email}</span>
                  <select
                    value={member.role}
                    disabled={busy}
                    onChange={(event) =>
                      handleRoleChange(member.email, event.target.value as Role)
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => handleRemove(member.email)}
                  disabled={busy || isSelf}
                  title={isSelf ? "Ask another admin to remove you" : undefined}
                  className={styles.removeButton}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <h2 className={styles.addFormTitle}>Add a member</h2>

        <label className={styles.field}>
          <span>Google account email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />
        </label>

        <label className={styles.field}>
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="editor">Editor — can create, edit, and delete books</option>
            <option value="admin">Admin — can also manage members</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={busyEmail === NEW_MEMBER_KEY}
          className={styles.submitButton}
        >
          {busyEmail === NEW_MEMBER_KEY ? "Adding…" : "Add member"}
        </button>
      </form>

      <p className={styles.note}>
        Changes here commit to GitHub and take effect after the next deploy (usually about a
        minute on Vercel). Someone whose role just changed may need to sign out and back in to
        see it take effect.
      </p>
    </div>
  );
}
