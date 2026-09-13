import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { toDateStr } from '../../utils/dataNormalizer';

export default function ReportsTab({
  reports = {},
  rentals = [],
  occupancy = [],
  bookings = [],
  bikes = [],
  rooms = [],
  models = [],
  reportPeriod = 'month',
  setReportPeriod,
  cardCls = 'bg-white border border-stone-200 rounded-2xl shadow-sm',
  currency = (v) => `$${parseFloat(v || 0).toFixed(2)}`,
  sendCategoryTelegramAlert,
  tgSending = false
}) {
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Determine date bounds based on period
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = toDateStr(today);

    if (reportPeriod === 'week') {
      const start = new Date(today.getTime() - 7 * 86400000);
      return { start: toDateStr(start), end: todayStr, label: 'Last 7 Days' };
    }
    if (reportPeriod === 'month') {
      const start = new Date(today.getTime() - 30 * 86400000);
      return { start: toDateStr(start), end: todayStr, label: 'Last 30 Days' };
    }
    if (reportPeriod === 'quarter') {
      const start = new Date(today.getTime() - 90 * 86400000);
      return { start: toDateStr(start), end: todayStr, label: 'Last 90 Days' };
    }
    if (reportPeriod === 'year') {
      const start = new Date(today.getTime() - 365 * 86400000);
      return { start: toDateStr(start), end: todayStr, label: 'Last Year' };
    }
    if (reportPeriod === 'custom') {
      return {
        start: customFrom || '2000-01-01',
        end: customTo || todayStr,
        label: `${customFrom || 'Start'} to ${customTo || 'Today'}`
      };
    }
    // 'all'
    return { start: '2000-01-01', end: '2099-12-31', label: 'All Time' };
  }, [reportPeriod, customFrom, customTo]);

  // ── Calculate Bike Rentals Metrics ──────────────────────────────────────────
  const bikeMetrics = useMemo(() => {
    const inRangeRentals = (rentals || []).filter(r => {
      const d = toDateStr(r.startDate || r.checkoutDate || r.createdAt);
      if (!d) return true;
      return d >= dateRange.start && d <= dateRange.end;
    });

    const rentalRev = inRangeRentals.reduce((sum, r) => {
      const base = parseFloat(r.totalPrice) || (parseFloat(r.dailyRate || 15) * (Number(r.totalDays) || 1));
      const late = parseFloat(r.lateFee || 0);
      const damage = parseFloat(r.damageFee || 0);
      return sum + (base + late + damage);
    }, 0);

    // Also consider bike bookings that might not be in rentals yet
    const inRangeBikeBookings = (bookings || []).filter(b => {
      const isRoom = b.type === 'room' || Boolean(b.roomId) || String(b.itemName || '').toLowerCase().includes('room');
      if (isRoom) return false;
      const d = toDateStr(b.startDate || b.createdAt);
      return d >= dateRange.start && d <= dateRange.end;
    });

    // If rentals list has data, use rentals; otherwise fallback to bookings or backend report
    const useRentalsCount = inRangeRentals.length;
    const finalBikeRevenue = useRentalsCount > 0
      ? rentalRev
      : (reports?.bikeRevenue || inRangeBikeBookings.reduce((sum, b) => sum + (parseFloat(b.totalFee || b.deposit || 0)), 0));

    const finalBikeCount = useRentalsCount > 0 ? useRentalsCount : (reports?.bikeCount || inRangeBikeBookings.length);

    return {
      revenue: finalBikeRevenue,
      count: finalBikeCount,
      rentals: inRangeRentals
    };
  }, [rentals, bookings, dateRange, reports]);

  // ── Calculate Room Metrics ──────────────────────────────────────────────────
  const roomMetrics = useMemo(() => {
    const inRangeOccupancy = (occupancy || []).filter(o => {
      const d = toDateStr(o.checkInDate || o.createdAt);
      if (!d) return true;
      return d >= dateRange.start && d <= dateRange.end;
    });

    const occRev = inRangeOccupancy.reduce((sum, o) => {
      const base = parseFloat(o.totalPrice || o.dailyRate || (o.bedCount ? o.bedCount * 25 : 25) || 0);
      return sum + base;
    }, 0);

    // Also consider room bookings
    const inRangeRoomBookings = (bookings || []).filter(b => {
      const isRoom = b.type === 'room' || Boolean(b.roomId) || String(b.itemName || '').toLowerCase().includes('room');
      if (!isRoom) return false;
      const d = toDateStr(b.startDate || b.createdAt);
      return d >= dateRange.start && d <= dateRange.end;
    });

    const bookingRev = inRangeRoomBookings.reduce((sum, b) => {
      return sum + (parseFloat(b.totalFee || b.totalPrice || b.deposit || 0));
    }, 0);

    const useOccCount = inRangeOccupancy.length;
    const finalRoomRevenue = useOccCount > 0
      ? occRev
      : (bookingRev > 0 ? bookingRev : (reports?.roomRevenue || 0));

    const finalRoomCount = useOccCount > 0 ? useOccCount : (inRangeRoomBookings.length || reports?.roomCount || 0);

    return {
      revenue: finalRoomRevenue,
      count: finalRoomCount,
      occupancy: inRangeOccupancy,
      bookings: inRangeRoomBookings
    };
  }, [occupancy, bookings, dateRange, reports]);

  // ── Total Revenue ───────────────────────────────────────────────────────────
  const totalRevenue = bikeMetrics.revenue + roomMetrics.revenue;

  // ── Daily Revenue Aggregation ───────────────────────────────────────────────
  const dailyChartData = useMemo(() => {
    const dayMap = {};

    // 1. From rentals
    (bikeMetrics.rentals || []).forEach(r => {
      const day = toDateStr(r.startDate || r.checkoutDate || r.createdAt);
      if (!day) return;
      if (!dayMap[day]) dayMap[day] = { day, bikes: 0, rooms: 0, total: 0 };
      const amt = (parseFloat(r.totalPrice) || (parseFloat(r.dailyRate || 15) * (Number(r.totalDays) || 1))) +
                  (parseFloat(r.lateFee || 0)) + (parseFloat(r.damageFee || 0));
      dayMap[day].bikes += amt;
      dayMap[day].total += amt;
    });

    // 2. From room occupancy
    (roomMetrics.occupancy || []).forEach(o => {
      const day = toDateStr(o.checkInDate || o.createdAt);
      if (!day) return;
      if (!dayMap[day]) dayMap[day] = { day, bikes: 0, rooms: 0, total: 0 };
      const amt = parseFloat(o.totalPrice || o.dailyRate || (o.bedCount ? o.bedCount * 25 : 25) || 0);
      dayMap[day].rooms += amt;
      dayMap[day].total += amt;
    });

    // 3. Fallback to room bookings if occupancy is empty
    if (roomMetrics.occupancy.length === 0) {
      (roomMetrics.bookings || []).forEach(b => {
        const day = toDateStr(b.startDate || b.createdAt);
        if (!day) return;
        if (!dayMap[day]) dayMap[day] = { day, bikes: 0, rooms: 0, total: 0 };
        const amt = parseFloat(b.totalFee || b.deposit || 0);
        dayMap[day].rooms += amt;
        dayMap[day].total += amt;
      });
    }

    // 4. Merge server dailyRevenue if client map is empty
    if (Object.keys(dayMap).length === 0 && reports?.dailyRevenue?.length > 0) {
      reports.dailyRevenue.forEach(d => {
        if (!d.day) return;
        dayMap[d.day] = {
          day: d.day,
          bikes: 0,
          rooms: parseFloat(d.total || 0),
          total: parseFloat(d.total || 0)
        };
      });
    }

    const sorted = Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day));

    // Format day label for charts (e.g. '09 Sep')
    return sorted.map(item => {
      let shortLabel = item.day;
      try {
        const parts = item.day.split('-');
        if (parts.length === 3) {
          const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          shortLabel = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        }
      } catch (e) {}

      return {
        ...item,
        shortDay: shortLabel,
        bikes: Number(item.bikes.toFixed(2)),
        rooms: Number(item.rooms.toFixed(2)),
        total: Number(item.total.toFixed(2))
      };
    });
  }, [bikeMetrics, roomMetrics, reports]);

  // ── Top Rented Bikes ────────────────────────────────────────────────────────
  const topBikes = useMemo(() => {
    const counts = {};

    (bikeMetrics.rentals || []).forEach(r => {
      const bikeName = r.bikeName || r.motoName || (r.bikeId ? `Bike #${r.bikeId}` : 'Motorbike');
      if (!counts[bikeName]) {
        counts[bikeName] = { name: bikeName, rentals: 0, revenue: 0 };
      }
      counts[bikeName].rentals += 1;
      const amt = (parseFloat(r.totalPrice) || (parseFloat(r.dailyRate || 15) * (Number(r.totalDays) || 1))) +
                  (parseFloat(r.lateFee || 0)) + (parseFloat(r.damageFee || 0));
      counts[bikeName].revenue += amt;
    });

    let list = Object.values(counts).sort((a, b) => b.rentals - a.rentals);

    // Fallback to server topBikes if empty
    if (list.length === 0 && reports?.topBikes?.length > 0) {
      list = reports.topBikes.map(b => ({
        name: b.name || 'Motorbike',
        rentals: Number(b.rentals || 0),
        revenue: Number(b.revenue || 0)
      }));
    }

    return list.slice(0, 6);
  }, [bikeMetrics, reports]);

  // ── Top Rooms ───────────────────────────────────────────────────────────────
  const topRooms = useMemo(() => {
    const counts = {};

    (roomMetrics.occupancy || []).forEach(o => {
      const name = o.roomName || (o.roomId ? `Room #${o.roomId}` : 'Standard Room');
      if (!counts[name]) counts[name] = { name, count: 0, revenue: 0 };
      counts[name].count += 1;
      counts[name].revenue += parseFloat(o.totalPrice || o.dailyRate || 25);
    });

    if (Object.keys(counts).length === 0) {
      (roomMetrics.bookings || []).forEach(b => {
        const name = b.roomName || b.itemName || 'Room';
        if (!counts[name]) counts[name] = { name, count: 0, revenue: 0 };
        counts[name].count += 1;
        counts[name].revenue += parseFloat(b.totalFee || b.deposit || 25);
      });
    }

    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [roomMetrics]);

  // ── Payment Methods Breakdown ───────────────────────────────────────────────
  const paymentBreakdown = useMemo(() => {
    let cash = 0;
    let aba = 0;
    let other = 0;

    (bikeMetrics.rentals || []).forEach(r => {
      const pm = String(r.paymentMethod || r.depositType || 'cash').toLowerCase();
      const amt = parseFloat(r.totalPrice || r.dailyRate || 0);
      if (pm.includes('aba') || pm.includes('qr') || pm.includes('bank')) aba += amt;
      else if (pm.includes('cash')) cash += amt;
      else other += amt;
    });

    (roomMetrics.occupancy || []).forEach(o => {
      const pm = String(o.paymentMethod || 'cash').toLowerCase();
      const amt = parseFloat(o.totalPrice || o.dailyRate || 25);
      if (pm.includes('aba') || pm.includes('qr') || pm.includes('bank')) aba += amt;
      else if (pm.includes('cash')) cash += amt;
      else other += amt;
    });

    const sum = cash + aba + other;
    return {
      cash,
      aba,
      other,
      total: sum,
      cashPct: sum > 0 ? Math.round((cash / sum) * 100) : 0,
      abaPct: sum > 0 ? Math.round((aba / sum) * 100) : 0,
      otherPct: sum > 0 ? Math.round((other / sum) * 100) : 0
    };
  }, [bikeMetrics, roomMetrics]);

  // ── Export CSV Handler ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Date', 'Room Revenue ($)', 'Bike Revenue ($)', 'Total Daily ($)'];
    const rows = dailyChartData.map(d => [d.day, d.rooms, d.bikes, d.total]);
    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SiemReapAngkor_Report_${dateRange.start}_to_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Telegram Alert Handler ──────────────────────────────────────────────────
  const handleTelegramAlert = () => {
    if (!sendCategoryTelegramAlert) return;
    const topBikeText = topBikes[0] ? `${topBikes[0].name} (${topBikes[0].rentals} rentals)` : 'None';
    sendCategoryTelegramAlert({
      category: 'Financial Report',
      title: `📊 Revenue Report (${dateRange.label})`,
      summary: `Total Revenue: ${currency(totalRevenue)}`,
      stats: [
        { label: 'Room Revenue', value: `${currency(roomMetrics.revenue)} (${roomMetrics.count} stays)` },
        { label: 'Bike Revenue', value: `${currency(bikeMetrics.revenue)} (${bikeMetrics.count} rentals)` },
        { label: 'Top Bike', value: topBikeText }
      ],
      details: [
        `Cash: ${currency(paymentBreakdown.cash)} (${paymentBreakdown.cashPct}%)`,
        `ABA KHQR: ${currency(paymentBreakdown.aba)} (${paymentBreakdown.abaPct}%)`,
        `Generated: ${new Date().toLocaleString('en-GB')}`
      ]
    });
  };

  const maxDailyVal = Math.max(...dailyChartData.map(x => x.total), 1);
  const maxTopBikeRentals = Math.max(...topBikes.map(x => x.rentals), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ── Toolbar: Filter & Actions ──────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-stone-200 p-4 rounded-2xl shadow-xs">
        
        {/* Period Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['week', 'Last 7 Days', 'fa-calendar-week'],
            ['month', 'Last 30 Days', 'fa-calendar-days'],
            ['quarter', 'Last 90 Days', 'fa-chart-pie'],
            ['year', 'Last Year', 'fa-calendar'],
            ['all', 'All Time', 'fa-infinity'],
            ['custom', 'Custom', 'fa-sliders']
          ].map(([p, l, icon]) => (
            <button
              key={p}
              onClick={() => setReportPeriod(p)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                reportPeriod === p
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-50 border border-stone-200/80 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <i className={`fa-solid ${icon} text-xs opacity-75`}></i>
              <span>{l}</span>
            </button>
          ))}
        </div>

        {/* Custom date range selector */}
        {reportPeriod === 'custom' && (
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 p-1.5 rounded-xl text-xs font-semibold">
            <span className="text-stone-500 pl-2">From:</span>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-brand-500"
            />
            <span className="text-stone-500">To:</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-brand-500"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            title="Print Report"
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-stone-200 text-stone-700 text-xs font-bold rounded-xl hover:bg-stone-50 transition-all shadow-xs"
          >
            <i className="fa-solid fa-print text-stone-500"></i>
            <span>Print</span>
          </button>

          <button
            onClick={handleExportCSV}
            title="Export CSV"
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-stone-200 text-stone-700 text-xs font-bold rounded-xl hover:bg-stone-50 transition-all shadow-xs"
          >
            <i className="fa-solid fa-file-csv text-emerald-600"></i>
            <span>CSV</span>
          </button>

          {sendCategoryTelegramAlert && (
            <button
              onClick={handleTelegramAlert}
              disabled={tgSending}
              title="Send report summary to Telegram"
              className="flex items-center gap-2 px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              <i className={`fa-brands fa-telegram ${tgSending ? 'animate-spin' : ''}`}></i>
              <span>{tgSending ? 'Sending...' : 'Alert Telegram'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3 Key Metric Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total Revenue */}
        <div className={`${cardCls} p-6 relative overflow-hidden flex items-center gap-4.5 group hover:border-emerald-300 transition-all`}>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 text-2xl shrink-0 group-hover:scale-105 transition-transform">
            <i className="fa-solid fa-dollar-sign"></i>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Total Revenue</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700">
                {dateRange.label}
              </span>
            </div>
            <p className="text-3xl font-black text-stone-900 mt-1 tracking-tight truncate">
              {currency(totalRevenue)}
            </p>
            <p className="text-xs text-stone-500 mt-1 font-medium">
              {roomMetrics.count + bikeMetrics.count} total completed orders
            </p>
          </div>
        </div>

        {/* Room Revenue */}
        <div className={`${cardCls} p-6 relative overflow-hidden flex items-center gap-4.5 group hover:border-blue-300 transition-all`}>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-2xl shrink-0 group-hover:scale-105 transition-transform">
            <i className="fa-solid fa-bed"></i>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Room Revenue</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-700">
                {roomMetrics.count} Stays
              </span>
            </div>
            <p className="text-3xl font-black text-stone-900 mt-1 tracking-tight truncate">
              {currency(roomMetrics.revenue)}
            </p>
            <p className="text-xs text-stone-500 mt-1 font-medium">
              Avg {currency(roomMetrics.count > 0 ? roomMetrics.revenue / roomMetrics.count : 0)} / stay
            </p>
          </div>
        </div>

        {/* Bike Revenue */}
        <div className={`${cardCls} p-6 relative overflow-hidden flex items-center gap-4.5 group hover:border-amber-300 transition-all`}>
          <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 text-2xl shrink-0 group-hover:scale-105 transition-transform">
            <i className="fa-solid fa-motorcycle"></i>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Bike Revenue</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100/80 text-brand-700">
                {bikeMetrics.count} Rentals
              </span>
            </div>
            <p className="text-3xl font-black text-stone-900 mt-1 tracking-tight truncate">
              {currency(bikeMetrics.revenue)}
            </p>
            <p className="text-xs text-stone-500 mt-1 font-medium">
              Avg {currency(bikeMetrics.count > 0 ? bikeMetrics.revenue / bikeMetrics.count : 0)} / rental
            </p>
          </div>
        </div>

      </div>

      {/* ── Daily Revenue & Most Rented Bikes ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Daily Revenue Chart (2 cols) */}
        <div className={`lg:col-span-2 ${cardCls} p-6 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-stone-900 text-base">Daily Revenue Timeline</h3>
                <p className="text-xs text-stone-400 mt-0.5">Revenue breakdown by day ({dateRange.label})</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-3 h-3 rounded-sm bg-blue-500"></span> Rooms
                </span>
                <span className="flex items-center gap-1.5 text-brand-600">
                  <span className="w-3 h-3 rounded-sm bg-brand-500"></span> Bikes
                </span>
              </div>
            </div>

            {dailyChartData.length > 0 ? (
              <div className="w-full h-72 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData.slice(-20)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="shortDay" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={{ stroke: '#e7e5e4' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#78716c' }} axisLine={{ stroke: '#e7e5e4' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(val, name) => [currency(val), name === 'rooms' ? 'Room Revenue' : 'Bike Revenue']}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e7e5e4', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="rooms" name="Room Revenue" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="bikes" name="Bike Revenue" stackId="a" fill="#c0622b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-16 text-stone-400">
                <i className="fa-solid fa-chart-simple text-4xl mb-3 opacity-30"></i>
                <p className="text-sm font-semibold">No revenue records in this selected period.</p>
                <p className="text-xs mt-1">Try switching the filter above to "Last Year" or "All Time".</p>
              </div>
            )}
          </div>

          {/* Mini Day-by-Day Bars */}
          {dailyChartData.length > 0 && (
            <div className="mt-6 pt-5 border-t border-stone-100 space-y-2">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Recent Daily Summary</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {dailyChartData.slice(-7).reverse().map((d, i) => {
                  const pct = maxDailyVal > 0 ? (d.total / maxDailyVal) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs py-1">
                      <span className="w-24 text-stone-500 font-semibold shrink-0">{d.day}</span>
                      <div className="flex-1 bg-stone-100 rounded-full h-4 overflow-hidden flex">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(d.rooms / maxDailyVal) * 100}%` }}
                          title={`Rooms: ${currency(d.rooms)}`}
                        ></div>
                        <div
                          className="h-full bg-brand-500 transition-all"
                          style={{ width: `${(d.bikes / maxDailyVal) * 100}%` }}
                          title={`Bikes: ${currency(d.bikes)}`}
                        ></div>
                      </div>
                      <span className="w-16 font-bold text-stone-800 text-right shrink-0">{currency(d.total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Most Rented Bikes (1 col) */}
        <div className={`${cardCls} p-6 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-stone-900 text-base">Top Rented Bikes</h3>
                <p className="text-xs text-stone-400 mt-0.5">Most in-demand motorbikes</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold">
                <i className="fa-solid fa-trophy"></i>
              </span>
            </div>

            {topBikes.length > 0 ? (
              <div className="space-y-4 pt-2">
                {topBikes.map((b, i) => (
                  <div key={i} className="flex items-center gap-3.5">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        i === 0
                          ? 'bg-amber-500 text-white shadow-xs'
                          : i === 1
                          ? 'bg-stone-300 text-stone-700'
                          : i === 2
                          ? 'bg-amber-700/80 text-white'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <p className="font-bold text-stone-800 truncate">{b.name}</p>
                        <span className="font-black text-brand-600 shrink-0 ml-2">{b.rentals}x</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${(b.rentals / maxTopBikeRentals) * 100}%` }}
                        ></div>
                      </div>
                      {b.revenue > 0 && (
                        <p className="text-[10px] text-stone-400 mt-0.5 font-medium">Earned {currency(b.revenue)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-stone-400">
                <i className="fa-solid fa-motorcycle text-4xl mb-3 opacity-30"></i>
                <p className="text-sm font-semibold">No bike rentals in this period.</p>
              </div>
            )}
          </div>

          {/* Payment Methods Ratio */}
          <div className="mt-6 pt-5 border-t border-stone-100 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-stone-500">Payment Methods</span>
              <span className="text-stone-700">{currency(paymentBreakdown.total)}</span>
            </div>

            <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${paymentBreakdown.cashPct}%` }}
                title={`Cash: ${currency(paymentBreakdown.cash)} (${paymentBreakdown.cashPct}%)`}
              ></div>
              <div
                className="bg-sky-500 h-full transition-all"
                style={{ width: `${paymentBreakdown.abaPct}%` }}
                title={`ABA KHQR: ${currency(paymentBreakdown.aba)} (${paymentBreakdown.abaPct}%)`}
              ></div>
              <div
                className="bg-stone-400 h-full transition-all"
                style={{ width: `${paymentBreakdown.otherPct}%` }}
                title={`Other: ${currency(paymentBreakdown.other)} (${paymentBreakdown.otherPct}%)`}
              ></div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Cash ({paymentBreakdown.cashPct}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span> ABA KHQR ({paymentBreakdown.abaPct}%)
              </span>
              {paymentBreakdown.otherPct > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-stone-400"></span> Other ({paymentBreakdown.otherPct}%)
                </span>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── Additional Breakdown: Top Rooms & Summary Grid ─────────────────── */}
      {topRooms.length > 0 && (
        <div className={`${cardCls} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Top Performing Rooms</h3>
              <p className="text-xs text-stone-400 mt-0.5">Most occupied room accommodations in {dateRange.label}</p>
            </div>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
              <i className="fa-solid fa-hotel"></i>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-2">
            {topRooms.map((rm, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">#{idx + 1} Room</p>
                <p className="text-sm font-bold text-stone-900 truncate">{rm.name}</p>
                <p className="text-xs text-blue-600 font-bold">{rm.count} check-ins</p>
                <p className="text-xs text-stone-500 font-medium">{currency(rm.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
