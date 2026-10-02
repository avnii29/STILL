import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <div className="px-6 py-16 sm:px-10">
      <PageSkeleton />
    </div>
  );
}
