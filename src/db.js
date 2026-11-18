// قاعدة البيانات الدائمة (SQLite محليًا / Turso في الاستضافة) + البذر الأولي
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FINISHES, CATEGORIES, PRODUCTS, USE_OVERRIDES } = require('./catalog-data');
const { productSvg } = require('./sample-images');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const SAMPLES_DIR = path.join(ROOT, 'public', 'samples');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SAMPLES_DIR, { recursive: true });

// محليًا: SQLite المدمجة في Node. في الاستضافة: Turso (نسخة محلية متزامنة مع قاعدة سحابية دائمة)
const TURSO_URL = process.env.TURSO_DATABASE_URL;
let raw;
if (TURSO_URL) {
  const Libsql = require('libsql');
  raw = new Libsql(path.join(DATA_DIR, 'replica.db'), { syncUrl: TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN, syncPeriod: 30 });
  raw.sync();
} else if (process.env.LIBSQL_LOCAL) { // لاختبار طبقة libsql محليًا فقط
  raw = new (require('libsql'))(path.join(DATA_DIR, 'libsql-test.db'));
} else {
  const { DatabaseSync } = require('node:sqlite');
  raw = new DatabaseSync(path.join(DATA_DIR, 'site.db'));
  raw.exec('PRAGMA journal_mode=WAL;');
}
// طبقة موحدة: تزيل البيانات الوصفية التي يضيفها libsql للصفوف
const clean = (r) => { if (r && typeof r === 'object' && '_metadata' in r) { const { _metadata, ...o } = r; return o; } return r; };
const db = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => { const st = raw.prepare(sql); return { get: (...a) => clean(st.get(...a)), all: (...a) => st.all(...a).map(clean), run: (...a) => st.run(...a) }; },
};
// المعاملات: محليًا BEGIN/COMMIT، وفي Turso تُنفَّذ الأوامر مباشرة على القاعدة السحابية
function tx(fn) {
  if (TURSO_URL) return fn();
  raw.exec('BEGIN');
  try { const r = fn(); raw.exec('COMMIT'); return r; } catch (e) { raw.exec('ROLLBACK'); throw e; }
}
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
  icon TEXT DEFAULT '', sort INTEGER DEFAULT 0, visible INTEGER DEFAULT 1, seo_title TEXT DEFAULT '', seo_desc TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL, short_desc TEXT DEFAULT '', description TEXT DEFAULT '', keywords TEXT DEFAULT '',
  uses TEXT DEFAULT '[]', materials TEXT DEFAULT '[]', sizes TEXT DEFAULT '[]', finishes TEXT DEFAULT '[]', quantities TEXT DEFAULT '[]',
  min_qty TEXT DEFAULT '', lead_time TEXT DEFAULT '', price_mode TEXT DEFAULT 'quote', price REAL, price_tiers TEXT DEFAULT '[]',
  image TEXT DEFAULT '', image_alt TEXT DEFAULT '', gallery TEXT DEFAULT '[]', related TEXT DEFAULT '[]',
  featured INTEGER DEFAULT 0, sort INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', reviewed INTEGER DEFAULT 0,
  seo_title TEXT DEFAULT '', seo_desc TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', badge TEXT DEFAULT '', image TEXT DEFAULT '',
  image_alt TEXT DEFAULT '', products TEXT DEFAULT '[]', start_date TEXT NOT NULL, end_date TEXT NOT NULL, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS portfolio (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', client TEXT DEFAULT '', category TEXT DEFAULT '',
  image TEXT DEFAULT '', image_alt TEXT DEFAULT '', gallery TEXT DEFAULT '[]', sort INTEGER DEFAULT 0, visible INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
`);

const JSON_FIELDS = ['uses', 'materials', 'sizes', 'finishes', 'quantities', 'price_tiers', 'gallery', 'related', 'products'];
const parseRow = (r) => {
  if (!r) return r;
  const o = { ...r };
  for (const f of JSON_FIELDS) if (f in o) { try { o[f] = JSON.parse(o[f] || '[]'); } catch { o[f] = []; } }
  if ('image' in o) { try { o.image = o.image ? JSON.parse(o.image) : null; } catch { o.image = null; } }
  return o;
};

// ---------- كلمات المرور ----------
const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  ({ salt, hash: crypto.scryptSync(String(pw), salt, 64).toString('hex') });
const verifyPassword = (pw, salt, hash) => {
  const h = crypto.scryptSync(String(pw), salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === h.length && crypto.timingSafeEqual(h, ref);
};

const DEFAULT_SETTINGS = {
  site_name: 'المتميز الراقي للدعاية والإعلان',
  site_url: '',
  hero_title: 'طباعة تليق بهويتك',
  hero_subtitle: 'من بطاقة الأعمال حتى لوحة المحل: خامات واضحة، تشطيبات فاخرة، وطلب مباشر عبر واتساب.',
  announcement: '',
  about: 'مطبعة ووكالة دعاية وإعلان تنفّذ مطبوعات الشركات والتغليف واللوحات والهدايا الدعائية بجودة تليق بعلامتك.',
  phone: '', email: '', address: '', hours: '', map_url: '', instagram: '', x: '', snapchat: '', tiktok: '',
  seo_home_title: 'المتميز الراقي للدعاية والإعلان | طباعة تليق بهويتك',
  seo_home_desc: 'كتالوج شامل لمنتجات الطباعة والدعاية: بطاقات أعمال، ملصقات، تغليف، لوحات، هدايا دعائية. اطلب مباشرة عبر واتساب.',
  seo_catalog_title: 'كتالوج المنتجات | المتميز الراقي', seo_catalog_desc: 'تصفح منتجات الطباعة والدعاية حسب القسم والاستخدام والخامة.',
  seo_offers_title: 'العروض الحالية | المتميز الراقي', seo_offers_desc: 'عروض سارية على منتجات الطباعة والدعاية.',
  seo_portfolio_title: 'معرض الأعمال | المتميز الراقي', seo_portfolio_desc: 'نماذج من مشاريع الطباعة والدعاية التي نفذناها.',
  seo_contact_title: 'تواصل معنا | المتميز الراقي', seo_contact_desc: 'تواصل مع المتميز الراقي للدعاية والإعلان عبر واتساب.',
  seo_guide_title: 'دليل الخامات والتشطيبات | المتميز الراقي', seo_guide_desc: 'تعرّف على الفرق بين المطفي واللامع والفويل واللمعة الموضعية والبروز.',
  seo_order_title: 'طلب لعدة منتجات | المتميز الراقي', seo_order_desc: 'اجمع المنتجات ومواصفاتها وأرسلها في رسالة واتساب واحدة.',
};

function seed() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k, v);

  const nCat = db.prepare('SELECT COUNT(*) n FROM categories').get().n;
  if (nCat === 0) {
    const insCat = db.prepare('INSERT INTO categories(slug,name,description,icon,sort) VALUES(?,?,?,?,?)');
    const insP = db.prepare(`INSERT INTO products(slug,category_id,name,short_desc,description,keywords,uses,materials,sizes,finishes,quantities,min_qty,lead_time,price_mode,image,image_alt,related,sort,status,reviewed,seo_title,seo_desc)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let idx = 0;
    tx(() => CATEGORIES.forEach((c, ci) => {
      const catId = Number(insCat.run(c.slug, c.name, c.description, c.icon, ci + 1).lastInsertRowid);
      (PRODUCTS[c.slug] || []).forEach((p, pi) => {
        const file = `${p.slug}.svg`;
        fs.writeFileSync(path.join(SAMPLES_DIR, file), productSvg(p.kind, p.name, idx++));
        const image = JSON.stringify({ src: `/samples/${file}`, sample: true });
        insP.run(p.slug, catId, p.name, p.desc || '', p.desc || '', p.kw || '',
          JSON.stringify(USE_OVERRIDES[p.slug] || c.uses), JSON.stringify(p.mats || []), JSON.stringify(p.sizes || []),
          JSON.stringify(p.fin || []), JSON.stringify(p.qty || []), p.min || '', '', 'quote', image,
          `${p.name} — نموذج توضيحي`, JSON.stringify(p.rel || []), pi + 1, 'draft', 0,
          `${p.name} | المتميز الراقي للدعاية والإعلان`, p.desc || '');
      });
    }));
  }

  if (!db.prepare('SELECT COUNT(*) n FROM users').get().n) {
    const username = process.env.ADMIN_USER || 'admin';
    let password = process.env.ADMIN_PASSWORD;
    if (!password && TURSO_URL) throw new Error('ضع ADMIN_PASSWORD في متغيرات البيئة قبل أول تشغيل على الاستضافة.');
    if (!password) {
      password = crypto.randomBytes(9).toString('base64url');
      fs.writeFileSync(path.join(DATA_DIR, 'admin-credentials.txt'),
        `بيانات دخول لوحة التحكم (أنشئت تلقائيًا — غيّر كلمة المرور من لوحة التحكم ثم احذف هذا الملف)\nusername: ${username}\npassword: ${password}\n`);
    }
    const { salt, hash } = hashPassword(password);
    db.prepare('INSERT INTO users(username,pass_hash,salt) VALUES(?,?,?)').run(username, hash, salt);
  }
}
seed();

