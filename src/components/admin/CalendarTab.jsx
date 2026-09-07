import { useState, useMemo, useRef, useEffect } from 'react';
import { toDateStr } from '../../utils/dataNormalizer';

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const KH_DAYS = ['អា','ច','អ','ព','ព្រ','សុ','ស'];

const STATUS_MAP = {
  active:     { label: 'កំពុងជួល',  dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700' },
  returned:   { label: 'ត្រឡប់',    dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  overdue:    { label: 'ហួសកំណត់', dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700' },
  confirmed:  { label: 'បញ្ជាក់',  dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  pending:    { label: 'រង់ចាំ',   dot: 'bg-stone-400',   badge: 'bg-stone-100 text-stone-600' },
  cancelled:  { label: 'បោះបង់',   dot: 'bg-red-500',     badge: 'bg-red-100 text-red-600' },
  checked_in: { label: 'ចូលស្នាក់', dot: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700' },
  checked_out:{ label: 'ចាកចេញ',   dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700' },
  inactive:   { label: 'ផ្អាក',    dot: 'bg-stone-400',   badge: 'bg-stone-100 text-stone-500' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2,'0'); }

function dateRange(s, e) {
  const dates = [];
  if (!s) return dates;
  const start = new Date(s);
  const end   = e ? new Date(e) : new Date(s);
  if (isNaN(start.getTime())) return dates;
  const cap = isNaN(end.getTime()) ? start : end;
  // Cap range to 60 days max to avoid performance issues
  let count = 0;
  for (let d = new Date(start); d <= cap && count < 60; d.setDate(d.getDate() + 1), count++) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function fmt$(v) { return `$${Number(v || 0).toFixed(2)}`; }

function StatusBadge({ status, small }) {
  const info = STATUS_MAP[status] || { badge: 'bg-stone-100 text-stone-600', label: status || '—' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${small ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-[10px]'} ${info.badge}`}>
      {info.label}
    </span>
  );
}

// ─── Compact Row Cards ─────────────────────────────────────────────────────────
function RentalRow({ r, bikes, models, expanded, onToggle }) {
  const bike  = bikes?.find(b => String(b.id) === String(r.bikeId || r.motoId));
  const model = models?.find(m => String(m.id) === String(bike?.modelId || r.modelId));
  const modelName = model ? (model.fullName || `${model.brand || ''} ${model.name || ''}`.trim()) : '';
  const bikeName  = r.bikeName || r.motoName || modelName || bike?.name || '—';
  const plate     = bike?.plateNumber || r.plateNumber || '';
  const photo     = bike?.photoUrl || bike?.imageUrl || '';
  const start     = toDateStr(r.startDate || r.checkoutDate);
  const end       = toDateStr(r.endDate   || r.returnDueDate);
  const total     = Number(r.totalPrice || r.totalFee || 0);
  const deposit   = Number(r.deposit || 0);
  const balance   = total - deposit;
  const days      = Number(r.totalDays || 1);
  let statusKey   = r.status || 'active';
  if (statusKey === 'active' && end && new Date(end) < new Date(new Date().toDateString())) statusKey = 'overdue';

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${statusKey === 'overdue' ? 'border-rose-200 bg-rose-50/40' : statusKey === 'returned' ? 'border-emerald-200 bg-emerald-50/30' : 'border-blue-100 bg-blue-50/30'}`}>
      {/* Collapsed Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 p-3 text-left hover:bg-white/60 transition-colors"
      >
        {/* Avatar */}
        {photo ? (
          <img src={photo} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white shadow-sm" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0 shadow-sm">
            <i className="fa-solid fa-motorcycle text-white text-xs"></i>
          </div>
        )}

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-xs text-stone-900 truncate max-w-[120px]">
              {r.guestName || r.customerName || '—'}
            </span>
            <StatusBadge status={statusKey} small />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-stone-500 mt-0.5 flex-wrap">
            <span className="font-mono bg-stone-100 px-1 rounded">{plate || bikeName}</span>
            <span>•</span>
            <span>{start} → {end}</span>
            {days > 1 && <span className="text-stone-400">({days}d)</span>}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className="font-bold text-xs text-stone-900">{fmt$(total)}</p>
          {balance > 0 && <p className="text-[9px] text-rose-600 font-bold">-{fmt$(balance)}</p>}
        </div>

        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-stone-400 text-[10px] shrink-0`}></i>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-white/60 px-3 pb-3 pt-2 space-y-2 bg-white/40">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: 'ម៉ូតូ / Model', value: modelName || bikeName },
              { label: 'ស្លាកលេខ', value: plate || '—' },
              { label: 'ចំនួនថ្ងៃ', value: `${days} ថ្ងៃ` },
              { label: 'ថ្លៃ/ថ្ងៃ', value: fmt$(r.dailyRate || r.pricePerDay || (days ? total / days : 0)) },
              { label: 'ប្រាក់បញ្ញើ', value: fmt$(deposit) },
              { label: 'នៅជំពាក់', value: fmt$(Math.max(0, balance)), bold: balance > 0, danger: balance > 0 },
            ].map((f, i) => (
              <div key={i} className="bg-white/60 rounded-lg p-1.5">
                <p className="text-[9px] text-stone-400 font-bold uppercase">{f.label}</p>
                <p className={`font-bold text-stone-800 text-xs mt-0.5 ${f.danger ? 'text-rose-600' : ''}`}>{f.value}</p>
              </div>
            ))}
          </div>
          {r.guestPhone && (
            <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
              <i className="fa-solid fa-phone text-[8px]"></i> {r.guestPhone}
            </div>
          )}
          {r.staffName && (
            <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
              <i className="fa-solid fa-user text-[8px]"></i> Staff: {r.staffName}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BookingRow({ b, bikes, models, rooms, expanded, onToggle }) {
  const isRoom = b.type === 'room' || !!b.roomId || !!b.roomName;
  const room   = rooms?.find(r => String(r.id) === String(b.roomId));
  const bike   = bikes?.find(bk => String(bk.id) === String(b.motoId || b.bikeId));
  const model  = models?.find(m => String(m.id) === String(bike?.modelId));

  const itemName  = b.itemName || (isRoom ? (b.roomName || room?.name || 'Room') : (b.motoName || b.bikeName || bike?.name || 'Motorbike'));
  const modelName = isRoom
    ? (b.categoryName || room?.categoryName || '')
    : (model ? (model.fullName || `${model.brand || ''} ${model.name || ''}`.trim()) : '');
  const photo   = isRoom ? (room?.images?.[0] || '') : (bike?.photoUrl || bike?.imageUrl || '');
  const start   = toDateStr(b.startDate || b.checkoutDate);
  const end     = toDateStr(b.endDate   || b.returnDueDate);
  const total   = Number(b.totalFee || b.totalAmount || 0);
  const deposit = Number(b.deposit || 0);
  const balance = total - deposit;
  const days    = Number(b.totalDays || 1);
  const status  = b.status || 'confirmed';

  const accentCls = isRoom
    ? 'border-amber-100 bg-amber-50/30'
    : 'border-purple-100 bg-purple-50/30';
  const iconCls = isRoom ? 'bg-amber-500' : 'bg-purple-500';

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${accentCls}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 p-3 text-left hover:bg-white/60 transition-colors"
      >
        {photo ? (
          <img src={photo} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white shadow-sm" />
        ) : (
          <div className={`w-8 h-8 rounded-lg ${iconCls} flex items-center justify-center shrink-0 shadow-sm`}>
            <i className={`fa-solid ${isRoom ? 'fa-bed' : 'fa-motorcycle'} text-white text-xs`}></i>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-xs text-stone-900 truncate max-w-[110px]">
              {b.customerName || b.name || '—'}
            </span>
            <StatusBadge status={status} small />
            <span className={`text-[9px] font-bold px-1 py-px rounded ${isRoom ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'}`}>
              {isRoom ? 'Room' : 'Motor'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-stone-500 mt-0.5 flex-wrap">
            <span className="font-semibold">{itemName}</span>
            {modelName && <><span>•</span><span className="text-stone-400">{modelName}</span></>}
            <span>•</span>
            <span>{start} → {end}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="font-bold text-xs text-stone-900">{fmt$(total)}</p>
          {balance > 0 && <p className="text-[9px] text-rose-600 font-bold">-{fmt$(balance)}</p>}
        </div>
        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-stone-400 text-[10px] shrink-0`}></i>
      </button>

      {expanded && (
        <div className="border-t border-white/60 px-3 pb-3 pt-2 space-y-2 bg-white/40">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: 'ទូរស័ព្ទ', value: b.customerPhone || b.phone || '—' },
              { label: 'ភ្ញៀវ', value: `${b.guests || 1} នាក់` },
              { label: 'ចំនួនថ្ងៃ', value: `${days} ថ្ងៃ` },
              { label: 'ប្រាក់/ថ្ងៃ', value: fmt$(b.pricePerDay || b.price || (days ? total / days : 0)) },
              { label: 'ប្រាក់បញ្ញើ', value: fmt$(deposit) },
              { label: 'នៅជំពាក់', value: fmt$(Math.max(0, balance)), danger: balance > 0 },
            ].map((f, i) => (
              <div key={i} className="bg-white/60 rounded-lg p-1.5">
                <p className="text-[9px] text-stone-400 font-bold uppercase">{f.label}</p>
                <p className={`font-bold text-xs mt-0.5 ${f.danger ? 'text-rose-600' : 'text-stone-800'}`}>{f.value}</p>
              </div>
            ))}
          </div>
          {b.bookingRef && (
            <p className="text-[10px] font-mono bg-stone-100 inline-block px-2 py-0.5 rounded text-stone-500">
              Ref: {b.bookingRef}
            </p>
          )}
          {b.nationality && (
            <p className="text-[10px] text-stone-500 flex items-center gap-1.5">
              <i className="fa-solid fa-earth-americas text-stone-400 text-[10px]"></i>
              <span>{b.nationality}</span>
            </p>
          )}
          {b.specialRequests && (
            <p className="text-[10px] text-stone-600 bg-white/70 rounded p-1.5 border border-stone-200 italic line-clamp-2 flex items-start gap-1.5">
              <i className="fa-solid fa-comment-dots text-stone-400 text-[10px] mt-0.5 shrink-0"></i>
              <span>{b.specialRequests}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function CalendarTab({ rentals, bookings, bikes, models, rooms, cardCls, btnSecondary, currency }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay]   = useState(null);
  const [filter, setFilter]             = useState('all'); // 'all'|'motor'|'room'|'returned'
  const [search, setSearch]             = useState('');
  const [expandedId, setExpandedId]     = useState(null);
  const detailRef = useRef(null);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };
  const goToday   = () => { setCurrentDate(new Date()); setSelectedDay(new Date().toISOString().split('T')[0]); };

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays     = new Date(year, month + 1, 0).getDate();

  // Build event map spanning full date range
  const eventsByDate = useMemo(() => {
    const map = {};
    const add = (dateStr, cat, item) => {
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = { active: [], overdue: [], returned: [], room: [], motorBook: [] };
      map[dateStr][cat].push(item);
    };

    (rentals || []).forEach(r => {
      const s = toDateStr(r.startDate || r.checkoutDate);
      const e = toDateStr(r.endDate   || r.returnDueDate);
      const ranges = dateRange(s, e);
      let cat = r.status === 'returned' ? 'returned' : (e && new Date(e) < new Date(new Date().toDateString()) ? 'overdue' : 'active');
      ranges.forEach(d => add(d, cat, r));
    });

    (bookings || []).forEach(b => {
      const s = toDateStr(b.startDate || b.checkoutDate);
      const e = toDateStr(b.endDate   || b.returnDueDate);
      const ranges = dateRange(s, e);
      const isRoom = b.type === 'room' || !!b.roomId || !!b.roomName;
      ranges.forEach(d => add(d, isRoom ? 'room' : 'motorBook', b));
    });

    return map;
  }, [rentals, bookings]);

  // De-duplicate by id
  const dedup = arr => { const s = new Set(); return arr.filter(x => { if (s.has(x.id)) return false; s.add(x.id); return true; }); };

  // Selected day events, deduplicated
  const dayEvents = useMemo(() => {
    if (!selectedDay) return null;
    const ev = eventsByDate[selectedDay] || {};
    return {
      active:    dedup(ev.active    || []),
      overdue:   dedup(ev.overdue   || []),
      returned:  dedup(ev.returned  || []),
      room:      dedup(ev.room      || []),
      motorBook: dedup(ev.motorBook || []),
    };
  }, [selectedDay, eventsByDate]);

  // Filter + search
  const filteredEvents = useMemo(() => {
    if (!dayEvents) return null;
    const q = search.toLowerCase().trim();

    const matchRental = r => {
      if (!q) return true;
      return [r.guestName, r.customerName, r.bikeName, r.motoName, r.plateNumber, r.guestPhone].some(
        v => String(v || '').toLowerCase().includes(q)
      );
    };
    const matchBooking = b => {
      if (!q) return true;
      return [b.customerName, b.name, b.itemName, b.roomName, b.motoName, b.bikeName, b.phone, b.customerPhone, b.bookingRef].some(
        v => String(v || '').toLowerCase().includes(q)
      );
    };

    const showMotor   = filter === 'all' || filter === 'motor';
    const showRoom    = filter === 'all' || filter === 'room';
    const showReturn  = filter === 'all' || filter === 'returned';

    return {
      active:    showMotor  ? dayEvents.active.filter(matchRental)   : [],
      overdue:   showMotor  ? dayEvents.overdue.filter(matchRental)  : [],
      returned:  showReturn ? dayEvents.returned.filter(matchRental) : [],
      room:      showRoom   ? dayEvents.room.filter(matchBooking)    : [],
      motorBook: showMotor  ? dayEvents.motorBook.filter(matchBooking): [],
    };
  }, [dayEvents, filter, search]);

  const totalCount = filteredEvents
    ? filteredEvents.active.length + filteredEvents.overdue.length + filteredEvents.returned.length
      + filteredEvents.room.length + filteredEvents.motorBook.length
    : 0;
  const rawTotal = dayEvents
    ? dayEvents.active.length + dayEvents.overdue.length + dayEvents.returned.length
      + dayEvents.room.length + dayEvents.motorBook.length
    : 0;

  // Monthly stats
  const monthStats = useMemo(() => {
    const pfx = `${year}-${pad(month + 1)}`;
    let motorIds = new Set(), roomIds = new Set(), motorRev = 0, roomRev = 0;
    (rentals || []).forEach(r => {
      const d = toDateStr(r.startDate || r.checkoutDate);
      if (d?.startsWith(pfx)) { motorIds.add(r.id); motorRev += Number(r.totalPrice || r.totalFee || 0); }
    });
    (bookings || []).forEach(b => {
      const d = toDateStr(b.startDate || b.checkoutDate);
      if (!d?.startsWith(pfx)) return;
      const isRoom = b.type === 'room' || !!b.roomId || !!b.roomName;
      if (isRoom) { roomIds.add(b.id); roomRev += Number(b.totalFee || 0); }
      else { motorIds.add(b.id); motorRev += Number(b.totalFee || 0); }
    });
    return { motor: motorIds.size, room: roomIds.size, motorRev, roomRev };
  }, [year, month, rentals, bookings]);

  // Auto-scroll detail into view on mobile
  useEffect(() => {
    if (selectedDay && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  }, [selectedDay]);

  // Toggle expand
  const toggleExpand = id => setExpandedId(prev => prev === id ? null : id);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
            <i className="fa-solid fa-calendar-days text-sm"></i>
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-stone-900">
              {MONTH_NAMES[month]} {year}
            </h3>
            <p className="text-[11px] text-stone-400">ចុចលើថ្ងៃណាមួយដើម្បីមើលព័ត៌មានលម្អិត</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth} className={`${btnSecondary} w-8 h-8 flex items-center justify-center !p-0 text-xs`}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button onClick={goToday} className={`${btnSecondary} px-3 py-1.5 text-xs font-bold`}>ថ្ងៃនេះ</button>
          <button onClick={nextMonth} className={`${btnSecondary} w-8 h-8 flex items-center justify-center !p-0 text-xs`}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* ── Monthly stat pills ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { icon: 'fa-motorcycle', color: 'blue',    label: 'ម៉ូតូ (ជួល+កក់)', value: monthStats.motor,   sub: `$${monthStats.motorRev.toFixed(0)}` },
          { icon: 'fa-bed',        color: 'amber',   label: 'កក់បន្ទប់',       value: monthStats.room,    sub: `$${monthStats.roomRev.toFixed(0)}`  },
          { icon: 'fa-dollar-sign',color: 'emerald', label: 'ចំណូលម៉ូតូ',     value: `$${monthStats.motorRev.toFixed(0)}`, sub: '' },
          { icon: 'fa-hotel',      color: 'purple',  label: 'ចំណូលបន្ទប់',    value: `$${monthStats.roomRev.toFixed(0)}`,  sub: '' },
        ].map((s, i) => (
          <div key={i} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-2xl p-3 flex items-center gap-2.5`}>
            <div className={`w-8 h-8 rounded-xl bg-${s.color}-500 flex items-center justify-center shrink-0`}>
              <i className={`fa-solid ${s.icon} text-white text-xs`}></i>
            </div>
            <div>
              <p className={`font-display font-bold text-base leading-tight text-${s.color}-900`}>{s.value}</p>
              <p className={`text-[10px] font-semibold text-${s.color}-600`}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Layout: Calendar LEFT + Detail RIGHT ── */}
      <div className="flex flex-col xl:flex-row gap-4">

        {/* ── Calendar Grid ── */}
        <div className={`${cardCls} overflow-hidden xl:w-[55%] shrink-0`}>
          {/* Day-of-week Header */}
          <div className="grid grid-cols-7 bg-stone-50 border-b border-stone-100">
            {KH_DAYS.map((d, i) => (
              <div key={i} className={`py-2.5 text-center text-[11px] font-bold ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-stone-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-stone-100">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`e${i}`} className="min-h-[70px] sm:min-h-[80px] bg-stone-50/40" />
            ))}

            {Array.from({ length: totalDays }).map((_, i) => {
              const dayNum  = i + 1;
              const dateStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
              const isToday = todayStr === dateStr;
              const isSel   = selectedDay === dateStr;
              const ev      = eventsByDate[dateStr];

              // Unique counts per day
              const cntActive   = ev ? new Set(ev.active.map(x=>x.id)).size    : 0;
              const cntOverdue  = ev ? new Set(ev.overdue.map(x=>x.id)).size   : 0;
              const cntReturn   = ev ? new Set(ev.returned.map(x=>x.id)).size  : 0;
              const cntRoom     = ev ? new Set(ev.room.map(x=>x.id)).size      : 0;
              const cntMotorBk  = ev ? new Set(ev.motorBook.map(x=>x.id)).size : 0;
              const total       = cntActive + cntOverdue + cntRoom + cntMotorBk;

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDay(isSel ? null : dateStr)}
                  className={`min-h-[70px] sm:min-h-[80px] p-1.5 flex flex-col cursor-pointer transition-all select-none ${
                    isSel
                      ? 'bg-brand-500 text-white'
                      : isToday
                      ? 'bg-amber-50 hover:bg-amber-100/70'
                      : ev
                      ? 'bg-white hover:bg-stone-50'
                      : 'bg-white hover:bg-stone-50/80'
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-start justify-between">
                    <span className={`text-[11px] font-bold leading-none w-5 h-5 flex items-center justify-center rounded-full ${
                      isSel ? 'bg-white/20 text-white' : isToday ? 'bg-brand-500 text-white' : 'text-stone-700'
                    }`}>
                      {dayNum}
                    </span>
                    {total > 0 && !isSel && (
                      <span className="text-[8px] font-bold text-stone-400 leading-none">{total}</span>
                    )}
                    {total > 0 && isSel && (
                      <span className="text-[8px] font-bold text-white/70 leading-none">{total}</span>
                    )}
                  </div>

                  {/* Dot + pill indicators */}
                  {ev && (
                    <div className="mt-1 flex flex-col gap-px">
                      {/* Dot row (compact) */}
                      <div className="flex gap-px flex-wrap">
                        {cntActive  > 0 && Array.from({ length: Math.min(cntActive, 3) }).map((_, ii) => (
                          <span key={`a${ii}`} className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/80' : 'bg-blue-500'}`} />
                        ))}
                        {cntActive > 3 && <span className={`text-[8px] font-bold ${isSel ? 'text-white/70' : 'text-blue-600'}`}>+{cntActive-3}</span>}
                        {cntOverdue > 0 && Array.from({ length: Math.min(cntOverdue, 2) }).map((_, ii) => (
                          <span key={`o${ii}`} className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/80' : 'bg-rose-500'}`} />
                        ))}
                        {cntRoom > 0 && Array.from({ length: Math.min(cntRoom, 2) }).map((_, ii) => (
                          <span key={`r${ii}`} className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/80' : 'bg-amber-500'}`} />
                        ))}
                        {cntMotorBk > 0 && Array.from({ length: Math.min(cntMotorBk, 2) }).map((_, ii) => (
                          <span key={`mb${ii}`} className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/80' : 'bg-purple-400'}`} />
                        ))}
                        {cntReturn > 0 && (
                          <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/60' : 'bg-emerald-500'}`} />
                        )}
                      </div>

                      {/* First label (only on desktop/medium cells) */}
                      {cntActive > 0 && (
                        <span className={`hidden sm:flex items-center gap-1 text-[9px] font-bold truncate leading-tight ${isSel ? 'text-white/90' : 'text-blue-600'}`}>
                          <i className="fa-solid fa-motorcycle text-[8px]"></i> {cntActive}
                        </span>
                      )}
                      {cntRoom > 0 && (
                        <span className={`hidden sm:flex items-center gap-1 text-[9px] font-bold truncate leading-tight ${isSel ? 'text-white/90' : 'text-amber-600'}`}>
                          <i className="fa-solid fa-bed text-[8px]"></i> {cntRoom}
                        </span>
                      )}
                      {cntOverdue > 0 && (
                        <span className={`hidden sm:flex items-center gap-1 text-[9px] font-bold truncate leading-tight ${isSel ? 'text-white/80' : 'text-rose-600'}`}>
                          <i className="fa-solid fa-triangle-exclamation text-[8px]"></i> {cntOverdue}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-stone-100 bg-stone-50/50">
            {[
              { dot: 'bg-blue-500',    label: 'ជួលម៉ូតូ' },
              { dot: 'bg-rose-500',    label: 'ហួសកំណត់' },
              { dot: 'bg-amber-500',   label: 'កក់បន្ទប់' },
              { dot: 'bg-purple-400',  label: 'កក់ម៉ូតូ' },
              { dot: 'bg-emerald-500', label: 'ត្រឡប់' },
            ].map((l, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] font-semibold text-stone-500">
                <span className={`w-2 h-2 rounded-full ${l.dot}`}></span>{l.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Detail Panel ── */}
        <div ref={detailRef} className="flex-1 min-w-0">
          {!selectedDay ? (
            <div className={`${cardCls} flex flex-col items-center justify-center py-20 text-center`}>
              <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                <i className="fa-regular fa-calendar-days text-stone-400 text-2xl"></i>
              </div>
              <p className="font-bold text-stone-600 text-sm">ចុចលើថ្ងៃ</p>
              <p className="text-stone-400 text-xs mt-1">ដើម្បីមើលព័ត៌មានការណ​ត់ ​​& ​ការជួល</p>
            </div>
          ) : (
            <div className={`${cardCls} overflow-hidden flex flex-col`} style={{ maxHeight: '80vh' }}>
              {/* Panel Header */}
              <div className="bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-3.5 flex items-center justify-between shrink-0">
                <div className="text-white">
                  <p className="font-bold text-sm">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('km-KH', {
                      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </p>
                  <p className="text-brand-200 text-[11px] mt-0.5">
                    {rawTotal} ការណ​ត់ / ការជួល
                    {totalCount !== rawTotal && ` · បង្ហាញ ${totalCount}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-times text-xs"></i>
                </button>
              </div>

              {/* Filter + Search Bar */}
              <div className="px-3 py-2.5 border-b border-stone-100 bg-stone-50/70 shrink-0 space-y-2">
                {/* Filter tabs */}
                <div className="flex gap-1 flex-wrap">
                  {[
                    { key: 'all',      icon: 'fa-layer-group', label: 'ទាំងអស់' },
                    { key: 'motor',    icon: 'fa-motorcycle',  label: 'ម៉ូតូ' },
                    { key: 'room',     icon: 'fa-bed',         label: 'បន្ទប់' },
                    { key: 'returned', icon: 'fa-circle-check',label: 'ត្រឡប់' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        filter === f.key
                          ? 'bg-brand-500 text-white shadow-sm'
                          : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <i className={`fa-solid ${f.icon} text-[9px]`}></i> {f.label}
                    </button>
                  ))}
                </div>
                {/* Search */}
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-[10px]"></i>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="ស្វែងរក (ឈ្មោះ, ស្លាកលេខ, ទូរស័ព្ទ...)"
                    className="w-full bg-white border border-stone-200 rounded-lg pl-7 pr-3 py-1.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:border-brand-400"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <i className="fa-solid fa-times text-[10px]"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable List */}
              <div className="overflow-y-auto flex-1 p-3 space-y-4">
                {totalCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-stone-400">
                    <i className="fa-regular fa-folder-open text-3xl mb-2 opacity-40"></i>
                    <p className="text-xs font-semibold">គ្មានទិន្នន័យ</p>
                    {search && <p className="text-[10px] mt-1">សាកល្បងលប់ Filter ឬ ពាក្យស្វែងរក</p>}
                  </div>
                ) : (
                  <>
                    {/* ─ Motor Rentals (Active) */}
                    {filteredEvents?.active.length > 0 && (
                      <Section
                        icon="fa-motorcycle" color="blue"
                        title="ការជួលម៉ូតូ" count={filteredEvents.active.length}
                      >
                        {filteredEvents.active.map(r => (
                          <RentalRow
                            key={r.id} r={r} bikes={bikes} models={models}
                            expanded={expandedId === `r-${r.id}`}
                            onToggle={() => toggleExpand(`r-${r.id}`)}
                          />
                        ))}
                      </Section>
                    )}

                    {/* ─ Overdue */}
                    {filteredEvents?.overdue.length > 0 && (
                      <Section
                        icon="fa-triangle-exclamation" color="rose"
                        title="ហួសកំណត់" count={filteredEvents.overdue.length}
                      >
                        {filteredEvents.overdue.map(r => (
                          <RentalRow
                            key={r.id} r={r} bikes={bikes} models={models}
                            expanded={expandedId === `o-${r.id}`}
                            onToggle={() => toggleExpand(`o-${r.id}`)}
                          />
                        ))}
                      </Section>
                    )}

                    {/* ─ Room Bookings */}
                    {filteredEvents?.room.length > 0 && (
                      <Section
                        icon="fa-bed" color="amber"
                        title="ការកក់បន្ទប់" count={filteredEvents.room.length}
                      >
                        {filteredEvents.room.map(b => (
                          <BookingRow
                            key={b.id} b={b} bikes={bikes} models={models} rooms={rooms}
                            expanded={expandedId === `rb-${b.id}`}
                            onToggle={() => toggleExpand(`rb-${b.id}`)}
                          />
                        ))}
                      </Section>
                    )}

                    {/* ─ Motor Bookings */}
                    {filteredEvents?.motorBook.length > 0 && (
                      <Section
                        icon="fa-motorcycle" color="purple"
                        title="ការកក់ម៉ូតូ" count={filteredEvents.motorBook.length}
                      >
                        {filteredEvents.motorBook.map(b => (
                          <BookingRow
                            key={b.id} b={b} bikes={bikes} models={models} rooms={rooms}
                            expanded={expandedId === `mb-${b.id}`}
                            onToggle={() => toggleExpand(`mb-${b.id}`)}
                          />
                        ))}
                      </Section>
                    )}

                    {/* ─ Returned */}
                    {filteredEvents?.returned.length > 0 && (
                      <Section
                        icon="fa-circle-check" color="emerald"
                        title="បានត្រឡប់" count={filteredEvents.returned.length}
                      >
                        {filteredEvents.returned.map(r => (
                          <RentalRow
                            key={r.id} r={r} bikes={bikes} models={models}
                            expanded={expandedId === `ret-${r.id}`}
                            onToggle={() => toggleExpand(`ret-${r.id}`)}
                          />
                        ))}
                      </Section>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────────
function Section({ icon, color, title, count, children }) {
  const [open, setOpen] = useState(true);
  const colorMap = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    icon: 'text-blue-500',    border: 'border-blue-100' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    icon: 'text-rose-500',    border: 'border-rose-100' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: 'text-amber-500',   border: 'border-amber-100' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  icon: 'text-purple-500',  border: 'border-purple-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500', border: 'border-emerald-100' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl ${c.bg} border ${c.border} mb-2 hover:brightness-95 transition-all`}
      >
        <div className={`flex items-center gap-2 text-xs font-bold ${c.text}`}>
          <i className={`fa-solid ${icon} ${c.icon} text-xs`}></i>
          {title}
          <span className={`px-1.5 py-px rounded-full text-[10px] font-bold ${c.bg} border ${c.border}`}>{count}</span>
        </div>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-[10px] ${c.text} opacity-60`}></i>
      </button>

      {open && (
        <div className="space-y-1.5 pl-1">
          {children}
        </div>
      )}
    </div>
  );
}
