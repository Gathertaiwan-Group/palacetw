"use client";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button for admin Server Action forms: while the form is submitting every SubmitButton in it is disabled
 * (prevents duplicate drafts/coupons from double clicks) and the clicked one shows `pendingText`.
 */
export default function SubmitButton({ pendingText = "儲存中…", children, disabled, ...rest }: ComponentProps<"button"> & { pendingText?: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && (rest.name ? data?.get(rest.name) === String(rest.value ?? "") : true);
  return (
    <button type="submit" {...rest} disabled={disabled || pending} aria-busy={mine || undefined} aria-disabled={pending || undefined}>
      {mine ? pendingText : children}
    </button>
  );
}
