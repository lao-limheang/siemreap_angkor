import React, { useRef, useState, useEffect } from 'react';

export default function DashboardPrintModal({
  isOpen,
  onClose,
  bikes = [],
  rooms = [],
  rentals = [],
  bookings = [],
  settings = {},
  currency = (v) => `$${Number(v || 0).toFixed(2)}`
}) {
  const printRef = useRef(null);

  const bProfile = settings.business_profile || {};
  const shopSet = settings.shop_settings || {};
  const invSettings = settings.invoice_settings || {};
  const pricingTax = settings.pricing_tax || {};

  // Paper format: 'a4' | 'pos80' | 'pos58'
  const defaultFormat = invSettings.paperSize || 'a4';
  const [paperFormat, setPaperFormat] = useState(defaultFormat);

  useEffect(() => {
    if (invSettings.paperSize) {
      setPaperFormat(invSettings.paperSize);
    }
  }, [invSettings.paperSize]);

  if (!isOpen) return null;

  const hotelName = invSettings.companyHeader || bProfile.hotelName || shopSet.shopName || 'Siem Reap Angkor Guesthouse & Motor Rental';
  const hotelSubtitle = invSettings.subtitle || bProfile.slogan || 'Executive Daily Operations & Summary Report';
  const hotelPhone = invSettings.phone || bProfile.phone || '+855 016 308 199';
  const hotelAddress = invSettings.address || bProfile.address || 'Near Angkor Wat Main Gate, Siem Reap, Cambodia';
  const taxNumber = invSettings.taxNumber || 'K002-901829381';
  const logo = shopSet.logo || bProfile.logo || '/assets/logo.png';
  const exchangeRate = Number(pricingTax.exchangeRate) || 4000;
  const showLogo = invSettings.showLogo !== false;

  const todayStr = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const nowDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Metrics Calculations
  const totalBikes = bikes.length;
  const availableBikes = bikes.filter(b => (b.status || '').toLowerCase() === 'available').length;
  const rentedBikes = bikes.filter(b => (b.status || '').toLowerCase() === 'rented').length;
  const repairBikes = bikes.filter(b => ['maintenance', 'repair', 'inactive'].includes((b.status || '').toLowerCase())).length;

  const totalRooms = rooms.length;
  const vacantRooms = rooms.filter(r => (r.status || '').toLowerCase() === 'vacant').length;
  const occupiedRooms = rooms.filter(r => (r.status || '').toLowerCase() === 'occupied').length;
  const cleaningRooms = rooms.filter(r => (r.status || '').toLowerCase() === 'cleaning').length;

  const todayRentals = rentals.filter(r => (r.startDate || r.checkoutDate || '').startsWith(todayStr));
  const todayIncome = todayRentals.reduce((sum, r) => sum + Number(r.totalPrice || r.totalFee || r.pricePerDay || 0), 0);
  const totalIncome = rentals.reduce((sum, r) => sum + Number(r.totalPrice || r.totalFee || 0), 0);
  const todayIncomeKhr = todayIncome * exchangeRate;
  const totalIncomeKhr = totalIncome * exchangeRate;

  const overdueRentals = rentals.filter(r => 
    (r.status === 'active' || r.status === 'rented') && 
    (r.endDate || r.returnDueDate) && 
    (r.endDate || r.returnDueDate) < todayStr
  );

  const displayRentals = rentals.slice(0, 15);

  const isPos = paperFormat === 'pos80' || paperFormat === 'pos58';
  const posWidthClass = paperFormat === 'pos58' ? 'max-w-[300px]' : 'max-w-[380px]';

  const handlePrint = () => {
    const printableEl = printRef.current;
    if (!printableEl) {
      window.print();
      return;
    }

    let iframe = document.getElementById('hidden-dashboard-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'hidden-dashboard-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    let stylesHtml = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
      stylesHtml += el.outerHTML + '\n';
    });

    const isPosFormat = paperFormat === 'pos80' || paperFormat === 'pos58';
    const pageSize = paperFormat === 'pos58' ? '58mm auto' : paperFormat === 'pos80' ? '80mm auto' : 'A4 portrait';
    const pageMargin = isPosFormat ? '0mm' : '8mm';
    const containerWidth = paperFormat === 'pos58' ? '54mm' : paperFormat === 'pos80' ? '76mm' : '100%';

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Dashboard_Report_${todayStr}</title>
          ${stylesHtml}
          <style>
            @page {
              size: ${pageSize} !important;
              margin: ${pageMargin} !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #111827 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: ${isPosFormat ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'} !important;
              padding: ${isPosFormat ? '1mm 2mm' : '0'} !important;
            }
            .dashboard-print-wrapper {
              width: 100% !important;
              max-width: ${containerWidth} !important;
              margin: 0 auto !important;
              background: #ffffff !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            thead {
              display: table-header-group !important;
            }
            tr {
              page-break-inside: avoid !important;
            }
            th, td {
              border: 1px solid #e5e7eb !important;
              padding: 4px 6px !important;
            }
          </style>
        </head>
        <body>
          <div class="dashboard-print-wrapper">
            ${printableEl.innerHTML}
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('Iframe print error, falling back to window.print():', e);
        window.print();
      }
    }, 280);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, paperFormat]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75 backdrop-blur-xs overflow-y-auto invoice-modal-overlay cursor-pointer"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden modal-pop my-auto relative z-10 cursor-default ${
          isPos ? posWidthClass : 'w-full max-w-4xl'
        }`}
      >
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-stone-900 text-white border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm">
              <i className="fa-solid fa-chart-line"></i>
            </span>
            <div>
              <h3 className="font-bold text-xs sm:text-sm">Dashboard Operations Report</h3>
              <p className="text-[10px] sm:text-[11px] text-stone-400 font-mono">Date: {nowDate} • {nowTime}</p>
            </div>
          </div>

          {/* Paper Switcher */}
          <div className="flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700">
            <button
              type="button"
              onClick={() => setPaperFormat('a4')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                paperFormat === 'a4' ? 'bg-blue-600 text-white shadow-xs' : 'text-stone-300 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-file-lines text-[11px]"></i>
              <span>A4 Report</span>
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('pos80')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                paperFormat === 'pos80' ? 'bg-blue-600 text-white shadow-xs' : 'text-stone-300 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-receipt text-[11px]"></i>
              <span>POS 80mm</span>
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('pos58')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                paperFormat === 'pos58' ? 'bg-blue-600 text-white shadow-xs' : 'text-stone-300 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-receipt text-[11px]"></i>
              <span>58mm</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-print"></i>
              <span>Print ({paperFormat.toUpperCase()})</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center text-xs transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div ref={printRef} className="bg-white max-h-[80vh] overflow-y-auto">
          {paperFormat === 'a4' ? (
            /* ══════════════════════════════════════════════════════════════════ */
            /* A4 EXECUTIVE DASHBOARD REPORT                                      */
            /* ══════════════════════════════════════════════════════════════════ */
            <div className="p-6 sm:p-8 text-stone-900 font-sans text-xs bg-white space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b-2 border-stone-800 gap-4">
                <div className="flex items-center gap-3">
                  {showLogo && logo && (
                    <img 
                      src={logo} 
                      alt="Logo" 
                      className="w-12 h-12 object-contain rounded-lg border border-stone-200 p-1"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <h1 className="text-base font-black text-stone-900 uppercase tracking-tight">{hotelName}</h1>
                    <p className="text-[11px] text-stone-500 font-semibold">{hotelSubtitle}</p>
                    <p className="text-[10px] text-stone-400">{hotelAddress} • Tel: {hotelPhone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-blue-700 tracking-wider uppercase block">DAILY OPERATIONS SUMMARY</span>
                  <p className="text-[10px] font-mono text-stone-600">DATE: {nowDate} • {nowTime}</p>
                  <p className="text-[9px] text-stone-400">Printed from Siem Reap Angkor PMS</p>
                </div>
              </div>

              {/* KPI Scorecards Grid */}
              <div>
                <h3 className="text-[11px] font-bold text-stone-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-gauge-high text-blue-600"></i>
                  <span>សូចនាករប្រតិបត្តិការគន្លឹះ (Key Performance Indicators)</span>
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {/* Motor Fleet */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block">ម៉ូតូសរុប (Fleet)</span>
                    <span className="text-lg font-black text-stone-900">{totalBikes}</span>
                    <span className="text-[10px] text-emerald-700 block font-semibold mt-0.5">ទំនេរ: {availableBikes} • កំពុងជួល: {rentedBikes}</span>
                  </div>

                  {/* Room Inventory */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block">បន្ទប់សរុប (Rooms)</span>
                    <span className="text-lg font-black text-stone-900">{totalRooms}</span>
                    <span className="text-[10px] text-blue-700 block font-semibold mt-0.5">ទំនេរ: {vacantRooms} • ស្នាក់នៅ: {occupiedRooms}</span>
                  </div>

                  {/* Today Income */}
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">ចំណូលថ្ងៃនេះ (Today)</span>
                    <span className="text-lg font-black text-amber-900">{currency(todayIncome)}</span>
                    <span className="text-[10px] text-amber-700 block font-semibold mt-0.5">៛ {todayIncomeKhr.toLocaleString()} KHR</span>
                  </div>

                  {/* Total Income */}
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">ចំណូលសរុប (Total Revenue)</span>
                    <span className="text-lg font-black text-emerald-900">{currency(totalIncome)}</span>
                    <span className="text-[10px] text-emerald-700 block font-semibold mt-0.5">កក់សរុប: {bookings.length}</span>
                  </div>
                </div>
              </div>

              {/* Fleet & Room Status Breakdown */}
              <div className="grid grid-cols-2 gap-4">
                {/* Motor Status Table */}
                <div className="p-3.5 bg-stone-50/50 rounded-xl border border-stone-200">
                  <h4 className="text-[10px] font-bold text-stone-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>ស្ថានភាពម៉ូតូ (Motor Fleet Status)</span>
                    <span className="font-mono text-stone-500">{totalBikes} Units</span>
                  </h4>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-stone-200">
                      <span className="text-stone-600">ម៉ូតូទំនេរ (Available for rent)</span>
                      <span className="font-bold text-emerald-700">{availableBikes} ({totalBikes > 0 ? Math.round((availableBikes/totalBikes)*100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-200">
                      <span className="text-stone-600">ម៉ូតូកំពុងជួល (Currently rented out)</span>
                      <span className="font-bold text-blue-700">{rentedBikes} ({totalBikes > 0 ? Math.round((rentedBikes/totalBikes)*100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-stone-600">ម៉ូតូជួសជុល / ថែទាំ (Maintenance)</span>
                      <span className="font-bold text-rose-700">{repairBikes}</span>
                    </div>
                  </div>
                </div>

                {/* Room Status Table */}
                <div className="p-3.5 bg-stone-50/50 rounded-xl border border-stone-200">
                  <h4 className="text-[10px] font-bold text-stone-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>ស្ថានភាពបន្ទប់ (Room Occupancy Status)</span>
                    <span className="font-mono text-stone-500">{totalRooms} Rooms</span>
                  </h4>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-stone-200">
                      <span className="text-stone-600">បន្ទប់ទំនេរ (Vacant ready)</span>
                      <span className="font-bold text-emerald-700">{vacantRooms}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-200">
                      <span className="text-stone-600">បន្ទប់មានភ្ញៀវ (Occupied stay)</span>
                      <span className="font-bold text-blue-700">{occupiedRooms}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-stone-600">បន្ទប់រៀបចំ / សម្អាត (Cleaning)</span>
                      <span className="font-bold text-amber-700">{cleaningRooms}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overdue Warning Section */}
              {overdueRentals.length > 0 && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-2">
                    <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                    <span>ម៉ូតូជួលហួសកាលកំណត់ប្រគល់ (Overdue Rentals: {overdueRentals.length} Cases)</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {overdueRentals.slice(0, 5).map((ov, oIdx) => (
                      <div key={ov.id || oIdx} className="flex justify-between items-center py-1 border-b border-rose-100 last:border-0">
                        <span className="font-semibold text-stone-800">
                          {ov.guestName || ov.customerName || 'Customer'} — {ov.bikeName || ov.model || 'Motor'} ({ov.plateNumber || 'No Plate'})
                        </span>
                        <span className="font-mono text-rose-700 font-bold">
                          Due: {ov.endDate || ov.returnDueDate}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Transactions Table */}
              <div>
                <h3 className="text-[11px] font-bold text-stone-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>ប្រតិបត្តិការជួលចុងក្រោយ (Recent Activity / Rental Records)</span>
                  <span className="text-stone-400 font-normal">បង្ហាញ {displayRentals.length} ជួរចុងក្រោយ</span>
                </h3>
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 font-bold uppercase">
                      <th className="py-2 px-2.5">#</th>
                      <th className="py-2 px-2.5">អតិថិជន (Customer)</th>
                      <th className="py-2 px-2.5">ម៉ូតូ / បន្ទប់ (Vehicle/Room)</th>
                      <th className="py-2 px-2.5">កាលបរិច្ឆេទ (Period)</th>
                      <th className="py-2 px-2.5 text-right">តម្លៃ (Fee)</th>
                      <th className="py-2 px-2.5 text-center">ស្ថានភាព (Status)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {displayRentals.map((r, idx) => (
                      <tr key={r.id || idx}>
                        <td className="py-1.5 px-2.5 font-mono text-stone-400">{idx + 1}</td>
                        <td className="py-1.5 px-2.5 font-bold text-stone-900">
                          {r.guestName || r.customerName || 'Customer'}
                          {(r.guestPhone || r.phone) && <span className="text-stone-400 font-normal block">{r.guestPhone || r.phone}</span>}
                        </td>
                        <td className="py-1.5 px-2.5 font-medium text-stone-800">
                          {r.bikeName || r.model || r.roomName || 'Item'}
                          {r.plateNumber && <span className="font-mono text-stone-500 text-[9px] block">({r.plateNumber})</span>}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-stone-600">
                          {r.startDate || r.checkoutDate || '—'} ➔ {r.endDate || r.returnDueDate || '—'}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-stone-900">
                          {currency(r.totalPrice || r.totalFee || 0)}
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            r.status === 'active' || r.status === 'rented' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {r.status || 'completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures & Footer */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-dashed border-stone-300 text-center text-[10px] text-stone-500">
                <div>
                  <div className="h-12 border-b border-stone-300 mb-2"></div>
                  <p className="font-bold text-stone-800">Prepared By (បុគ្គលិករៀបចំ)</p>
                  <p className="text-[9px] text-stone-400">Receptionist / Front Desk</p>
                </div>
                <div>
                  <div className="h-12 border-b border-stone-300 mb-2"></div>
                  <p className="font-bold text-stone-800">Approved By (អ្នកគ្រប់គ្រង)</p>
                  <p className="text-[9px] text-stone-400">General Manager / Owner</p>
                </div>
              </div>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════════ */
            /* POS THERMAL SHIFT SUMMARY (80mm & 58mm)                            */
            /* ══════════════════════════════════════════════════════════════════ */
            <div className="p-4 sm:p-5 bg-white text-stone-950 font-mono text-[11px] leading-tight select-all">
              {/* Header */}
              <div className="text-center space-y-1">
                {showLogo && logo && (
                  <img src={logo} alt="Logo" className="w-8 h-8 object-contain mx-auto mb-1 filter grayscale" />
                )}
                <h2 className="font-black text-xs uppercase">{hotelName}</h2>
                <p className="text-[9px] text-stone-600">DAILY SHIFT SUMMARY</p>
                <p className="text-[9px] text-stone-500">{nowDate} • {nowTime}</p>
              </div>

              <div className="my-2 border-b border-dashed border-stone-400"></div>

              {/* Revenue Snapshot */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between font-black text-xs">
                  <span>TODAY REVENUE:</span>
                  <span>{currency(todayIncome)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>TODAY KHR (៛):</span>
                  <span>{todayIncomeKhr.toLocaleString()} ៛</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>TOTAL SYSTEM REV:</span>
                  <span>{currency(totalIncome)}</span>
                </div>
              </div>

              <div className="my-2 border-b border-dashed border-stone-400"></div>

              {/* Operational Snapshot */}
              <div className="space-y-1 text-[10px]">
                <div className="font-bold uppercase text-[9px] text-stone-500">FLEET SNAPSHOT</div>
                <div className="flex justify-between">
                  <span>Available Bikes:</span>
                  <span className="font-bold">{availableBikes} / {totalBikes}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rented Out:</span>
                  <span className="font-bold">{rentedBikes}</span>
                </div>
                <div className="flex justify-between">
                  <span>Under Repair:</span>
                  <span>{repairBikes}</span>
                </div>

                <div className="font-bold uppercase text-[9px] text-stone-500 pt-1">ROOM SNAPSHOT</div>
                <div className="flex justify-between">
                  <span>Vacant Rooms:</span>
                  <span className="font-bold">{vacantRooms} / {totalRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span>Occupied:</span>
                  <span className="font-bold">{occupiedRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cleaning:</span>
                  <span>{cleaningRooms}</span>
                </div>

                {overdueRentals.length > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold pt-1">
                    <span>OVERDUE CASES:</span>
                    <span>{overdueRentals.length}</span>
                  </div>
                )}
              </div>

              <div className="my-2 border-b-2 border-dashed border-stone-600"></div>

              {/* Footer */}
              <div className="text-center space-y-1 text-[9px] text-stone-500 italic pt-1">
                <p>*** END OF SHIFT SUMMARY ***</p>
                <p>Siem Reap Angkor PMS System</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