// ---------- استعلامات ----------
const getSettings = () => Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map((r) => [r.key, r.value]));
const allCategories = () => db.prepare('SELECT * FROM categories ORDER BY sort, id').all();
const allProducts = () => db.prepare('SELECT * FROM products ORDER BY sort, id').all().map(parseRow);
const publishedProducts = () => db.prepare(`SELECT p.* FROM products p LEFT JOIN categories c ON c.id=p.category_id
  WHERE p.status='published' AND (c.visible IS NULL OR c.visible=1) ORDER BY c.sort, p.sort, p.id`).all().map(parseRow);
const productBySlug = (slug) => parseRow(db.prepare('SELECT * FROM products WHERE slug=?').get(slug));
const allOffers = () => db.prepare('SELECT * FROM offers ORDER BY sort, id DESC').all().map(parseRow);
const allPortfolio = () => db.prepare('SELECT * FROM portfolio ORDER BY sort, id DESC').all().map(parseRow);

// التاريخ الحالي بتوقيت الرياض
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const activeOffers = () => { const d = today(); return allOffers().filter((o) => o.active && o.start_date <= d && o.end_date >= d); };

module.exports = { db, tx, parseRow, hashPassword, verifyPassword, getSettings, allCategories, allProducts, publishedProducts, productBySlug, allOffers, activeOffers, allPortfolio, today, FINISHES, DATA_DIR, ROOT };
