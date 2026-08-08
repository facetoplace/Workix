/**
 * Build & download a performer CV PDF from hub profile data.
 * Locale/labels come from opts (hub UI language). Lazy-loads html2pdf.js once;
 * filename: "{name} {slug} — workix.pdf".
 */
(function (global) {
  'use strict';

  const HTML2PDF_SRC = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js';
  const AVAIL_EN = {
    open: 'Open to work',
    working: 'Working',
    resting: 'Resting',
    ideas: 'Looking for ideas',
    busy: 'Busy',
  };
  const UI_EN = {
    about: 'About',
    skills: 'Skills',
    links: 'Links',
    rate: 'Rate',
    generated: 'Generated from workix.co',
    telegram: 'Telegram',
    email: 'Email',
    social: 'Social',
    link: 'Link',
  };
  let loadPromise = null;

  function escapeHtml(s) {
    if (global.WorkixMarkdown && typeof global.WorkixMarkdown.escapeHtml === 'function') {
      return global.WorkixMarkdown.escapeHtml(s);
    }
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMd(text) {
    const raw = String(text == null ? '' : text).trim();
    if (!raw) return '';
    if (global.WorkixMarkdown && typeof global.WorkixMarkdown.render === 'function') {
      return global.WorkixMarkdown.render(raw);
    }
    return `<p>${escapeHtml(raw).replace(/\n/g, '<br />')}</p>`;
  }

  function safeFilePart(s) {
    return String(s || '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  function performerPdfFilename(p) {
    const name = safeFilePart(p && p.name) || 'Performer';
    const slug = safeFilePart(p && p.slug);
    const base = slug ? `${name} ${slug}` : name;
    return `${base} — workix.pdf`;
  }

  function pageUrl(p) {
    if (p && p.url && String(p.url).startsWith('http')) return p.url;
    const path = (p && p.url) || (p && p.slug ? `/${p.slug}` : `/performer/${p && p.id}`);
    const rel = path.startsWith('/') ? path : `/${path}`;
    try {
      return `${location.origin}${rel}`;
    } catch (_) {
      return `https://workix.co${rel}`;
    }
  }

  function contactKindLabel(kind, labels) {
    const L = labels || UI_EN;
    const k = String(kind || '').toLowerCase();
    if (k === 'telegram') return L.telegram || 'Telegram';
    if (k === 'email') return L.email || 'Email';
    if (k === 'social') return L.social || 'Social';
    return L.link || 'Link';
  }

  function availabilityLabel(codeOrLabel, labels) {
    const raw = String(codeOrLabel || '').trim();
    if (!raw) return '';
    const key = raw.toLowerCase();
    if (labels && labels[key]) return labels[key];
    if (AVAIL_EN[key]) return AVAIL_EN[key];
    // Already a localized label from the hub UI.
    return raw;
  }

  function formatGeneratedAt(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function waitNextPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function ensureHtml2Pdf() {
    if (global.html2pdf) return Promise.resolve(global.html2pdf);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = HTML2PDF_SRC;
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      s.onload = () => {
        if (global.html2pdf) resolve(global.html2pdf);
        else reject(new Error('html2pdf failed to load'));
      };
      s.onerror = () => reject(new Error('Failed to load html2pdf.js'));
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  function buildCvElement(p, opts = {}) {
    const labels = Object.assign({}, UI_EN, AVAIL_EN, opts.labels || {});
    const locale = String(opts.locale || labels.locale || 'en');
    const name = String((p && p.name) || 'Performer').trim();
    const headline = String((p && p.headline) || '').trim();
    const bio = (p && (p.bio || p.description)) || '';
    const tags = Array.isArray(p && p.tags) ? p.tags : [];
    const skills = Array.isArray(p && p.skills) ? p.skills : tags.map((t) => t.name || t);
    const links = Array.isArray(p && p.links) ? p.links : [];
    const contacts = Array.isArray(opts.contacts) ? opts.contacts : [];
    const rate = opts.rateText || '';
    const avail = availabilityLabel(opts.availabilityCode || opts.availability || '', labels);
    const meta = [
      avail,
      (p && p.location) || '',
      Array.isArray(p && p.openTo) && p.openTo.length ? p.openTo.join(', ') : '',
    ].filter(Boolean);
    const url = pageUrl(p);
    const generatedAt = formatGeneratedAt(opts.generatedAt ? new Date(opts.generatedAt) : new Date());
    const aboutH = escapeHtml(labels.about || UI_EN.about);
    const skillsH = escapeHtml(labels.skills || UI_EN.skills);
    const linksH = escapeHtml(labels.links || UI_EN.links);
    const generated = escapeHtml(labels.generated || UI_EN.generated);

    const root = document.createElement('div');
    root.className = 'wx-cv-sheet';
    root.setAttribute('lang', locale);
    root.setAttribute('translate', 'no');
    // Inline ink colors so html2canvas clone cannot inherit hub dark-theme .wx-md strong (#f1f5f9).
    root.innerHTML = `
      <style>
        .wx-cv-sheet .wx-md, .wx-cv-sheet .wx-md p, .wx-cv-sheet .wx-md li { color: #1e293b !important; }
        .wx-cv-sheet .wx-md strong, .wx-cv-sheet .wx-md b { color: #0f172a !important; font-weight: 700 !important; }
        .wx-cv-sheet .wx-md h1, .wx-cv-sheet .wx-md h2, .wx-cv-sheet .wx-md h3,
        .wx-cv-sheet .wx-md h4, .wx-cv-sheet .wx-md h5, .wx-cv-sheet .wx-md h6 { color: #0f172a !important; }
        .wx-cv-sheet .wx-md a { color: #0284c7 !important; }
        .wx-cv-sheet .wx-md code { color: #0f172a !important; background: #f1f5f9 !important; }
        .wx-cv-sheet .wx-md ul { list-style-type: disc !important; padding-left: 1.35rem !important; }
        .wx-cv-sheet .wx-md ol { list-style-type: decimal !important; padding-left: 1.35rem !important; }
        .wx-cv-sheet .wx-md li { display: list-item !important; }
      </style>
      <div class="wx-cv-brand">Workix</div>
      <h1 class="wx-cv-name">${escapeHtml(name)}</h1>
      ${headline ? `<p class="wx-cv-headline">${escapeHtml(headline)}</p>` : ''}
      ${meta.length ? `<p class="wx-cv-meta">${escapeHtml(meta.join(' · '))}</p>` : ''}
      ${rate ? `<p class="wx-cv-rate">${escapeHtml(rate)}</p>` : ''}
      ${bio ? `<div class="wx-cv-section"><h2>${aboutH}</h2><div class="wx-md wx-cv-body">${renderMd(bio)}</div></div>` : ''}
      ${skills.length ? `<div class="wx-cv-section"><h2>${skillsH}</h2><p class="wx-cv-tags">${skills.map((s) => escapeHtml(typeof s === 'string' ? s : (s.name || ''))).filter(Boolean).map((s) => `<span>${s}</span>`).join('')}</p></div>` : ''}
      ${(links.length || contacts.length) ? `<div class="wx-cv-section"><h2>${linksH}</h2><ul class="wx-cv-links">
        ${contacts.map((c) => {
          const href = escapeHtml(c.url || '');
          if (!href) return '';
          return `<li><strong>${escapeHtml(contactKindLabel(c.kind, labels))}</strong> — <a href="${href}">${href}</a></li>`;
        }).join('')}
        ${links.map((l) => {
          const href = escapeHtml(typeof l === 'string' ? l : (l.url || ''));
          const label = escapeHtml(typeof l === 'string' ? l : (l.label || l.url || ''));
          if (!href) return '';
          return `<li><strong>${label}</strong> — <a href="${href}">${href}</a></li>`;
        }).join('')}
      </ul></div>` : ''}
      <div class="wx-cv-footer">
        <div class="wx-cv-footer-left">
          <a class="wx-cv-source" href="${escapeHtml(url)}">${escapeHtml(url)}</a>
        </div>
        <div class="wx-cv-footer-right">
          <div>${generated}</div>
          <div class="wx-cv-when">${escapeHtml(generatedAt)}</div>
        </div>
      </div>
    `;
    return root;
  }

  async function downloadPerformerPdf(p, opts = {}) {
    if (!p) throw new Error('No performer');
    const html2pdf = await ensureHtml2Pdf();
    const el = buildCvElement(p, opts);
    const host = document.createElement('div');
    host.className = 'wx-cv-pdf-host';
    host.setAttribute('aria-hidden', 'true');
    // Viewport origin only — any negative left makes html2canvas crop the left edge.
    host.style.cssText = 'position:fixed;left:0;top:0;width:794px;margin:0;padding:0;opacity:0;pointer-events:none;z-index:-1;overflow:visible;border:0;';
    el.style.cssText = 'position:relative;left:0;top:0;margin:0;transform:none;width:794px;max-width:794px;box-sizing:border-box;';
    host.appendChild(el);
    document.body.appendChild(host);

    const filename = performerPdfFilename(p);
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    try {
      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      } catch (_) { /* ignore */ }
      await waitNextPaint();

      // Pin to true (0,0) after layout — do NOT use negative scrollX (double-shift → left crop).
      const rect = el.getBoundingClientRect();
      if (Math.abs(rect.left) > 0.5 || Math.abs(rect.top) > 0.5) {
        host.style.left = `${parseFloat(host.style.left || '0') - rect.left}px`;
        host.style.top = `${parseFloat(host.style.top || '0') - rect.top}px`;
        await waitNextPaint();
      }

      await html2pdf()
        .set({
          margin: [12, 12, 14, 12],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          enableLinks: true,
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: 794,
            width: 794,
            onclone(_doc, cloned) {
              const sheet = (cloned && cloned.classList && cloned.classList.contains('wx-cv-sheet'))
                ? cloned
                : (_doc.querySelector && _doc.querySelector('.wx-cv-sheet'));
              if (sheet && sheet.style) {
                sheet.style.position = 'relative';
                sheet.style.left = '0';
                sheet.style.top = '0';
                sheet.style.margin = '0';
                sheet.style.transform = 'none';
              }
              const clonedHost = _doc.querySelector && _doc.querySelector('.wx-cv-pdf-host');
              if (clonedHost && clonedHost.style) {
                clonedHost.style.position = 'absolute';
                clonedHost.style.left = '0';
                clonedHost.style.top = '0';
                clonedHost.style.opacity = '1';
                clonedHost.style.overflow = 'visible';
              }
            },
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(el)
        .save();
      return { ok: true, filename };
    } finally {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      window.scrollTo(scrollX, scrollY);
      host.remove();
    }
  }

  global.WorkixCvPdf = {
    downloadPerformerPdf,
    performerPdfFilename,
    buildCvElement,
  };
})(typeof window !== 'undefined' ? window : globalThis);
