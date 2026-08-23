"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./BookForm.module.css";

interface TocEntryInput {
  label: string;
  anchor: string;
}

export interface BookFormValues {
  slug: string;
  title: string;
  author: string;
  language: string;
  coverImage: string;
  publishedYear: string;
  excerpt: string;
  toc: TocEntryInput[];
  body: string;
}

interface BookFormProps {
  mode: "create" | "edit";
  initialValues: BookFormValues;
}

export default function BookForm({ mode, initialValues }: BookFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<BookFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof BookFormValues>(
    key: K,
    value: BookFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const updateTocEntry = (index: number, key: keyof TocEntryInput, value: string) => {
    setValues((prev) => ({
      ...prev,
      toc: prev.toc.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    }));
  };

  const addTocEntry = () => {
    setValues((prev) => ({ ...prev, toc: [...prev.toc, { label: "", anchor: "" }] }));
  };

  const removeTocEntry = (index: number) => {
    setValues((prev) => ({ ...prev, toc: prev.toc.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      title: values.title,
      author: values.author,
      language: values.language,
      coverImage: values.coverImage || undefined,
      publishedYear: values.publishedYear ? Number(values.publishedYear) : undefined,
      excerpt: values.excerpt || undefined,
      toc: values.toc.filter((entry) => entry.label.trim() && entry.anchor.trim()),
      body: values.body,
      ...(mode === "create" ? { slug: values.slug } : {}),
    };

    const url =
      mode === "create" ? "/api/admin/books" : `/api/admin/books/${initialValues.slug}`;
    const method = mode === "create" ? "POST" : "PUT";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        slug?: string;
        error?: string;
      };

      if (!response.ok || !data.slug) {
        throw new Error(data.error ?? `Save failed (${response.status})`);
      }

      router.push(`/admin/books/${data.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (mode !== "edit") return;
    if (!window.confirm(`Delete "${values.title || initialValues.slug}"? This cannot be undone.`)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/books/${initialValues.slug}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Delete failed (${response.status})`);
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <label className={styles.field}>
        <span>Slug</span>
        <input
          type="text"
          value={values.slug}
          onChange={(event) => updateField("slug", event.target.value)}
          disabled={mode === "edit"}
          placeholder="dune"
          required
        />
        {mode === "edit" && (
          <span className={styles.hint}>
            Not editable after creation — it&apos;s the filename and URL.
          </span>
        )}
      </label>

      <label className={styles.field}>
        <span>Title</span>
        <input
          type="text"
          value={values.title}
          onChange={(event) => updateField("title", event.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span>Author</span>
        <input
          type="text"
          value={values.author}
          onChange={(event) => updateField("author", event.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span>Language</span>
        <select
          value={values.language}
          onChange={(event) => updateField("language", event.target.value)}
        >
          <option value="en">English</option>
          <option value="he">Hebrew</option>
        </select>
      </label>

      <label className={styles.field}>
        <span>Cover image URL</span>
        <input
          type="text"
          value={values.coverImage}
          onChange={(event) => updateField("coverImage", event.target.value)}
          placeholder="/images/books/example.jpg"
        />
      </label>

      <label className={styles.field}>
        <span>Published year</span>
        <input
          type="number"
          value={values.publishedYear}
          onChange={(event) => updateField("publishedYear", event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Excerpt</span>
        <textarea
          value={values.excerpt}
          onChange={(event) => updateField("excerpt", event.target.value)}
          rows={3}
        />
      </label>

      <fieldset className={styles.field}>
        <legend>Table of contents</legend>
        {values.toc.map((entry, index) => (
          <div key={index} className={styles.tocRow}>
            <input
              type="text"
              placeholder="Label"
              aria-label={`Table of contents entry ${index + 1} label`}
              value={entry.label}
              onChange={(event) => updateTocEntry(index, "label", event.target.value)}
            />
            <input
              type="text"
              placeholder="anchor-id"
              aria-label={`Table of contents entry ${index + 1} anchor`}
              value={entry.anchor}
              onChange={(event) => updateTocEntry(index, "anchor", event.target.value)}
            />
            <button
              type="button"
              onClick={() => removeTocEntry(index)}
              aria-label={`Remove table of contents entry ${index + 1}`}
            >
              &times;
            </button>
          </div>
        ))}
        <button type="button" onClick={addTocEntry}>
          + Add entry
        </button>
      </fieldset>

      <label className={styles.field}>
        <span>Body (Markdown)</span>
        <textarea
          value={values.body}
          onChange={(event) => updateField("body", event.target.value)}
          rows={16}
          className={styles.bodyTextarea}
          required
        />
      </label>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : mode === "create" ? "Create book" : "Save changes"}
        </button>

        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className={styles.deleteButton}
          >
            Delete book
          </button>
        )}
      </div>
    </form>
  );
}
