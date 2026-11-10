"use client";

import { useActionState, useRef, useEffect } from "react";
import { RiCheckboxCircleFill, RiErrorWarningFill, RiUploadCloud2Line } from "@remixicon/react";

import Panel from "@/components/Panel";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Textarea } from "@/components/base/textarea/textarea";
import { publishRelease, type ReleaseFormState } from "./actions";

const initialState: ReleaseFormState = {};

export default function PublishReleaseForm() {
  const [state, action, pending] = useActionState(publishRelease, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <Panel title="Publish a new build" description="Uploads the APK to the backend and marks it latest.">
      <form ref={formRef} action={action} className="@container px-5 pb-5">
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          <input type="hidden" name="platform" value="android" />

          <div className="flex flex-col gap-1.5 @xl:col-span-2">
            <label htmlFor="apk" className="text-body-medium text-text-primary">
              APK file
            </label>
            <input
              id="apk"
              name="apk"
              type="file"
              accept=".apk"
              required
              className="w-full cursor-pointer rounded-xl border border-dashed border-border-button-default bg-background-secondary-default p-2 text-body-regular text-text-secondary outline-none file:me-3 file:cursor-pointer file:rounded-lg file:border file:border-border-button-default file:bg-background-primary-default file:px-2.5 file:py-1 file:text-body-medium file:text-text-primary hover:border-border-button-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            />
          </div>

          <Input name="version_code" type="text" inputMode="numeric" pattern="[1-9][0-9]*" label="Version code" isRequired placeholder="42" />
          <Input name="version_name" type="text" label="Version name" isRequired placeholder="1.2.0" />
          <Input name="min_supported_version_code" type="text" inputMode="numeric" pattern="[1-9][0-9]*" label="Min supported version code" hint="Optional. Older builds are forced to update." />
          <Textarea name="release_notes" label="Release notes" rows={3} autoResize maxRows={8} className="@xl:col-span-2" />

          {state.error && (
            <p role="alert" className="@xl:col-span-2 flex items-start gap-2 rounded-xl bg-status-rose-background px-3 py-2 text-body-regular text-status-rose-text">
              <RiErrorWarningFill className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="@xl:col-span-2 flex items-center gap-2 rounded-xl bg-status-lime-background px-3 py-2 text-body-regular text-status-lime-text">
              <RiCheckboxCircleFill className="size-4 shrink-0" aria-hidden />
              Release published.
            </p>
          )}

          <div className="@xl:col-span-2 flex justify-end">
            <Button type="submit" disabled={pending} leadingIcon={RiUploadCloud2Line} className="w-full @xl:w-auto">
              {pending ? "Uploading…" : "Publish build"}
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  );
}
