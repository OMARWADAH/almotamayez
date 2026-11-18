// قوالب الصفحات العامة (تُولَّد على الخادم)
'use strict';

const WA_NUMBER = '966599293545';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const wa = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
const GENERAL_MSG = 'مرحبًا، أرغب في طلب عرض سعر لخدمات الطباعة والدعاية من المتميز الراقي. ممكن تساعدوني؟';
const productMsg = (name, url) => `مرحبًا، أرغب في طلب ${name} من المتميز الراقي.\nرابط المنتج: ${url}\nممكن أعرف السعر ومدة التنفيذ؟`;
const sar = (n) => `${Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س`;
const fmtDate = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; } };

function priceInfo(p) {
  const tiers = (p.price_tiers || []).filter((t) => t && t.price > 0);
  if (p.price_mode === 'fixed' && p.price > 0) return { label: sar(p.price), kind: 'fixed' };
  if (p.price_mode === 'from' && p.price > 0) return { label: `يبدأ من ${sar(p.price)}`, kind: 'from' };
  if (p.price_mode === 'tiers' && tiers.length) return { label: `يبدأ من ${sar(Math.min(...tiers.map((t) => t.price)))}`, kind: 'tiers', tiers };
  return { label: 'السعر حسب المواصفات', kind: 'quote' };
}

