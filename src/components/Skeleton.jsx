export function Skeleton({
  className = '',
  variant = 'rectangular', // 'text' | 'circular' | 'rectangular' | 'rounded'
  width,
  height,
  dark = false,
  style = {}
}) {
  const baseClasses = dark ? 'skeleton-dark-shimmer' : 'skeleton-bone';

  let variantClass = 'rounded-md';
  if (variant === 'circular') variantClass = 'rounded-full';
  else if (variant === 'text') variantClass = 'rounded h-3.5 my-1';
  else if (variant === 'rounded') variantClass = 'rounded-xl';
  else if (variant === 'rectangular') variantClass = 'rounded-none';

  return (
    <div
      className={`${baseClasses} ${variantClass} ${className}`}
      style={{
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        ...style
      }}
    />
  );
}

// ─── Bike Card Skeleton ───────────────────────────────────────────────────────
export function BikeCardSkeleton({ delayClass = '' }) {
  return (
    <div className={`card listing-card overflow-hidden bg-white border border-stone-200/80 rounded-2xl shadow-sm ${delayClass}`}>
      {/* Image placeholder */}
      <div className="relative h-48 skeleton-shimmer flex items-center justify-center overflow-hidden">
        <div className="w-12 h-12 rounded-full bg-stone-200/60 flex items-center justify-center text-stone-300">
          <i className="fa-solid fa-motorcycle text-xl"></i>
        </div>
        {/* Floating badge placeholders */}
        <div className="absolute top-3 right-3 w-12 h-5 skeleton-bone rounded-full"></div>
      </div>

      <div className="p-5">
        {/* Title */}
        <div className="h-5 w-3/4 skeleton-bone rounded-md mb-2.5"></div>
        
        {/* Description lines */}
        <div className="space-y-1.5 mb-5">
          <div className="h-3 w-full skeleton-bone rounded"></div>
          <div className="h-3 w-4/5 skeleton-bone rounded"></div>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-5">
          <div className="h-7 w-20 skeleton-bone rounded-lg"></div>
          <div className="h-3 w-10 skeleton-bone rounded"></div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="h-9 skeleton-bone rounded-lg"></div>
          <div className="h-9 skeleton-bone rounded-lg"></div>
        </div>
      </div>
    </div>
  );
}

// ─── Room Card Skeleton ───────────────────────────────────────────────────────
export function RoomCardSkeleton({ delayClass = '' }) {
  return (
    <div className={`card listing-card overflow-hidden bg-white border border-stone-200/80 rounded-2xl shadow-sm ${delayClass}`}>
      {/* Image placeholder */}
      <div className="relative h-56 skeleton-shimmer flex items-center justify-center overflow-hidden">
        <div className="w-14 h-14 rounded-full bg-stone-200/60 flex items-center justify-center text-stone-300">
          <i className="fa-solid fa-bed text-2xl"></i>
        </div>
        {/* Floating price badge placeholder */}
        <div className="absolute top-3 right-3 w-24 h-6 skeleton-bone rounded-full"></div>
      </div>

      <div className="p-5">
        {/* Title */}
        <div className="h-5 w-3/5 skeleton-bone rounded-md mb-2"></div>
        
        {/* Description */}
        <div className="space-y-1.5 mb-4">
          <div className="h-3 w-full skeleton-bone rounded"></div>
          <div className="h-3 w-4/5 skeleton-bone rounded"></div>
        </div>

        {/* Bed selector skeleton */}
        <div className="mb-4">
          <div className="h-3 w-20 skeleton-bone rounded mb-2"></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-8 skeleton-bone rounded-lg"></div>
            <div className="h-8 skeleton-bone rounded-lg"></div>
            <div className="h-8 skeleton-bone rounded-lg"></div>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-4">
          <div className="h-8 w-24 skeleton-bone rounded-lg"></div>
          <div className="h-3 w-12 skeleton-bone rounded"></div>
        </div>

        {/* Amenities grid */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full skeleton-bone shrink-0"></div>
              <div className="h-3 w-20 skeleton-bone rounded"></div>
            </div>
          ))}
        </div>

        {/* Book button */}
        <div className="h-10 w-full skeleton-bone rounded-lg"></div>
      </div>
    </div>
  );
}

