import { redirect } from "next/navigation";

export default async function LoginAlias({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  redirect(`/auth/sign-in${suffix}`);
}
