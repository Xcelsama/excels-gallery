"use server";

import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMessage(prevState, formData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  // Honeypot: a field real visitors never see or fill in (hidden via CSS
  // in MessageForm). Bots that fill every field trip it.
  const honeypot = String(formData.get("company") ?? "").trim();
  // Time-trap: a hidden timestamp of when the form was rendered. A
  // submission within ~1.5s of render is almost certainly scripted.
  const renderedAt = Number(formData.get("renderedAt") ?? 0);
  const tooFast = renderedAt && Date.now() - renderedAt < 1500;

  if (honeypot || tooFast) {
    // Pretend success rather than revealing the trap to whatever filled it.
    return { success: true };
  }

  if (!name || name.length > 200) {
    return { success: false, error: "Enter your name." };
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (!message || message.length > 4000) {
    return {
      success: false,
      error: "Enter a message (up to 4000 characters).",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ name, email, message });

  if (error) {
    return { success: false, error: "Could not send. Please try again." };
  }

  return { success: true };
}
