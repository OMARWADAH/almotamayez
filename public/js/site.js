(function () {
  'use strict';
  var WA = 'https://wa.me/966599293545?text=';
  var KEY = 'mr_multi_order';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- تخزين الطلب المجمّع ----------
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } }
  function save(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { } updateCount(items); }
  function updateCount(items) {
    var el = $('.cart-count'); if (!el) return;
    var n = (items || load()).length; el.textContent = n; el.hidden = !n;
  }
  function addItem(item) {
    var items = load();
    items.push(item); save(items);
    toast('أُضيف «' + item.name + '» إلى الطلب المجمّع', '/order', 'عرض الطلب');
  }

  var toastTimer;
  function toast(msg, href, linkText) {
    var t = $('.toast'); if (!t) return;
    t.textContent = msg;
    if (href) { var a = document.createElement('a'); a.href = href; a.textContent = linkText; t.appendChild(a); }
    t.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  // ---------- القائمة على الجوال ----------
  var mb = $('.menu-btn'), nav = $('#main-nav');
  if (mb && nav) mb.addEventListener('click', function () {
    var open = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', open);
  });

  // ---------- زر + على البطاقات ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.add-cart');
    if (!b) return;
    addItem({ slug: b.dataset.slug, name: b.dataset.name, url: b.dataset.url, opts: {} });
    b.classList.add('added'); b.textContent = '✓';
    setTimeout(function () { b.classList.remove('added'); b.textContent = '+'; }, 1600);
  });

  // ---------- رسالة واتساب ----------
  function specLines(o, bullet) {
    var L = [], p = bullet || '';
    if (o.qty) L.push(p + 'الكمية: ' + o.qty);
    if (o.size) L.push(p + 'المقاس: ' + o.size);
    if (o.material) L.push(p + 'الخامة: ' + o.material);
    if (o.finishes && o.finishes.length) L.push(p + 'التشطيب: ' + o.finishes.join('، '));
    return L;
  }
  function productMessage(d, o) {
    var L = ['مرحبًا، أرغب في طلب ' + d.name + ' من المتميز الراقي.'];
    L = L.concat(specLines(o));
    L.push('رابط المنتج: ' + d.url);
    L.push('ممكن أعرف السعر ومدة التنفيذ؟');
    return L.join('\n');
  }

  // ---------- صفحة المنتج ----------
  var dataEl = $('#product-data'), form = $('#order-form');
  if (dataEl && form) {
    var d = JSON.parse(dataEl.textContent);
    var btn = $('#order-btn');
    var read = function () {
      var get = function (n) { var x = form.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : ''; };
      var custom = (form.querySelector('[name="qty_custom"]') || {}).value;
      return {
        size: get('size'), material: get('material'), qty: custom ? custom : get('qty'),
        finishes: $$('input[name="finish"]:checked', form).map(function (x) { return x.value; })
      };
    };
    var update = function () { btn.href = WA + encodeURIComponent(productMessage(d, read())); };
    form.addEventListener('change', function (e) {
      if (e.target.name === 'qty') { var c = form.querySelector('[name="qty_custom"]'); if (c) c.value = ''; }
      update();
    });
    form.addEventListener('input', function (e) {
      if (e.target.name === 'qty_custom' && e.target.value) $$('input[name="qty"]', form).forEach(function (r) { r.checked = false; });
      update();
    });
    update();
    var add = $('#add-multi');
    if (add) add.addEventListener('click', function () { addItem({ slug: d.slug, name: d.name, url: d.url, opts: read() }); });

    // معرض الصور
    var main = $('.g-main img');
    $$('.g-thumb').forEach(function (t) {
      t.addEventListener('click', function () {
        if (!main) return;
        main.src = t.dataset.src;
        if (t.dataset.srcset) main.srcset = t.dataset.srcset; else main.removeAttribute('srcset');
        main.alt = t.dataset.alt;
        $$('.g-thumb').forEach(function (x) { x.classList.toggle('active', x === t); });
      });
    });
  }

  // ---------- البحث المباشر في الكتالوج ----------
  var filters = $('#filters'), results = $('#results');
  if (filters && results) {
    var timer, ctrl;
    var run = function () {
      var params = new URLSearchParams(new FormData(filters));
      $$('[name]', filters).forEach(function (el) { if (!params.get(el.name)) params.delete(el.name); });
      var qs = params.toString();
      history.replaceState(null, '', '/catalog' + (qs ? '?' + qs : ''));
      params.set('partial', '1');
      if (ctrl) ctrl.abort(); ctrl = window.AbortController ? new AbortController() : null;
      fetch('/catalog?' + params.toString(), ctrl ? { signal: ctrl.signal } : {})
        .then(function (r) { return r.text(); })
        .then(function (h) { results.innerHTML = h; })
        .catch(function () { });
    };
    filters.addEventListener('input', function (e) { if (e.target.type === 'search') { clearTimeout(timer); timer = setTimeout(run, 220); } });
    filters.addEventListener('change', function (e) {
      if (e.target.name === 'cat') {
        // تغيير القسم يغيّر خيارات الاستخدام والخامة: إعادة تحميل الصفحة كاملة
        $$('select', filters).forEach(function (s) { s.value = ''; });
        var p = new URLSearchParams(new FormData(filters));
        $$('[name]', filters).forEach(function (el) { if (!p.get(el.name)) p.delete(el.name); });
        location.href = '/catalog' + (p.toString() ? '?' + p.toString() : '');
        return;
      }
      if (e.target.type !== 'search') run();
    });
    filters.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  }

  // ---------- صفحة الطلب المجمّع ----------
  var mo = $('#multi-order');
  if (mo) {
    var esc = function (s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var note = '';
    var render = function () {
      var items = load();
      if (!items.length) {
        mo.innerHTML = '<div class="empty"><p>قائمة الطلب فارغة.</p><p>اضغط «+» على أي منتج أو «أضف إلى الطلب المجمّع» من صفحة المنتج.</p><a class="btn btn-dark" href="/catalog">تصفح المنتجات</a></div>';
        return;
      }
      mo.innerHTML = items.map(function (it, i) {
        var specs = specLines(it.opts || {}).filter(function (l) { return l.indexOf('الكمية') !== 0; });
        return '<div class="mo-item"><div><h3><a href="' + esc(it.url) + '">' + (i + 1) + ') ' + esc(it.name) + '</a></h3>' +
          (specs.length ? '<ul>' + specs.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '<ul><li>بدون مواصفات محددة</li></ul>') +
          '<label class="mo-qty">الكمية <input type="text" inputmode="numeric" data-i="' + i + '" value="' + esc((it.opts || {}).qty || '') + '" placeholder="اختياري"></label></div>' +
          '<button class="mo-remove" data-i="' + i + '" aria-label="حذف ' + esc(it.name) + '">حذف</button></div>';
      }).join('') +
        '<label class="mo-note"><strong>ملاحظات إضافية (اختياري)</strong><textarea id="mo-note" placeholder="مثال: أحتاج التصميم أيضًا، أو موعد التسليم المطلوب">' + esc(note) + '</textarea></label>' +
        '<div class="mo-actions"><a class="btn btn-order btn-lg" id="mo-send" target="_blank" rel="noopener">أرسل الطلب عبر واتساب</a><button class="btn btn-outline" id="mo-clear">إفراغ القائمة</button></div>';
      updateLink();
    };
    var updateLink = function () {
      var items = load(), a = $('#mo-send'); if (!a) return;
      var L = ['مرحبًا، أرغب في طلب المنتجات التالية من المتميز الراقي:', ''];
      items.forEach(function (it, i) {
        L.push((i + 1) + ') ' + it.name);
        L = L.concat(specLines(it.opts || {}, '- '));
        L.push('- الرابط: ' + it.url); L.push('');
      });
      if (note.trim()) { L.push('ملاحظات: ' + note.trim()); L.push(''); }
      L.push('ممكن أعرف السعر ومدة التنفيذ؟');
      a.href = WA + encodeURIComponent(L.join('\n'));
    };
    mo.addEventListener('click', function (e) {
      if (e.target.classList.contains('mo-remove')) { var items = load(); items.splice(+e.target.dataset.i, 1); save(items); render(); }
      if (e.target.id === 'mo-clear') { if (confirm('إفراغ قائمة الطلب؟')) { save([]); render(); } }
    });
    mo.addEventListener('input', function (e) {
      if (e.target.dataset.i !== undefined && e.target.tagName === 'INPUT') {
        var items = load(); var it = items[+e.target.dataset.i]; if (!it) return;
        it.opts = it.opts || {}; it.opts.qty = e.target.value.trim(); save(items); updateLink();
      }
      if (e.target.id === 'mo-note') { note = e.target.value; updateLink(); }
    });
    render();
  }

  updateCount();
})();
