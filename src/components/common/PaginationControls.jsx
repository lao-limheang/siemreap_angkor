export default function PaginationControls({
  page = 1,
  setPage,
  pageSize = 10,
  setPageSize,
  totalItems = 0,
  pageSizeOptions = [10, 25, 50, 100]
}) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-stone-50/80 border-t border-stone-200 text-xs text-stone-600">
      <div className="flex items-center gap-3">
        <span className="font-medium">
          បង្ហាញ <span className="font-bold text-stone-800">{startItem} - {endItem}</span> នៃ <span className="font-bold text-stone-900">{totalItems}</span>
        </span>

        {setPageSize && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-stone-300">
            <span className="text-stone-500">ក្នុងមួយទំព័រ:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-stone-200 rounded-lg px-2 py-1 font-semibold text-stone-700 outline-none focus:border-brand-500"
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(1)}
          disabled={page <= 1}
          className="px-2 py-1 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white font-bold transition shadow-xs"
          title="First Page"
        >
          <i className="fa-solid fa-angles-left text-[10px]"></i>
        </button>

        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white font-bold transition shadow-xs flex items-center gap-1"
        >
          <i className="fa-solid fa-chevron-left text-[10px]"></i>
          <span>មុន</span>
        </button>

        <span className="px-3 py-1 bg-brand-50 text-brand-700 font-bold rounded-lg border border-brand-200">
          ទំព័រ {page} / {totalPages}
        </span>

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white font-bold transition shadow-xs flex items-center gap-1"
        >
          <span>បន្ទាប់</span>
          <i className="fa-solid fa-chevron-right text-[10px]"></i>
        </button>

        <button
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
          className="px-2 py-1 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white font-bold transition shadow-xs"
          title="Last Page"
        >
          <i className="fa-solid fa-angles-right text-[10px]"></i>
        </button>
      </div>
    </div>
  );
}
