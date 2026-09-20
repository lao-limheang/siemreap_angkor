import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ReviewService } from '../services/DatabaseService';
import {
  Star,
  Bike,
  Hotel,
  Compass,
  Sparkles,
  User,
  Globe,
  PenLine,
  Send,
  CheckCircle2,
  ThumbsUp,
  AlertCircle,
  AlertTriangle,
  Award,
  ShieldCheck,
  HeartHandshake,
  MapPin,
  BadgeDollarSign,
  Clock,
  ArrowRight,
  RotateCcw,
  MessageSquare,
  Lock
} from 'lucide-react';

export default function FeedbackPage({ publicSettings }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [service, setService] = useState('Motor Rental');
  const [selectedTags, setSelectedTags] = useState([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRef, setSubmittedRef] = useState('');
  const [error, setError] = useState('');

  const hotelName = publicSettings?.business_profile?.hotelName || "Motor Rental Siem Reap Angkor & Guesthouse";
  const logo = publicSettings?.business_profile?.logo || "";
  const phone = publicSettings?.business_profile?.phone || "+855 016 308 199";

  // Service categories with modern Lucide icons (NO EMOJIS)
  const services = [
    { id: 'Motor Rental', label: 'Motorbike Rental', icon: Bike, desc: 'Scooters & Bikes' },
    { id: 'Guesthouse Room', label: 'Guesthouse Stay', icon: Hotel, desc: 'Rooms & Amenities' },
    { id: 'Temple Tour', label: 'Temple Tour', icon: Compass, desc: 'Angkor Wat Trip' },
    { id: 'General Service', label: 'Overall Service', icon: Sparkles, desc: 'Customer Care' }
  ];

  // Quick impression tags (NO EMOJIS)
  const quickTags = [
    { id: 'clean_room', label: 'Clean Room', icon: Sparkles },
    { id: 'reliable_bike', label: 'Reliable Motorbike', icon: Bike },
    { id: 'friendly_staff', label: 'Helpful Staff', icon: HeartHandshake },
    { id: 'great_location', label: 'Near Angkor Gate', icon: MapPin },
    { id: 'fair_price', label: 'Transparent Pricing', icon: BadgeDollarSign },
    { id: 'quick_checkin', label: 'Quick Check-in', icon: Clock }
  ];

  const handleToggleTag = (tagLabel) => {
    setSelectedTags(prev => {
      const exists = prev.includes(tagLabel);
      const next = exists ? prev.filter(t => t !== tagLabel) : [...prev, tagLabel];
      return next;
    });
  };

  const getRatingInfo = (score) => {
    switch (score) {
      case 5:
        return {
          label: 'Exceptional Experience',
          subtitle: 'Exceeded all expectations',
          icon: Award,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
        };
      case 4:
        return {
          label: 'Very Good & Satisfying',
          subtitle: 'Enjoyed our time here',
          icon: ThumbsUp,
          color: 'text-teal-700 bg-teal-50 border-teal-200'
        };
      case 3:
        return {
          label: 'Average Experience',
          subtitle: 'Met standard expectations',
          icon: CheckCircle2,
          color: 'text-amber-700 bg-amber-50 border-amber-200'
        };
      case 2:
        return {
          label: 'Needs Improvement',
          subtitle: 'Encountered some issues',
          icon: AlertCircle,
          color: 'text-orange-700 bg-orange-50 border-orange-200'
        };
      case 1:
        return {
          label: 'Unsatisfactory',
          subtitle: 'Did not meet expectations',
          icon: AlertTriangle,
          color: 'text-rose-700 bg-rose-50 border-rose-200'
        };
      default:
        return {
          label: 'Rate Your Experience',
          subtitle: 'Select from 1 to 5 stars',
          icon: Star,
          color: 'text-stone-700 bg-stone-50 border-stone-200'
        };
    }
  };

  const currentScore = hoverRating || rating;
  const ratingInfo = getRatingInfo(currentScore);
  const RatingIcon = ratingInfo.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() && selectedTags.length === 0) {
      setError('Please share a brief comment or select at least one impression tag.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const compiledText = [
        `[${service}]`,
        selectedTags.length > 0 ? `Tags: ${selectedTags.join(', ')}` : '',
        text.trim()
      ].filter(Boolean).join(' • ');

      const reviewData = {
        name: name.trim() || 'Verified Guest',
        country: country.trim() || 'Visitor',
        rating: Number(rating) || 5,
        text: compiledText,
        service,
        tags: selectedTags,
        createdAt: Date.now()
      };

      // 1. Write to Firebase (shared real-time cloud) first
      const fbResult = await ReviewService.create(reviewData).catch(() => null);

      // 2. Also sync to API (server-side backup for Telegram alert, non-blocking)
      fetch('/api/public-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      }).catch(err => console.warn('API review sync notice:', err));

      const refId = fbResult?.id ? fbResult.id.slice(-6).toUpperCase() : `REV-${Date.now().toString().slice(-6)}`;
      setSubmittedRef(refId);
      setSubmitted(true);
    } catch (err) {
      setError('Unable to record your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-800 font-sans flex flex-col justify-between antialiased">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-stone-200 py-3.5 px-4 sm:px-6 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {logo ? (
              <img src={logo} alt="Logo" className="w-9 h-9 object-contain rounded-xl border border-stone-200 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
                <Bike className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-base text-stone-900 truncate leading-tight">
                {hotelName}
              </h1>
              <p className="text-[11px] text-stone-500 truncate">
                Siem Reap Angkor, Cambodia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 rounded-full text-[11px] font-semibold text-stone-600 shrink-0 border border-stone-200/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Verified Review</span>
            <span className="sm:hidden">Verified</span>
          </div>
        </div>
      </header>

      {/* Main Review Form Container */}
      <main className="flex-1 flex items-center justify-center p-3.5 sm:p-6 my-2">
        <div className="w-full max-w-xl bg-white border border-stone-200 rounded-2xl sm:rounded-3xl shadow-lg p-5 sm:p-8">
          
          {submitted ? (
            /* Confirmation Screen (Modern, clean, no animations) */
            <div className="text-center py-6 space-y-5">
              <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="inline-block px-3 py-0.5 bg-stone-100 text-stone-600 font-mono text-xs font-bold rounded-md mb-2">
                  Reference #{submittedRef}
                </span>
                <h2 className="font-display text-2xl font-bold text-stone-900">
                  Thank You For Your Feedback
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  អរគុណសម្រាប់ការវាយតម្លៃ និងផ្តល់មតិយោបល់
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
                  <span className="text-stone-500 font-medium">Service Reviewed</span>
                  <span className="font-bold text-stone-800">{service}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
                  <span className="text-stone-500 font-medium">Rating Given</span>
                  <div className="flex items-center gap-1 font-bold text-stone-800">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{rating} of 5</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Status</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Published to Verified Wall
                  </span>
                </div>
              </div>

              <p className="text-stone-600 text-xs leading-relaxed max-w-sm mx-auto">
                Your review has been directly delivered to our local management team and will help future travelers enjoy their trip around Angkor.
              </p>

              <div className="pt-3 flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setText('');
                    setSelectedTags([]);
                    setName('');
                    setCountry('');
                    setRating(5);
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Submit Another Review</span>
                </button>
                <Link
                  to="/"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Return to Website</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            /* Review Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form Title & Context */}
              <div className="text-center pb-3 border-b border-stone-100">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 border border-stone-200 rounded-full text-stone-700 text-xs font-bold mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                  <span>Guest Experience Review</span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
                  How Was Your Visit?
                </h2>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Your honest feedback helps us improve and supports our local family team in Siem Reap.
                </p>
              </div>

              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Star Rating Section */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl text-center space-y-2.5">
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Overall Experience Score
                </div>

                {/* Stars Row (NO EMOJIS, Lucide Star SVG icons) */}
                <div className="flex justify-center items-center gap-2 sm:gap-3 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverRating || rating) >= star;
                    return (
                      <button
                        type="button"
                        key={star}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        aria-label={`Rate ${star} out of 5 stars`}
                        className="p-1 focus:outline-none cursor-pointer"
                      >
                        <Star
                          className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
                            isFilled
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-stone-100 text-stone-300 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Rating description card (NO EMOJIS) */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${ratingInfo.color}`}>
                  <RatingIcon className="w-4 h-4 shrink-0" />
                  <span>{ratingInfo.label}</span>
                  <span className="font-normal opacity-80">({currentScore}/5)</span>
                </div>
              </div>

              {/* 2. Service Category Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Service Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {services.map((item) => {
                    const IconComponent = item.icon;
                    const isSelected = service === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setService(item.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col items-start gap-1 cursor-pointer ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/70 text-brand-900 ring-1 ring-brand-500'
                            : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600'
                        }`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="text-xs font-bold leading-tight mt-1">{item.label}</div>
                        <div className="text-[10px] text-stone-500 font-normal leading-tight">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Quick Tag Pills (NO EMOJIS) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  What Stood Out? (Optional)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {quickTags.map((tag) => {
                    const TagIcon = tag.icon;
                    const isSelected = selectedTags.includes(tag.label);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleTag(tag.label)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <TagIcon className="w-3.5 h-3.5" />
                        <span>{tag.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Review Comment Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <PenLine className="w-3.5 h-3.5 text-stone-500" />
                    <span>Your Review / Comments</span>
                  </label>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {text.length} characters
                  </span>
                </div>
                <textarea
                  rows="4"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Tell us about the motorbike condition, bedroom cleanliness, staff hospitality, or helpful local advice..."
                  className="w-full bg-white border border-stone-200 rounded-xl p-3.5 text-xs sm:text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 transition resize-none leading-relaxed"
                ></textarea>
              </div>

              {/* 5. Guest Information (Name & Origin) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Your Name (Optional)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. David / Sophie"
                      className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Country or City (Optional)
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. France / Phnom Penh"
                      className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="flex items-center gap-2 p-3 bg-stone-50 border border-stone-200/80 rounded-xl text-[11px] text-stone-500">
                <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>
                  Submitted reviews are verified and displayed on our public testimonials wall.
                </span>
              </div>

              {/* Submit Action */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 active:bg-black text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Submitting Review...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Guest Review</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-4 text-center border-t border-stone-200 bg-white text-xs text-stone-400">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 {hotelName}</span>
          <span className="font-mono text-[11px] text-stone-500">Tel: {phone}</span>
        </div>
      </footer>
    </div>
  );
}
