(function () {
  'use strict';
  var S = null; // الحالة من الخادم
  var tab = 'products';
  var pf = { q: '', status: '', cat: '' };
  var sel = new Set();
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var main = $('#a-main'), dlg = $('#dlg'), dform = $('#dlg-form');
  var ICONS = ['card', 'flyer', 'sticker', 'box', 'cup', 'rollup', 'car', 'flag', 'mug', 'photo'];
  var STATUS = { draft: 'مسودة', published: 'منشور', hidden: 'مخفي' };

  // ---------- أدوات ----------
  function toast(msg, bad) {
    var t = $('#a-toast'); t.textContent = msg; t.className = 'a-toast show' + (bad ? ' bad' : '');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = 'a-toast'; }, bad ? 6000 : 3000);
  }
  function api(method, url, body) {
    var opt = { method: method, credentials: 'same-origin', headers: {} };
    if (body instanceof FormData) opt.body = body;
    else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch('/api/admin' + url, opt).then(function (r) {
      if (r.status === 401) { location.href = '/admin/login'; throw new Error('انتهت الجلسة'); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || 'تعذّر الحفظ. حاول مرة أخرى.'); e.data = j; throw e; }
        return j;
      });
    });
  }
  function refresh() { return api('GET', '/state').then(function (j) { S = j; $('#a-user').textContent = j.user; render(); }); }
  var catName = function (id) { var c = S.categories.find(function (x) { return x.id === id; }); return c ? c.name : '—'; };
  function priceLabel(p) {
    if (p.price_mode === 'fixed' && p.price) return p.price + ' ر.س';
    if (p.price_mode === 'from' && p.price) return 'يبدأ من ' + p.price + ' ر.س';
    if (p.price_mode === 'tiers' && (p.price_tiers || []).length) return 'حسب الكمية (' + p.price_tiers.length + ')';
    return 'عرض سعر';
  }
  var field = function (label, html, hint, wide) { return '<label class="f' + (wide ? ' wide' : '') + '"><span>' + label + '</span>' + html + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; };
  var input = function (name, val, extra) { return '<input name="' + name + '" value="' + esc(val) + '" ' + (extra || '') + '>'; };
  var area = function (name, val, rows) { return '<textarea name="' + name + '" rows="' + (rows || 3) + '">' + esc(val) + '</textarea>'; };
  var check = function (name, on, label) { return '<label class="chk"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; };
  var thumb = function (img) { return img && img.src ? '<img src="' + esc(img.sm || img.src) + '" alt="" class="thumb">' : '<span class="thumb ph"></span>'; };

  // رفع صورة وإرجاع كائنها
  function uploadFile(file) {
    var fd = new FormData(); fd.append('file', file);
    toast('جارٍ رفع الصورة…');
    return api('POST', '/upload', fd).then(function (j) { toast('تم رفع الصورة'); return j.image; });
  }
  function imgPicker(key, img, label) {
    return '<div class="imgpick" data-key="' + key + '"><div class="ip-prev">' + (img && img.src ? '<img src="' + esc(img.sm || img.src) + '" alt="">' + (img.sample ? '<em>نموذج توضيحي</em>' : '') : '<span>لا توجد صورة</span>') + '</div>' +
      '<label class="a-btn small">' + (label || 'رفع صورة') + '<input type="file" accept="image/*" hidden data-upload="' + key + '"></label>' +
      (img && img.src ? ' <button type="button" class="a-btn small ghost" data-clear-img="' + key + '">إزالة</button>' : '') + '</div>';
  }

  // ---------- التبويبات ----------
  $$('.a-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      tab = b.dataset.tab;
      $$('.a-tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      render();
    });
  });
  function render() {
    ({ products: rProducts, categories: rCategories, offers: rOffers, portfolio: rPortfolio, home: rHome, seo: rSeo, account: rAccount })[tab]();
  }

  // ---------- المنتجات ----------
  function filteredProducts() {
    var q = pf.q.trim();
    return S.products.filter(function (p) {
      if (pf.status && p.status !== pf.status) return false;
      if (pf.cat && String(p.category_id) !== pf.cat) return false;
      if (q && (p.name + ' ' + p.slug + ' ' + p.keywords).indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) {
      var ca = S.categories.findIndex(function (c) { return c.id === a.category_id; }), cb = S.categories.findIndex(function (c) { return c.id === b.category_id; });
      return ca - cb || a.sort - b.sort || a.id - b.id;
    });
  }
  function rProducts() {
    var list = filteredProducts();
    var counts = { draft: 0, published: 0, hidden: 0 };
    S.products.forEach(function (p) { counts[p.status]++; });
    main.innerHTML = '<div class="a-head"><h1>المنتجات</h1><button class="a-btn primary" data-act="new-product">+ منتج جديد</button></div>' +
      '<p class="a-muted">المنشور: ' + counts.published + ' · المسودات: ' + counts.draft + ' · المخفي: ' + counts.hidden + '. النشر يتطلب صورة خاصة بالمنتج ونصًا بديلًا وتأكيد مراجعة التوفر.</p>' +
      '<div class="a-bar"><input type="search" id="pf-q" placeholder="بحث بالاسم…" value="' + esc(pf.q) + '">' +
      '<select id="pf-status"><option value="">كل الحالات</option>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (pf.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select>' +
      '<select id="pf-cat"><option value="">كل الأقسام</option>' + S.categories.map(function (c) { return '<option value="' + c.id + '"' + (pf.cat === String(c.id) ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="a-bulk"><label class="chk"><input type="checkbox" id="sel-all"> تحديد الكل (' + list.length + ')</label><span id="sel-n">' + sel.size + ' محدد</span>' +
      '<button class="a-btn small" data-bulk="review">تأكيد مراجعة التوفر</button><button class="a-btn small primary" data-bulk="publish">نشر</button>' +
      '<button class="a-btn small" data-bulk="draft">إرجاع لمسودة</button><button class="a-btn small" data-bulk="hidden">إخفاء</button>' +
      '<button class="a-btn small" data-bulk="feature">إظهار في الرئيسية</button><button class="a-btn small" data-bulk="unfeature">إزالة من الرئيسية</button></div>' +
      '<div class="a-table-wrap"><table class="a-table"><thead><tr><th></th><th></th><th>المنتج</th><th>القسم</th><th>الحالة</th><th>التوفر</th><th>السعر</th><th>الرئيسية</th><th>ترتيب</th><th></th></tr></thead><tbody>' +
      list.map(function (p) {
        return '<tr data-id="' + p.id + '"><td><input type="checkbox" class="sel" value="' + p.id + '"' + (sel.has(p.id) ? ' checked' : '') + ' aria-label="تحديد ' + esc(p.name) + '"></td>' +
          '<td>' + thumb(p.image) + '</td><td><button class="link" data-act="edit-product" data-id="' + p.id + '">' + esc(p.name) + '</button><small class="a-muted d-block" dir="ltr">/' + esc(p.slug) + '</small></td>' +
          '<td>' + esc(catName(p.category_id)) + '</td><td><span class="st st-' + p.status + '">' + STATUS[p.status] + '</span></td>' +
          '<td>' + (p.reviewed ? '<span class="ok">✓ تمت المراجعة</span>' : '<span class="a-muted">لم يُراجع</span>') + '</td>' +
          '<td>' + esc(priceLabel(p)) + '</td><td>' + (p.featured ? '★' : '') + '</td>' +
          '<td class="nowrap"><button class="a-btn icon" data-move="-1" data-id="' + p.id + '" aria-label="تحريك لأعلى">▲</button><button class="a-btn icon" data-move="1" data-id="' + p.id + '" aria-label="تحريك لأسفل">▼</button></td>' +
          '<td class="nowrap"><button class="a-btn small" data-act="edit-product" data-id="' + p.id + '">تعديل</button> <a class="a-btn small ghost" target="_blank" rel="noopener" href="/product/' + encodeURIComponent(p.slug) + '">' + (p.status === 'published' ? 'عرض' : 'معاينة') + '</a></td></tr>';
      }).join('') + '</tbody></table></div>';
    $('#pf-q').addEventListener('input', function (e) { pf.q = e.target.value; rProductsKeepFocus(); });
    $('#pf-status').addEventListener('change', function (e) { pf.status = e.target.value; render(); });
    $('#pf-cat').addEventListener('change', function (e) { pf.cat = e.target.value; render(); });
    $('#sel-all').addEventListener('change', function (e) { list.forEach(function (p) { e.target.checked ? sel.add(p.id) : sel.delete(p.id); }); render(); });
  }
  function rProductsKeepFocus() { var pos = $('#pf-q').selectionStart; render(); var q = $('#pf-q'); q.focus(); q.setSelectionRange(pos, pos); }

  function productForm(p) {
    var isNew = !p.id;
    var tiers = (p.price_tiers || []).concat([{ qty: '', price: '' }]);
    var others = S.products.filter(function (x) { return x.id !== p.id; });
    return '<div class="dlg-head"><h2>' + (isNew ? 'منتج جديد' : 'تعديل: ' + esc(p.name)) + '</h2><button type="button" class="a-btn ghost" data-close>إغلاق</button></div>' +
      '<div class="dlg-body">' +
      '<fieldset><legend>البيانات الأساسية</legend><div class="grid2">' +
      field('اسم المنتج *', input('name', p.name, 'required')) +
      field('الرابط المختصر (slug) *', input('slug', p.slug, 'required dir="ltr"'), 'يظهر في رابط الصفحة: /product/…') +
      field('القسم', '<select name="category_id">' + S.categories.map(function (c) { return '<option value="' + c.id + '"' + (c.id === p.category_id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>') +
      field('ترتيب الظهور', input('sort', p.sort || 0, 'type="number"')) +
      field('وصف مختصر', area('short_desc', p.short_desc, 2), '', true) +
      field('الوصف الكامل', area('description', p.description, 4), '', true) +
      field('كلمات بحث بديلة', input('keywords', p.keywords), 'افصل بفاصلة: بزنس كارد، كرت شخصي…', true) +
      '</div></fieldset>' +
      '<fieldset><legend>الصور</legend><div class="grid2">' +
      '<div class="f"><span>الصورة الرئيسية *</span>' + imgPicker('image', p.image) + '</div>' +
      field('النص البديل للصورة *', input('image_alt', p.image_alt), 'يصف الصورة لقارئات الشاشة ومحركات البحث') +
      '<div class="f wide"><span>معرض الصور</span><div class="gal">' + (p.gallery || []).map(function (g, i) {
        return '<div class="gal-item"><img src="' + esc(g.sm || g.src) + '" alt=""><input data-gal-alt="' + i + '" value="' + esc(g.alt || '') + '" placeholder="نص بديل"><button type="button" class="a-btn small ghost" data-gal-del="' + i + '">حذف</button></div>';
      }).join('') + '<label class="a-btn small">+ إضافة صور<input type="file" accept="image/*" multiple hidden data-gal-upload></label></div></div>' +
      '</div></fieldset>' +
      '<fieldset><legend>الخيارات والمواصفات</legend><div class="grid2">' +
      field('المقاسات', area('sizes', (p.sizes || []).join('\n'), 3), 'كل خيار في سطر') +
      field('الخامات', area('materials', (p.materials || []).join('\n'), 3), 'كل خيار في سطر — تُستخدم أيضًا في تصفية الكتالوج') +
      field('الكميات المقترحة', area('quantities', (p.quantities || []).join('\n'), 3), 'كل كمية في سطر') +
      field('الاستخدامات', area('uses', (p.uses || []).join('\n'), 3), 'للتصفية حسب الاستخدام') +
      field('الحد الأدنى للطلب', input('min_qty', p.min_qty)) +
      field('مدة التنفيذ', input('lead_time', p.lead_time), 'مثال: 3–5 أيام عمل') +
      '<div class="f wide"><span>التشطيبات المتاحة</span><div class="chks">' + S.finishes.map(function (f) { return check('fin_' + f.id, (p.finishes || []).indexOf(f.id) > -1, esc(f.name)); }).join('') + '</div></div>' +
      '</div></fieldset>' +
      '<fieldset><legend>السعر (ريال سعودي)</legend><div class="radios">' +
      [['quote', 'اطلب عرض سعر (السعر حسب المواصفات)'], ['fixed', 'سعر ثابت'], ['from', 'يبدأ من'], ['tiers', 'أسعار حسب الكمية']].map(function (m) {
        return '<label class="chk"><input type="radio" name="price_mode" value="' + m[0] + '"' + ((p.price_mode || 'quote') === m[0] ? ' checked' : '') + '> ' + m[1] + '</label>';
      }).join('') + '</div>' +
      '<div class="price-one">' + field('السعر', input('price', p.price || '', 'type="number" min="0" step="0.01" inputmode="decimal"')) + '</div>' +
      '<div class="price-tiers"><table class="a-table mini"><thead><tr><th>الكمية</th><th>السعر الإجمالي (ر.س)</th></tr></thead><tbody>' +
      tiers.map(function (t) { return '<tr><td><input data-tier-qty value="' + esc(t.qty) + '" placeholder="مثال: 500"></td><td><input data-tier-price type="number" min="0" step="0.01" value="' + esc(t.price) + '"></td></tr>'; }).join('') +
      '</tbody></table><button type="button" class="a-btn small" data-add-tier>+ صف</button></div></fieldset>' +
      '<fieldset><legend>منتجات مكملة</legend>' + field('اختر منتجات تُقترح داخل الصفحة', '<select name="related" multiple size="6">' + others.map(function (x) { return '<option value="' + esc(x.slug) + '"' + ((p.related || []).indexOf(x.slug) > -1 ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>', 'اضغط Ctrl (أو ⌘) لاختيار أكثر من منتج', true) + '</fieldset>' +
      '<fieldset><legend>الظهور ومحركات البحث</legend><div class="grid2">' +
      field('عنوان الصفحة (SEO)', input('seo_title', p.seo_title)) + field('وصف الصفحة (SEO)', area('seo_desc', p.seo_desc, 2)) +
      '</div><div class="chks">' + check('featured', p.featured, 'إظهار في الصفحة الرئيسية') + check('reviewed', p.reviewed, 'راجعت توفر هذا المنتج وتفاصيله') + '</div>' +
      field('الحالة', '<select name="status">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select>') +
      '</fieldset></div>' +
      '<div class="dlg-foot">' + (isNew ? '' : '<button type="button" class="a-btn danger" data-del-product>حذف</button>') +
      '<span class="sp"></span><button type="button" class="a-btn" data-save="preview">حفظ ومعاينة</button><button type="button" class="a-btn" data-save="draft">حفظ كمسودة</button><button type="button" class="a-btn primary" data-save="publish">حفظ ونشر</button></div>';
  }
  var editing = null;
  function openProduct(p) {
    editing = JSON.parse(JSON.stringify(p));
    dform.innerHTML = productForm(editing); dlg.showModal(); syncPriceMode();
  }
  function syncPriceMode() {
    var m = (dform.querySelector('[name="price_mode"]:checked') || {}).value;
    var one = $('.price-one', dform), tiers = $('.price-tiers', dform);
    if (one) one.hidden = !(m === 'fixed' || m === 'from');
    if (tiers) tiers.hidden = m !== 'tiers';
  }
  function collectProduct() {
    var f = dform, v = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    var lines = function (n) { return v(n).split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
    var tiers = $$('[data-tier-qty]', f).map(function (q, i) { return { qty: q.value.trim(), price: Number($$('[data-tier-price]', f)[i].value) }; }).filter(function (t) { return t.qty && t.price > 0; });
    $$('[data-gal-alt]', f).forEach(function (inp) { editing.gallery[+inp.dataset.galAlt].alt = inp.value; });
    return {
      name: v('name'), slug: v('slug'), category_id: Number(v('category_id')), sort: Number(v('sort')) || 0,
      short_desc: v('short_desc'), description: v('description'), keywords: v('keywords'),
      image: editing.image || null, image_alt: v('image_alt'), gallery: editing.gallery || [],
      sizes: lines('sizes'), materials: lines('materials'), quantities: lines('quantities'), uses: lines('uses'),
      min_qty: v('min_qty'), lead_time: v('lead_time'),
      finishes: S.finishes.filter(function (x) { return f.querySelector('[name="fin_' + x.id + '"]').checked; }).map(function (x) { return x.id; }),
      price_mode: (f.querySelector('[name="price_mode"]:checked') || {}).value || 'quote', price: v('price'), price_tiers: tiers,
      related: $$('[name="related"] option:checked', f).map(function (o) { return o.value; }),
      seo_title: v('seo_title'), seo_desc: v('seo_desc'),
      featured: f.querySelector('[name="featured"]').checked, reviewed: f.querySelector('[name="reviewed"]').checked, status: v('status'),
    };
  }
  function saveProduct(mode) {
    var data = collectProduct();
    if (mode === 'publish') data.status = 'published';
    if (mode === 'draft') data.status = 'draft';
    var previewWin = mode === 'preview' ? window.open('about:blank', '_blank') : null;
    return api(editing.id ? 'PUT' : 'POST', '/products' + (editing.id ? '/' + editing.id : ''), data).then(function (j) {
      editing = j.product;
      toast(mode === 'publish' ? 'تم الحفظ والنشر ✓' : 'تم الحفظ ✓');
      if (previewWin) previewWin.location = '/product/' + encodeURIComponent(j.product.slug);
      if (mode !== 'preview') dlg.close();
      return refresh();
    }).catch(function (e) { if (previewWin) previewWin.close(); toast(e.message, true); });
  }

  // ---------- الأقسام ----------
  function rCategories() {
    main.innerHTML = '<div class="a-head"><h1>الأقسام</h1><button class="a-btn primary" data-act="new-cat">+ قسم جديد</button></div>' +
      '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>القسم</th><th>المنتجات</th><th>الظهور</th><th>ترتيب</th><th></th></tr></thead><tbody>' +
      S.categories.map(function (c) {
        var n = S.products.filter(function (p) { return p.category_id === c.id; }).length;
        var pub = S.products.filter(function (p) { return p.category_id === c.id && p.status === 'published'; }).length;
        return '<tr><td><strong>' + esc(c.name) + '</strong><small class="a-muted d-block" dir="ltr">' + esc(c.slug) + '</small></td><td>' + pub + ' منشور / ' + n + '</td><td>' + (c.visible ? 'ظاهر' : '<span class="st st-hidden">مخفي</span>') + '</td>' +
          '<td class="nowrap"><button class="a-btn icon" data-cmove="-1" data-id="' + c.id + '" aria-label="لأعلى">▲</button><button class="a-btn icon" data-cmove="1" data-id="' + c.id + '" aria-label="لأسفل">▼</button></td>' +
          '<td><button class="a-btn small" data-act="edit-cat" data-id="' + c.id + '">تعديل</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function openCat(c) {
    editing = c;
    dform.innerHTML = '<div class="dlg-head"><h2>' + (c.id ? 'تعديل القسم' : 'قسم جديد') + '</h2><button type="button" class="a-btn ghost" data-close>إغلاق</button></div><div class="dlg-body"><div class="grid2">' +
      field('اسم القسم *', input('name', c.name)) + field('الرابط المختصر *', input('slug', c.slug, 'dir="ltr"')) +
      field('الوصف', area('description', c.description, 2), '', true) +
      field('الأيقونة', '<select name="icon">' + ICONS.map(function (i) { return '<option' + (c.icon === i ? ' selected' : '') + '>' + i + '</option>'; }).join('') + '</select>') +
      field('الترتيب', input('sort', c.sort || 0, 'type="number"')) +
      field('عنوان الصفحة (SEO)', input('seo_title', c.seo_title)) + field('وصف الصفحة (SEO)', area('seo_desc', c.seo_desc, 2)) +
      '</div>' + check('visible', c.id ? c.visible : true, 'ظاهر للزوار') + '</div>' +
      '<div class="dlg-foot">' + (c.id ? '<button type="button" class="a-btn danger" data-del-cat>حذف</button>' : '') + '<span class="sp"></span><button type="button" class="a-btn primary" data-save-cat>حفظ</button></div>';
    dlg.showModal();
  }

  // ---------- العروض ----------
  function offerState(o) { if (!o.active) return ['موقوف', 'hidden']; if (o.end_date < S.today) return ['منتهٍ (مخفي تلقائيًا)', 'hidden']; if (o.start_date > S.today) return ['قادم', 'draft']; return ['ساري', 'published']; }
  function rOffers() {
    main.innerHTML = '<div class="a-head"><h1>العروض</h1><button class="a-btn primary" data-act="new-offer">+ عرض جديد</button></div><p class="a-muted">تظهر العروض بين تاريخي البداية والنهاية فقط، وتختفي تلقائيًا بعد انتهائها (بتوقيت الرياض).</p>' +
      (S.offers.length ? '<div class="a-table-wrap"><table class="a-table"><thead><tr><th></th><th>العرض</th><th>الفترة</th><th>الحالة</th><th>المنتجات</th><th></th></tr></thead><tbody>' + S.offers.map(function (o) {
        var st = offerState(o);
        return '<tr><td>' + thumb(o.image) + '</td><td><strong>' + esc(o.title) + '</strong>' + (o.badge ? ' <span class="badge-y">' + esc(o.badge) + '</span>' : '') + '</td><td dir="ltr">' + o.start_date + ' → ' + o.end_date + '</td><td><span class="st st-' + st[1] + '">' + st[0] + '</span></td><td>' + (o.products || []).length + '</td><td><button class="a-btn small" data-act="edit-offer" data-id="' + o.id + '">تعديل</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="a-empty">لا توجد عروض بعد.</div>');
  }
  function openOffer(o) {
    editing = JSON.parse(JSON.stringify(o));
    dform.innerHTML = '<div class="dlg-head"><h2>' + (o.id ? 'تعديل العرض' : 'عرض جديد') + '</h2><button type="button" class="a-btn ghost" data-close>إغلاق</button></div><div class="dlg-body"><div class="grid2">' +
      field('عنوان العرض *', input('title', o.title)) + field('شارة مميزة', input('badge', o.badge), 'مثال: خصم 20٪') +
      field('الوصف', area('description', o.description, 3), '', true) +
      field('تاريخ البداية *', input('start_date', o.start_date || S.today, 'type="date"')) + field('تاريخ النهاية *', input('end_date', o.end_date, 'type="date"')) +
      '<div class="f"><span>صورة العرض</span>' + imgPicker('image', o.image) + '</div>' + field('النص البديل', input('image_alt', o.image_alt)) +
      field('المنتجات المشمولة', '<select name="products" multiple size="8">' + S.products.map(function (x) { return '<option value="' + esc(x.slug) + '"' + ((o.products || []).indexOf(x.slug) > -1 ? ' selected' : '') + '>' + esc(x.name) + (x.status !== 'published' ? ' (غير منشور)' : '') + '</option>'; }).join('') + '</select>', 'تظهر المنتجات المنشورة فقط للزوار', true) +
      field('الترتيب', input('sort', o.sort || 0, 'type="number"')) +
      '</div>' + check('active', o.id ? o.active : true, 'العرض مفعّل') + '</div>' +
      '<div class="dlg-foot">' + (o.id ? '<button type="button" class="a-btn danger" data-del-offer>حذف</button>' : '') + '<span class="sp"></span><button type="button" class="a-btn primary" data-save-offer>حفظ</button></div>';
    dlg.showModal();
  }

  // ---------- معرض الأعمال ----------
  function rPortfolio() {
    main.innerHTML = '<div class="a-head"><h1>معرض الأعمال</h1><button class="a-btn primary" data-act="new-pf">+ مشروع</button></div><p class="a-muted">يُعرض للزوار فقط ما ترفعه هنا ويكون ظاهرًا.</p>' +
      (S.portfolio.length ? '<div class="pf-admin">' + S.portfolio.map(function (p) {
        return '<div class="pfa"><img src="' + esc(p.image.sm || p.image.src) + '" alt=""><div><strong>' + esc(p.title) + '</strong>' + (p.visible ? '' : ' <span class="st st-hidden">مخفي</span>') + '<small class="a-muted d-block">' + esc(p.client) + '</small></div><button class="a-btn small" data-act="edit-pf" data-id="' + p.id + '">تعديل</button></div>';
      }).join('') + '</div>' : '<div class="a-empty">لم تُرفع مشاريع بعد.</div>');
  }
  function openPf(p) {
    editing = JSON.parse(JSON.stringify(p));
    dform.innerHTML = '<div class="dlg-head"><h2>' + (p.id ? 'تعديل المشروع' : 'مشروع جديد') + '</h2><button type="button" class="a-btn ghost" data-close>إغلاق</button></div><div class="dlg-body"><div class="grid2">' +
      field('عنوان المشروع *', input('title', p.title)) + field('العميل', input('client', p.client)) +
      field('النوع / القسم', input('category', p.category)) + field('الترتيب', input('sort', p.sort || 0, 'type="number"')) +
      field('الوصف', area('description', p.description, 3), '', true) +
      '<div class="f"><span>الصورة *</span>' + imgPicker('image', p.image) + '</div>' + field('النص البديل', input('image_alt', p.image_alt)) +
      '</div>' + check('visible', p.id ? p.visible : true, 'ظاهر للزوار') + '</div>' +
      '<div class="dlg-foot">' + (p.id ? '<button type="button" class="a-btn danger" data-del-pf>حذف</button>' : '') + '<span class="sp"></span><button type="button" class="a-btn primary" data-save-pf>حفظ</button></div>';
    dlg.showModal();
  }

  // ---------- الواجهة والتواصل ----------
  var heroImg = null;
  function rHome() {
    var s = S.settings; heroImg = s.hero_image ? JSON.parse(s.hero_image) : null;
    main.innerHTML = '<div class="a-head"><h1>الواجهة الرئيسية وبيانات التواصل</h1></div><form id="home-form" class="card"><div class="grid2">' +
      field('العنوان الرئيسي', input('hero_title', s.hero_title)) + field('اسم الموقع', input('site_name', s.site_name)) +
      field('النص التعريفي أسفل العنوان', area('hero_subtitle', s.hero_subtitle, 2), '', true) +
      '<div class="f"><span>صورة الواجهة (اختياري — تحل محل المشهد المرسوم)</span>' + imgPicker('hero', heroImg) + '</div>' + field('النص البديل لصورة الواجهة', input('hero_image_alt', s.hero_image_alt)) +
      field('شريط إعلان أعلى الموقع', input('announcement', s.announcement), 'اتركه فارغًا لإخفائه', true) +
      field('نبذة (تظهر في التذييل)', area('about', s.about, 2), '', true) +
      '</div><h2>بيانات التواصل</h2><p class="a-muted">رقم واتساب للطلبات ثابت: ‎+966 59 929 3545. البيانات التالية تظهر فقط عند تعبئتها.</p><div class="grid2">' +
      field('الهاتف', input('phone', s.phone, 'dir="ltr"')) + field('البريد الإلكتروني', input('email', s.email, 'dir="ltr" type="email"')) +
      field('العنوان', input('address', s.address)) + field('ساعات العمل', input('hours', s.hours), 'مثال: السبت–الخميس 9ص–10م') +
      field('رابط الخريطة', input('map_url', s.map_url, 'dir="ltr" placeholder="https://"')) + field('رابط الموقع الأساسي', input('site_url', s.site_url, 'dir="ltr" placeholder="https://example.com"'), 'يُستخدم في روابط المنتجات داخل رسائل واتساب') +
      field('إنستغرام', input('instagram', s.instagram, 'dir="ltr" placeholder="https://"')) + field('إكس', input('x', s.x, 'dir="ltr" placeholder="https://"')) +
      field('سناب شات', input('snapchat', s.snapchat, 'dir="ltr" placeholder="https://"')) + field('تيك توك', input('tiktok', s.tiktok, 'dir="ltr" placeholder="https://"')) +
      '</div><div class="dlg-foot"><span class="sp"></span><button type="button" class="a-btn primary" data-save-settings="home-form">حفظ</button></div></form>';
  }
  function rSeo() {
    var s = S.settings;
    var pages = [['home', 'الرئيسية'], ['catalog', 'الكتالوج'], ['offers', 'العروض'], ['portfolio', 'معرض الأعمال'], ['guide', 'دليل الخامات'], ['contact', 'تواصل معنا'], ['order', 'الطلب المجمّع']];
    main.innerHTML = '<div class="a-head"><h1>عناوين وأوصاف الصفحات</h1></div><p class="a-muted">عنوان ووصف كل منتج وقسم يُعدّلان من نافذة تعديله.</p><form id="seo-form" class="card">' +
      pages.map(function (p) { return '<h3>' + p[1] + '</h3><div class="grid2">' + field('العنوان', input('seo_' + p[0] + '_title', s['seo_' + p[0] + '_title'])) + field('الوصف', area('seo_' + p[0] + '_desc', s['seo_' + p[0] + '_desc'], 2)) + '</div>'; }).join('') +
      '<div class="dlg-foot"><span class="sp"></span><button type="button" class="a-btn primary" data-save-settings="seo-form">حفظ</button></div></form>';
  }
  function rAccount() {
    main.innerHTML = '<div class="a-head"><h1>الحساب</h1></div><form id="pw-form" class="card narrow">' +
      field('كلمة المرور الحالية', '<input type="password" name="current" autocomplete="current-password">') +
      field('كلمة المرور الجديدة', '<input type="password" name="next" autocomplete="new-password" minlength="10">', '10 أحرف على الأقل') +
      '<div class="dlg-foot"><span class="sp"></span><button type="button" class="a-btn primary" data-save-pw>تغيير كلمة المرور</button></div></form>';
  }

  // ---------- الأحداث ----------
  function move(list, id, dir, table) {
    var i = list.findIndex(function (x) { return x.id === id; }), j = i + dir;
    if (j < 0 || j >= list.length) return;
    var ids = list.map(function (x) { return x.id; }); var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    return api('POST', '/reorder', { table: table, ids: ids }).then(function () { toast('تم تحديث الترتيب'); return refresh(); }).catch(function (e) { toast(e.message, true); });
  }
  var val = function (form, n) { var el = form.querySelector('[name="' + n + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, [data-close]'); if (!t) return;
    var d = t.dataset, id = Number(d.id);
    if (d.close !== undefined) { dlg.close(); return; }
    if (d.act === 'new-product') openProduct({ name: '', slug: '', category_id: S.categories[0] && S.categories[0].id, status: 'draft', price_mode: 'quote', gallery: [], finishes: [], related: [] });
    if (d.act === 'edit-product') openProduct(S.products.find(function (p) { return p.id === id; }));
    if (d.act === 'new-cat') openCat({ name: '', slug: '', icon: 'card' });
    if (d.act === 'edit-cat') openCat(S.categories.find(function (c) { return c.id === id; }));
    if (d.act === 'new-offer') openOffer({ title: '', products: [] });
    if (d.act === 'edit-offer') openOffer(S.offers.find(function (o) { return o.id === id; }));
    if (d.act === 'new-pf') openPf({ title: '' });
    if (d.act === 'edit-pf') openPf(S.portfolio.find(function (p) { return p.id === id; }));
    if (d.move) {
      var p = S.products.find(function (x) { return x.id === id; });
      move(S.products.filter(function (x) { return x.category_id === p.category_id; }).sort(function (a, b) { return a.sort - b.sort || a.id - b.id; }), id, Number(d.move), 'products');
    }
    if (d.cmove) move(S.categories, id, Number(d.cmove), 'categories');
    if (d.bulk) {
      if (!sel.size) return toast('حدد منتجًا واحدًا على الأقل', true);
      api('POST', '/products/bulk', { ids: Array.from(sel), action: d.bulk }).then(function (j) {
        var msg = 'تم تنفيذ الإجراء على ' + j.done + ' منتج.';
        if (j.failed && j.failed.length) { msg += ' تعذّر ' + j.failed.length + ': ' + j.failed.slice(0, 3).map(function (f) { return '«' + f.name + '» — ' + f.errs.join(' '); }).join(' | '); toast(msg, true); }
        else toast(msg);
        sel.clear(); return refresh();
      }).catch(function (e) { toast(e.message, true); });
    }
    if (d.save) saveProduct(d.save);
    if (d.addTier !== undefined) { var tb = $('.price-tiers tbody', dform); tb.insertAdjacentHTML('beforeend', '<tr><td><input data-tier-qty placeholder="مثال: 1000"></td><td><input data-tier-price type="number" min="0" step="0.01"></td></tr>'); }
    if (d.delProduct !== undefined && confirm('حذف المنتج «' + editing.name + '» نهائيًا؟')) api('DELETE', '/products/' + editing.id).then(function () { dlg.close(); toast('تم الحذف'); refresh(); }).catch(function (e) { toast(e.message, true); });
    if (d.galDel !== undefined) { collectProduct(); editing.gallery.splice(+d.galDel, 1); rerenderProductForm(); }
    if (d.clearImg) {
      if (tab === 'home') { heroImg = null; $('.imgpick[data-key="hero"]').outerHTML = imgPicker('hero', null); }
      else { if (tab === 'products') collectProduct(); editing.image = null; $('.imgpick[data-key="image"]', dform).outerHTML = imgPicker('image', null); }
    }
    if (d.saveCat !== undefined) {
      var f = dform;
      api(editing.id ? 'PUT' : 'POST', '/categories' + (editing.id ? '/' + editing.id : ''), { name: val(f, 'name'), slug: val(f, 'slug'), description: val(f, 'description'), icon: val(f, 'icon'), sort: val(f, 'sort'), visible: val(f, 'visible'), seo_title: val(f, 'seo_title'), seo_desc: val(f, 'seo_desc') })
        .then(function () { dlg.close(); toast('تم حفظ القسم ✓'); refresh(); }).catch(function (e) { toast(e.message, true); });
    }
    if (d.delCat !== undefined && confirm('حذف القسم؟')) api('DELETE', '/categories/' + editing.id).then(function () { dlg.close(); toast('تم الحذف'); refresh(); }).catch(function (e) { toast(e.message, true); });
    if (d.saveOffer !== undefined) {
      var fo = dform;
      api(editing.id ? 'PUT' : 'POST', '/offers' + (editing.id ? '/' + editing.id : ''), { title: val(fo, 'title'), badge: val(fo, 'badge'), description: val(fo, 'description'), start_date: val(fo, 'start_date'), end_date: val(fo, 'end_date'), image: editing.image || null, image_alt: val(fo, 'image_alt'), products: $$('[name="products"] option:checked', fo).map(function (o) { return o.value; }), sort: val(fo, 'sort'), active: val(fo, 'active') })
        .then(function () { dlg.close(); toast('تم حفظ العرض ✓'); refresh(); }).catch(function (e) { toast(e.message, true); });
    }
    if (d.delOffer !== undefined && confirm('حذف العرض؟')) api('DELETE', '/offers/' + editing.id).then(function () { dlg.close(); toast('تم الحذف'); refresh(); }).catch(function (e) { toast(e.message, true); });
    if (d.savePf !== undefined) {
      var fp = dform;
      api(editing.id ? 'PUT' : 'POST', '/portfolio' + (editing.id ? '/' + editing.id : ''), { title: val(fp, 'title'), client: val(fp, 'client'), category: val(fp, 'category'), description: val(fp, 'description'), image: editing.image || null, image_alt: val(fp, 'image_alt'), sort: val(fp, 'sort'), visible: val(fp, 'visible') })
        .then(function () { dlg.close(); toast('تم حفظ المشروع ✓'); refresh(); }).catch(function (e) { toast(e.message, true); });
    }
    if (d.delPf !== undefined && confirm('حذف المشروع؟')) api('DELETE', '/portfolio/' + editing.id).then(function () { dlg.close(); toast('تم الحذف'); refresh(); }).catch(function (e) { toast(e.message, true); });
    if (d.saveSettings) {
      var fs = document.getElementById(d.saveSettings), body = {};
      $$('[name]', fs).forEach(function (el) { body[el.name] = el.value; });
      if (d.saveSettings === 'home-form') body.hero_image = heroImg;
      api('PUT', '/settings', body).then(function (j) { S.settings = j.settings; toast('تم الحفظ ✓ — حدّث صفحة الموقع لرؤية التعديل'); }).catch(function (e) { toast(e.message, true); });
    }
    if (d.savePw !== undefined) {
      var fw = $('#pw-form');
      api('POST', '/password', { current: val(fw, 'current'), next: val(fw, 'next') }).then(function () { fw.reset(); toast('تم تغيير كلمة المرور ✓'); }).catch(function (e) { toast(e.message, true); });
    }
  });
  function rerenderProductForm() { var sc = $('.dlg-body', dform).scrollTop; dform.innerHTML = productForm(editing); syncPriceMode(); $('.dlg-body', dform).scrollTop = sc; }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.classList.contains('sel')) { t.checked ? sel.add(Number(t.value)) : sel.delete(Number(t.value)); $('#sel-n').textContent = sel.size + ' محدد'; }
    if (t.name === 'price_mode') syncPriceMode();
    if (t.dataset.upload && t.files[0]) {
      var key = t.dataset.upload;
      uploadFile(t.files[0]).then(function (img) {
        if (key === 'hero') { heroImg = img; $('.imgpick[data-key="hero"]').outerHTML = imgPicker('hero', img); return; }
        if (tab === 'products') { collectProduct(); editing.image = img; rerenderProductForm(); }
        else { editing.image = img; $('.imgpick[data-key="image"]', dform).outerHTML = imgPicker('image', img); }
      }).catch(function (err) { toast(err.message, true); });
    }
    if (t.dataset.galUpload !== undefined && t.files.length) {
      collectProduct();
      Array.from(t.files).reduce(function (pr, file) {
        return pr.then(function () { return uploadFile(file).then(function (img) { img.alt = editing.name; editing.gallery.push(img); }); });
      }, Promise.resolve()).then(rerenderProductForm).catch(function (err) { toast(err.message, true); rerenderProductForm(); });
    }
  });
  dlg.addEventListener('cancel', function () { editing = null; });

  refresh().catch(function (e) { main.innerHTML = '<p class="a-err">' + esc(e.message) + '</p>'; });
})();
