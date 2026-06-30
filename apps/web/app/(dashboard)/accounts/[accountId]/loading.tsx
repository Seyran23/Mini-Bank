import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountDetailLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-48" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-44" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
