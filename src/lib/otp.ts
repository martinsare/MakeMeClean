import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

async function readFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === "string") return body.error;
      if (typeof body?.message === "string") return body.message;
      if (typeof body === "string") return body;
      return "Edge function failed";
    } catch {
      try {
        const text = await error.context.text();
        return text || error.message;
      } catch {
        return error.message;
      }
    }
  }

  if (error instanceof Error) return error.message;
  return "Request failed";
}

export async function sendOtp(
  email: string,
  purpose: "registration" | "careers" | "password_reset"
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("send-otp", {
    body: { email, purpose },
  });
  if (error) return { ok: false, error: await readFunctionError(error) };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Failed to send code" };
  return { ok: true };
}

export async function verifyOtp(
  email: string,
  otp: string,
  purpose: "registration" | "careers" | "password_reset"
): Promise<{ ok: boolean; verified: boolean; error?: string; reason?: string; resetToken?: string }> {
  const { data, error } = await supabase.functions.invoke("verify-otp", {
    body: { email, otp, purpose },
  });
  if (error) return { ok: false, verified: false, error: await readFunctionError(error) };
  if (!data?.ok) return { ok: false, verified: false, error: data?.error };
  return {
    ok: true,
    verified: Boolean(data.verified),
    reason: data.reason,
    resetToken: typeof data.resetToken === "string" ? data.resetToken : undefined,
  };
}
