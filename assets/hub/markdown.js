/**
 * Lightweight GitHub-flavored-ish markdown → safe HTML for hub descriptions.
 * Escapes raw HTML first, then applies a controlled subset (no script/style).
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(href) {
    let u = String(href || '').trim().replace(/&amp;/g, '&');
    if (!u) return '';
    if (/^www\./i.test(u)) u = `https://${u}`;
    if (/^(https?:|mailto:|tel:|\/|#)/i.test(u)) return u;
    // bare domain / path (skynes.dev, github.com/user)
    if (/^[\w.-]+\.[\w.-]+([/?#][^\s]*)?$/i.test(u) && !/\s/.test(u)) return `https://${u}`;
    return '';
  }

  function splitTrailingPunct(url) {
    const s = String(url || '');
    const m = s.match(/^(.*?)([.,;:!?…»"'”’)\]\}]+)$/);
    if (!m) return { url: s, trail: '' };
    // Keep balanced trailing ) ] } that belong to the URL path/query
    let core = m[1];
    let trail = m[2];
    while (trail && /[)\]\}]/.test(trail[0])) {
      const open = trail[0] === ')' ? '(' : trail[0] === ']' ? '[' : '{';
      const close = trail[0];
      const opens = (core.match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closes = (core.match(new RegExp(`\\${close}`, 'g')) || []).length;
      if (opens > closes) {
        core += close;
        trail = trail.slice(1);
      } else break;
    }
    return { url: core, trail };
  }

  function anchorHtml(href, label) {
    const url = safeUrl(href);
    if (!url) return null;
    const isHttp = /^https?:/i.test(url);
    const isMailTel = /^(mailto:|tel:)/i.test(url);
    if (!isHttp && !isMailTel && !url.startsWith('/') && !url.startsWith('#')) return null;
    const text = label != null ? String(label) : escapeHtml(url.replace(/^mailto:/i, '').replace(/^tel:/i, ''));
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  }

  function inlineMd(escapedText) {
    let s = String(escapedText || '');
    const held = [];
    const hold = (html) => {
      const token = `§§H${held.length}§§`;
      held.push(html);
      return token;
    };

    // Images ![alt](url)
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (full, alt, href) => {
      const url = safeUrl(href);
      if (!url || !/^https?:/i.test(url)) return full;
      return hold(`<img src="${escapeHtml(url)}" alt="${alt}" loading="lazy" />`);
    });

    // Markdown links [label](url) or [label](url "title")
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (full, label, href) => {
      const a = anchorHtml(href, label);
      return a ? hold(a) : label;
    });

    // Angle-bracket autolinks <https://…> / <mailto:…>
    s = s.replace(/&lt;((?:https?:\/\/|mailto:|tel:)[^&\s>]+)&gt;/gi, (full, href) => {
      const label = href.replace(/^mailto:/i, '').replace(/^tel:/i, '');
      const a = anchorHtml(href, escapeHtml(label));
      return a ? hold(a) : full;
    });

    // Bare URLs / www. — keep trailing punctuation outside the link
    s = s.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<&]+)/gi, (full, pre, rawUrl) => {
      const { url, trail } = splitTrailingPunct(rawUrl);
      const href = safeUrl(url);
      if (!href) return full;
      return `${pre}${hold(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`)}${trail}`;
    });

    // mailto: / tel: bare
    s = s.replace(/(^|[\s(])((?:mailto:|tel:)[^\s<&]+)/gi, (full, pre, rawUrl) => {
      const { url, trail } = splitTrailingPunct(rawUrl);
      const a = anchorHtml(url);
      return a ? `${pre}${hold(a)}${trail}` : full;
    });

    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(>])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(>])_([^_\n]+)_(?=[^\w_]|$)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    for (let i = 0; i < held.length; i += 1) {
      s = s.split(`§§H${i}§§`).join(held[i]);
    }
    return s;
  }

  function renderMarkdown(src) {
    const raw = String(src == null ? '' : src).replace(/\r\n?/g, '\n').trim();
    if (!raw) return '';

    const fences = [];
    let text = raw.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const token = `§§FENCE${fences.length}§§`;
      fences.push({
        token,
        html: `<pre class="wx-md-pre"><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`,
      });
      return `\n${token}\n`;
    });

    const codes = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      const token = `§§CODE${codes.length}§§`;
      codes.push({ token, html: `<code class="wx-md-code">${escapeHtml(code)}</code>` });
      return token;
    });

    text = escapeHtml(text);

    // Restore inline code (already escaped content)
    for (const c of codes) {
      text = text.split(escapeHtml(c.token)).join(c.html);
    }

    const lines = text.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      // Fenced code block token (escaped form of §§FENCEn§§)
      let fenceHit = null;
      for (const f of fences) {
        if (trimmed === escapeHtml(f.token)) {
          fenceHit = f;
          break;
        }
      }
      if (fenceHit) {
        out.push(fenceHit.html);
        i += 1;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        out.push('<hr />');
        i += 1;
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^&gt;\s?/.test(trimmed)) {
        const quote = [];
        while (i < lines.length && /^&gt;\s?/.test(lines[i].trim())) {
          quote.push(lines[i].trim().replace(/^&gt;\s?/, ''));
          i += 1;
        }
        out.push(`<blockquote>${inlineMd(quote.join('<br />'))}</blockquote>`);
        continue;
      }

      if (/^([-*+]|\d+\.)\s+/.test(trimmed)) {
        const ordered = /^\d+\.\s+/.test(trimmed);
        const tag = ordered ? 'ol' : 'ul';
        const items = [];
        while (i < lines.length) {
          const t = lines[i].trim();
          const m = t.match(ordered ? /^(\d+)\.\s+(.+)$/ : /^[-*+]\s+(.+)$/);
          if (!m) break;
          items.push(`<li>${inlineMd(ordered ? m[2] : m[1])}</li>`);
          i += 1;
        }
        out.push(`<${tag}>${items.join('')}</${tag}>`);
        continue;
      }

      const para = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) break;
        if (/^(#{1,6}\s|[-*+]\s|\d+\.\s|&gt;|(-{3,}|\*{3,}|_{3,})$)/.test(t)) break;
        let isFence = false;
        for (const f of fences) {
          if (t === escapeHtml(f.token)) {
            isFence = true;
            break;
          }
        }
        if (isFence) break;
        para.push(lines[i]);
        i += 1;
      }
      if (para.length) {
        out.push(`<p>${inlineMd(para.join('\n')).replace(/\n/g, '<br />')}</p>`);
      }
    }

    return out.join('\n');
  }

  global.WorkixMarkdown = { render: renderMarkdown, escapeHtml };
})(typeof window !== 'undefined' ? window : globalThis);