// ─── Testimonials Skeleton ────────────────────────────────────────────────────
export function TestimonialsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {[1, 2, 3].map(i => (
        <div key={i} className={`bg-white rounded-2xl p-8 border border-stone-200/80 shadow-card flex flex-col skeleton-delay-${i}`}>
          {/* Star rating placeholder */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className="w-4 h-4 rounded-sm skeleton-bone"></div>
            ))}
          </div>

          {/* Quote text placeholder lines */}
          <div className="space-y-2.5 mb-8 flex-1">
            <div className="h-3.5 w-full skeleton-bone rounded"></div>
            <div className="h-3.5 w-11/12 skeleton-bone rounded"></div>
            <div className="h-3.5 w-4/5 skeleton-bone rounded"></div>
          </div>

          {/* User profile */}
          <div className="flex items-center gap-4 mt-auto">
            <div className="w-12 h-12 rounded-full skeleton-bone shrink-0"></div>
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-28 skeleton-bone rounded"></div>
              <div className="h-3 w-20 skeleton-bone rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── About Us Skeleton ────────────────────────────────────────────────────────
export function AboutUsSkeleton() {
  return (
    <div className="space-y-20">
      {/* 1. Services Bar Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-11 h-11 rounded-xl skeleton-bone shrink-0"></div>
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-24 skeleton-bone rounded"></div>
              <div className="h-2.5 w-16 skeleton-bone rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Story Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: Text Skeleton */}
        <div className="space-y-6">
          <div className="h-3.5 w-28 skeleton-bone rounded-md"></div>
          <div className="space-y-2">
            <div className="h-9 w-4/5 skeleton-bone rounded-xl"></div>
            <div className="h-9 w-3/5 skeleton-bone rounded-xl"></div>
          </div>
          <div className="space-y-2.5 pt-2">
            <div className="h-3.5 w-full skeleton-bone rounded"></div>
            <div className="h-3.5 w-11/12 skeleton-bone rounded"></div>
            <div className="h-3.5 w-4/5 skeleton-bone rounded"></div>
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="h-3.5 w-full skeleton-bone rounded"></div>
            <div className="h-3.5 w-5/6 skeleton-bone rounded"></div>
          </div>

          {/* Action button & badge */}
          <div className="flex items-center gap-4 pt-4">
            <div className="h-11 w-40 skeleton-bone rounded-full"></div>
            <div className="h-11 w-36 skeleton-bone rounded-full"></div>
          </div>
        </div>

        {/* Right: Images Skeleton */}
        <div className="relative">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 sm:h-80 md:h-96 rounded-3xl skeleton-shimmer border-4 border-white shadow-lg"></div>
            <div className="h-64 sm:h-80 md:h-96 rounded-3xl skeleton-shimmer border-4 border-white shadow-lg mt-8"></div>
          </div>
          {/* Floating badge */}
          <div className="absolute -bottom-4 -left-4 sm:bottom-4 sm:left-4 h-16 w-60 rounded-2xl skeleton-bone shadow-xl"></div>
        </div>
      </div>

      {/* 3. Why Us Stats & Features Skeleton */}
      <div className="pt-8 border-t border-stone-200">
        <div className="text-center max-w-sm mx-auto mb-12 space-y-2">
          <div className="h-3.5 w-24 skeleton-bone rounded mx-auto"></div>
          <div className="h-8 w-64 skeleton-bone rounded-lg mx-auto"></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-12">
          {[1, 2, 3].map(i => (
            <div key={i} className="text-center p-5 bg-white border border-stone-200 rounded-2xl shadow-sm space-y-2">
              <div className="h-7 w-16 skeleton-bone rounded mx-auto"></div>
              <div className="h-3 w-20 skeleton-bone rounded mx-auto"></div>
            </div>
          ))}
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl skeleton-bone"></div>
              <div className="h-4 w-32 skeleton-bone rounded"></div>
              <div className="space-y-1.5">
                <div className="h-3 w-full skeleton-bone rounded"></div>
                <div className="h-3 w-4/5 skeleton-bone rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Featured Services Skeleton ───────────────────────────────────────────────
export function FeaturedServicesSkeleton() {
  return (
    <div className="space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="h-3.5 w-32 skeleton-bone rounded-md mx-auto"></div>
        <div className="h-8 w-3/4 skeleton-bone rounded-xl mx-auto"></div>
        <div className="h-4 w-1/2 skeleton-bone rounded mx-auto"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-3xl p-8 border border-stone-200 shadow-card flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl skeleton-bone"></div>
                <div className="w-28 h-6 rounded-full skeleton-bone"></div>
              </div>
              <div className="h-7 w-3/5 skeleton-bone rounded-lg mb-3"></div>
              <div className="space-y-2 mb-6">
                <div className="h-3.5 w-full skeleton-bone rounded"></div>
                <div className="h-3.5 w-4/5 skeleton-bone rounded"></div>
              </div>

              <div className="space-y-3 mb-8">
                {[1, 2, 3, 4].map(b => (
                  <div key={b} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full skeleton-bone shrink-0"></div>
                    <div className="h-3.5 w-5/6 skeleton-bone rounded"></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex gap-3">
              <div className="h-11 w-44 rounded-xl skeleton-bone"></div>
              <div className="h-11 w-32 rounded-xl skeleton-bone"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Callout Banner */}
      <div className="rounded-3xl p-8 bg-stone-900 border border-stone-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 w-full md:w-2/3">
          <div className="h-5 w-28 rounded-full skeleton-dark-shimmer"></div>
          <div className="h-7 w-4/5 rounded-lg skeleton-dark-shimmer"></div>
          <div className="h-3.5 w-3/5 rounded skeleton-dark-shimmer"></div>
        </div>
        <div className="h-12 w-48 rounded-xl skeleton-dark-shimmer"></div>
      </div>
    </div>
  );
}

// ─── Page Header Skeleton ─────────────────────────────────────────────────────
export function PageHeaderSkeleton() {
  return (
    <div className="mb-10 space-y-4">
      <div className="h-4 w-28 skeleton-bone rounded"></div>
      <div className="space-y-3">
        <div className="h-3.5 w-32 skeleton-bone rounded"></div>
        <div className="h-10 w-72 sm:w-96 skeleton-bone rounded-xl"></div>
        <div className="h-4 w-full max-w-xl skeleton-bone rounded"></div>
        <div className="h-4 w-2/3 max-w-md skeleton-bone rounded"></div>
      </div>
    </div>
  );
}

// ─── Admin Metric / Stats Skeleton ────────────────────────────────────────────
export function AdminStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white border border-stone-200 rounded-2xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl skeleton-bone shrink-0"></div>
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 skeleton-bone rounded"></div>
            <div className="h-6 w-28 skeleton-bone rounded-lg"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Admin Table Skeleton ─────────────────────────────────────────────────────
export function AdminTableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <div className="h-5 w-40 skeleton-bone rounded-md"></div>
        <div className="flex gap-2">
          <div className="h-8 w-24 skeleton-bone rounded-lg"></div>
          <div className="h-8 w-28 skeleton-bone rounded-lg"></div>
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-stone-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-6 py-4 flex items-center justify-between gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className="h-4 skeleton-bone rounded"
                style={{
                  width: cIdx === 0 ? '160px' : cIdx === cols - 1 ? '80px' : '110px'
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Chart Skeleton ─────────────────────────────────────────────────────
export function AdminChartSkeleton() {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-center">
        <div className="h-5 w-48 skeleton-bone rounded-md"></div>
        <div className="h-8 w-32 skeleton-bone rounded-lg"></div>
      </div>
      
      {/* Bars simulation */}
      <div className="h-64 flex items-end justify-between gap-3 pt-6 px-2 border-b border-stone-100">
        {[40, 65, 30, 85, 55, 90, 70, 45, 80, 60, 95, 75].map((h, i) => (
          <div key={i} className="w-full flex flex-col items-center gap-2">
            <div
              className="w-full skeleton-bone rounded-t-md"
              style={{ height: `${h}%` }}
            />
            <div className="w-6 h-2.5 skeleton-bone rounded"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="h-16 skeleton-bone rounded-xl"></div>
        <div className="h-16 skeleton-bone rounded-xl"></div>
        <div className="h-16 skeleton-bone rounded-xl"></div>
      </div>
    </div>
  );
}

// ─── Contact Skeleton ─────────────────────────────────────────────────────────
export function ContactSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Skeleton */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="h-4 w-16 skeleton-bone rounded"></div>
            <div className="h-11 w-full skeleton-bone rounded-lg"></div>
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-16 skeleton-bone rounded"></div>
            <div className="h-11 w-full skeleton-bone rounded-lg"></div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-20 skeleton-bone rounded"></div>
          <div className="h-28 w-full skeleton-bone rounded-lg"></div>
        </div>
        <div className="h-12 w-full skeleton-bone rounded-lg mt-4"></div>
      </div>

      {/* Info Card Skeleton */}
      <div className="bg-stone-900 rounded-2xl p-6 space-y-4">
        <div className="h-6 w-48 skeleton-dark-shimmer rounded-md mb-6"></div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-3 items-center">
            <div className="w-5 h-5 rounded skeleton-dark-shimmer shrink-0"></div>
            <div className="h-4 w-3/4 skeleton-dark-shimmer rounded"></div>
          </div>
        ))}
        <div className="flex gap-3 mt-6 pt-5 border-t border-stone-700">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-10 h-10 rounded-lg skeleton-dark-shimmer"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Footer Skeleton ──────────────────────────────────────────────────────────
export function FooterSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
      {[1, 2, 3, 4].map((col, idx) => (
        <div key={idx} className="space-y-4">
          <div className="h-6 w-32 skeleton-dark-shimmer rounded mb-4"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-3 skeleton-dark-shimmer rounded ${idx === 0 ? 'w-full' : 'w-24'}`}></div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Navbar Skeleton ──────────────────────────────────────────────────────────
export function NavbarSkeleton() {
  return (
    <div className="h-12 w-48 skeleton-bone rounded-lg flex items-center gap-3 opacity-50 bg-stone-100 p-2">
      <div className="w-8 h-8 rounded bg-stone-300"></div>
      <div className="w-24 h-4 rounded bg-stone-300"></div>
    </div>
  );
}

