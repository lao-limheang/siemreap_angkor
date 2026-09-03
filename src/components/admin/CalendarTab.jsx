import { useState, useMemo } from 'react';

export default function CalendarTab({ rentals, bookings, cardCls, btnSecondary }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Days in month calculation
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Map events by date YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = {};
    const pad = n => String(n).padStart(2, '0');

    (rentals || []).forEach(r => {
      const d = r.startDate;
      if (d) {
        if (!map[d]) map[d] = { active: [], returned: [], overdue: [], bookings: [] };
        if (r.status === 'returned') map[d].returned.push(r);
        else {
          const isOverdue = new Date(r.endDate) < new Date();
          if (isOverdue) map[d].overdue.push(r);
          else map[d].active.push(r);
        }
      }
    });

    (bookings || []).forEach(b => {
      const d = b.startDate || (b.createdAt || '').split('T')[0];
      if (d) {
        if (!map[d]) map[d] = { active: [], returned: [], overdue: [], bookings: [] };
        map[d].bookings.push(b);
      }
    });

    return map;
  }, [rentals, bookings]);

  // Selected day items
  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return null;
    return eventsByDate[selectedDay] || { active: [], returned: [], overdue: [], bookings: [] };
  }, [selectedDay, eventsByDate]);

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold text-lg">
            <i className="fa-solid fa-calendar-days"></i>
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-stone-900">
              {monthNames[month]} {year}
            </h3>
            <p className="text-xs text-stone-500">Rental and reservation schedule overview</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className={`${btnSecondary} px-3 py-1.5 text-xs font-bold`}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button onClick={goToday} className={`${btnSecondary} px-3 py-1.5 text-xs font-bold`}>
            Today
          </button>
          <button onClick={nextMonth} className={`${btnSecondary} px-3 py-1.5 text-xs font-bold`}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-stone-600 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Active Rentals</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Returned</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Bookings</span>
      </div>

      {/* Calendar Grid */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs font-bold text-stone-600 py-3">
          <span className="text-rose-500">Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span className="text-blue-500">Sat</span>
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-stone-100 text-xs">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[110px] p-2 bg-stone-50/50"></div>
          ))}

          {/* Day cells */}
          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1;
            const pad = n => String(n).padStart(2, '0');
            const dateStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const isSelected = selectedDay === dateStr;
            const events = eventsByDate[dateStr];

            return (
              <div
                key={dayNum}
                onClick={() => setSelectedDay(dateStr)}
                className={`min-h-[90px] sm:min-h-[110px] p-2.5 transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-brand-50/60 ring-2 ring-brand-500 ring-inset'
                    : isToday
                    ? 'bg-stone-50 hover:bg-stone-100'
                    : 'bg-white hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${
                      isToday
                        ? 'bg-brand-500 text-white shadow-xs'
                        : 'text-stone-700'
                    }`}
                  >
                    {dayNum}
                  </span>
                </div>

                {/* Event count pills */}
                {events && (
                  <div className="space-y-1 mt-1">
                    {events.active.length > 0 && (
                      <span className="block px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded truncate">
                        {events.active.length} Active
                      </span>
                    )}
                    {events.bookings.length > 0 && (
                      <span className="block px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded truncate">
                        {events.bookings.length} Booked
                      </span>
                    )}
                    {events.overdue.length > 0 && (
                      <span className="block px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded truncate">
                        {events.overdue.length} Overdue
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Panel */}
      {selectedDay && (
        <div className={`${cardCls} p-5 border-l-4 border-l-brand-500`}>
          <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <i className="fa-solid fa-clock text-brand-500"></i>
              Schedule for {selectedDay}
            </h4>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-xs text-stone-400 hover:text-stone-600 font-bold"
            >
              &times; Close
            </button>
          </div>

          <div className="space-y-3">
            {selectedDayItems && (
              <>
                {selectedDayItems.active.length === 0 &&
                  selectedDayItems.returned.length === 0 &&
                  selectedDayItems.bookings.length === 0 && (
                    <p className="text-xs text-stone-400 py-2">No rentals or bookings on this date.</p>
                  )}

                {selectedDayItems.active.map(r => (
                  <div key={r.id} className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-blue-950">{r.guestName}</span> — {r.bikeName}
                      <p className="text-blue-600 text-[11px]">Due: {r.endDate} ({r.rentalType || 'Full Day'})</p>
                    </div>
                    <span className="font-bold text-blue-700">${r.totalPrice}</span>
                  </div>
                ))}

                {selectedDayItems.bookings.map(b => (
                  <div key={b.id} className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-amber-950">{b.name}</span> — {b.bikeName || b.roomName}
                      <p className="text-amber-700 text-[11px]">Booking ({b.phone || 'No phone'})</p>
                    </div>
                    <span className="font-bold text-amber-700">Deposit: ${b.deposit || 0}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