function img(image, alt, { sizes = '(max-width: 640px) 50vw, 300px', cls = '', eager = false, w = 800, h = 600 } = {}) {
  if (!image || !image.src) return `<div class="img-ph ${cls}" role="img" aria-label="${esc(alt)}"></div>`;
  const srcset = image.sm ? ` srcset="${esc(image.sm)} 480w, ${esc(image.src)} 1200w" sizes="${sizes}"` : '';
  return `<img src="${esc(image.sm || image.src)}"${srcset} alt="${esc(alt)}" width="${image.w || w}" height="${image.h || h}" class="${cls}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

const ICONS = {
  card: '<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M7 11h6M7 14h4"/>',
  flyer: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  sticker: '<path d="M20 12a8 8 0 1 1-8-8h8v8z"/><path d="M12 4v4a4 4 0 0 0 4 4h4"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  cup: '<path d="M6 4h12l-1.5 16h-9z"/><path d="M5 8h14"/>',
  rollup: '<rect x="7" y="2" width="10" height="17"/><path d="M5 22h14M12 19v3"/>',
  car: '<path d="M3 16v-4l3-5h10l4 5v4z"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
  flag: '<path d="M5 21V3"/><path d="M5 4c5-2 8 2 14 0v9c-6 2-9-2-14 0"/>',
  mug: '<path d="M4 6h12v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 9h2a3 3 0 0 1 0 6h-2"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.card}</svg>`;
const WA_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';

function layout(ctx, { title, desc, page = '', body, og, canonical, preview = false, noindex = false }) {
  const s = ctx.settings;
  const ogImg = og ? (og.startsWith('http') ? og : ctx.base + og) : ctx.base + '/img/logo.png';
  const nav = [['/', 'الرئيسية', 'home'], ['/catalog', 'المنتجات', 'catalog'], ['/offers', 'العروض', 'offers'], ['/portfolio', 'معرض الأعمال', 'portfolio'], ['/guide', 'دليل الخامات', 'guide'], ['/contact', 'تواصل معنا', 'contact']];
  const contactBits = [
    s.phone && `<li><span>الهاتف</span><a href="tel:${esc(s.phone.replace(/\s/g, ''))}" dir="ltr">${esc(s.phone)}</a></li>`,
    s.email && `<li><span>البريد</span><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>`,
    s.address && `<li><span>العنوان</span>${esc(s.address)}</li>`,
    s.hours && `<li><span>ساعات العمل</span>${esc(s.hours)}</li>`,
  ].filter(Boolean).join('');
  const socials = [['instagram', 'إنستغرام'], ['x', 'إكس'], ['snapchat', 'سناب شات'], ['tiktok', 'تيك توك']].filter(([k]) => s[k]).map(([k, n]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${n}</a>`).join('');
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex || preview ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(canonical || ctx.base + ctx.path)}">
<meta property="og:type" content="website"><meta property="og:locale" content="ar_SA">
<meta property="og:site_name" content="${esc(s.site_name)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImg)}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/img/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css?v=5">
</head>
<body data-page="${page}">
${preview ? '<div class="preview-bar">وضع المعاينة — هذه الصفحة غير منشورة ولا يراها الزوار. <a href="/admin">العودة للوحة التحكم</a></div>' : ''}
${s.announcement ? `<div class="announce">${esc(s.announcement)}</div>` : ''}
<header class="site-header">
  <div class="wrap hdr">
    <a href="/" class="logo" aria-label="${esc(s.site_name)} — الرئيسية"><img src="/img/logo.png" alt="شعار ${esc(s.site_name)}" width="857" height="292"></a>
    <nav class="main-nav" id="main-nav" aria-label="القائمة الرئيسية">
      ${nav.map(([h, t, k]) => `<a href="${h}"${k === page ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
    </nav>
    <div class="hdr-actions">
      <a href="/catalog" class="icon-btn" aria-label="بحث"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></a>
      <a href="/order" class="icon-btn cart-link" aria-label="الطلب المجمّع"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h15l-2 9H8z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg><span class="cart-count" hidden>0</span></a>
      <button class="icon-btn menu-btn" aria-expanded="false" aria-controls="main-nav" aria-label="القائمة"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-footer">
  <div class="wrap ft">
    <div class="ft-brand"><img src="/img/logo.png" alt="شعار ${esc(s.site_name)}" width="857" height="292" loading="lazy"><p>${esc(s.about)}</p></div>
    <div><h3>روابط</h3><ul class="ft-links">${nav.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}<li><a href="/order">طلب لعدة منتجات</a></li></ul></div>
    <div><h3>تواصل</h3><ul class="ft-contact"><li><span>واتساب</span><a href="${wa(GENERAL_MSG)}" target="_blank" rel="noopener" dir="ltr">+966 59 929 3545</a></li>${contactBits}</ul>${socials ? `<div class="socials">${socials}</div>` : ''}</div>
  </div>
  <div class="wrap ft-bottom">© ${new Date().getFullYear()} ${esc(s.site_name)}</div>
</footer>
<a class="wa-float" href="${wa(GENERAL_MSG)}" target="_blank" rel="noopener" aria-label="تواصل عبر واتساب">${WA_ICON}<span>واتساب</span></a>
<div class="toast" role="status" aria-live="polite"></div>
<script src="/js/site.js?v=4" defer></script>
</body></html>`;
}

function productCard(ctx, p, catName = '') {
  const url = `${ctx.base}/product/${p.slug}`;
  const pr = priceInfo(p);
  return `<article class="pcard">
  <a href="/product/${esc(p.slug)}" class="pcard-img" tabindex="-1" aria-hidden="true">${img(p.image, p.image_alt || p.name)}</a>
  <div class="pcard-body">
    ${catName ? `<span class="pcard-cat">${esc(catName)}</span>` : ''}
    <h3><a href="/product/${esc(p.slug)}">${esc(p.name)}</a></h3>
    <p class="pcard-desc">${esc(p.short_desc)}</p>
    <div class="price ${pr.kind}">${esc(pr.label)}</div>
    <div class="pcard-actions">
      <a class="btn btn-order" href="${wa(productMsg(p.name, url))}" target="_blank" rel="noopener">${WA_ICON}اطلب الآن</a>
      <button type="button" class="btn-icon add-cart" data-slug="${esc(p.slug)}" data-name="${esc(p.name)}" data-url="${esc(url)}" aria-label="أضف ${esc(p.name)} إلى الطلب المجمّع" title="أضف إلى الطلب المجمّع">+</button>
    </div>
  </div>
</article>`;
}

const grid = (ctx, products, catMap) => products.length
  ? `<div class="pgrid">${products.map((p) => productCard(ctx, p, catMap[p.category_id])).join('')}</div>`
  : `<div class="empty"><p>لم نجد منتجات مطابقة.</p><p>جرّب كلمة أخرى مثل «ستيكر» أو «بزنس كارد»، أو أرسل لنا ما تحتاجه مباشرة.</p><a class="btn btn-order" href="${wa(GENERAL_MSG)}" target="_blank" rel="noopener">${WA_ICON}اطلب عرض سعر</a></div>`;

// المشهد البصري للواجهة: بطاقة بلمعة موضعية + علبة + كيس ورقي + ملصقات
const HERO_SCENE = `<svg class="hero-scene" viewBox="0 0 640 520" role="img" aria-label="عينات مطبوعة: بطاقة أعمال بلمعة موضعية، علبة مطبوعة، كيس ورقي، وملصقات">
<defs>
 <filter id="hs" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-opacity=".18"/></filter>
 <linearGradient id="kraft" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6ab78"/><stop offset="1" stop-color="#b98653"/></linearGradient>
 <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <linearGradient id="gold2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6a1f"/><stop offset=".45" stop-color="#f6dc8a"/><stop offset=".6" stop-color="#c79a2c"/><stop offset="1" stop-color="#7a5a14"/></linearGradient>
 <pattern id="paperTex" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="#000" stroke-opacity=".035"/></pattern>
 <clipPath id="cardClip"><rect x="0" y="0" width="300" height="172" rx="12"/></clipPath>
</defs>
<ellipse cx="330" cy="470" rx="290" ry="28" fill="#000" opacity=".06"/>
<!-- كيس ورقي -->
<g filter="url(#hs)" class="hs-bag">
 <path d="M410 120 q0 -70 55 -70 q55 0 55 70" fill="none" stroke="#8b5e34" stroke-width="7"/>
 <polygon points="370,118 560,118 585,450 345,450" fill="url(#kraft)"/>
 <polygon points="560,118 600,140 612,430 585,450" fill="#a7774a"/>
 <rect x="345" y="118" width="240" height="332" fill="url(#paperTex)"/>
 <circle cx="465" cy="250" r="54" fill="#EC0B8C"/><text x="465" y="268" font-size="50" font-weight="900" fill="#fff" text-anchor="middle" font-family="Tajawal">M</text>
 <text x="465" y="352" font-size="22" font-weight="800" fill="#3b2a17" text-anchor="middle" font-family="Tajawal">المتميز الراقي</text>
</g>
<!-- علبة -->
<g filter="url(#hs)" class="hs-box">
 <polygon points="70,250 250,250 320,200 140,200" fill="#2CABE2"/>
 <polygon points="250,250 320,200 320,350 250,400" fill="#1d86b3"/>
 <rect x="70" y="250" width="180" height="150" fill="#fff"/>
 <rect x="70" y="250" width="180" height="40" fill="#111"/>
 <text x="160" y="345" font-size="20" font-weight="800" fill="#111" text-anchor="middle" font-family="Tajawal">علبة منتج</text>
 <rect x="110" y="360" width="100" height="5" rx="2" fill="#ddd"/>
 <polygon points="140,200 180,200 250,150 210,150" fill="url(#gold2)" opacity=".0"/>
</g>
<!-- ملصقات -->
<g class="hs-stickers">
 <g filter="url(#hs)"><circle cx="560" cy="80" r="44" fill="#FBED21"/><text x="560" y="90" font-size="26" font-weight="900" text-anchor="middle" font-family="Tajawal" fill="#111">جديد</text></g>
 <g filter="url(#hs)" transform="rotate(-12 95 150)"><rect x="40" y="110" width="110" height="80" rx="16" fill="#EC0B8C"/><text x="95" y="160" font-size="22" font-weight="800" fill="#fff" text-anchor="middle" font-family="Tajawal">ستيكر</text></g>
 <g filter="url(#hs)"><path d="M300 60 l14 30 32 4 -24 22 7 32 -29 -16 -29 16 7 -32 -24 -22 32 -4z" fill="#2CABE2" stroke="#fff" stroke-width="5"/></g>
</g>
<!-- بطاقة أعمال بلمعة موضعية -->
<g transform="translate(150 300) rotate(-8)" filter="url(#hs)" class="hs-card">
 <rect x="0" y="0" width="300" height="172" rx="12" fill="#151515"/>
 <g clip-path="url(#cardClip)">
  <text x="150" y="98" font-size="64" font-weight="900" fill="#262626" text-anchor="middle" font-family="Tajawal">M</text>
  <text x="150" y="98" font-size="64" font-weight="900" fill="#2f2f2f" text-anchor="middle" font-family="Tajawal" stroke="#3a3a3a">M</text>
  <rect class="spot-shine" x="-120" y="-20" width="90" height="220" fill="url(#shine)" transform="skewX(-20)" opacity=".7"/>
 </g>
 <text x="150" y="140" font-size="17" font-weight="700" fill="url(#gold2)" text-anchor="middle" font-family="Tajawal">لمعة موضعية · فويل ذهبي</text>
 <rect x="0" y="0" width="300" height="6" fill="#EC0B8C"/>
</g>
</svg>`;

const STEPS = [
  ['اختر المنتج', 'تصفّح الأقسام أو ابحث بالاسم المتداول مثل «بزنس كارد» أو «ستيكر».'],
  ['حدّد المواصفات', 'اختر المقاس والخامة والتشطيب والكمية، أو اتركها لنقترحها عليك.'],
  ['تواصل عبر واتساب', 'اضغط «اطلب الآن» لتصلنا رسالة جاهزة باسم المنتج ومواصفاته.'],
];

function home(ctx, { categories, featured, offers, portfolio, counts, catMap, finishes }) {
  const s = ctx.settings;
  const heroImg = s.hero_image ? JSON.parse(s.hero_image) : null;
  return layout(ctx, {
    title: s.seo_home_title, desc: s.seo_home_desc, page: 'home', og: heroImg?.src,
    body: `
<section class="hero">
  <div class="wrap hero-in">
    <div class="hero-copy">
      <span class="eyebrow">المتميز الراقي للدعاية والإعلان</span>
      <h1>${esc(s.hero_title)}</h1>
      <p>${esc(s.hero_subtitle)}</p>
      <div class="hero-cta">
        <a class="btn btn-dark btn-lg" href="/catalog">استعرض المنتجات</a>
        <a class="btn btn-order btn-lg" href="${wa(GENERAL_MSG)}" target="_blank" rel="noopener">${WA_ICON}اطلب عرض سعر</a>
      </div>
      <ul class="hero-points"><li>خيارات خامات وتشطيبات واضحة</li><li>رسالة طلب جاهزة بمواصفاتك</li><li>اجمع عدة منتجات في طلب واحد</li></ul>
    </div>
    <div class="hero-visual">${heroImg ? img(heroImg, s.hero_image_alt || 'عينات مطبوعة', { eager: true, sizes: '(max-width: 900px) 100vw, 50vw' }) : HERO_SCENE}</div>
  </div>
</section>

<section class="wrap section">
  <div class="sec-head"><h2>الأقسام</h2><a href="/catalog" class="more">كل المنتجات ←</a></div>
  <div class="cat-grid">
    ${categories.map((c, i) => `<a class="cat-tile c${i % 4}" href="/catalog?cat=${esc(c.slug)}"><span class="cat-ic">${icon(c.icon)}</span><strong>${esc(c.name)}</strong><small>${esc(c.description)}</small>${counts[c.id] ? `<em>${counts[c.id]} منتج</em>` : ''}</a>`).join('')}
  </div>
</section>

${offers.length ? `<section class="offers-band"><div class="wrap section">
  <div class="sec-head"><h2>العروض السارية</h2><a href="/offers" class="more">كل العروض ←</a></div>
  <div class="offer-grid">${offers.slice(0, 3).map((o) => offerCard(ctx, o)).join('')}</div>
</div></section>` : ''}

${featured.length ? `<section class="wrap section">
  <div class="sec-head"><h2>منتجات مختارة</h2><a href="/catalog" class="more">الكتالوج ←</a></div>
  ${grid(ctx, featured, catMap)}
</section>` : ''}

<section class="steps-band"><div class="wrap section">
  <div class="sec-head center"><h2>اطلب في ثلاث خطوات</h2></div>
  <ol class="steps">${STEPS.map(([t, d], i) => `<li><span class="step-n">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
</div></section>

<section class="wrap section">
  <div class="sec-head"><h2>شاهد الفرق في التشطيبات</h2><a href="/guide" class="more">دليل الخامات ←</a></div>
  <div class="swatch-row">${finishes.slice(0, 6).map((f) => `<a class="swatch-mini" href="/guide#${f.id}"><span class="sw sw-${f.id}"><b>M</b></span><span>${esc(f.name)}</span></a>`).join('')}</div>
</section>

${portfolio.length ? `<section class="wrap section">
  <div class="sec-head"><h2>من أعمالنا</h2><a href="/portfolio" class="more">معرض الأعمال ←</a></div>
  <div class="pf-grid">${portfolio.slice(0, 6).map(pfCard).join('')}</div>
</section>` : ''}

<section class="cta-band"><div class="wrap cta-in">
  <div><h2>عندك فكرة أو مواصفات خاصة؟</h2><p>أرسل لنا ما تحتاجه وسنرد عليك بالسعر ومدة التنفيذ.</p></div>
  <a class="btn btn-order btn-lg" href="${wa(GENERAL_MSG)}" target="_blank" rel="noopener">${WA_ICON}اطلب عرض سعر</a>
</div></section>`,
  });
}

function offerCard(ctx, o) {
  return `<article class="offer-card">
  ${o.image ? `<div class="offer-img">${img(o.image, o.image_alt || o.title)}</div>` : ''}
  <div class="offer-body">
    ${o.badge ? `<span class="badge-y">${esc(o.badge)}</span>` : ''}
    <h3>${esc(o.title)}</h3>
    <p>${esc(o.description)}</p>
    <p class="offer-dates">ساري حتى ${fmtDate(o.end_date)}</p>
    <a class="btn btn-order" href="${wa(`مرحبًا، أرغب في الاستفادة من عرض «${o.title}» لدى المتميز الراقي.\nرابط العروض: ${ctx.base}/offers\nممكن التفاصيل؟`)}" target="_blank" rel="noopener">${WA_ICON}اطلب العرض</a>
  </div>
</article>`;
}

const pfCard = (p) => `<figure class="pf-card">${img(p.image, p.image_alt || p.title)}<figcaption><strong>${esc(p.title)}</strong>${p.client ? `<span>${esc(p.client)}</span>` : ''}${p.description ? `<p>${esc(p.description)}</p>` : ''}</figcaption></figure>`;

function catalog(ctx, { products, categories, catMap, q, cat, use, mat, uses, mats, partial }) {
  const s = ctx.settings;
  const curCat = categories.find((c) => c.slug === cat);
  const results = `<p class="result-count">${products.length ? `${products.length} منتج` : ''}${q ? ` لنتيجة «${esc(q)}»` : ''}</p>${grid(ctx, products, catMap)}`;
  if (partial) return results;
  const opt = (arr, v) => arr.map((x) => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
  return layout(ctx, {
    title: curCat ? (curCat.seo_title || `${curCat.name} | المتميز الراقي`) : s.seo_catalog_title,
    desc: curCat ? (curCat.seo_desc || curCat.description) : s.seo_catalog_desc,
    page: 'catalog', canonical: ctx.base + '/catalog' + (curCat ? `?cat=${curCat.slug}` : ''),
    body: `
<section class="page-head"><div class="wrap"><h1>${curCat ? esc(curCat.name) : 'كتالوج المنتجات'}</h1><p>${curCat ? esc(curCat.description) : 'ابحث بالاسم الذي تعرفه — نفهم «بزنس كارد» و«بطاقة أعمال»، و«ستيكر» و«ملصق».'}</p></div></section>
<section class="wrap section catalog">
  <form class="filters" id="filters" action="/catalog" method="get" role="search">
    <label class="search-box"><span class="sr-only">ابحث في المنتجات</span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" name="q" value="${esc(q)}" placeholder="ابحث: بزنس كارد، ستيكر، رول أب..." autocomplete="off" enterkeyhint="search">
    </label>
    <div class="chips" role="radiogroup" aria-label="الأقسام">
      <label class="chip"><input type="radio" name="cat" value=""${!cat ? ' checked' : ''}><span>الكل</span></label>
      ${categories.map((c) => `<label class="chip"><input type="radio" name="cat" value="${esc(c.slug)}"${c.slug === cat ? ' checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}
    </div>
    ${uses.length || mats.length ? `<div class="selects">
      ${uses.length ? `<label>الاستخدام<select name="use"><option value="">الكل</option>${opt(uses, use)}</select></label>` : ''}
      ${mats.length ? `<label>الخامة<select name="mat"><option value="">الكل</option>${opt(mats, mat)}</select></label>` : ''}
    </div>` : ''}
    <noscript><button class="btn btn-dark">بحث</button></noscript>
  </form>
  <div id="results" aria-live="polite">${results}</div>
</section>`,
  });
}

function productPage(ctx, { p, cat, related, finishes, preview }) {
  const url = `${ctx.base}/product/${p.slug}`;
  const pr = priceInfo(p);
  const fmap = Object.fromEntries(finishes.map((f) => [f.id, f]));
  const gallery = [p.image, ...(p.gallery || [])].filter((g) => g && g.src);
  const sample = p.image && p.image.sample;
  const chipGroup = (name, label, items, type = 'radio') => items.length ? `<fieldset class="opt"><legend>${label}</legend><div class="chips">${items.map((v) => `<label class="chip"><input type="${type}" name="${name}" value="${esc(v)}"><span>${esc(v)}</span></label>`).join('')}</div></fieldset>` : '';
  const finItems = (p.finishes || []).filter((id) => fmap[id]);
  const data = { name: p.name, slug: p.slug, url, unit: '' };
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.short_desc, image: gallery.map((g) => (g.src.startsWith('http') ? g.src : ctx.base + g.src)), brand: { '@type': 'Brand', name: ctx.settings.site_name }, url };
  if (pr.kind === 'fixed' || pr.kind === 'from') ld.offers = { '@type': 'Offer', priceCurrency: 'SAR', price: p.price, url };
  return layout(ctx, {
    title: p.seo_title || `${p.name} | المتميز الراقي`, desc: p.seo_desc || p.short_desc, page: 'product', preview,
    og: p.image?.og || (p.image && !p.image.sample ? p.image.src : '/img/logo.png'),
    body: `
<nav class="wrap crumbs" aria-label="مسار التنقل"><a href="/">الرئيسية</a><span>/</span><a href="/catalog">المنتجات</a>${cat ? `<span>/</span><a href="/catalog?cat=${esc(cat.slug)}">${esc(cat.name)}</a>` : ''}<span>/</span><span aria-current="page">${esc(p.name)}</span></nav>
<section class="wrap product">
  <div class="gallery">
    <div class="g-main">${img(gallery[0], p.image_alt || p.name, { eager: true, sizes: '(max-width: 900px) 100vw, 55vw' })}</div>
    ${sample ? '<p class="sample-note">الصورة «نموذج توضيحي» وقد يختلف التنفيذ الفعلي حسب التصميم والخامة.</p>' : ''}
    ${gallery.length > 1 ? `<div class="g-thumbs">${gallery.map((g, i) => `<button type="button" class="g-thumb${i ? '' : ' active'}" data-src="${esc(g.src)}" data-srcset="${g.sm ? esc(`${g.sm} 480w, ${g.src} 1200w`) : ''}" data-alt="${esc(g.alt || p.image_alt || p.name)}" aria-label="عرض الصورة ${i + 1}">${img(g, g.alt || p.name, { sizes: '96px' })}</button>`).join('')}</div>` : ''}
  </div>
  <div class="p-info">
    ${cat ? `<a class="pcard-cat" href="/catalog?cat=${esc(cat.slug)}">${esc(cat.name)}</a>` : ''}
    <h1>${esc(p.name)}</h1>
    <p class="lead">${esc(p.short_desc)}</p>
    <div class="price-box ${pr.kind}"><span class="price">${esc(pr.label)}</span>${pr.kind === 'quote' ? '<small>أرسل المواصفات وسنرد بالسعر ومدة التنفيذ</small>' : '<small>الأسعار بالريال السعودي</small>'}</div>
    ${pr.kind === 'tiers' ? `<table class="tiers"><thead><tr><th>الكمية</th><th>السعر</th></tr></thead><tbody>${pr.tiers.map((t) => `<tr><td>${esc(t.qty)}</td><td>${sar(t.price)}</td></tr>`).join('')}</tbody></table>` : ''}
    <form class="opts" id="order-form" onsubmit="return false">
      ${chipGroup('size', 'المقاس', p.sizes || [])}
      ${chipGroup('material', 'الخامة', p.materials || [])}
      ${finItems.length ? `<fieldset class="opt"><legend>التشطيب <a href="/guide" class="hint">ما الفرق؟</a></legend><div class="chips">${finItems.map((id) => `<label class="chip"><input type="checkbox" name="finish" value="${esc(fmap[id].name)}"><span>${esc(fmap[id].name)}</span></label>`).join('')}</div></fieldset>` : ''}
      <fieldset class="opt"><legend>الكمية</legend>
        <div class="chips">${(p.quantities || []).map((q) => `<label class="chip"><input type="radio" name="qty" value="${esc(q)}"><span>${esc(q)}</span></label>`).join('')}
        <label class="qty-custom"><span class="sr-only">كمية أخرى</span><input type="number" min="1" inputmode="numeric" name="qty_custom" placeholder="كمية أخرى"></label></div>
      </fieldset>
      <ul class="facts">${p.min_qty ? `<li><span>الحد الأدنى للطلب</span>${esc(p.min_qty)}</li>` : ''}${p.lead_time ? `<li><span>مدة التنفيذ</span>${esc(p.lead_time)}</li>` : ''}</ul>
      <p class="opt-hint">اختيار المواصفات اختياري — يمكنك الإرسال مباشرة ونساعدك في الاختيار.</p>
      <div class="p-actions">
        <a class="btn btn-order btn-lg" id="order-btn" href="${wa(productMsg(p.name, url))}" target="_blank" rel="noopener">${WA_ICON}اطلب الآن</a>
        <button type="button" class="btn btn-outline btn-lg" id="add-multi">أضف إلى الطلب المجمّع</button>
      </div>
    </form>
  </div>
</section>
${p.description && p.description !== p.short_desc ? `<section class="wrap section p-desc"><h2>عن المنتج</h2><p>${esc(p.description).replace(/\n/g, '<br>')}</p></section>` : ''}
${finItems.length ? `<section class="wrap section"><h2 class="h2s">التشطيبات المتاحة لهذا المنتج</h2><div class="swatch-row">${finItems.map((id) => `<a class="swatch-mini" href="/guide#${id}"><span class="sw sw-${id}"><b>M</b></span><span>${esc(fmap[id].name)}</span></a>`).join('')}</div></section>` : ''}
${related.length ? `<section class="wrap section"><div class="sec-head"><h2>منتجات مكملة</h2></div>${grid(ctx, related, ctx.catMap)}</section>` : ''}
<script type="application/json" id="product-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  });
}

function offersPage(ctx, { offers, productsBySlug, catMap }) {
  const s = ctx.settings;
  return layout(ctx, {
    title: s.seo_offers_title, desc: s.seo_offers_desc, page: 'offers',
    body: `<section class="page-head yellow"><div class="wrap"><h1>العروض</h1><p>عروض سارية لفترة محدودة — تختفي تلقائيًا عند انتهائها.</p></div></section>
<section class="wrap section">${offers.length ? offers.map((o) => {
      const prods = (o.products || []).map((sl) => productsBySlug[sl]).filter(Boolean);
      return `<div class="offer-block">${offerCard(ctx, o)}${prods.length ? `<h3 class="h3s">المنتجات المشمولة</h3>${grid(ctx, prods, catMap)}` : ''}</div>`;
    }).join('') : `<div class="empty"><p>لا توجد عروض سارية حاليًا.</p><p>تابعنا أو تواصل معنا لمعرفة أحدث العروض.</p><a class="btn btn-order" href="${wa(GENERAL_MSG)}" target="_blank" rel="noopener">${WA_ICON}تواصل عبر واتساب</a></div>`}</section>`,
  });
}

function portfolioPage(ctx, { items }) {
  const s = ctx.settings;
  return layout(ctx, {
    title: s.seo_portfolio_title, desc: s.seo_portfolio_desc, page: 'portfolio',
    body: `<section class="page-head"><div class="wrap"><h1>معرض الأعمال</h1><p>نماذج من مشاريع نفذناها لعملائنا.</p></div></section>
<section class="wrap section">${items.length ? `<div class="pf-grid">${items.map(pfCard).join('')}</div>` : `<div class="empty"><p>سيتم عرض نماذج أعمالنا هنا قريبًا.</p><a class="btn btn-dark" href="/catalog">تصفح المنتجات</a></div>`}</section>`,
  });
}

function contactPage(ctx) {
  const s = ctx.settings;
  const rows = [
    ['واتساب', `<a href="${wa(GENERAL_MSG)}" target="_blank" rel="noopener" dir="ltr">+966 59 929 3545</a>`],
    s.phone && ['الهاتف', `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}" dir="ltr">${esc(s.phone)}</a>`],
    s.email && ['البريد الإلكتروني', `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`],
    s.address && ['العنوان', esc(s.address) + (s.map_url ? ` — <a href="${esc(s.map_url)}" target="_blank" rel="noopener">عرض على الخريطة</a>` : '')],
    s.hours && ['ساعات العمل', esc(s.hours)],
  ].filter(Boolean);
  return layout(ctx, {
    title: s.seo_contact_title, desc: s.seo_contact_desc, page: 'contact',
    body: `<section class="page-head"><div class="wrap"><h1>تواصل معنا</h1><p>أسرع طريقة للطلب أو الاستفسار هي واتساب.</p></div></section>
<section class="wrap section contact">
  <div class="contact-card"><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  <a class="btn btn-order btn-lg" href="${wa(GENERAL_MSG)}" target="_blank" rel="noopener">${WA_ICON}ابدأ المحادثة على واتساب</a></div>
  <div class="contact-side"><h2>قبل أن تراسلنا</h2><ol class="steps compact">${STEPS.map(([t, d], i) => `<li><span class="step-n">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol></div>
</section>`,
  });
}

function guidePage(ctx, { finishes, byFinish }) {
  const s = ctx.settings;
  return layout(ctx, {
    title: s.seo_guide_title, desc: s.seo_guide_desc, page: 'guide',
    body: `<section class="page-head"><div class="wrap"><h1>دليل الخامات والتشطيبات</h1><p>مرّر أو اضغط على العينات لترى الفرق بين التشطيبات، ثم اختر المنتجات التي تدعم كل تشطيب.</p></div></section>
<section class="wrap section guide">${finishes.map((f) => `<article class="g-item" id="${f.id}">
  <div class="sw sw-big sw-${f.id}" tabindex="0" aria-label="عينة ${esc(f.name)}"><b>M</b><i>المتميز</i></div>
  <div><h2>${esc(f.name)} <small dir="ltr">${esc(f.en)}</small></h2><p>${esc(f.desc)}</p>
  ${(byFinish[f.id] || []).length ? `<div class="g-prods"><span>متاح في:</span>${byFinish[f.id].map((p) => `<a href="/product/${esc(p.slug)}">${esc(p.name)}</a>`).join('')}</div>` : ''}</div>
</article>`).join('')}</section>`,
  });
}

function orderPage(ctx) {
  const s = ctx.settings;
  return layout(ctx, {
    title: s.seo_order_title, desc: s.seo_order_desc, page: 'order', noindex: true,
    body: `<section class="page-head"><div class="wrap"><h1>أرسل طلبًا لعدة منتجات</h1><p>اجمع المنتجات ومواصفاتها هنا، ثم أرسلها في رسالة واتساب واحدة.</p></div></section>
<section class="wrap section"><div id="multi-order" class="multi-order"><p class="muted">جارٍ التحميل…</p></div></section>`,
  });
}

function notFound(ctx) {
  return layout(ctx, { title: 'الصفحة غير موجودة | المتميز الراقي', desc: '', noindex: true, body: `<section class="wrap section empty"><h1>الصفحة غير موجودة</h1><p>ربما نُقل المنتج أو لم يُنشر بعد.</p><a class="btn btn-dark" href="/catalog">تصفح المنتجات</a></section>` });
}

function loginPage(error = '') {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>دخول المدير | المتميز الراقي</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/site.css?v=5"></head>
<body class="login-body"><form class="login-card" method="post" action="/admin/login">
<img src="/img/logo.png" alt="شعار المتميز الراقي" width="857" height="292"><h1>دخول لوحة التحكم</h1>
${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ''}
<label>اسم المستخدم<input name="username" autocomplete="username" required></label>
<label>كلمة المرور<input name="password" type="password" autocomplete="current-password" required></label>
<button class="btn btn-dark btn-lg">دخول</button><a href="/" class="muted">العودة للموقع</a></form></body></html>`;
}

module.exports = { esc, wa, home, catalog, productPage, offersPage, portfolioPage, contactPage, guidePage, orderPage, notFound, loginPage, WA_NUMBER, GENERAL_MSG };
