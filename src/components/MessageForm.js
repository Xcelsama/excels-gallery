"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { sendMessage } from "@/lib/actions/message";

const initialState = { success: false, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-accent/40 bg-accent-soft px-8 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent/20 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send message"}
    </button>
  );
}

export default function MessageForm() {
  const [state, formAction] = useActionState(sendMessage, initialState);
  const renderedAt = useRef(Date.now());

  if (state.success) {
    return (
      <p className="rounded-lg border border-line bg-surface px-5 py-4 text-sm text-ink">
        Thanks — your message is on its way.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {/* Honeypot: real visitors never see this field. Kept off-screen
          rather than display:none, which some bots skip past. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <input type="hidden" name="renderedAt" value={renderedAt.current} />

      <div>
        <label htmlFor="name" className="block text-sm text-ink-muted">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-ink"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm text-ink-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={320}
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-ink"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm text-ink-muted">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={4000}
          className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface px-4 py-2.5 text-ink"
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
