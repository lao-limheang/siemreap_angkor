import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';

export default function CustomerDocsTab({
  guests,
  cardCls,
  inputCls
}) {
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filtered = useMemo(() => {
    return (guests || []).filter(g => {
      const q = search.toLowerCase();
      return (
        (g.name || '').toLowerCase().includes(q) ||
        (g.phone || '').toLowerCase().includes(q) ||
        (g.passportOrId || '').toLowerCase().includes(q)
      );
    });
  }, [guests, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <h3 className="font-display font-bold text-lg text-stone-900 flex items-center gap-2">
            <i className="fa-solid fa-id-card text-brand-500"></i>
            ឯកសារអតិថិជន (Customer Identity & Passport Documents)
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Archived identification documents, national IDs, and passports for security and deposit verification.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
          <input
            type="text"
            placeholder="Search name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${inputCls} pl-9 py-2 text-xs`}
          />
        </div>
      </div>

      {/* Document Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {paginated.map(g => (
          <div
            key={g.id}
            className={`${cardCls} p-4 hover:shadow-md transition border border-stone-200 flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 uppercase tracking-wider">
                  {g.docType || 'ID / Passport'}
                </span>
                <span className="font-mono text-[11px] text-stone-400">#{g.id}</span>
              </div>

              <div className="w-full h-32 bg-stone-100 rounded-xl overflow-hidden mb-3 border border-stone-100 flex items-center justify-center">
                {g.documentUrl || g.docUrl ? (
                  <img
                    src={g.documentUrl || g.docUrl}
                    alt={g.name}
                    className="w-full h-full object-cover hover:scale-105 transition"
                  />
                ) : (
                  <div className="text-center text-stone-400">
                    <i className="fa-solid fa-file-image text-3xl mb-1 opacity-40"></i>
                    <p className="text-[10px]">No document scan</p>
                  </div>
                )}
              </div>

              <h4 className="font-bold text-stone-900 text-sm leading-snug">{g.name}</h4>
              <p className="text-xs font-mono text-stone-600 mt-0.5">
                {g.passportOrId ? `ID: ${g.passportOrId}` : 'No ID Number'}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                Phone: {g.phone || '—'}
              </p>
            </div>

            <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
              <span>{g.nationality || 'International'}</span>
              {(g.documentUrl || g.docUrl) && (
                <button
                  onClick={() => setSelectedDoc(g)}
                  className="text-brand-600 font-bold hover:underline"
                >
                  Inspect &rarr;
                </button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-stone-400">
            <i className="fa-solid fa-file-invoice text-4xl mb-2 opacity-30 block"></i>
            No customer documents registered yet.
          </div>
        )}
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <PaginationControls
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalItems={filtered.length}
          pageSizeOptions={[12, 24, 48]}
        />
      </div>

      {/* Full Document View Modal */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h4 className="font-bold text-stone-900">{selectedDoc.name} — Document</h4>
                <p className="text-xs text-stone-500">ID/Passport: {selectedDoc.passportOrId} | {selectedDoc.phone}</p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-stone-50 rounded-2xl p-2">
              <img
                src={selectedDoc.documentUrl}
                alt={selectedDoc.name}
                className="max-h-[65vh] object-contain rounded-xl shadow-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-5 py-2 bg-stone-900 text-white text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
