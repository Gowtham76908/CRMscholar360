import { cn } from "../../lib/utils";

/** Single shimmer block */
export function Skeleton({ className }) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-gray-200",
                className
            )}
        />
    );
}

/** Full-page skeleton for the Leads list */
export function LeadsSkeleton() {
    return (
        <div className="p-6 space-y-4">
            {/* Header bar */}
            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-9 w-32" />
                <div className="ml-auto flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>
            {/* Table rows */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 px-4 py-3 flex gap-4">
                    {[150, 120, 100, 80, 100, 80].map((w, i) => (
                        <Skeleton key={i} className="h-4" style={{ width: w }} />
                    ))}
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-4">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <div className="ml-auto flex gap-2">
                            <Skeleton className="h-6 w-6 rounded" />
                            <Skeleton className="h-6 w-6 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Full-page skeleton for LeadDetail */
export function LeadDetailSkeleton() {
    return (
        <div className="flex h-full">
            {/* Left main */}
            <div className="flex-1 p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="ml-auto flex gap-2">
                        {[80, 80, 80, 80].map((w, i) => <Skeleton key={i} className="h-9" style={{ width: w }} />)}
                    </div>
                </div>
                {/* AI bar */}
                <Skeleton className="h-20 w-full rounded-xl" />
                {/* Tab bar */}
                <div className="flex gap-3 border-b border-gray-200 pb-3">
                    {[60, 60, 60, 60].map((w, i) => <Skeleton key={i} className="h-8 rounded-md" style={{ width: w }} />)}
                </div>
                {/* Timeline items */}
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-1" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-16 w-full rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
            {/* Right sidebar */}
            <div className="w-80 border-l border-gray-200 p-5 space-y-5">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
            </div>
        </div>
    );
}

/** Full-page skeleton for Dashboard */
export function DashboardSkeleton() {
    return (
        <div className="p-6 space-y-6">
            {/* Greeting */}
            <Skeleton className="h-6 w-64" />
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>
            {/* Two-col content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                    <Skeleton className="h-4 w-32 mb-4" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 py-2">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-3.5 w-36" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-5 w-14 rounded-full" />
                        </div>
                    ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                    <Skeleton className="h-4 w-32 mb-4" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 py-2.5">
                            <Skeleton className="h-4 w-4 rounded" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-3.5 w-40" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
