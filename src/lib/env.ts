import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined || value === null ? undefined : value;

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(20).optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(20).optional(),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(20).optional()),
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
  AI_PROVIDER: z.enum(["none", "openai", "anthropic"]).optional().default("none"),
  AI_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  EMAIL_PROVIDER: z.enum(["none", "resend", "smtp", "log"]).optional().default("none"),
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  VAPID_PRIVATE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  VAPID_SUBJECT: z.preprocess(emptyToUndefined, z.string().optional()),
  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CALENDAR_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_DOCS_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_DOCS_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_BOT_USERNAME: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  WHATSAPP_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  WHATSAPP_APP_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  WHATSAPP_VERIFY_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  INSTAGRAM_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  INSTAGRAM_APP_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  GMAIL_ENABLED: z.enum(["true", "false"]).optional(),
  GUEST_EXTRACT_DAILY_LIMIT: z.preprocess(emptyToUndefined, z.string().optional()),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  TURNSTILE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = serverEnvSchema.parse(process.env);
  return cached;
}

export function getSupabaseAnonKey(): string | undefined {
  const env = getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function isSupabaseConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseAnonKey());
}

export function isGoogleAuthEnabled(): boolean {
  return getServerEnv().NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && isSupabaseConfigured();
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getServerEnv().DATABASE_URL);
}

export function getAppUrl(): string {
  const env = getServerEnv();
  return env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function isProduction(): boolean {
  return getServerEnv().NODE_ENV === "production";
}

export function isServiceRoleConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isTurnstileConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

export type CaptchaMode = "active" | "development" | "unavailable";

export function captchaMode(): CaptchaMode {
  if (isTurnstileConfigured()) return "active";
  return isProduction() ? "unavailable" : "development";
}
