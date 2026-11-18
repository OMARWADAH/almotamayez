// اختبار شامل عبر HTTP: node tests/e2e.js  (الخادم يعمل على المنفذ 3000)
'use strict';
const fs = require('fs');
const path = require('path');
const B = process.env.BASE || 'http://localhost:3000';
const cred = process.env.ADMIN_PASSWORD ? { username: 'admin', password: process.env.ADMIN_PASSWORD } : Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', 'data', 'admin-credentials.txt'), 'utf8').split('\n').filter((l) => l.includes(': ')).map((l) => l.split(': ').map((s) => s.trim())));
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓', m); } else { failN++; console.log('✗', m); } };
let cookie = '';
const H = (extra = {}) => ({ Origin: B, Cookie: cookie, ...extra });
const api = async (method, url, body) => {
  const r = await fetch(B + '/api/admin' + url, { method, headers: H(body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const page = async (u) => { const r = await fetch(B + u, { headers: { Cookie: '' } }); return { status: r.status, text: await r.text() }; };

(async () => {
  // 1) الحماية
  ok((await fetch(B + '/api/admin/state')).status === 401, 'API محمية بدون تسجيل دخول');
  const r0 = await fetch(B + '/admin', { redirect: 'manual' });
  ok(r0.status === 302 && /login/.test(r0.headers.get('location')), '/admin يحوّل لصفحة الدخول');
  ok((await fetch(B + '/api/admin/products/1', { method: 'DELETE' })).status === 401, 'الحذف مرفوض بدون جلسة');
  const bad = await fetch(B + '/admin/login', { method: 'POST', redirect: 'manual', headers: { Origin: B, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'username=admin&password=wrong' });
  ok(bad.status === 401, 'كلمة مرور خاطئة مرفوضة');
  const lr = await fetch(B + '/admin/login', { method: 'POST', redirect: 'manual', headers: { Origin: B, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: cred.username, password: cred.password }) });
  cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  ok(lr.status === 302 && cookie.startsWith('mr_sid='), 'تسجيل الدخول ينجح ويُنشئ جلسة');
  const st = await api('GET', '/state');
  ok(st.status === 200 && st.json.products.length >= 95, `حالة اللوحة: ${st.json.products.length} منتج`);
  ok(st.json.products.every((p) => p.status === 'draft' || p.reviewed), 'المنتجات تبدأ كمسودات');
  const xs = await fetch(B + '/api/admin/settings', { method: 'PUT', headers: { Cookie: cookie, Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
  ok(xs.status === 403, 'طلب تعديل من مصدر خارجي مرفوض (CSRF)');

  const P = Object.fromEntries(st.json.products.map((p) => [p.slug, p]));
  // 2) النشر مشروط بالمراجعة
  const bc = P['business-cards'];
  const r1 = await api('POST', '/products/bulk', { ids: [P['training-files'].id], action: 'publish' });
  ok(r1.json.failed && r1.json.failed.length === 1, 'النشر يُرفض قبل تأكيد مراجعة التوفر');
  const demo = ['business-cards', 'letterhead', 'envelopes', 'stamps', 'flyers', 'brochures', 'posters', 'company-profiles', 'paper-stickers', 'vinyl-stickers', 'die-cut-stickers', 'product-labels',
    'product-boxes', 'gift-boxes', 'paper-bags', 'thank-you-cards', 'menus', 'paper-cups', 'banners', 'roll-up', '3d-letters', 'storefront-stickers', 'car-wraps', 'promo-flags', 'lanyards', 'mugs', 'tshirts', 'occasion-invitations', 'calendars', 'canvas-prints'];
  const ids = demo.map((s) => P[s].id);
  await api('POST', '/products/bulk', { ids, action: 'review' });
  const r2 = await api('POST', '/products/bulk', { ids, action: 'publish' });
  ok(r2.json.done === ids.length, `نشر ${r2.json.done} منتج بعد المراجعة`);
  await api('POST', '/products/bulk', { ids: ['business-cards', 'gift-boxes', 'roll-up', 'mugs', 'paper-stickers', 'menus', 'paper-bags', 'company-profiles'].map((s) => P[s].id), action: 'feature' });

  // منع تكرار الصورة
  const dup = { ...P['notepads'], image: P['business-cards'].image, reviewed: true, status: 'published' };
  const rdup = await api('PUT', '/products/' + dup.id, dup);
  ok(rdup.status === 422 && /مستخدمة/.test(rdup.json.error), 'منع نشر منتج بصورة منتج منشور آخر');

  // 3) تعديل السعر والصورة
  const png = await (await fetch(B + '/img/logo.png')).arrayBuffer();
  const fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'test.png');
  const up = await fetch(B + '/api/admin/upload', { method: 'POST', headers: { Cookie: cookie, Origin: B }, body: fd });
  const upj = await up.json();
  ok(up.status === 200 && upj.image && upj.image.sm, 'رفع صورة وإنشاء نسخة للجوال وصورة مشاركة');
  const fl = { ...P['flyers'], reviewed: true, status: 'published', price_mode: 'tiers', price_tiers: [{ qty: '500', price: 150 }, { qty: '1000', price: 240 }], gallery: [{ ...upj.image, alt: 'معرض تجريبي' }] };
  const rfl = await api('PUT', '/products/' + fl.id, fl);
  ok(rfl.status === 200, 'حفظ أسعار حسب الكمية + معرض صور');
  let pg = await page('/product/flyers');
  ok(pg.text.includes('يبدأ من') && pg.text.includes('١٥٠') && pg.text.includes(upj.image.sm), 'السعر والصورة الجديدة يظهران بعد تحديث الصفحة');
  const bcPrice = await api('PUT', '/products/' + bc.id, { ...P['business-cards'], reviewed: true, status: 'published', featured: true, price_mode: 'from', price: 45, lead_time: '3–5 أيام عمل' });
  ok(bcPrice.status === 200, 'تعديل سعر «يبدأ من» لبطاقات الأعمال');
  pg = await page('/product/business-cards');
  ok(pg.text.includes('يبدأ من ٤٥') && pg.text.includes('3–5 أيام عمل'), 'سعر «يبدأ من» ومدة التنفيذ ظاهران');
  const badPrice = await api('PUT', '/products/' + bc.id, { ...P['business-cards'], reviewed: true, status: 'published', price_mode: 'fixed', price: '' });
  ok(badPrice.status === 400, 'رسالة خطأ واضحة عند سعر غير صالح: ' + badPrice.json.error);

  // 4) العروض: سارية ومنتهية
  for (const o of st.json.offers.filter((o) => ['عرض تجريبي منتهٍ', 'عرض بطاقات الأعمال'].includes(o.title))) await api('DELETE', '/offers/' + o.id);
  const t = st.json.today; const d = (n) => new Date(Date.parse(t) + n * 864e5).toISOString().slice(0, 10);
  await api('POST', '/offers', { title: 'عرض تجريبي منتهٍ', start_date: d(-20), end_date: d(-1), active: true, products: ['flyers'] });
  await api('POST', '/offers', { title: 'عرض بطاقات الأعمال', badge: 'خصم 15٪', description: 'خصم على بطاقات الأعمال بتشطيب اللمعة الموضعية.', start_date: d(-1), end_date: d(14), active: true, products: ['business-cards', 'letterhead'] });
  pg = await page('/offers');
  ok(pg.text.includes('عرض بطاقات الأعمال') && !pg.text.includes('عرض تجريبي منتهٍ'), 'العرض المنتهي مخفي والساري ظاهر');
  pg = await page('/');
  ok(pg.text.includes('العروض السارية') && !pg.text.includes('عرض تجريبي منتهٍ'), 'الرئيسية تعرض العروض السارية فقط');

  // 5) المسودة غير متاحة للزوار
  ok((await page('/product/notepads')).status === 404, 'صفحة منتج مسودة غير متاحة للزوار');
  const prev = await fetch(B + '/product/notepads', { headers: { Cookie: cookie } });
  ok(prev.status === 200 && (await prev.text()).includes('وضع المعاينة'), 'المدير يعاين المسودة');

  // 6) البحث العربي
  const sr = async (q) => (await page('/catalog?partial=1&q=' + encodeURIComponent(q))).text;
  for (const [q, must] of [['بزنس كارد', 'بطاقات الأعمال'], ['بطاقة أعمال', 'بطاقات الأعمال'], ['ستيكر', 'ملصقات ورقية'], ['ملصق', 'ملصقات فينيل'], ['استيكر فينيل', 'ملصقات فينيل'], ['رول اب', 'الرول أب'], ['منيو', 'قوائم الطعام'], ['مج', 'أكواب ومجات'], ['تيشرت', 'تيشيرتات'], ['شنطة', 'الأكياس الورقية'], ['كروت', 'بطاقات الأعمال'], ['الملصقات', 'ملصقات ورقية']]) {
    ok((await sr(q)).includes(must), `بحث «${q}» يجد «${must}»`);
  }
  ok(!(await sr('بزنس كارد')).includes('أكواب ومجات'), 'بحث «بزنس كارد» لا يعيد نتائج غير ذات صلة');

  // 7) أزرار الطلب: الرقم واسم المنتج
  pg = await page('/catalog');
  const links = [...pg.text.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const pub = (await api('GET', '/state')).json.products.filter((p) => p.status === 'published');
  const cardLinks = links.filter((l) => decodeURIComponent(l).includes('رابط المنتج'));
  ok(cardLinks.length === pub.length && cardLinks.every((l) => l.startsWith('https://wa.me/966599293545?text=')), `كل ${pub.length} منتج منشور له زر طلب على الرقم الصحيح`);
  ok(pub.every((p) => cardLinks.some((l) => decodeURIComponent(l).includes(`طلب ${p.name} من`) && decodeURIComponent(l).includes(`/product/${p.slug}`))), 'رسالة كل زر تحمل اسم المنتج ورابطه');
  const imgs = pub.map((p) => p.image && p.image.src);
  ok(imgs.every(Boolean) && new Set(imgs).size === imgs.length, 'لكل منتج منشور صورة خاصة غير مكررة');

  // تنظيف: حذف العروض والأسعار التجريبية حتى لا تظهر أسعار غير حقيقية
  const fin = (await api('GET', '/state')).json;
  for (const o of fin.offers.filter((o) => ['عرض تجريبي منتهٍ', 'عرض بطاقات الأعمال'].includes(o.title))) await api('DELETE', '/offers/' + o.id);
  for (const s of ['flyers', 'business-cards']) {
    const p = fin.products.find((x) => x.slug === s);
    await api('PUT', '/products/' + p.id, { ...p, price_mode: 'quote', price: null, price_tiers: [], gallery: [], lead_time: '' });
  }
  ok(!(await page('/product/flyers')).text.includes('١٥٠'), 'تنظيف الأسعار التجريبية');
  console.log(`\n${pass} نجح، ${failN} فشل`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
