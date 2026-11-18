'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
let sharp = null; try { sharp = require('sharp'); } catch { /* اختياري */ }

const D = require('./src/db');
const V = require('./src/views');
const { search } = require('./src/search');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const UPLOADS = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});
app.use('/uploads', express.static(UPLOADS, { maxAge: '365d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// ---------- الجلسات والصلاحيات ----------
const COOKIE = 'mr_sid';
const parseCookies = (h = '') => Object.fromEntries(h.split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
function currentUser(req) {
  const tok = parseCookies(req.headers.cookie)[COOKIE];
  if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return null;
  const row = D.db.prepare('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(tok, Date.now());
  return row || null;
}
const sameOrigin = (req) => {
  const src = req.get('origin') || req.get('referer');
  if (!src) return false;
  try { return new URL(src).host === req.get('host'); } catch { return false; }
};
function requireAdminApi(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'انتهت الجلسة أو لم يتم تسجيل الدخول.' });
  if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({ error: 'طلب غير مسموح.' });
  req.user = u; next();
}

const attempts = new Map();
app.get('/admin/login', (req, res) => { if (currentUser(req)) return res.redirect('/admin'); res.set('Cache-Control', 'no-store').send(V.loginPage()); });
app.post('/admin/login', (req, res) => {
  const ip = req.ip; const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60e3);
  if (a.length >= 8) return res.status(429).send(V.loginPage('محاولات كثيرة. حاول بعد 15 دقيقة.'));
  if (!sameOrigin(req)) return res.status(403).send(V.loginPage('طلب غير مسموح.'));
  const { username = '', password = '' } = req.body || {};
  const u = D.db.prepare('SELECT * FROM users WHERE username=?').get(String(username).trim());
  if (!u || !D.verifyPassword(password, u.salt, u.pass_hash)) {
    a.push(now); attempts.set(ip, a);
    return res.status(401).send(V.loginPage('اسم المستخدم أو كلمة المرور غير صحيحة.'));
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  D.db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
  D.db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').run(token, u.id, now + 7 * 864e5);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 7 * 864e5, path: '/' });
  res.redirect('/admin');
});
app.post('/admin/logout', (req, res) => {
  const tok = parseCookies(req.headers.cookie)[COOKIE];
  if (tok) D.db.prepare('DELETE FROM sessions WHERE token=?').run(tok);
  res.clearCookie(COOKIE, { path: '/' }); res.redirect('/admin/login');
});
app.get(['/admin', '/admin/'], (req, res) => {
  if (!currentUser(req)) return res.redirect('/admin/login');
  res.set('Cache-Control', 'no-store').sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ---------- سياق الصفحات العامة ----------
function ctxOf(req) {
  const settings = D.getSettings();
  const base = (settings.site_url || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const cats = D.allCategories();
  return { settings, base, path: req.path, cats, catMap: Object.fromEntries(cats.map((c) => [c.id, c.name])) };
}
const html = (res, body, code = 200) => res.status(code).set('Cache-Control', 'no-cache').type('html').send(body);

app.get('/', (req, res) => {
  const ctx = ctxOf(req);
  const pub = D.publishedProducts();
  const counts = {}; pub.forEach((p) => { counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
  html(res, V.home(ctx, {
    categories: ctx.cats.filter((c) => c.visible), featured: pub.filter((p) => p.featured).slice(0, 8),
    offers: D.activeOffers(), portfolio: D.allPortfolio().filter((p) => p.visible && p.image), counts, catMap: ctx.catMap, finishes: D.FINISHES,
  }));
});

app.get('/catalog', (req, res) => {
  const ctx = ctxOf(req);
  const q = String(req.query.q || '').slice(0, 80); const cat = String(req.query.cat || '');
  const use = String(req.query.use || ''); const mat = String(req.query.mat || '');
  const visibleCats = ctx.cats.filter((c) => c.visible);
  let list = D.publishedProducts();
  const catRow = visibleCats.find((c) => c.slug === cat);
  if (catRow) list = list.filter((p) => p.category_id === catRow.id);
  const uses = [...new Set(list.flatMap((p) => p.uses || []))].sort();
  const mats = [...new Set(list.flatMap((p) => p.materials || []))].sort();
  if (use) list = list.filter((p) => (p.uses || []).includes(use));
  if (mat) list = list.filter((p) => (p.materials || []).includes(mat));
  if (q.trim()) list = search(list, q, ctx.catMap);
  const out = V.catalog(ctx, { products: list, categories: visibleCats, catMap: ctx.catMap, q, cat: catRow ? cat : '', use, mat, uses, mats, partial: req.query.partial === '1' });
  html(res, out);
});
app.get('/category/:slug', (req, res) => res.redirect(301, `/catalog?cat=${encodeURIComponent(req.params.slug)}`));

app.get('/product/:slug', (req, res) => {
  const ctx = ctxOf(req);
  const p = D.productBySlug(req.params.slug);
  const isAdmin = !!currentUser(req);
  const preview = !!p && p.status !== 'published';
  if (!p || (preview && !isAdmin)) return html(res, V.notFound(ctx), 404);
  const cat = ctx.cats.find((c) => c.id === p.category_id);
  if (!preview && cat && !cat.visible) return html(res, V.notFound(ctx), 404);
  const pub = D.publishedProducts();
  const bySlug = Object.fromEntries(pub.map((x) => [x.slug, x]));
  let related = (p.related || []).map((s) => bySlug[s]).filter(Boolean);
  if (related.length < 3) related = related.concat(pub.filter((x) => x.category_id === p.category_id && x.id !== p.id && !related.includes(x))).slice(0, 4);
  html(res, V.productPage(ctx, { p, cat, related: related.slice(0, 4), finishes: D.FINISHES, preview }));
});

app.get('/offers', (req, res) => {
  const ctx = ctxOf(req);
  const bySlug = Object.fromEntries(D.publishedProducts().map((x) => [x.slug, x]));
  html(res, V.offersPage(ctx, { offers: D.activeOffers(), productsBySlug: bySlug, catMap: ctx.catMap }));
});
app.get('/portfolio', (req, res) => html(res, V.portfolioPage(ctxOf(req), { items: D.allPortfolio().filter((p) => p.visible && p.image) })));
app.get('/contact', (req, res) => html(res, V.contactPage(ctxOf(req))));
app.get('/order', (req, res) => html(res, V.orderPage(ctxOf(req))));
app.get('/guide', (req, res) => {
  const pub = D.publishedProducts(); const byFinish = {};
  for (const f of D.FINISHES) byFinish[f.id] = pub.filter((p) => (p.finishes || []).includes(f.id));
  html(res, V.guidePage(ctxOf(req), { finishes: D.FINISHES, byFinish }));
});
app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nDisallow: /admin\nDisallow: /api\nSitemap: ${ctxOf(req).base}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const { base } = ctxOf(req);
  const urls = ['/', '/catalog', '/offers', '/portfolio', '/guide', '/contact', ...D.publishedProducts().map((p) => `/product/${p.slug}`)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${V.esc(base + u)}</loc></url>`).join('')}</urlset>`);
});

// ---------- واجهة برمجة لوحة التحكم ----------
const api = express.Router();
api.use(requireAdminApi);

const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const arr = (v, max = 60) => (Array.isArray(v) ? v : String(v || '').split(/[\n،,]/)).map((x) => str(x, 200)).filter(Boolean).slice(0, max);
const SLUG_RE = /^[\p{L}\p{N}-]{1,80}$/u;
const IMG_RE = /^(\/(uploads|samples)\/[\w.\-]+|https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/[\w\/.,\-]+)$/;
const imgObj = (v) => {
  if (!v || typeof v !== 'object' || typeof v.src !== 'string') return null;
  if (!IMG_RE.test(v.src)) return null;
  const o = { src: v.src };
  for (const k of ['sm', 'og']) if (typeof v[k] === 'string' && IMG_RE.test(v[k])) o[k] = v[k];
  if (v.w) o.w = Number(v.w) || undefined; if (v.h) o.h = Number(v.h) || undefined;
  if (v.sample) o.sample = true;
  if (v.alt) o.alt = str(v.alt, 300);
  return o;
};
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

function cleanProduct(b) {
  const tiers = (Array.isArray(b.price_tiers) ? b.price_tiers : []).map((t) => ({ qty: str(t.qty, 40), price: Number(t.price) })).filter((t) => t.qty && t.price > 0).slice(0, 20);
  const mode = ['fixed', 'from', 'tiers', 'quote'].includes(b.price_mode) ? b.price_mode : 'quote';
  const price = b.price === '' || b.price == null ? null : Number(b.price);
  if (mode === 'fixed' || mode === 'from') { if (!(price > 0)) throw new Error('أدخل سعرًا صحيحًا بالريال أو اختر «اطلب عرض سعر».'); }
  if (mode === 'tiers' && !tiers.length) throw new Error('أضف سعرًا واحدًا على الأقل حسب الكمية.');
  const name = str(b.name, 150); if (!name) throw new Error('اسم المنتج مطلوب.');
  const slug = str(b.slug, 80).toLowerCase().replace(/\s+/g, '-'); if (!SLUG_RE.test(slug)) throw new Error('الرابط المختصر (slug) يجب أن يحتوي حروفًا وأرقامًا وشرطات فقط.');
  return {
    slug, name, category_id: Number(b.category_id) || null, short_desc: str(b.short_desc, 400), description: str(b.description, 5000), keywords: str(b.keywords, 1000),
    uses: JSON.stringify(arr(b.uses)), materials: JSON.stringify(arr(b.materials)), sizes: JSON.stringify(arr(b.sizes)),
    finishes: JSON.stringify(arr(b.finishes).filter((f) => D.FINISHES.some((x) => x.id === f))), quantities: JSON.stringify(arr(b.quantities)),
    min_qty: str(b.min_qty, 100), lead_time: str(b.lead_time, 100), price_mode: mode, price: price > 0 ? price : null, price_tiers: JSON.stringify(tiers),
    image: JSON.stringify(imgObj(b.image) || ''), image_alt: str(b.image_alt, 300), gallery: JSON.stringify((Array.isArray(b.gallery) ? b.gallery : []).map(imgObj).filter(Boolean).slice(0, 12)),
    related: JSON.stringify(arr(b.related, 12)), featured: b.featured ? 1 : 0, sort: Number(b.sort) || 0,
    status: ['draft', 'published', 'hidden'].includes(b.status) ? b.status : 'draft', reviewed: b.reviewed ? 1 : 0,
    seo_title: str(b.seo_title, 200), seo_desc: str(b.seo_desc, 400),
  };
}
function publishProblems(p, selfId) {
  const errs = [];
  const image = typeof p.image === 'string' ? (p.image ? JSON.parse(p.image) : null) : p.image;
  if (!image || !image.src) errs.push('أضف صورة المنتج قبل النشر.');
  if (!p.reviewed) errs.push('أكّد مراجعة توفر المنتج قبل النشر.');
  if (!p.image_alt) errs.push('أضف نصًا بديلًا للصورة.');
  if (image && image.src) {
    const dup = D.db.prepare(`SELECT name FROM products WHERE status='published' AND id<>? AND json_extract(image,'$.src')=?`).get(selfId || 0, image.src);
    if (dup) errs.push(`الصورة نفسها مستخدمة في منتج منشور آخر («${dup.name}»). استخدم صورة خاصة بهذا المنتج.`);
  }
  return errs;
}
const fail = (res, e, code = 400) => res.status(code).json({ error: e.message || String(e) });
const touch = (fields) => ({ ...fields, updated_at: new Date().toISOString() });
function upsert(table, id, fields) {
  const keys = Object.keys(fields);
  if (id) {
    const r = D.db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`).run(...keys.map((k) => fields[k]), id);
    if (!r.changes) throw new Error('العنصر غير موجود.');
    return id;
  }
  return Number(D.db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map((k) => fields[k])).lastInsertRowid);
}
const uniqueErr = (e) => /UNIQUE/.test(e.message) ? new Error('الرابط المختصر مستخدم مسبقًا، اختر رابطًا آخر.') : e;

api.get('/state', (req, res) => res.json({
  user: req.user.username, categories: D.allCategories(), products: D.allProducts(), offers: D.allOffers(), portfolio: D.allPortfolio(),
  settings: D.getSettings(), finishes: D.FINISHES, today: D.today(),
}));

api.post('/products', (req, res) => saveProduct(req, res, null));
api.put('/products/:id', (req, res) => saveProduct(req, res, Number(req.params.id)));
function saveProduct(req, res, id) {
  try {
    const f = cleanProduct(req.body || {});
    if (f.status === 'published') { const errs = publishProblems(f, id); if (errs.length) return res.status(422).json({ error: 'تعذّر النشر: ' + errs.join(' '), problems: errs }); }
    const newId = upsert('products', id, touch(f));
    res.json({ ok: true, product: D.parseRow(D.db.prepare('SELECT * FROM products WHERE id=?').get(newId)) });
  } catch (e) { fail(res, uniqueErr(e)); }
}
api.delete('/products/:id', (req, res) => { D.db.prepare('DELETE FROM products WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });
api.post('/products/bulk', (req, res) => {
  const { ids = [], action } = req.body || {};
  const results = { done: 0, failed: [] };
  for (const id of ids.map(Number)) {
    const p = D.db.prepare('SELECT * FROM products WHERE id=?').get(id); if (!p) continue;
    if (action === 'publish') {
      const errs = publishProblems(p, id);
      if (errs.length) { results.failed.push({ name: p.name, errs }); continue; }
      D.db.prepare("UPDATE products SET status='published', updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    } else if (action === 'draft' || action === 'hidden') D.db.prepare('UPDATE products SET status=? WHERE id=?').run(action, id);
    else if (action === 'review') D.db.prepare('UPDATE products SET reviewed=1 WHERE id=?').run(id);
    else if (action === 'feature' || action === 'unfeature') D.db.prepare('UPDATE products SET featured=? WHERE id=?').run(action === 'feature' ? 1 : 0, id);
    else return fail(res, new Error('إجراء غير معروف.'));
    results.done++;
  }
  res.json({ ok: true, ...results });
});

api.post('/categories', (req, res) => saveCategory(req, res, null));
api.put('/categories/:id', (req, res) => saveCategory(req, res, Number(req.params.id)));
function saveCategory(req, res, id) {
  try {
    const b = req.body || {};
    const name = str(b.name, 120); if (!name) throw new Error('اسم القسم مطلوب.');
    const slug = str(b.slug, 80).toLowerCase().replace(/\s+/g, '-'); if (!SLUG_RE.test(slug)) throw new Error('الرابط المختصر غير صالح.');
    const newId = upsert('categories', id, { name, slug, description: str(b.description, 400), icon: str(b.icon, 30) || 'card', sort: Number(b.sort) || 0, visible: b.visible ? 1 : 0, seo_title: str(b.seo_title, 200), seo_desc: str(b.seo_desc, 400) });
    res.json({ ok: true, id: newId });
  } catch (e) { fail(res, uniqueErr(e)); }
}
api.delete('/categories/:id', (req, res) => {
  const n = D.db.prepare('SELECT COUNT(*) n FROM products WHERE category_id=?').get(Number(req.params.id)).n;
  if (n) return fail(res, new Error(`لا يمكن حذف قسم يحتوي ${n} منتجًا. انقل المنتجات أو أخفِ القسم.`));
  D.db.prepare('DELETE FROM categories WHERE id=?').run(Number(req.params.id)); res.json({ ok: true });
});

api.post('/offers', (req, res) => saveOffer(req, res, null));
api.put('/offers/:id', (req, res) => saveOffer(req, res, Number(req.params.id)));
function saveOffer(req, res, id) {
  try {
    const b = req.body || {};
    const title = str(b.title, 150); if (!title) throw new Error('عنوان العرض مطلوب.');
    if (!isDate(b.start_date) || !isDate(b.end_date)) throw new Error('حدّد تاريخ البداية والنهاية.');
    if (b.end_date < b.start_date) throw new Error('تاريخ النهاية قبل تاريخ البداية.');
    const newId = upsert('offers', id, { title, description: str(b.description, 1000), badge: str(b.badge, 40), image: JSON.stringify(imgObj(b.image) || ''), image_alt: str(b.image_alt, 300), products: JSON.stringify(arr(b.products, 50)), start_date: b.start_date, end_date: b.end_date, sort: Number(b.sort) || 0, active: b.active ? 1 : 0 });
    res.json({ ok: true, id: newId });
  } catch (e) { fail(res, e); }
}
api.delete('/offers/:id', (req, res) => { D.db.prepare('DELETE FROM offers WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

api.post('/portfolio', (req, res) => savePf(req, res, null));
api.put('/portfolio/:id', (req, res) => savePf(req, res, Number(req.params.id)));
function savePf(req, res, id) {
  try {
    const b = req.body || {};
    const title = str(b.title, 150); if (!title) throw new Error('عنوان المشروع مطلوب.');
    const image = imgObj(b.image); if (!image) throw new Error('أضف صورة المشروع.');
    const newId = upsert('portfolio', id, { title, description: str(b.description, 1000), client: str(b.client, 120), category: str(b.category, 120), image: JSON.stringify(image), image_alt: str(b.image_alt, 300) || title, sort: Number(b.sort) || 0, visible: b.visible ? 1 : 0 });
    res.json({ ok: true, id: newId });
  } catch (e) { fail(res, e); }
}
api.delete('/portfolio/:id', (req, res) => { D.db.prepare('DELETE FROM portfolio WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

const SETTING_KEYS = ['site_name', 'site_url', 'hero_title', 'hero_subtitle', 'hero_image', 'hero_image_alt', 'announcement', 'about', 'phone', 'email', 'address', 'hours', 'map_url', 'instagram', 'x', 'snapchat', 'tiktok',
  ...['home', 'catalog', 'offers', 'portfolio', 'contact', 'guide', 'order'].flatMap((p) => [`seo_${p}_title`, `seo_${p}_desc`])];
api.put('/settings', (req, res) => {
  try {
    const b = req.body || {};
    const st = D.db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const vals = [];
    for (const k of SETTING_KEYS) if (k in b) {
      let v = b[k];
      if (k === 'hero_image') v = v ? JSON.stringify(imgObj(v) || '') : '';
      else v = str(v, 2000);
      if (['site_url', 'map_url', 'instagram', 'x', 'snapchat', 'tiktok'].includes(k) && v && !/^https?:\/\//.test(v)) return fail(res, new Error('الروابط يجب أن تبدأ بـ https://'));
      vals.push([k, v === '""' ? '' : v]);
    }
    D.tx(() => vals.forEach(([k, v]) => st.run(k, v)));
    res.json({ ok: true, settings: D.getSettings() });
  } catch (e) { fail(res, e); }
});

api.post('/reorder', (req, res) => {
  const { table, ids } = req.body || {};
  if (!['products', 'categories', 'offers', 'portfolio'].includes(table) || !Array.isArray(ids)) return fail(res, new Error('بيانات غير صالحة.'));
  const st = D.db.prepare(`UPDATE ${table} SET sort=? WHERE id=?`);
  D.tx(() => ids.forEach((id, i) => st.run(i + 1, Number(id))));
  res.json({ ok: true });
});

api.post('/password', (req, res) => {
  const { current = '', next = '' } = req.body || {};
  const u = D.db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!D.verifyPassword(current, u.salt, u.pass_hash)) return fail(res, new Error('كلمة المرور الحالية غير صحيحة.'));
  if (String(next).length < 10) return fail(res, new Error('كلمة المرور الجديدة يجب ألا تقل عن 10 أحرف.'));
  const { salt, hash } = D.hashPassword(next);
  D.db.prepare('UPDATE users SET pass_hash=?, salt=? WHERE id=?').run(hash, salt, u.id);
  const tok = parseCookies(req.headers.cookie)[COOKIE];
  D.db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(u.id, tok);
  res.json({ ok: true });
});

// Cloudinary (في الاستضافة): CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD
const CLOUD = (() => { const m = /^cloudinary:\/\/(\w+):([\w-]+)@([\w-]+)/.exec(process.env.CLOUDINARY_URL || ''); return m && { key: m[1], secret: m[2], name: m[3] }; })();
async function uploadToCloudinary(buf, id) {
  let body = buf, w, h;
  if (sharp) { const o = await sharp(buf).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true }); body = o.data; w = o.info.width; h = o.info.height; }
  const timestamp = Math.floor(Date.now() / 1000), folder = 'almotamayez';
  const signature = crypto.createHash('sha1').update(`folder=${folder}&public_id=${id}&timestamp=${timestamp}${CLOUD.secret}`).digest('hex');
  const fd = new FormData();
  fd.append('file', new Blob([body], { type: 'image/jpeg' }), id + '.jpg');
  for (const [k, v] of Object.entries({ api_key: CLOUD.key, timestamp, folder, public_id: id, signature })) fd.append(k, String(v));
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD.name}/image/upload`, { method: 'POST', body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Cloudinary upload failed');
  const base = `https://res.cloudinary.com/${CLOUD.name}/image/upload`;
  const t = (tr) => `${base}/${tr}/v${j.version}/${j.public_id}`;
  if (w && w > 1200) { h = Math.round(h * 1200 / w); w = 1200; }
  return { src: t('c_limit,w_1200,f_auto,q_auto'), sm: t('c_limit,w_480,f_auto,q_auto'), og: t('c_fill,w_1200,h_630,f_jpg,q_auto') + '.jpg', w: w || j.width, h: h || j.height };
}

// رفع الصور: نسخة كبيرة + نسخة للجوال + صورة مشاركة
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(f.mimetype)) });
api.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return fail(res, new Error('الملف غير مدعوم. ارفع صورة JPG أو PNG أو WebP بحجم أقل من 10 ميجابايت.'));
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
  try {
    if (CLOUD) return res.json({ ok: true, image: await uploadToCloudinary(req.file.buffer, id) });
    if (sharp) {
      const base = sharp(req.file.buffer, { failOn: 'error' }).rotate();
      const big = await base.clone().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      await fs.promises.writeFile(path.join(UPLOADS, `${id}-1200.webp`), big.data);
      await base.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(UPLOADS, `${id}-480.webp`));
      await base.clone().resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(path.join(UPLOADS, `${id}-og.jpg`));
      return res.json({ ok: true, image: { src: `/uploads/${id}-1200.webp`, sm: `/uploads/${id}-480.webp`, og: `/uploads/${id}-og.jpg`, w: big.info.width, h: big.info.height } });
    }
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[req.file.mimetype];
    await fs.promises.writeFile(path.join(UPLOADS, `${id}.${ext}`), req.file.buffer);
    res.json({ ok: true, image: { src: `/uploads/${id}.${ext}` } });
  } catch (e) { console.error('upload', e.message); fail(res, new Error('تعذّر رفع الصورة. تأكد أنها صورة سليمة ثم حاول مرة أخرى.')); }
});
app.use('/api/admin', api);
app.use('/api/admin', (err, req, res, next) => fail(res, err.code === 'LIMIT_FILE_SIZE' ? new Error('حجم الصورة أكبر من 10 ميجابايت.') : err));

// صور مشاركة (PNG) للصور التوضيحية
async function buildSampleOg() {
  if (!sharp) return;
  for (const p of D.allProducts()) {
    if (!p.image || !p.image.sample || p.image.og) continue;
    const svgPath = path.join(__dirname, 'public', p.image.src);
    const out = p.image.src.replace(/\.svg$/, '-og.jpg');
    try {
      if (!fs.existsSync(path.join(__dirname, 'public', out))) await sharp(svgPath, { density: 110 }).resize(1200, 630, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 80 }).toFile(path.join(__dirname, 'public', out));
      D.db.prepare('UPDATE products SET image=? WHERE id=?').run(JSON.stringify({ ...p.image, og: out }), p.id);
    } catch { /* تجاهل */ }
  }
}

app.use((req, res) => html(res, V.notFound(ctxOf(req)), 404));
app.listen(PORT, () => {
  console.log(`المتميز الراقي يعمل على http://localhost:${PORT}`);
  buildSampleOg();
});
