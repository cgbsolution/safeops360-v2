import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBox className="h-8 w-48" />
          <SkeletonBox className="h-4 w-72" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <SkeletonBox className="h-4 w-24" />
              <SkeletonBox className="h-10 w-16" />
              <SkeletonBox className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <SkeletonBox className="h-4 w-24" />
              <SkeletonBox className="h-10 w-16" />
              <SkeletonBox className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <SkeletonBox className="h-5 w-48" />
            <SkeletonBox className="h-3 w-32 mt-1" />
          </CardHeader>
          <CardContent>
            <SkeletonBox className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <SkeletonBox className="h-5 w-36" />
            <SkeletonBox className="h-3 w-28 mt-1" />
          </CardHeader>
          <CardContent>
            <SkeletonBox className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <SkeletonBox className="h-5 w-40" />
              <SkeletonBox className="h-3 w-28 mt-1" />
            </CardHeader>
            <CardContent>
              <SkeletonBox className="h-40 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <SkeletonBox className="h-5 w-36" />
          <SkeletonBox className="h-3 w-52 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="py-3 flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex gap-2">
                    <SkeletonBox className="h-5 w-20" />
                    <SkeletonBox className="h-5 w-32" />
                  </div>
                  <SkeletonBox className="h-4 w-3/4" />
                </div>
                <SkeletonBox className="h-4 w-16 ml-4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
