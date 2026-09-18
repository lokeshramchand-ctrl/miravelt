"use client";

import { useActionState, useRef, useEffect } from "react";

import { publishRelease, type ReleaseFormState } from "./actions";

const initialState: ReleaseFormState = {};

export default function PublishReleaseForm() {
  const [state, action, pending] = useActionState(publishRelease, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Publish a new build</h2>
      <input type="hidden" name="platform" value="android" />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="APK file" htmlFor="apk">
          <input id="apk" name="apk" type="file" accept=".apk" required className="text-sm text-zinc-700 dark:text-zinc-300" />
        </Field>
        <Field label="Version code" htmlFor="version_code">
          <input id="version_code" name="version_code" type="number" required min={1} className={inputClass} />
        </Field>
        <Field label="Version name" htmlFor="version_name">
          <input id="version_name" name="version_name" type="text" required placeholder="1.2.0" className={inputClass} />
        </Field>
        <Field label="Min supported version code (optional)" htmlFor="min_supported_version_code">
          <input id="min_supported_version_code" name="min_supported_version_code" type="number" min={1} className={inputClass} />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Release notes" htmlFor="release_notes">
          <textarea id="release_notes" name="release_notes" rows={2} className={inputClass} />
        </Field>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Release published.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Uploading…" : "Publish"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}
