import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh px-6 py-24">
      <p className="label mb-4">Missing</p>
      <h1 className="font-display text-5xl tracking-tight">That page is not here.</h1>
      <Link href="/" className="mt-8 inline-block border-b border-line pb-0.5">
        Back to Still
      </Link>
    </div>
  );
}
