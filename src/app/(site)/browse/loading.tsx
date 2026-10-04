export default function Loading() {
  return (
    <div className="container-x pt-36 pb-24" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-12 w-2/3 max-w-lg rounded-xl" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-900/5">
            <div className="skeleton aspect-[4/3]" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-5 w-2/3 rounded" />
              <div className="skeleton h-4 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
