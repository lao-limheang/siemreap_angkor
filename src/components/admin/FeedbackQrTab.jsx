import { useState, useRef } from 'react';
import { 
  Printer, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Star, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  HeartHandshake, 
  Smartphone, 
  Globe, 
  Settings2,
  FileText
} from 'lucide-react';

export default function FeedbackQrTab({ settings, cardCls, btnPrimary, btnSecondary }) {
  const [copied, setCopied] = useState(false);
  const [paperFormat, setPaperFormat] = useState('a5'); // 'a4' | 'a5' | 'card'
  const [colorTheme, setColorTheme] = useState('terracotta'); // 'terracotta' | 'monochrome'
  
  // Default to live production url if available, otherwise current origin
  const defaultProdUrl = 'https://siemreapangkor.vercel.app/feedback';
  const currentOriginUrl = `${window.location.origin}/feedback`;
  const initialUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? defaultProdUrl 
    : currentOriginUrl;
    
  const [urlMode, setUrlMode] = useState('prod'); // 'prod' | 'current' | 'custom'
  const [customUrl, setCustomUrl] = useState(initialUrl);

  const activeFeedbackUrl = urlMode === 'prod' 
    ? defaultProdUrl 
    : urlMode === 'current' 
      ? currentOriginUrl 
      : customUrl;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&format=png&margin=10&data=${encodeURIComponent(activeFeedbackUrl)}`;

  const hotelName = settings?.business_profile?.hotelName || "Motor Rental Siem Reap Angkor & Guesthouse";
  const logo = settings?.business_profile?.logo || settings?.shop_settings?.logo || "";
  const phone = settings?.business_profile?.phone || "+855 016 308 199";

  const printCardRef = useRef(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFeedbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Isolated clean print for counter standee card
  const handlePrint = () => {
    const printableEl = printCardRef.current;
    if (!printableEl) {
      window.print();
      return;
    }

    let iframe = document.getElementById('hidden-feedback-qr-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'hidden-feedback-qr-print-frame';
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

    const pageSize = paperFormat === 'a4' 
      ? 'A4 portrait' 
      : paperFormat === 'card' 
        ? '100mm 150mm portrait' 
        : 'A5 portrait';
        
    const containerWidth = paperFormat === 'a4' 
      ? '170mm' 
      : paperFormat === 'card' 
        ? '90mm' 
        : '130mm';

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Feedback Standee - ${hotelName}</title>
          ${stylesHtml}
          <style>
            @page {
              size: ${pageSize} !important;
              margin: 8mm !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #1c1917 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              min-height: 98vh !important;
            }
            .qr-standee-print-wrapper {
              width: 100% !important;
              max-width: ${containerWidth} !important;
              margin: 0 auto !important;
              background: #ffffff !important;
              box-shadow: none !important;
            }
          </style>
        </head>
        <body>
          <div class="qr-standee-print-wrapper">
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
    }, 350);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Dynamic print-only CSS fallback so Ctrl+P also prints just the standee */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-qr-standee-card,
          #printable-qr-standee-card * {
            visibility: visible !important;
          }
          #printable-qr-standee-card {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: ${paperFormat === 'a4' ? '180mm' : paperFormat === 'card' ? '95mm' : '135mm'} !important;
            box-shadow: none !important;
            border: 2px solid #292524 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top Banner Card */}
      <div className={`${cardCls} p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-stone-900 flex items-center gap-2">
                Guest Feedback QR Standee (ស្លាក QR វាយតម្លៃ)
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Print this card to display at the reception desk, rooms, or attach to motorbike keys for verified reviews.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button 
              onClick={handlePrint} 
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Standee Card</span>
            </button>
            <a
              href={activeFeedbackUrl}
              target="_blank"
              rel="noreferrer"
              className={`${btnPrimary} flex items-center gap-1.5`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Test Review Page</span>
            </a>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs">
          {/* Paper format */}
          <div>
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Paper Format
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'a5', label: 'A5 Standee', desc: 'Recommended' },
                { id: 'a4', label: 'A4 Sheet', desc: 'Full Poster' },
                { id: 'card', label: '4"x6" Tent', desc: 'Desk Tent' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPaperFormat(f.id)}
                  className={`py-1.5 px-2 rounded-lg font-bold border transition text-center ${
                    paperFormat === f.id
                      ? 'bg-white border-brand-500 text-brand-700 shadow-2xs'
                      : 'border-stone-200 text-stone-600 hover:bg-white'
                  }`}
                >
                  <div className="text-[11px]">{f.label}</div>
                  <div className="text-[9px] text-stone-400 font-normal">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Settings2 className="w-3.5 h-3.5" /> Style Theme
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setColorTheme('terracotta')}
                className={`py-2 px-2.5 rounded-lg font-bold border transition flex items-center justify-center gap-1.5 ${
                  colorTheme === 'terracotta'
                    ? 'bg-white border-brand-500 text-brand-700 shadow-2xs'
                    : 'border-stone-200 text-stone-600 hover:bg-white'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-[#c0622b]"></div>
                <span>Terracotta Gold</span>
              </button>
              <button
                type="button"
                onClick={() => setColorTheme('monochrome')}
                className={`py-2 px-2.5 rounded-lg font-bold border transition flex items-center justify-center gap-1.5 ${
                  colorTheme === 'monochrome'
                    ? 'bg-white border-stone-800 text-stone-900 shadow-2xs'
                    : 'border-stone-200 text-stone-600 hover:bg-white'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-stone-900"></div>
                <span>Monochrome B&W</span>
              </button>
            </div>
          </div>

          {/* Target URL */}
          <div>
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> QR Destination URL
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setUrlMode('prod')}
                className={`flex-1 py-2 px-1 text-[11px] font-bold rounded-lg border transition ${
                  urlMode === 'prod' ? 'bg-white border-brand-500 text-brand-700 shadow-2xs' : 'border-stone-200 text-stone-600 hover:bg-white'
                }`}
                title="Use Live Vercel URL so phone camera scanning works anywhere"
              >
                Live Deploy URL
              </button>
              <button
                type="button"
                onClick={() => setUrlMode('current')}
                className={`flex-1 py-2 px-1 text-[11px] font-bold rounded-lg border transition ${
                  urlMode === 'current' ? 'bg-white border-brand-500 text-brand-700 shadow-2xs' : 'border-stone-200 text-stone-600 hover:bg-white'
                }`}
                title="Use current domain/origin"
              >
                Current Host
              </button>
              <button
                type="button"
                onClick={() => setUrlMode('custom')}
                className={`py-2 px-2 text-[11px] font-bold rounded-lg border transition ${
                  urlMode === 'custom' ? 'bg-white border-brand-500 text-brand-700 shadow-2xs' : 'border-stone-200 text-stone-600 hover:bg-white'
                }`}
              >
                Custom
              </button>
            </div>
          </div>
        </div>

        {urlMode === 'custom' && (
          <div className="mb-6 p-3 bg-stone-100 rounded-xl flex items-center gap-2 text-xs">
            <Globe className="w-4 h-4 text-stone-500" />
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://yourcustomdomain.com/feedback"
              className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-1.5 font-mono text-xs text-stone-800 outline-none"
            />
          </div>
        )}

        {/* Stand Preview & Side Instructions */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8">
          
          {/* Printable Standee Card (TARGET FOR PRINT) */}
          <div className="w-full flex justify-center">
            <div ref={printCardRef} className="w-full max-w-sm flex justify-center">
              <div 
                id="printable-qr-standee-card"
                className={`bg-white rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col items-center text-center w-full relative transition-all ${
                  colorTheme === 'terracotta'
                    ? 'border-2 border-[#c0622b]/40 ring-4 ring-[#c0622b]/10'
                    : 'border-2 border-stone-900 ring-4 ring-stone-100'
                }`}
                style={{ minHeight: paperFormat === 'a4' ? '560px' : '480px' }}
              >
                {/* Decorative Top Pill / Slot */}
                <div className={`w-14 h-1.5 rounded-full mb-4 ${colorTheme === 'terracotta' ? 'bg-[#c0622b]/30' : 'bg-stone-300'}`}></div>

                {/* Hotel Logo / Branding */}
                {logo ? (
                  <img src={logo} alt="Logo" className="w-14 h-14 object-contain rounded-2xl mb-2 shadow-2xs" />
                ) : (
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-2xs ${
                    colorTheme === 'terracotta' ? 'bg-brand-50 text-[#c0622b]' : 'bg-stone-100 text-stone-800'
                  }`}>
                    <Sparkles className="w-6 h-6" />
                  </div>
                )}

                <h4 className="font-display font-bold text-base sm:text-lg text-stone-900 leading-tight">
                  {hotelName}
                </h4>
                <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                  Siem Reap Angkor • Kingdom of Cambodia
                </p>

                {/* 5 Clean Star Icons (NO EMOJI) */}
                <div className="flex items-center justify-center gap-1.5 text-amber-400 my-2.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Action Heading */}
                <div className="my-1">
                  <h5 className="font-bold text-sm sm:text-base text-stone-900 tracking-tight">
                    Share Your Experience
                  </h5>
                  <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                    សូមស្កេនដើម្បីវាយតម្លៃ ឬផ្តល់មតិយោបល់
                  </p>
                </div>

                {/* QR Code Container with Corner Markers */}
                <div className="relative p-3.5 bg-white rounded-2xl border border-stone-200 shadow-sm my-3">
                  <img
                    src={qrCodeUrl}
                    alt="Feedback QR Code"
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-xl"
                  />
                  <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-stone-800 rounded-tl"></div>
                  <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-stone-800 rounded-tr"></div>
                  <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-stone-800 rounded-bl"></div>
                  <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-stone-800 rounded-br"></div>
                </div>

                {/* Instruction Badges with Icons (NO EMOJI) */}
                <div className="flex items-center justify-center gap-3 text-[10px] text-stone-600 font-semibold my-1.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-stone-500" />
                    Scan with Phone
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-stone-500" />
                    Takes 30 Seconds
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-stone-500" />
                    Direct to Owner
                  </span>
                </div>

                {/* Direct Link Footer */}
                <div className="mt-3 pt-2.5 border-t border-stone-100 w-full flex items-center justify-between text-[10px] text-stone-400 font-mono px-1">
                  <span className="truncate">{activeFeedbackUrl}</span>
                  <span className="text-stone-500 shrink-0 font-sans font-medium">{phone}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details & Actions Side Panel */}
          <div className="w-full lg:w-96 space-y-4">
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
              <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block">
                Direct Feedback URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeFeedbackUrl}
                  className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono text-stone-700 outline-none select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-stone-500">
                Guests scanning this QR code are directed straight to the modern feedback form without any distracting navigation.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-800 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Real-Time Review Wall & Telegram Alert
              </div>
              <p className="leading-relaxed text-emerald-700">
                Reviews submitted through this link immediately sync to your Firebase cloud database and send instant notifications to your Telegram channel.
              </p>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
              <p className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-brand-600" />
                Display Recommendations
              </p>
              <ul className="text-xs text-stone-600 space-y-1.5">
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0"></span>
                  <span><strong>Reception Desk:</strong> Place in an acrylic A5 vertical stand right beside the check-out terminal.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0"></span>
                  <span><strong>Guest Rooms:</strong> Insert inside the room information folder or on the bedside table.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0"></span>
                  <span><strong>Motorbike Return:</strong> Invite guests to scan during helmet and deposit return.</span>
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={handlePrint}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Standee ({paperFormat.toUpperCase()})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
