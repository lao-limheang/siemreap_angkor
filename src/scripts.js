export function initializeScripts() {
    // ============================
    // i18n Translation System
    // ============================
    const translations = {
        en: {
            nav_bikes: 'Bikes', nav_why: 'Why Us', nav_location: 'Location', nav_contact: 'Contact', nav_book: 'Book Now',
            hero_location: 'Siem Reap, Cambodia',
            hero_khmer: 'ម៉ូតូជួល សៀមរាបអង្គរ',
            hero_title_1: 'Explore Angkor', hero_title_2: 'On Two Wheels',
            hero_desc: 'Premium scooter & motorcycle rentals starting from just <strong class="t-primary">$10/day</strong>. The easiest way to discover temples, countryside, and hidden gems.',
            hero_cta_1: 'Book via Telegram', hero_cta_2: 'View All Bikes',
            stat_models: 'Bike Models', stat_price: 'Starting Price', stat_riders: 'Happy Riders',
            bikes_tag: 'Special Offer', bikes_title: 'Our Fleet',
            bikes_desc: 'Quality motorcycles & scooters at the best daily rates in Siem Reap',
            bike_vespa_desc: 'Classic Italian Style', bike_pg1_desc: 'Adventure & Touring',
            bike_pg1_note: 'មានធុងខាងក្រោយ (Rear storage)',
            bike_pcx_desc: 'Sporty & Powerful', bike_click_desc: 'Best Seller in Cambodia',
            bike_scoopy_desc: 'Cute & Comfortable', bike_zoomer_desc: 'Urban Adventure',
            per_day: 'day', rent_now: 'Rent Now', best_value: 'BEST VALUE',
            why_tag: 'Why Choose Us', why_title: 'Ride With Confidence', why_desc: 'Your trusted motor rental partner in Siem Reap',
            feat_price_title: 'Best Prices', feat_price_desc: 'Lowest daily rates in Siem Reap with discounts for longer rentals.',
            feat_maintain_title: 'Well Maintained', feat_maintain_desc: 'All bikes regularly serviced and inspected for your safety.',
            feat_delivery_title: 'Free Delivery', feat_delivery_desc: 'We deliver to your hotel or guesthouse in Siem Reap city.',
            feat_support_title: '24/7 Support', feat_support_desc: 'Call or message us anytime. We\'re always here to help.',
            loc_tag: 'Our Location', loc_title: 'Find Us in Siem Reap', loc_desc: 'Visit us or we\'ll deliver the bike to you',
            loc_shop_title: 'Visit Our Shop', loc_address_label: 'Address', loc_address: 'Siem Reap, Cambodia',
            loc_hours_label: 'Hours', loc_hours: 'Open everyday, 7 AM – 8 PM',
            loc_phone_label: 'Phone', loc_directions: 'Get Directions',
            contact_tag: 'Get in Touch', contact_title: 'Ready to Ride?',
            contact_desc: 'Contact us to book your bike — fast, easy, and reliable',
            social_group: 'Group', total_views: 'Total Views',
            promo_text: 'Special discount prices on all bikes!', promo_btn: 'View Bikes',
        },
        kh: {
            nav_bikes: 'ម៉ូតូ', nav_why: 'ហេតុអ្វី', nav_location: 'ទីតាំង', nav_contact: 'ទំនាក់ទំនង', nav_book: 'កក់ឥឡូវ',
            hero_location: 'សៀមរាប, កម្ពុជា',
            hero_khmer: 'ម៉ូតូជួល សៀមរាបអង្គរ',
            hero_title_1: 'រុករកអង្គរ', hero_title_2: 'ដោយកង់ពីរ',
            hero_desc: 'សេវាជួលម៉ូតូ និងស្កូតឺរប្រណីតចាប់ពីតម្លៃត្រឹមតែ <strong class="t-primary">$10/ថ្ងៃ</strong>។ មធ្យោបាយងាយស្រួលបំផុតដើម្បីរុករកប្រាសាទ និងទេសភាព។',
            hero_cta_1: 'កក់តាម Telegram', hero_cta_2: 'មើលម៉ូតូទាំងអស់',
            stat_models: 'ម៉ូដែល', stat_price: 'តម្លៃចាប់ផ្តើម', stat_riders: 'អតិថិជនសប្បាយ',
            bikes_tag: 'ការផ្តល់ជូនពិសេស', bikes_title: 'ម៉ូតូរបស់យើង',
            bikes_desc: 'ម៉ូតូ និងស្កូតឺរគុណភាពល្អក្នុងតម្លៃប្រចាំថ្ងៃល្អបំផុតនៅសៀមរាប',
            bike_vespa_desc: 'រចនាប័ទ្មអ៊ីតាលី', bike_pg1_desc: 'ដំណើរផ្សងព្រេង',
            bike_pg1_note: 'មានធុងខាងក្រោយ',
            bike_pcx_desc: 'រឹងមាំ និងថាមពលខ្លាំង', bike_click_desc: 'លក់ដាច់បំផុតនៅកម្ពុជា',
            bike_scoopy_desc: 'គួរឱ្យស្រលាញ់ និងស្រួល', bike_zoomer_desc: 'ផ្សងព្រេងក្នុងទីក្រុង',
            per_day: 'ថ្ងៃ', rent_now: 'ជួលឥឡូវ', best_value: 'តម្លៃល្អបំផុត',
            why_tag: 'ហេតុអ្វីជ្រើសយើង', why_title: 'ជិះដោយទំនុកចិត្ត', why_desc: 'ដៃគូជួលម៉ូតូដែលអាចទុកចិត្តបានរបស់អ្នកនៅសៀមរាប',
            feat_price_title: 'តម្លៃល្អបំផុត', feat_price_desc: 'តម្លៃប្រចាំថ្ងៃទាបបំផុតនៅសៀមរាប មានការបញ្ចុះតម្លៃសម្រាប់ការជួលយូរ។',
            feat_maintain_title: 'ថែទាំល្អ', feat_maintain_desc: 'ម៉ូតូទាំងអស់ត្រូវបានពិនិត្យ និងថែទាំជាទៀងទាត់។',
            feat_delivery_title: 'ដឹកជញ្ជូនឥតគិតថ្លៃ', feat_delivery_desc: 'យើងដឹកជញ្ជូនទៅសណ្ឋាគារ ឬផ្ទះសំណាក់របស់អ្នក។',
            feat_support_title: 'ជំនួយ 24/7', feat_support_desc: 'ទូរស័ព្ទ ឬផ្ញើសារមកយើងគ្រប់ពេល។',
            loc_tag: 'ទីតាំងរបស់យើង', loc_title: 'រកយើងនៅសៀមរាប', loc_desc: 'មកទស្សនា ឬយើងនឹងដឹកម៉ូតូទៅអ្នក',
            loc_shop_title: 'មកហាងរបស់យើង', loc_address_label: 'អាសយដ្ឋាន', loc_address: 'សៀមរាប, កម្ពុជា',
            loc_hours_label: 'ម៉ោងបើក', loc_hours: 'បើករាល់ថ្ងៃ ម៉ោង 7 ព្រឹក – 8 យប់',
            loc_phone_label: 'ទូរស័ព្ទ', loc_directions: 'ទទួលបានទិសដៅ',
            contact_tag: 'ទំនាក់ទំនង', contact_title: 'ត្រៀមជិះហើយ?',
            contact_desc: 'ទំនាក់ទំនងយើងដើម្បីកក់ម៉ូតូ — រហ័ស ងាយស្រួល និងអាចទុកចិត្តបាន',
            social_group: 'ក្រុម', total_views: 'ការមើលសរុប',
            promo_text: 'តម្លៃបញ្ចុះតម្លៃពិសេសសម្រាប់ម៉ូតូទាំងអស់!', promo_btn: 'មើលម៉ូតូ',
        }
    };

    let currentLang = localStorage.getItem('lang') || 'en';

    function applyTranslation(lang) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
        const langLabel = document.getElementById('langLabel');
        if(langLabel) langLabel.textContent = lang.toUpperCase();
        document.documentElement.lang = lang === 'kh' ? 'km' : 'en';

        const t = translations[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (t[key]) {
                if (el.querySelector('strong') || t[key].includes('<strong')) {
                    el.innerHTML = t[key];
                } else {
                    el.textContent = t[key];
                }
            }
        });
    }

    // ============================
    // Theme Toggle
    // ============================
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.getElementById('themeIconSun');
    const moonIcon = document.getElementById('themeIconMoon');

    function updateThemeIcons() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (sunIcon) sunIcon.style.display = isDark ? 'none' : 'inline';
        if (moonIcon) moonIcon.style.display = isDark ? 'inline' : 'none';
    }

    if (themeToggle) {
        // Remove existing listener if any to avoid duplicates in React strict mode
        const newToggle = themeToggle.cloneNode(true);
        themeToggle.parentNode.replaceChild(newToggle, themeToggle);
        
        newToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            const isDark = next === 'dark';
            const sIcon = document.getElementById('themeIconSun');
            const mIcon = document.getElementById('themeIconMoon');
            if (sIcon) sIcon.style.display = isDark ? 'none' : 'inline';
            if (mIcon) mIcon.style.display = isDark ? 'inline' : 'none';
        });
        updateThemeIcons();
    }

    // ============================
    // Language Toggle
    // ============================
    const langToggleBtn = document.getElementById('langToggle');
    if (langToggleBtn) {
        const newLangBtn = langToggleBtn.cloneNode(true);
        langToggleBtn.parentNode.replaceChild(newLangBtn, langToggleBtn);
        newLangBtn.addEventListener('click', () => {
            const next = currentLang === 'en' ? 'kh' : 'en';
            applyTranslation(next);
        });
    }

    applyTranslation(currentLang);

    // ============================
    // Mobile Menu
    // ============================
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const menuIcon = document.getElementById('menuIcon');

    if (mobileToggle && mobileMenu && menuIcon) {
        const newMobileToggle = mobileToggle.cloneNode(true);
        mobileToggle.parentNode.replaceChild(newMobileToggle, mobileToggle);
        newMobileToggle.addEventListener('click', () => {
            const isOpen = !mobileMenu.classList.contains('hidden');
            mobileMenu.classList.toggle('hidden');
            document.getElementById('menuIcon').className = isOpen ? 'fa-solid fa-bars t-secondary' : 'fa-solid fa-xmark t-primary';
        });

        document.querySelectorAll('.mobile-link').forEach(link => {
            const newLink = link.cloneNode(true);
            link.parentNode.replaceChild(newLink, link);
            newLink.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                document.getElementById('menuIcon').className = 'fa-solid fa-bars t-secondary';
            });
        });
    }

    // ============================
    // Scroll Animations
    // ============================
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = parseInt(entry.target.dataset.delay || 0);
                setTimeout(() => entry.target.classList.add('visible'), delay);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.anim-fade-up, .anim-scale-in').forEach(el => obs.observe(el));

    // ============================
    // Counter Animation
    // ============================
    const cObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                const steps = 60;
                let step = 0;
                const timer = setInterval(() => {
                    step++;
                    const progress = 1 - Math.pow(1 - step / steps, 3);
                    el.textContent = Math.round(target * progress);
                    if (step >= steps) { el.textContent = target; clearInterval(timer); }
                }, 1800 / steps);
                cObs.unobserve(el);
            }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.counter').forEach(c => cObs.observe(c));

    // ============================
    // Promo Bar Close
    // ============================
    const promoClose = document.getElementById('promoClose');
    if (promoClose) {
        promoClose.addEventListener('click', () => {
            const bar = document.getElementById('promoBar');
            if(bar) bar.style.display = 'none';
        });
    }

    // ============================
    // Smooth Scroll
    // ============================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const tgt = document.querySelector(this.getAttribute('href'));
            if (tgt) {
                const top = tgt.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}
