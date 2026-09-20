import React, { useRef, useState, useEffect } from 'react';

export default function RoomInvoiceModal({
  isOpen,
  onClose,
  occupancy,
  relatedOccupancies = [],
  rooms = [],
  settings = {},
  currency: rawCurrency
}) {
  const printRef = useRef(null);
  const currency = typeof rawCurrency === 'function' ? rawCurrency : (v) => `$${Number(v || 0).toFixed(2)}`;

  const bProfile = settings.business_profile || {};
  const invSettings = settings.invoice_settings || {};
  const pricingTax = settings.pricing_tax || {};
  const shopSet = settings.shop_settings || {};

  // Paper format state: 'a4' | 'pos80' | 'pos58'
  const defaultFormat = invSettings.paperSize || 'a4';
  const [paperFormat, setPaperFormat] = useState(defaultFormat);

  useEffect(() => {
    if (invSettings.paperSize) {
      setPaperFormat(invSettings.paperSize);
    }
  }, [invSettings.paperSize]);

  if (!isOpen || !occupancy) return null;

  const hotelName = invSettings.companyHeader || bProfile.hotelName || shopSet.shopName || 'Siem Reap Angkor Guesthouse';
  const hotelSubtitle = invSettings.subtitle || bProfile.slogan || 'Near Angkor Wat Temple Heritage Area';
  const hotelPhone = invSettings.phone || bProfile.phone || '+855 016 308 199';
  const hotelEmail = bProfile.email || 'contact@siemreapangkor.com';
  const hotelAddress = invSettings.address || bProfile.address || 'Near Angkor Wat Main Gate, Siem Reap, Cambodia';
  const taxNumber = invSettings.taxNumber || 'K002-901829381';
  const logo = shopSet.logo || bProfile.logo || '/assets/logo.png';
  const exchangeRate = Number(pricingTax.exchangeRate) || 4000;

  // Customizer options (admin can toggle in settings)
  const showLogo = invSettings.showLogo !== false;
  const showKhr = invSettings.showKhr !== false;
  const showSignatures = invSettings.showSignatures !== false;
  const showTaxId = invSettings.showTaxId !== false;
  const showGuestId = invSettings.showGuestId !== false;
  const customFooterNote = invSettings.footerNote || 'Thank you for choosing Siem Reap Angkor! We hope you have a pleasant stay near the temples.';

  // Determine all rooms for this guest (multi-room support)
  const allStays = relatedOccupancies && relatedOccupancies.length > 0
    ? relatedOccupancies
    : [occupancy];

  const primaryStay = occupancy;
  const guestName = primaryStay.guestName || 'Guest';
  const guestPhone = primaryStay.guestPhone || 'N/A';
  const guestNationality = primaryStay.guestNationality || 'Cambodia';
  const passportOrId = primaryStay.passportOrId || primaryStay.passport || 'N/A';
  const checkInDate = primaryStay.checkInDate || new Date().toISOString().split('T')[0];
  const checkOutDate = primaryStay.checkOutDate || 'Open';

  // Calculate nights
  let nights = 1;
  if (checkInDate && checkOutDate && checkOutDate !== 'Open') {
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0) nights = diff;
  }

  // Calculate items
  let items = [];
  let subtotal = 0;
  const discount = Number(primaryStay.discount || 0);

  if (primaryStay.customItems && primaryStay.customItems.length > 0) {
    items = primaryStay.customItems;
    subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  } else {
    items = allStays.filter(Boolean).map((stay) => {
      const roomObj = rooms.find(r => 
        (stay.roomId && String(r.id) === String(stay.roomId)) ||
        (stay.roomName && (r.name === stay.roomName || `Room ${r.name}` === stay.roomName || r.name === String(stay.roomName).replace(/^Room\s*#?/i, '')))
      ) || (rooms || []).find(r => r.status === 'occupied') || rooms[0] || {};

      const rawRate = Number(stay.price || stay.roomRate || roomObj.price || roomObj.rate || 25);
      const rate = isNaN(rawRate) || rawRate <= 0 ? 25 : rawRate;
      const total = rate * nights;

      let cleanRoomName = 'Room 101';
      if (stay.roomName && String(stay.roomName).trim() && String(stay.roomName).trim().toLowerCase() !== 'null' && String(stay.roomName).trim() !== 'room #null') {
        cleanRoomName = String(stay.roomName).startsWith('Room') ? stay.roomName : `Room ${stay.roomName}`;
      } else if (roomObj.name) {
        cleanRoomName = `Room ${roomObj.name}`;
      } else if (stay.roomId && String(stay.roomId) !== 'null') {
        cleanRoomName = String(stay.roomId).startsWith('Room') ? stay.roomId : `Room ${stay.roomId}`;
      }

      return {
        id: stay.id || Math.random(),
        roomName: cleanRoomName,
        bedType: roomObj.bedType || `${stay.bedCount || roomObj.bedCount || 1} Bed`,
        floor: roomObj.floor || '1',
        rate,
        nights,
        total
      };
    });
    subtotal = items.reduce((sum, item) => sum + item.total, 0);
  }

  const formatSafeDate = (val) => {
    if (!val) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(val);
    }
  };

  const grandTotal = primaryStay.totalAmount !== undefined
    ? Number(primaryStay.totalAmount)
    : Math.max(0, subtotal - discount);
  const grandTotalKhr = grandTotal * exchangeRate;
  const invoiceNumber = primaryStay.invoiceNumber || `INV-RM-${primaryStay.id || '001'}-${String(checkInDate).replace(/-/g, '').slice(2)}`;
  const invoiceDate = formatSafeDate(primaryStay.createdAt);
  const invoiceTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const paymentStatus = (primaryStay.paymentStatus || 'paid').toUpperCase();
  const paymentMethod = (primaryStay.paymentMethod || 'cash').toUpperCase();

  const isPos = paperFormat === 'pos80' || paperFormat === 'pos58';
  const posWidthClass = paperFormat === 'pos58' ? 'max-w-[290px]' : 'max-w-[360px]';

  const handlePrint = () => {
    const printableEl = printRef.current;
    if (!printableEl) {
      window.print();
      return;
    }

    let iframe = document.getElementById('hidden-invoice-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'hidden-invoice-print-frame';
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
          <title>${invoiceNumber || 'Guest Invoice & Folio'}</title>
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
            .invoice-print-wrapper {
              width: 100% !important;
              max-width: ${containerWidth} !important;
              margin: 0 auto !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body>
          <div class="invoice-print-wrapper">
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
  }, [isOpen, paperFormat, occupancy, relatedOccupancies]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75 backdrop-blur-xs overflow-y-auto invoice-modal-overlay print:p-0 print:bg-white print:static print:overflow-visible"
      onClick={onClose}
    >
      {/* Print media dynamic styling for A4 vs POS thermal paper */}
      <style>{`
        @media print {
          @page {
            size: ${paperFormat === 'pos58' ? '58mm auto' : paperFormat === 'pos80' ? '80mm auto' : 'auto'};
            margin: ${isPos ? '0' : '10mm'};
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .printable-invoice-container {
            width: ${paperFormat === 'pos58' ? '54mm' : paperFormat === 'pos80' ? '76mm' : '100%'} !important;
            max-width: ${paperFormat === 'pos58' ? '54mm' : paperFormat === 'pos80' ? '76mm' : '100%'} !important;
            margin: 0 auto !important;
            padding: ${isPos ? '2mm' : '0'} !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* Container */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden modal-pop my-auto max-h-[92vh] flex flex-col printable-invoice-container print:shadow-none print:border-none print:rounded-none relative z-10 opacity-100 ${
          isPos ? posWidthClass : 'w-full max-w-3xl'
        }`}
      >
        {/* Top Control Bar (Hidden during Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-stone-900 text-white print:hidden border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm">
              <i className="fa-solid fa-file-invoice"></i>
            </span>
            <div>
              <h3 className="font-bold text-xs sm:text-sm">Guest Invoice & Folio</h3>
              <p className="text-[10px] sm:text-[11px] text-stone-400 font-mono">{invoiceNumber}</p>
            </div>
          </div>

          {/* Paper Size Switcher Tabs */}
          <div className="flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700">
            <button
              type="button"
              onClick={() => setPaperFormat('a4')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                paperFormat === 'a4'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
              title="Standard A4 Page Layout (Folio)"
            >
              <i className="fa-solid fa-file-lines text-[11px]"></i>
              <span>A4 Folio</span>
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('pos80')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                paperFormat === 'pos80'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
              title="80mm Thermal Receipt (POS)"
            >
              <i className="fa-solid fa-receipt text-[11px]"></i>
              <span>POS 80mm</span>
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('pos58')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                paperFormat === 'pos58'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
              title="58mm Compact Thermal Receipt"
            >
              <i className="fa-solid fa-receipt text-[11px]"></i>
              <span>58mm</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
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

        {/* Printable Area (Targeted for isolated printing) */}
        <div ref={printRef} id="invoice-printable-content" className="bg-white overflow-y-auto flex-1">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* VIEW 1: STANDARD A4 OFFICIAL FOLIO                             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
        {paperFormat === 'a4' && (
          <div className="p-6 sm:p-10 text-stone-900 print:p-8 bg-white font-sans text-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-stone-200 pb-6 mb-6">
              <div className="flex items-start gap-3.5">
                {showLogo && (
                  <img
                    src={logo}
                    alt="Logo"
                    className="w-14 h-14 object-contain rounded-xl border border-stone-100 p-1"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div>
                  <h1 className="font-bold text-lg text-stone-900 leading-tight">{hotelName}</h1>
                  {hotelSubtitle && <p className="text-[11px] text-stone-500">{hotelSubtitle}</p>}
                  <p className="text-[11px] text-stone-500 mt-0.5 max-w-xs">{hotelAddress}</p>
                  <div className="flex flex-wrap gap-x-3 text-[11px] text-stone-500 mt-1 font-mono">
                    <span>📞 {hotelPhone}</span>
                    {hotelEmail && <span>✉️ {hotelEmail}</span>}
                  </div>
                  {showTaxId && taxNumber && (
                    <p className="text-[10px] text-stone-400 font-mono mt-0.5">VATTIN / TAX ID: {taxNumber}</p>
                  )}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className={`inline-block px-3 py-1 rounded-full font-bold text-[11px] tracking-wider uppercase mb-2 ${
                  paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {paymentStatus === 'PAID' ? 'PAID / វិក្កយបត្រផ្លូវការ' : 'UNPAID / មិនទាន់ទូទាត់'}
                </span>
                <p className="text-xs text-stone-400 font-mono">INVOICE NO.</p>
                <p className="text-sm font-black font-mono text-stone-900">{invoiceNumber}</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Date: <span className="font-medium text-stone-700">{invoiceDate} {invoiceTime}</span>
                </p>
              </div>
            </div>

            {/* Guest & Stay Meta Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200/80 mb-6">
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                  Guest Details (ព័ត៌មានភ្ញៀវ)
                </span>
                <p className="text-sm font-bold text-stone-900">{guestName}</p>
                <div className="mt-1 space-y-0.5 text-stone-600 text-xs">
                  <p><span className="text-stone-400">Phone:</span> <span className="font-mono">{guestPhone}</span></p>
                  <p><span className="text-stone-400">Nationality:</span> <span>{guestNationality}</span></p>
                  {showGuestId && (
                    <p><span className="text-stone-400">Passport / ID:</span> <span className="font-mono font-bold text-stone-800">{passportOrId}</span></p>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                  Stay Period (កាលបរិច្ឆេទស្នាក់នៅ)
                </span>
                <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                  <div className="bg-white p-2 rounded-xl border border-stone-200/60">
                    <span className="text-[10px] text-stone-400 block">Check-in</span>
                    <span className="font-bold text-stone-800 font-mono">{checkInDate}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-stone-200/60">
                    <span className="text-[10px] text-stone-400 block">Check-out</span>
                    <span className="font-bold text-stone-800 font-mono">{checkOutDate}</span>
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 mt-2">
                  Total Duration: <strong className="text-stone-800">{nights} Night(s)</strong> • Rooms: <strong className="text-stone-800">{items.length} Room(s)</strong>
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-stone-300 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                    <th className="py-2.5 px-2">#</th>
                    <th className="py-2.5 px-2">Description / Room Details</th>
                    <th className="py-2.5 px-2 text-center">Nights / Qty</th>
                    <th className="py-2.5 px-2 text-right">Rate / Unit</th>
                    <th className="py-2.5 px-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-stone-50/50">
                      <td className="py-3 px-2 font-mono text-stone-400">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <p className="font-bold text-stone-900">{item.roomName || item.description}</p>
                        <p className="text-[11px] text-stone-500">
                          {item.floor ? `Floor ${item.floor} • ${item.bedType}` : (item.subtitle || '')}
                        </p>
                      </td>
                      <td className="py-3 px-2 text-center font-mono">{item.nights !== undefined ? item.nights : (item.qty || 1)}</td>
                      <td className="py-3 px-2 text-right font-mono">{currency(item.rate)}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-stone-900">{currency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Exchange Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-t-2 border-stone-200 pt-4 mb-8">
              <div className="max-w-xs text-[11px] text-stone-500">
                <p className="font-bold text-stone-700 uppercase tracking-wider text-[10px] mb-1">Terms & Conditions</p>
                <p>{customFooterNote}</p>
                <p className="mt-1 font-mono text-[10px] text-stone-400">Payment Method: {paymentMethod}</p>
              </div>

              <div className="w-full sm:w-64 space-y-2 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Charges Subtotal:</span>
                  <span className="font-mono font-semibold">{currency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span className="font-mono font-semibold">-{currency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600">
                  <span>Tax / Service (0%):</span>
                  <span className="font-mono">$0.00</span>
                </div>
                <div className="border-t border-stone-200 pt-2 flex justify-between items-baseline font-bold text-stone-900">
                  <span className="text-sm">Grand Total (USD):</span>
                  <span className="text-base font-mono font-black text-brand-700">{currency(grandTotal)}</span>
                </div>
                {showKhr && (
                  <div className="flex justify-between items-center text-[11px] text-stone-500 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200">
                    <span>Total in KHR ({exchangeRate.toLocaleString()}៛):</span>
                    <span className="font-mono font-bold text-stone-700">{grandTotalKhr.toLocaleString()} ៛</span>
                  </div>
                )}
              </div>
            </div>

            {/* Signatures */}
            {showSignatures && (
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-stone-200 text-center text-xs text-stone-500">
                <div>
                  <div className="h-14 border-b border-dashed border-stone-300 mb-2"></div>
                  <p className="font-bold text-stone-800">Guest Signature</p>
                  <p className="text-[10px] text-stone-400">ហត្ថលេខាភ្ញៀវ</p>
                </div>
                <div>
                  <div className="h-14 border-b border-dashed border-stone-300 mb-2"></div>
                  <p className="font-bold text-stone-800">Receptionist / Cashier</p>
                  <p className="text-[10px] text-stone-400">ហត្ថលេខាអ្នកទទួលប្រាក់</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: THERMAL POS RECEIPT (80mm / 58mm)                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {isPos && (
          <div className="p-4 sm:p-6 bg-white text-stone-950 font-mono text-[11px] leading-tight select-all">
            {/* POS Header */}
            <div className="text-center space-y-1">
              {showLogo && (
                <img
                  src={logo}
                  alt="Logo"
                  className="w-10 h-10 object-contain mx-auto mb-1 filter grayscale"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <h2 className="font-black text-sm uppercase tracking-wider">{hotelName}</h2>
              {hotelSubtitle && <p className="text-[10px] text-stone-600">{hotelSubtitle}</p>}
              <p className="text-[10px] text-stone-600">{hotelAddress}</p>
              <p className="text-[10px] text-stone-600">Tel: {hotelPhone}</p>
              {showTaxId && taxNumber && (
                <p className="text-[9px] text-stone-500">VAT: {taxNumber}</p>
              )}
            </div>

            {/* Receipt Divider */}
            <div className="my-2 border-b border-dashed border-stone-400 text-center"></div>

            {/* Meta Info */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>RCVD: #{invoiceNumber}</span>
                <span>{invoiceDate}</span>
              </div>
              <div className="flex justify-between">
                <span>TIME: {invoiceTime}</span>
                <span>PAY: {paymentMethod}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>GUEST: {guestName}</span>
              </div>
              {guestPhone && guestPhone !== 'N/A' && (
                <div>TEL: {guestPhone}</div>
              )}
              {showGuestId && passportOrId && passportOrId !== 'N/A' && (
                <div>ID/DOC: {passportOrId}</div>
              )}
              <div className="flex justify-between">
                <span>STAY: {checkInDate} ➔ {checkOutDate}</span>
                <span>({nights}N)</span>
              </div>
            </div>

            {/* Receipt Divider */}
            <div className="my-2 border-b border-dashed border-stone-400"></div>

            {/* Items Table */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold uppercase pb-0.5 border-b border-stone-200">
                <span>ITEM / DESCRIPTION</span>
                <span>QTY</span>
                <span>AMOUNT</span>
              </div>
              {items.map((it, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold text-[10px]">
                    <span className="truncate max-w-[160px]">{it.roomName || it.description}</span>
                    <span className="text-right">{currency(it.total)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-stone-500">
                    <span>{it.nights !== undefined ? `${it.nights} nights @ ${currency(it.rate)}` : `${it.qty || 1} x ${currency(it.rate)}`}</span>
                    <span>{it.floor ? `Fl.${it.floor}` : ''}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Receipt Divider */}
            <div className="my-2 border-b border-dashed border-stone-400"></div>

            {/* Calculations */}
            <div className="space-y-1 text-right text-[11px]">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>{currency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>DISCOUNT:</span>
                  <span>-{currency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>TAX/SERVICE:</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-xs font-black pt-1 border-t border-stone-300">
                <span>TOTAL USD:</span>
                <span>{currency(grandTotal)}</span>
              </div>
              {showKhr && (
                <div className="flex justify-between text-[10px] font-bold text-stone-700">
                  <span>TOTAL KHR:</span>
                  <span>{grandTotalKhr.toLocaleString()} ៛</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-emerald-800 font-bold">
                <span>STATUS:</span>
                <span>{paymentStatus} ({paymentMethod})</span>
              </div>
            </div>

            {/* Receipt Divider */}
            <div className="my-3 border-b-2 border-dashed border-stone-400"></div>

            {/* Footer QR / Barcode & Greeting */}
            <div className="text-center space-y-1.5 pt-1">
              <div className="inline-block p-1 border border-stone-300 rounded bg-stone-50">
                <i className="fa-solid fa-qrcode text-3xl text-stone-800"></i>
              </div>
              <p className="font-bold text-[10px] uppercase">
                {customFooterNote}
              </p>
              <p className="text-[9px] text-stone-500">
                សូមអរគុណសម្រាប់ការស្នាក់នៅ!
              </p>
              <p className="text-[8px] text-stone-400 font-sans mt-2">
                Siem Reap Angkor PMS • eFolio System
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
