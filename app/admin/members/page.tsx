import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import { getMembers } from "@/lib/members";
import MembersManager from "./MembersManager";
import styles from "../admin.module.css";

export default async function MembersPage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin");
  }

  if (session.role !== "admin") {
    return (
      <main className={styles.main}>
        <h1>Members</h1>
        <p className={styles.subtitle}>
          Only admins can manage members. Ask an existing admin for access.
        </p>
        <Link href="/admin" className={styles.button}>
          Back to admin
        </Link>
      </main>
    );
  }

  const members = getMembers();

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <div>
          <h1>Members</h1>
          <p className={styles.subtitle}>Who can sign in at /admin, and what they can do.</p>
        </div>
        <Link href="/admin" className={styles.secondaryButton}>
          Back to admin
        </Link>
      </div>

      <MembersManager members={members} currentEmail={session.email} />
    </main>
  );
}
