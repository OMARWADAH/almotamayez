// بحث عربي: توحيد الحروف + جذع خفيف + مرادفات متداولة
'use strict';

const normalize = (s) => String(s || '').toLowerCase()
  .replace(/[ً-ْٰـ]/g, '') // تشكيل وتطويل
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const stem = (w) => {
  let t = w;
  if (t.length > 4 && t.startsWith('وال')) t = t.slice(3);
  else if (t.length > 3 && (t.startsWith('ال') || t.startsWith('لل'))) t = t.slice(2);
  else if (t.length > 4 && /^[وبفك]ال/.test(t)) t = t.slice(3);
  for (const suf of ['يات', 'ات', 'ون', 'ين', 'ان', 'يه', 'ه', 'ي']) {
    if (t.length - suf.length >= 3 && t.endsWith(suf)) { t = t.slice(0, -suf.length); break; }
  }
  return t;
};

// مجموعات مرادفات: أي كلمة في المجموعة تُوسَّع لبقية المجموعة
const SYN_GROUPS = [
  ['بزنس كارد', 'بطاقه اعمال', 'بطاقات الاعمال', 'كرت شخصي', 'كروت شخصيه', 'كرت', 'كروت', 'business card'],
  ['ستيكر', 'استيكر', 'ملصق', 'ملصقات', 'لاصق', 'sticker'],
  ['ليبل', 'لابل', 'ليبلات', 'label'],
  ['فلاير', 'فلايرات', 'منشور', 'نشره', 'flyer'],
  ['بروشور', 'بروشورات', 'brochure'],
  ['منيو', 'مينيو', 'قائمه طعام', 'قوائم', 'menu'],
  ['رول اب', 'رولاب', 'رول', 'roll up'],
  ['بنر', 'بنرات', 'لافته', 'يافطه', 'banner'],
  ['مج', 'مجات', 'كوب', 'اكواب', 'كاسات', 'mug'],
  ['تيشرت', 'تيشيرت', 'تي شيرت', 'قميص', 'tshirt'],
  ['شنطه', 'شنط', 'كيس', 'اكياس', 'حقيبه', 'حقائب', 'bag'],
  ['بوكس', 'علبه', 'علب', 'box'],
  ['كرتون', 'كراتين', 'كرتونيه'],
  ['ختم', 'اختام'],
  ['كانفس', 'كانفاس', 'canvas'],
  ['دعوه', 'دعوات', 'كرت زواج', 'invitation'],
  ['تقويم', 'رزنامه', 'كلندر', 'نتيجه'],
  ['ظرف', 'اظرف', 'مظاريف'],
  ['لوحه', 'لوحات', 'sign'],
  ['qr', 'كيو ار', 'باركود'],
  ['اجنده', 'مفكره', 'دفتر', 'نوت بوك', 'نوت باد'],
];
const SYN = new Map();
for (const g of SYN_GROUPS) {
  const ng = g.map(normalize);
  for (const w of ng) SYN.set(w, ng);
}

// يعيد قائمة "مجموعات" كل مجموعة = بدائل؛ يجب أن تتطابق كل مجموعة
function parseQuery(q) {
  let nq = normalize(q);
  const groups = [];
  // العبارات متعددة الكلمات أولًا
  for (const [phrase, alts] of SYN) {
    if (phrase.includes(' ') && nq.includes(phrase)) { groups.push(alts); nq = nq.replace(phrase, ' '); }
  }
  for (const w of nq.split(' ').filter(Boolean)) {
    if (['من', 'في', 'على', 'او', 'و', 'مع'].includes(w)) continue;
    groups.push(SYN.get(w) || SYN.get(stem(w)) || [w]);
  }
  return groups;
}

function buildIndex(p, catName = '') {
  const txt = normalize([p.name, p.keywords, p.short_desc, catName, (p.materials || []).join(' '), (p.uses || []).join(' ')].join(' '));
  const words = txt.split(' ');
  return { txt, stems: words.map(stem) };
}

function matchAlt(idx, alt) {
  if (alt.includes(' ')) return idx.txt.includes(alt);
  const sa = stem(alt);
  return idx.txt.includes(alt) || idx.stems.some((s) => s.startsWith(sa) || (s.length >= 3 && sa.startsWith(s) && sa.length - s.length <= 1));
}

// ترتيب بسيط: تطابق الاسم أعلى
function search(products, q, catNameById = {}) {
  const groups = parseQuery(q);
  if (!groups.length) return products;
  const scored = [];
  for (const p of products) {
    const idx = buildIndex(p, catNameById[p.category_id]);
    if (!groups.every((alts) => alts.some((a) => matchAlt(idx, a)))) continue;
    const nameIdx = buildIndex({ name: p.name });
    const score = groups.filter((alts) => alts.some((a) => matchAlt(nameIdx, a))).length;
    scored.push([score, p]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}

module.exports = { normalize, stem, search, parseQuery };
