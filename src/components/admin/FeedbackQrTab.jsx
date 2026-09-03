import { useState } from 'react';

export default function FeedbackQrTab({ settings, cardCls, btnPrimary, btnSecondary }) {
  const [copied, setCopied] = useState(false);
  const feedbackUrl = `${window.location.origin}/feedback`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&data=${encodeURIComponent(feedbackUrl)}`;

  const hotelName = settings?.business_profile?.hotelName || "Motor Rental Siem Reap Angkor & Guesthouse";
  const logo = settings?.business_profile?.logo || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(feedbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Info */}
      <div className={`${cardCls} p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5 mb-5">
          <div>
            <h3 className="font-display font-bold text-xl text-stone-900 flex items-center gap-2.5">
              <i className="fa-solid fa-qrcode text-brand-500"></i>
              Guest Feedback QR Code (QR កូដវាយតម្លៃ)
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Place this QR Code on your reception counter, guesthouse rooms, or motorbike keychains so guests can scan and leave direct feedback.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className={btnSecondary}>
              <i className="fa-solid fa-print mr-1.5"></i> Print Card
            </button>
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noreferrer"
              className={`${btnPrimary} flex items-center gap-1.5`}
            >
              <i className="fa-solid fa-arrow-up-right-from-square"></i> Test Form
            </a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Live Printable Stand Preview */}
          <div className="stand-card bg-white border-2 border-stone-300 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center max-w-sm w-full relative">
            <div className="w-12 h-1 bg-stone-300 rounded-full mb-4"></div>
            
            {logo ? (
              <img src={logo} alt="Logo" className="w-14 h-14 object-contain rounded-2xl mb-3 shadow-xs" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-2xl mb-3 shadow-xs">
                <i className="fa-solid fa-motorcycle"></i>
              </div>
            )}
            
            <h4 className="font-display font-bold text-base text-stone-900 leading-snug">{hotelName}</h4>
            <p className="text-[11px] text-stone-400 font-medium mt-0.5">Siem Reap, Cambodia</p>
            
            <div className="flex items-center gap-1 text-amber-400 text-sm my-3">
              <i className="fa-solid fa-star"></i>
              <i className="fa-solid fa-star"></i>
              <i className="fa-solid fa-star"></i>
              <i className="fa-solid fa-star"></i>
              <i className="fa-solid fa-star"></i>
            </div>

            {/* QR Code Container */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 shadow-inner my-2">
              <img
                src={qrCodeUrl}
                alt="Feedback QR Code"
                className="w-52 h-52 object-contain rounded-xl"
              />
            </div>

            <p className="text-xs font-bold text-stone-800 mt-3">
              Scan with Phone Camera to Leave Review
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              សូមស្កេនដើម្បីវាយតម្លៃសេវាកម្មរបស់យើងខ្ញុំ
            </p>

            <div className="mt-4 pt-3 border-t border-stone-100 w-full text-[10px] text-stone-400 font-mono truncate">
              {feedbackUrl}
            </div>
          </div>

          {/* Details & Actions */}
          <div className="flex-1 space-y-4">
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
              <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block">
                Direct Feedback URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={feedbackUrl}
                  className="flex-1 bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-mono text-stone-700 outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-stone-500">
                Customers scanning this QR code will see a dedicated mobile review form without any distracting admin or external navigation.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-800 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <i className="fa-solid fa-bell text-emerald-600"></i> Instant Telegram Notification
              </p>
              <p className="leading-relaxed">
                Whenever a customer submits a review via this QR code, your Telegram bot will instantly receive a notification with the guest's name, rating, and feedback!
              </p>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-stone-700">Tips for Best Results:</p>
              <ul className="text-xs text-stone-600 space-y-1 list-disc list-inside">
                <li>Print this stand card on high-quality paper and place it on the reception counter.</li>
                <li>Attach small printed QR codes onto motorbike keys or room folders.</li>
                <li>Staff can invite guests to scan when handing back motorbike deposits.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
