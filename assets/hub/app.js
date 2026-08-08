(function () {
  const { createApp, ref, computed, reactive, watch, onMounted, nextTick } = Vue;

  const FEED_PAGE = 24;
  const FEED_WINDOW = 72; // keep ~3 pages in memory
  const HUB_LOGO = '/img/logo-pwa.png';
  const HUB_BRAND = 'Workix';
  const BRAND_NAMES = {
    'workix.co': 'Workix',
    'facetoplace.app': 'FaceToPlace',
  };

  const PREF_EVENT_KEYS = ['public_contact', 'applies', 'invites', 'messages', 'digests', 'moderation'];

  function metaContent(name) {
    try {
      const el = document.querySelector(`meta[name="${name}"]`);
      return el ? String(el.content || '').trim() : '';
    } catch (_) {
      return '';
    }
  }

  function normalizePageHost(raw) {
    let h = String(raw || '').trim().toLowerCase();
    if (!h) return '';
    h = h.replace(/^https?:\/\//, '');
    h = h.split('/')[0].split('?')[0].split('#')[0];
    h = h.replace(/:\d+$/, '');
    return h;
  }

  /** work.facetoplace.app → facetoplace.app */
  function rootDomainFromHost(raw) {
    let h = normalizePageHost(raw);
    if (h.startsWith('work.')) h = h.slice(5);
    if (h.startsWith('www.')) h = h.slice(4);
    return h;
  }

  function isHubRootDomain(root) {
    const d = String(root || '').toLowerCase();
    if (!d || d === 'localhost' || d === '127.0.0.1') return true;
    return d === 'workix.co';
  }

  function brandNameForRoot(root) {
    const d = String(root || '').toLowerCase();
    if (BRAND_NAMES[d]) return BRAND_NAMES[d];
    const base = (d.split('.')[0] || d).replace(/[-_]+/g, ' ');
    if (!base) return HUB_BRAND;
    return base.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function absOnOrigin(origin, src) {
    const s = String(src || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return `https:${s}`;
    try {
      return new URL(s, origin).href;
    } catch (_) {
      return '';
    }
  }

  function isGoogleFaviconUrl(url) {
    return /google\.com\/s2\/favicons/i.test(String(url || ''));
  }

  function googleFaviconUrl(host) {
    const h = String(host || '').replace(/^www\./i, '').toLowerCase();
    if (!h) return '';
    // sz=128: real icons come back ≥32×32; missing domains stay 16×16 (globe).
    // sz=280 is broken on Google s2 — returns 16×16 even for known hosts.
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`;
  }

  /**
   * Load image; for Google s2 favicons reject the default globe (always 16×16).
   * Real icons with sz=128 come back ≥32×32.
   */
  function probeImage(url, timeoutMs = 2800, opts = {}) {
    const minSide = Number(opts.minSide) || 0;
    const rejectGoogleDefault = opts.rejectGoogleDefault !== false;
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        resolve(ok ? url : null);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      img.onload = () => {
        const w = Number(img.naturalWidth) || 0;
        const h = Number(img.naturalHeight) || 0;
        // Google default placeholder: 16×16 (same bytes for missing domains)
        if (rejectGoogleDefault && isGoogleFaviconUrl(url) && (w <= 16 || h <= 16)) {
          finish(false);
          return;
        }
        if (minSide > 0 && (w < minSide || h < minSide)) {
          finish(false);
          return;
        }
        finish(true);
      };
      img.onerror = () => finish(false);
      try { img.referrerPolicy = 'no-referrer'; } catch (_) { /* ignore */ }
      img.src = url;
    });
  }

  async function fetchWithTimeout(url, timeoutMs = 900) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!res.ok) return null;
      return res;
    } catch (_) {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchJsonLoose(url) {
    const res = await fetchWithTimeout(url);
    if (!res) return null;
    try { return await res.json(); } catch (_) { return null; }
  }

  async function fetchTextLoose(url) {
    const res = await fetchWithTimeout(url);
    if (!res) return '';
    try { return await res.text(); } catch (_) { return ''; }
  }

  function firstProbedImage(urls, timeoutMs = 2200) {
    const unique = [];
    const seen = new Set();
    for (const url of urls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      unique.push(url);
    }
    return new Promise((resolve) => {
      let left = unique.length;
      if (!left) return resolve(null);
      let settled = false;
      unique.forEach((url) => {
        probeImage(url, timeoutMs).then((ok) => {
          if (settled) return;
          if (ok) {
            settled = true;
            resolve(ok);
            return;
          }
          left -= 1;
          if (left <= 0) resolve(null);
        });
      });
    });
  }

  function iconsFromManifest(manifest, origin) {
    const icons = Array.isArray(manifest && manifest.icons) ? manifest.icons : [];
    const scored = icons.map((icon) => {
      const src = absOnOrigin(origin, icon && icon.src);
      const sizes = String((icon && icon.sizes) || '');
      let score = 0;
      const m = sizes.match(/(\d+)x(\d+)/i);
      if (m) score = Math.min(Number(m[1]), Number(m[2]));
      else if (src) score = 64;
      return { src, score };
    }).filter((x) => x.src);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((x) => x.src);
  }

  function iconsFromHtml(html, origin) {
    const out = [];
    const re = /<link\b[^>]*rel=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html))) {
      const rel = String(m[1] || '').toLowerCase();
      if (!/(apple-touch-icon|icon|shortcut icon)/.test(rel)) continue;
      const tag = m[0];
      const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
      const abs = absOnOrigin(origin, href);
      if (abs) out.push({ abs, apple: rel.includes('apple-touch-icon') });
    }
    out.sort((a, b) => Number(b.apple) - Number(a.apple));
    return out.map((x) => x.abs);
  }

  async function resolveMirrorBrand(root) {
    const overrideName = metaContent('workix-brand');
    const overrideLogo = metaContent('workix-brand-logo');
    const name = overrideName || brandNameForRoot(root);
    if (overrideLogo) {
      const ok = await probeImage(overrideLogo);
      if (ok) return { name, logo: ok, root };
    }

    const origins = [`https://${root}`, `https://www.${root}`];
    const preferred = [];
    const fallback = [];
    for (const origin of origins) {
      // Prefer real app/PWA icons over tiny favicons (favicon often wins the race otherwise)
      [
        '/img/logo/app.png',
        '/apple-touch-icon.png',
        '/apple-touch-icon-precomposed.png',
        '/apple-touch-icon-180x180.png',
        '/pwa/icon-192.png',
        '/android-chrome-192x192.png',
        '/icon-192.png',
        '/favicon-192x192.png',
        '/favicon.png',
      ].forEach((p) => preferred.push(`${origin}${p}`));
      fallback.push(`${origin}/favicon.ico`);
    }

    // Probe known paths immediately (no CORS). Discover extras from manifest/HTML in parallel.
    const discover = (async () => {
      const extra = [];
      await Promise.all(origins.map(async (origin) => {
        const manifests = await Promise.all(
          ['/pwa/manifest.json', '/manifest.webmanifest', '/manifest.json', '/site.webmanifest']
            .map((path) => fetchJsonLoose(`${origin}${path}`)),
        );
        for (const manifest of manifests) {
          if (!manifest) continue;
          iconsFromManifest(manifest, origin).forEach((u) => extra.push(u));
          break;
        }
        const html = await fetchTextLoose(`${origin}/`);
        if (html) iconsFromHtml(html, origin).forEach((u) => extra.push(u));
      }));
      return extra;
    })();

    let logo = await firstProbedImage(preferred, 2200);
    if (!logo) {
      const extra = await discover;
      logo = await firstProbedImage(extra.concat(fallback), 2200);
    }
    return { name, logo: logo || HUB_LOGO, root };
  }

  function detectSiteBrandSync() {
    const host = normalizePageHost(
      (typeof WorkixAPI !== 'undefined' && WorkixAPI.getFeatureHost && WorkixAPI.getFeatureHost())
        || location.host
        || location.hostname
        || '',
    );
    const root = rootDomainFromHost(host);
    if (isHubRootDomain(root)) {
      return { name: metaContent('workix-brand') || HUB_BRAND, logo: metaContent('workix-brand-logo') || HUB_LOGO, root: root || 'workix.co', hub: true };
    }
    return {
      name: metaContent('workix-brand') || brandNameForRoot(root),
      logo: metaContent('workix-brand-logo') || HUB_LOGO,
      root,
      hub: false,
    };
  }

  function isWeakLogoUrl(raw) {
    const u = String(raw || '').trim();
    if (!u) return true;
    return /google\.com\/s2\/favicons/i.test(u)
      || /icons\.duckduckgo\.com\/ip3/i.test(u)
      || /favicon\.yandex\./i.test(u)
      || /\/favicon\.ico(?:$|\?)/i.test(u);
  }

  function originFromSiteUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      if (!/^https?:$/i.test(u.protocol)) return '';
      return u.origin;
    } catch (_) {
      return '';
    }
  }

  /**
   * Site icon when no Logo URL: Google s2 sz=128 first (skip 16×16 globe),
   * then on-site apple-touch / manifest / common PWA paths.
   */
  async function resolveSiteIcon(siteUrl) {
    const origin = originFromSiteUrl(siteUrl);
    if (!origin) return '';
    let host = '';
    try { host = new URL(origin).hostname.replace(/^www\./i, ''); } catch (_) { host = ''; }

    if (host) {
      const fromGoogle = await probeImage(googleFaviconUrl(host), 8000, { rejectGoogleDefault: true });
      if (fromGoogle) return fromGoogle;
    }

    const preferred = [
      `${origin}/apple-touch-icon.png`,
      `${origin}/apple-touch-icon-precomposed.png`,
      `${origin}/apple-touch-icon-180x180.png`,
      `${origin}/icon-192.png`,
      `${origin}/android-chrome-192x192.png`,
      `${origin}/img/logo/app.png`,
      `${origin}/favicon.svg`,
      `${origin}/favicon.png`,
    ];

    let logo = await firstProbedImage(preferred, 2200);
    if (logo && !isWeakLogoUrl(logo)) return logo;

    const ico = await probeImage(`${origin}/favicon.ico`, 1500, { minSide: 17 });
    if (ico) return ico;

    try {
      const manifest = await fetchJsonLoose(`${origin}/manifest.json`)
        || await fetchJsonLoose(`${origin}/manifest.webmanifest`)
        || await fetchJsonLoose(`${origin}/site.webmanifest`)
        || await fetchJsonLoose(`${origin}/pwa/manifest.json`);
      if (manifest) {
        const extras = [];
        iconsFromManifest(manifest, origin).forEach((u) => {
          if (u && !isWeakLogoUrl(u)) extras.push(u);
        });
        if (extras.length) {
          const found = await firstProbedImage(extras.slice(0, 4), 2200);
          if (found && !isWeakLogoUrl(found)) return found;
        }
      }
    } catch (_) { /* ignore */ }

    return '';
  }

  function defaultPrefs() {
    return {
      email: '',
      telegram: '',
      telegramChatId: '',
      telegramLinked: false,
      channels: { email: true, telegram: true },
      events: {
        public_contact: { email: true, telegram: true },
        applies: { email: true, telegram: true },
        invites: { email: true, telegram: true },
        messages: { email: false, telegram: true },
        digests: { email: true, telegram: false },
        moderation: { email: true, telegram: true },
      },
    };
  }

  function normalizePrefsClient(raw) {
    const base = defaultPrefs();
    const p = raw && typeof raw === 'object' ? raw : {};
    const events = Object.assign({}, base.events);
    for (const key of PREF_EVENT_KEYS) {
      events[key] = Object.assign({}, base.events[key], (p.events && p.events[key]) || {});
    }
    if (!p.events && p.channels) {
      events.applies = Object.assign({}, events.applies, p.channels);
    }
    const chatId = p.telegramChatId != null ? String(p.telegramChatId) : '';
    return {
      email: p.email || '',
      telegram: p.telegram || '',
      telegramChatId: chatId,
      telegramLinked: p.telegramLinked != null ? !!p.telegramLinked : !!chatId,
      channels: {
        email: events.applies.email,
        telegram: events.applies.telegram,
      },
      events,
    };
  }

  const NotifyPrefsPanel = {
    name: 'WxNotifyPrefs',
    props: {
      prefs: { type: Object, required: true },
      t: { type: Function, required: true },
    },
    emits: ['save', 'updated', 'toast'],
    data() {
      return {
        eventKeys: PREF_EVENT_KEYS,
        tgBusy: false,
        tgWait: false,
        tgPollTimer: null,
      };
    },
    computed: {
      tgConnectLabel() {
        if (this.prefs.telegramLinked) return this.t('prefs_tg_reconnect');
        if (String(this.prefs.telegram || '').trim()) return this.t('prefs_tg_allow');
        return this.t('prefs_tg_connect');
      },
    },
    methods: {
      ensureEvents() {
        if (!this.prefs.events) this.prefs.events = defaultPrefs().events;
        for (const key of PREF_EVENT_KEYS) {
          if (!this.prefs.events[key]) this.prefs.events[key] = { email: true, telegram: true };
        }
      },
      stopTgPoll() {
        if (this.tgPollTimer) {
          clearInterval(this.tgPollTimer);
          this.tgPollTimer = null;
        }
        this.tgWait = false;
      },
      applyPrefs(next) {
        const n = normalizePrefsClient(next);
        Object.assign(this.prefs, n);
        this.prefs.telegramChatId = n.telegramChatId || '';
        this.prefs.telegramLinked = !!n.telegramLinked;
        this.prefs.telegram = n.telegram || '';
        this.prefs.events = n.events;
        this.prefs.channels = n.channels;
        this.$emit('updated', n);
      },
      async connectTelegram() {
        if (this.tgBusy) return;
        this.tgBusy = true;
        this.stopTgPoll();
        try {
          const res = await WorkixAPI.connectTelegram({
            telegram: String(this.prefs.telegram || '').trim() || undefined,
          });
          if (res && res.url) {
            window.open(res.url, '_blank', 'noopener');
          }
          this.tgWait = true;
          const started = Date.now();
          const pollOnce = async () => {
            const p = await WorkixAPI.getPrefs();
            if (p && (p.telegramLinked || p.telegramChatId)) {
              this.applyPrefs(p);
              this.stopTgPoll();
              return true;
            }
            return false;
          };
          // Immediate check (reconnect / already linked) + poll while user finishes /start
          if (await pollOnce().catch(() => false)) return;
          this.tgPollTimer = setInterval(async () => {
            if (Date.now() - started > 120000) {
              this.stopTgPoll();
              this.$emit('toast', this.t('prefs_tg_timeout'));
              return;
            }
            try { await pollOnce(); } catch (e) { /* keep polling */ }
          }, 1500);
        } catch (e) {
          this.tgWait = false;
          this.$emit('toast', (e && e.message) || this.t('error'));
        } finally {
          this.tgBusy = false;
        }
      },
      async disconnectTelegram() {
        if (this.tgBusy) return;
        this.tgBusy = true;
        try {
          this.stopTgPoll();
          const p = await WorkixAPI.disconnectTelegram();
          this.applyPrefs(p);
        } finally {
          this.tgBusy = false;
        }
      },
    },
    created() {
      this.ensureEvents();
    },
    beforeUnmount() {
      this.stopTgPoll();
    },
    template: `
      <div class="wx-notify-prefs grid gap-4">
        <div>
          <h2 class="text-base font-semibold mb-1">{{ t('prefs_contacts_title') }}</h2>
          <p class="wx-muted text-sm mb-3">{{ t('prefs_contacts_hint') }}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="text-sm">
              <span class="wx-field-label">{{ t('prefs_email') }}<span class="wx-help" tabindex="0" :data-tip="t('hint_prefs_email')">?</span></span>
              <input class="wx-input mt-1" v-model="prefs.email" />
            </label>
            <div class="text-sm">
              <label class="block">
                <span class="wx-field-label">{{ t('prefs_telegram') }}<span class="wx-help" tabindex="0" :data-tip="t('hint_prefs_telegram')">?</span></span>
                <input class="wx-input mt-1" v-model="prefs.telegram" placeholder="@username" />
              </label>
              <div class="wx-tg-bind mt-2">
                <div v-if="prefs.telegramLinked" class="wx-tg-bind-status">
                  <span class="wx-badge ok">{{ t('prefs_tg_linked') }}</span>
                  <span class="text-xs wx-muted" translate="no">{{ prefs.telegram || ('id:' + prefs.telegramChatId) }}</span>
                </div>
                <p v-else class="text-xs wx-muted mb-2">{{ t('prefs_tg_bind_hint') }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    class="wx-btn wx-btn-ghost text-sm"
                    type="button"
                    :disabled="tgBusy"
                    @click="connectTelegram"
                  >{{ tgBusy || tgWait ? t('prefs_tg_waiting') : tgConnectLabel }}</button>
                  <button
                    v-if="prefs.telegramLinked"
                    class="wx-btn wx-btn-ghost text-sm"
                    type="button"
                    :disabled="tgBusy"
                    @click="disconnectTelegram"
                  >{{ t('prefs_tg_disconnect') }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h2 class="text-base font-semibold mb-3">{{ t('prefs_matrix_title') }}</h2>
          <p v-if="!prefs.telegramLinked" class="text-xs wx-muted mb-2">{{ t('prefs_tg_matrix_hint') }}</p>
          <div class="wx-notify-matrix" role="table">
            <div class="wx-notify-matrix-row wx-notify-matrix-head" role="row">
              <div role="columnheader"></div>
              <div role="columnheader">{{ t('prefs_email') }}</div>
              <div role="columnheader">{{ t('prefs_telegram') }}</div>
            </div>
            <div v-for="key in eventKeys" :key="key" class="wx-notify-matrix-row" role="row">
              <div class="wx-notify-matrix-label" role="rowheader">{{ t('prefs_event_' + key) }}</div>
              <label class="wx-notify-matrix-cell" role="cell">
                <input type="checkbox" v-model="prefs.events[key].email" />
              </label>
              <label class="wx-notify-matrix-cell" role="cell">
                <input
                  type="checkbox"
                  v-model="prefs.events[key].telegram"
                  :disabled="!prefs.telegramLinked && key !== 'public_contact'"
                />
              </label>
            </div>
          </div>
        </div>
        <button class="wx-btn wx-btn-primary w-full sm:w-auto" type="button" @click="$emit('save')">{{ t('save') }}</button>
      </div>
    `,
  };

  const RESERVED_PATHS = new Set([
    'api', 'hub', 'new', 'legacy', 'agent', 'partners', 'cases',
    'order', 'performer', 'go', 'p', 'feed', 'rss', 'sitemap', 'robots',
    'llms', 'openapi', 'openapi-v1', 'img', 'vendor', 'css', 'js',
    'assets', 'static', 'mcp', 'catalog', 'onboarding', 'mine', 'profile',
    'prefs', 'notifications', 'auth', 'support', 'role', 'apply', 'project', 'startup',
    'index', 'favicon', 'apple-touch-icon', 'site', 'manifest', 'sw',
    'health', 'admin', 'socket.io', 'well-known',
  ]);

  function isReservedPathSegment(seg) {
    const s = String(seg || '').trim().toLowerCase();
    if (!s) return true;
    if (RESERVED_PATHS.has(s)) return true;
    if (s.includes('.')) return true;
    return false;
  }

  /** Canonical public project URL: /{slug} or /{slug}/{role} */
  function projectPath(slug, roleSlug) {
    const s = encodeURIComponent(String(slug || '').trim());
    if (!s) return '/';
    if (roleSlug) return `/${s}/${encodeURIComponent(String(roleSlug).trim())}`;
    return `/${s}`;
  }

  /** Canonical performer URL: /{slug} when set, else /performer/{id} */
  function performerPublicPath(entity) {
    const slug = String((entity && entity.slug) || '').trim().toLowerCase();
    if (slug && !isReservedPathSegment(slug)) return `/${encodeURIComponent(slug)}`;
    const id = String((entity && (entity.id || entity.performerId)) || entity || '').trim();
    if (!id) return '/';
    return `/performer/${encodeURIComponent(id)}`;
  }

  function parseRoute() {
    const path = location.pathname || '/';
    const hash = (location.hash || '').replace(/^#/, '');
    const h = hash.replace(/^\//, '');

    // App sections via hash win when present (e.g. /ai-translator → navigate to /#/mine)
    if (h === 'partners' || (/^\/partners\/?$/i.test(path) && !h)) return { name: 'partners' };
    if (h === 'cases' || (/^\/cases\/?$/i.test(path) && !h)) return { name: 'cases' };
    if (h === 'support' || (/^\/support\/?$/i.test(path) && !h)) return { name: 'support' };

    const orderPath = path.match(/^\/order\/([^/]+)\/?$/);
    if (orderPath) {
      return { name: 'order', id: decodeURIComponent(orderPath[1]) };
    }
    const performerPath = path.match(/^\/performer\/([^/]+)\/?$/);
    if (performerPath) {
      return { name: 'performer', id: decodeURIComponent(performerPath[1]) };
    }
    // Global role-by-id path (server 301s here to the canonical /{slug}/{role} on
    // first load; also used as a client-side rewrite target for bare #/role/:id hashes).
    const rolePath = path.match(/^\/role\/([^/]+)\/?$/);
    if (rolePath && !h) {
      return { name: 'role', id: decodeURIComponent(rolePath[1]) };
    }

    // Path aliases: /p/:slug[/:role], /go/:slug[/:role] (fallback), /:slug[/:role]
    const pPath = path.match(/^\/p\/([^/]+)(?:\/([^/]+))?\/?$/i);
    if (pPath && !h) {
      const role = pPath[2] ? decodeURIComponent(pPath[2]) : null;
      if (role === 'edit') return { name: 'startup-form', slug: decodeURIComponent(pPath[1]) };
      return {
        name: role ? 'go' : 'startup',
        slug: decodeURIComponent(pPath[1]),
        startupSlug: decodeURIComponent(pPath[1]),
        roleSlug: role,
      };
    }
    const goPath = path.match(/^\/go\/([^/]+)(?:\/([^/]+))?\/?$/i);
    if (goPath && !h) {
      return {
        name: 'go',
        startupSlug: decodeURIComponent(goPath[1]),
        roleSlug: goPath[2] ? decodeURIComponent(goPath[2]) : null,
        slug: decodeURIComponent(goPath[1]),
      };
    }
    const rootPath = path.match(/^\/([^/]+)(?:\/([^/]+))?\/?$/);
    if (rootPath && !h && !isReservedPathSegment(rootPath[1])) {
      const role = rootPath[2] ? decodeURIComponent(rootPath[2]) : null;
      if (role === 'edit') return { name: 'startup-form', slug: decodeURIComponent(rootPath[1]) };
      return {
        name: role ? 'go' : 'startup',
        slug: decodeURIComponent(rootPath[1]),
        startupSlug: decodeURIComponent(rootPath[1]),
        roleSlug: role,
      };
    }

    if (!h || h === 'catalog') return { name: 'catalog' };
    if (h === 'onboarding') return { name: 'onboarding' };
    if (h === 'mine') return { name: 'mine' };
    if (h === 'profile') return { name: 'profile' };
    if (h === 'prefs' || h === 'notifications') return { name: 'prefs' };
    if (h === 'auth') return { name: 'auth' };
    if (h === 'new-startup' || h === 'new-project') return { name: 'startup-form', slug: null };
    // Legacy hash routes → still parsed (canonicalizer rewrites to path)
    let m = h.match(/^(?:p|project|startup)\/([^/]+)\/edit$/);
    if (m) return { name: 'startup-form', slug: decodeURIComponent(m[1]) };
    m = h.match(/^(?:p|project|startup)\/([^/]+)$/);
    if (m) return { name: 'startup', slug: decodeURIComponent(m[1]), startupSlug: decodeURIComponent(m[1]) };
    m = h.match(/^go\/([^/]+)(?:\/([^/]+))?$/);
    if (m) {
      return {
        name: 'go',
        startupSlug: decodeURIComponent(m[1]),
        roleSlug: m[2] ? decodeURIComponent(m[2]) : null,
        slug: decodeURIComponent(m[1]),
      };
    }
    m = h.match(/^role\/([^/]+)$/);
    if (m) return { name: 'role', id: decodeURIComponent(m[1]) };
    m = h.match(/^apply\/([^/]+)$/);
    if (m) return { name: 'apply', roleId: decodeURIComponent(m[1]) };
    if (h === 'new-role' || h === 'new-order') return { name: 'role-form', startupId: null, id: null };
    m = h.match(/^new-role\/([^/]+)$/);
    if (m) return { name: 'role-form', startupId: decodeURIComponent(m[1]), id: null };
    m = h.match(/^role\/([^/]+)\/edit$/);
    if (m) return { name: 'role-form', id: decodeURIComponent(m[1]), startupId: null };
    m = h.match(/^performer\/([^/]+)$/);
    if (m) return { name: 'performer', id: decodeURIComponent(m[1]) };
    m = h.match(/^order\/([^/]+)$/);
    if (m) return { name: 'order', id: decodeURIComponent(m[1]) };
    return { name: 'catalog' };
  }

  function navigate(hashPath, replace) {
    const h = String(hashPath || '').replace(/^\//, '');
    // Path URLs for share/SEO (Telegram crawlers never see #hash)
    let url;
    const performer = h.match(/^performer\/([^/]+)$/i);
    const order = h.match(/^order\/([^/]+)$/i);
    if (!h || h === 'catalog') url = '/';
    else if (performer) {
      url = `/performer/${encodeURIComponent(decodeURIComponent(performer[1]))}`;
    } else if (order) {
      url = `/order/${encodeURIComponent(decodeURIComponent(order[1]))}`;
    } else if (h === 'support' || h === 'partners' || h === 'cases') {
      url = `/${h}`;
    } else {
      // App sections stay on hash; reset pathname so /go/slug#/catalog doesn't stick
      url = `/#/${h}`;
    }
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function navigateProject(slug, roleSlug, replace) {
    const url = projectPath(slug, roleSlug);
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  createApp({
    components: { WxNotifyPrefs: NotifyPrefsPanel },
    setup() {
      const languages = [
        { code: 'en', label: 'English', flag: 'gb' },
        { code: 'de', label: 'Deutsch', flag: 'de' },
        { code: 'hi', label: 'हिंदी', flag: 'in' },
        { code: 'fr', label: 'Français', flag: 'fr' },
        { code: 'tr', label: 'Türkçe', flag: 'tr' },
        { code: 'ru', label: 'Русский', flag: 'ru' },
        { code: 'uk', label: 'Українська', flag: 'ua' },
        { code: 'es', label: 'Español', flag: 'es' },
        { code: 'zh', label: '中文', flag: 'cn' },
        { code: 'ja', label: '日本語', flag: 'jp' },
        { code: 'ko', label: '한국어', flag: 'kr' },
      ];
      const savedLang = localStorage.getItem('workix_lang');
      const navLang = (navigator.language || navigator.languages && navigator.languages[0] || '').toLowerCase();
      const navCode = navLang.slice(0, 2);
      const savedOk = savedLang && languages.some((l) => l.code === savedLang) ? savedLang : null;
      // Browser language when supported; otherwise English — never force Russian.
      const defaultLang = savedOk
        || (languages.some((l) => l.code === navCode) ? navCode : null)
        || 'en';
      const locale = ref(defaultLang);
      const langOpen = ref(false);
      const accountOpen = ref(false);
      const notifyOpen = ref(false);
      const notifications = ref([]);
      const notifyUnread = ref(0);
      const route = ref(parseRoute());
      const loading = ref(true);
      const toast = ref('');
      const expandedBodies = reactive({});
      const BODY_EXPAND_CHARS = 420;
      function bodyKey(kind, id) {
        return `${kind}:${id == null ? '' : String(id)}`;
      }
      function bodyNeedsExpand(text) {
        const s = String(text || '').trim();
        if (!s) return false;
        if (s.length > BODY_EXPAND_CHARS) return true;
        return s.split(/\n/).length > 8;
      }
      function isBodyExpanded(key) {
        return !!expandedBodies[key];
      }
      function toggleBodyExpand(key) {
        expandedBodies[key] = !expandedBodies[key];
      }
      /** Plain text or GitHub-like markdown → sanitized HTML for detail bodies. */
      function renderMarkdown(text) {
        const raw = String(text == null ? '' : text);
        if (!raw.trim()) return '';
        const md = (typeof window !== 'undefined' ? window : globalThis).WorkixMarkdown;
        try {
          if (md && typeof md.render === 'function') {
            return md.render(raw);
          }
        } catch (e) { /* fall through */ }
        // Fallback: escape + basic autolink so bare URLs still work without markdown.js
        const esc = md && md.escapeHtml
          ? md.escapeHtml(raw)
          : raw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const linked = esc.replace(/(^|[\s(>])((?:https?:\/\/|www\.)[^\s<&]+)/gi, (full, pre, u) => {
          const href = /^www\./i.test(u) ? `https://${u}` : u;
          return `${pre}<a href="${href}" target="_blank" rel="noopener noreferrer">${u}</a>`;
        });
        return `<p>${linked.replace(/\n/g, '<br />')}</p>`;
      }
      const me = ref(null);
      const startups = ref([]);
      const roles = ref([]);
      const orders = ref([]);
      const performers = ref([]);
      const boardTags = ref([]);
      const online = ref(0);
      const mineStartups = ref([]);
      const currentStartup = ref(null);
      const currentRole = ref(null);
      const currentPerformer = ref(null);
      const performerProjects = computed(() => (currentPerformer.value && currentPerformer.value.projects) || []);
      const performerOrders = computed(() => (currentPerformer.value && currentPerformer.value.orders) || []);
      const performerRoles = computed(() => (currentPerformer.value && currentPerformer.value.roles) || []);
      const currentOrder = ref(null);
      const routeError = ref(null);
      const carousel = ref([]);
      const profile = ref({
        name: '', headline: '', bio: '', skills: [], links: [], location: '', openTo: [],
        availability: 'open',
        telegram: '', portfolio: '', github: '', cv: '',
        payment: { budget: '', type: 'work', cur: 'USDT' },
        displayCurrency: 'USDT',
      });
      const availabilityOptions = ['open', 'working', 'resting', 'ideas', 'busy'];
      /** Listing lifecycle in the form: active = live (API: approved). */
      const listingStageOptions = ['draft', 'pending', 'active', 'closed', 'frozen'];
      /** Product / funding stage (projects). */
      const projectStageOptions = [
        'idea', 'stealth', 'preseed', 'seed', 'mvp', 'early',
        'growth', 'scale', 'mature', 'project',
      ];
      const PENDING_FORM_KEY = 'workix_pending_form';
      const profileLinksText = ref('');
      const prefs = ref(defaultPrefs());
      const q = ref('');
      const onceKey = ref('');
      const keyDraft = ref('');
      const keyRotating = ref(false);
      const importText = ref('');
      const feed = ref((() => {
        // One-time home switch: Projects is the default main feed now
        if (!localStorage.getItem('workix_feed_home_v2')) {
          localStorage.setItem('workix_feed', 'projects');
          localStorage.setItem('workix_feed_home_v2', '1');
        }
        const saved = localStorage.getItem('workix_feed');
        if (saved === 'projects' || saved === 'performers' || saved === 'orders') return saved;
        return 'projects';
      })());

      const hubCases = computed(() => {
        const stories = typeof WorkixStories !== 'undefined' ? WorkixStories : null;
        const rows = (stories && stories.CASES) || [];
        const ru = locale.value === 'ru';
        return rows.map((c) => ({
          id: c.id,
          title: ru ? (c.titleRu || c.titleEn) : (c.titleEn || c.titleRu),
          summary: ru ? (c.summaryRu || c.summaryEn) : (c.summaryEn || c.summaryRu),
          outcome: ru ? (c.outcomeRu || c.outcomeEn) : (c.outcomeEn || c.outcomeRu),
          link: c.link || '',
          tags: c.tags || [],
        }));
      });

      const hubPartners = computed(() => {
        const stories = typeof WorkixStories !== 'undefined' ? WorkixStories : null;
        const rows = (stories && stories.PARTNERS) || [];
        const ru = locale.value === 'ru';
        return rows.map((p) => ({
          id: p.id,
          title: ru ? (p.titleRu || p.titleEn) : (p.titleEn || p.titleRu),
          blurb: ru ? (p.blurbRu || p.blurbEn) : (p.blurbEn || p.blurbRu),
          href: p.href || '#',
          kind: p.kind || 'link',
        }));
      });
      const sloganIndex = ref(0);
      const sloganTick = ref(0);
      const prevSlogan = ref('');
      const siteBrand = ref(detectSiteBrandSync());
      const pwaCanInstall = ref(false);
      let deferredPwaPrompt = null;
      const displayCurrency = ref(localStorage.getItem('workix_display_cur') || 'USDT');
      const fxRates = reactive({});
      const appVersion = (() => {
        // Same source as legacy: <!-- Works Version x.y.z --> before <!DOCTYPE>
        try {
          const fromDom = document.body?.parentElement?.previousSibling?.previousSibling?.data;
          if (fromDom) {
            const part = String(fromDom).trim().split(/\s+/)[3];
            if (part) return part;
          }
        } catch (_) { /* fall through */ }
        try {
          for (const n of document.childNodes) {
            if (n.nodeType === 8 && /Works\s+Version/i.test(n.data || '')) {
              const m = String(n.data).match(/Works\s+Version\s+([\d.]+)/i);
              if (m) return m[1];
            }
          }
        } catch (_) { /* fall through */ }
        return '1.2.11';
      })();
      const footerYear = new Date().getFullYear();
      const apiMeta = computed(() => WorkixAPI.getState());
      const authStore = computed(() => WorkixAuth.get());

      const filters = reactive({
        types: {
          task: true,
          project: true,
          time_job: true,
          full_job: true,
          fixes: true,
          idea: true,
          early: true,
          growth: true,
        },
        tagsOn: ['all'],
        openTo: [],
        priceFrom: null,
      });

      const formStartup = reactive({
        name: '', slug: '', url: '', github: '', logo: '', description: '', tags: '',
        linksText: '',
        applyDefaults: { apply_url: '', apply_email: '', apply_telegram: '' },
        stage: 'early',
        status: 'pending',
      });
      const formRole = reactive({
        startupId: '', title: '', slug: '', description: '', tags: '',
        kind: 'task', project: '',
        payment: { budget: '', type: 'work', cur: 'USDT' },
        apply_url: '', apply_email: '', apply_telegram: '', linksText: '', status: 'pending',
      });

      /** One line: Label | https://url | kind — kind optional */
      function linksToText(links) {
        return (Array.isArray(links) ? links : [])
          .map((l) => {
            if (typeof l === 'string') return l;
            const label = (l && l.label) || '';
            const url = (l && (l.url || l.href)) || '';
            const kind = (l && l.kind) || '';
            if (!url) return '';
            if (kind && kind !== 'link') return `${label} | ${url} | ${kind}`;
            if (label) return `${label} | ${url}`;
            return url;
          })
          .filter(Boolean)
          .join('\n');
      }

      function parseLinksText(text) {
        return String(text || '')
          .split(/\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const parts = line.split('|').map((x) => x.trim()).filter(Boolean);
            if (parts.length >= 3) return { label: parts[0], url: parts[1], kind: parts[2] };
            if (parts.length === 2) {
              if (/^https?:\/\//i.test(parts[0]) || parts[0].includes('.')) {
                return { label: parts[1], url: parts[0] };
              }
              return { label: parts[0], url: parts[1] };
            }
            return { url: parts[0] };
          });
      }

      /** Tags/skills: accept comma, semicolon, or pipe as separators. */
      function splitTagList(raw) {
        const list = Array.isArray(raw) ? raw : [raw];
        const out = [];
        const seen = new Set();
        for (const item of list) {
          for (const part of String(item == null ? '' : item).split(/[,;|/]+/)) {
            const name = part.trim().replace(/\s+/g, ' ');
            if (!name) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(name);
          }
        }
        return out.slice(0, 40);
      }
      const formApply = reactive({
        name: '',
        contact: '',
        Interesity: null,
        Difficulty: null,
        Understandability: null,
        Budget: '',
        Currency: 'USDT',
        Time: null,
        Description: '',
        score: null,
      });
      const applySaving = ref(false);
      const formSupport = reactive({ contact: '', message: '' });
      const supportSending = ref(false);
      const formProposal = reactive({
        Interesity: null,
        Difficulty: null,
        Understandability: null,
        Budget: '',
        Currency: 'USDT',
        Time: null,
        Description: '',
        score: null,
      });
      const proposalSaving = ref(false);
      const walletChains = ['TON', 'USDT', 'ETH'];
      const proposalCurrencies = ['USDT', 'USD', 'TON', 'ETH'];
      const payCurrencies = ['USDT', 'USD', 'RUB', 'CNY', 'GBP', 'UAH', 'EUR', 'TON'];
      const taskKinds = ['task', 'project', 'time_job', 'full_job', 'fixes'];

      async function applySiteBrand() {
        const sync = detectSiteBrandSync();
        siteBrand.value = sync;
        if (sync.hub) return;
        try {
          const resolved = await resolveMirrorBrand(sync.root);
          siteBrand.value = {
            name: resolved.name || sync.name,
            logo: resolved.logo || sync.logo,
            root: sync.root,
            hub: false,
          };
          try {
            const title = document.title || '';
            if (title && /Workix/i.test(title) && siteBrand.value.name && siteBrand.value.name !== HUB_BRAND) {
              document.title = title.replace(/Workix/gi, siteBrand.value.name);
            }
            const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (apple) apple.setAttribute('content', siteBrand.value.name);
          } catch (_) { /* ignore */ }
        } catch (_) {
          /* keep sync brand */
        }
      }

      function t(key) {
        return WorkixI18n.t(locale.value, key);
      }

      const slogans = computed(() => [
        t('slogan_1'),
        t('slogan_2'),
        t('slogan_3'),
        t('slogan_4'),
      ].map((s) => String(s || '').trim()).filter(Boolean));

      const currentSlogan = computed(() => {
        const list = slogans.value;
        if (!list.length) return '';
        return list[sloganIndex.value % list.length] || list[0];
      });

      function advanceSlogan() {
        const list = slogans.value;
        if (list.length < 2) return;
        prevSlogan.value = currentSlogan.value;
        sloganIndex.value = (sloganIndex.value + 1) % list.length;
        const tick = sloganTick.value + 1;
        sloganTick.value = tick;
        setTimeout(() => {
          if (sloganTick.value === tick) prevSlogan.value = '';
        }, 420);
      }

      watch(locale, () => {
        sloganIndex.value = 0;
        sloganTick.value += 1;
        prevSlogan.value = '';
      });

      const feedTitle = computed(() => {
        if (feed.value === 'orders') return t('feed_title_orders');
        if (feed.value === 'performers') return t('feed_title_performers');
        return t('feed_title_projects');
      });

      const feedSearchPlaceholder = computed(() => {
        if (feed.value === 'orders') return t('search_orders');
        if (feed.value === 'performers') return t('search_performers');
        return t('search_projects');
      });

      const orderTypeOptions = [
        { id: 'task', labelKey: 'type_task' },
        { id: 'project', labelKey: 'type_project' },
        { id: 'time_job', labelKey: 'type_time_job' },
        { id: 'full_job', labelKey: 'type_full_job' },
        { id: 'fixes', labelKey: 'type_fixes' },
      ];
      const projectTypeOptions = [
        { id: 'idea', labelKey: 'type_idea' },
        { id: 'stealth', labelKey: 'type_stealth' },
        { id: 'preseed', labelKey: 'type_preseed' },
        { id: 'seed', labelKey: 'type_seed' },
        { id: 'mvp', labelKey: 'type_mvp' },
        { id: 'early', labelKey: 'type_early' },
        { id: 'growth', labelKey: 'type_growth' },
        { id: 'scale', labelKey: 'type_scale' },
        { id: 'mature', labelKey: 'type_mature' },
        { id: 'project', labelKey: 'type_project' },
      ];
      const feedTypeOptions = computed(() => (
        feed.value === 'orders' ? orderTypeOptions : projectTypeOptions
      ));

      const openToOptions = computed(() => {
        const set = new Set();
        performers.value.forEach((p) => (p.openTo || []).forEach((x) => set.add(x)));
        return [...set].sort();
      });

      function rolesForStartup(st) {
        return roles.value.filter((r) => r.startupId === st.id || r.startupSlug === st.slug);
      }

      const availableTags = computed(() => {
        if (boardTags.value.length && (feed.value === 'orders' || feed.value === 'performers')) {
          return boardTags.value;
        }
        // Fallback: derive string tags from loaded cards
        const set = new Map();
        if (feed.value === 'projects') {
          startups.value.forEach((st) => {
            rolesForStartup(st).forEach((r) => (r.tags || []).forEach((x) => {
              const name = typeof x === 'string' ? x : x.name;
              const id = typeof x === 'string' ? x : (x.id || x.name);
              if (name) set.set(id, { id, name, emoji: (x && x.emoji) || null });
            }));
          });
        } else if (feed.value === 'orders') {
          orders.value.forEach((o) => (o.tags || []).forEach((x) => {
            const name = typeof x === 'string' ? x : x.name;
            const id = typeof x === 'string' ? x : (x.id || x.name);
            if (name) set.set(id, { id, name, emoji: (x && x.emoji) || null });
          }));
        } else {
          performers.value.forEach((p) => (p.tags || []).forEach((x) => {
            const name = typeof x === 'string' ? x : x.name;
            const id = typeof x === 'string' ? x : (x.id || x.name);
            if (name) set.set(id, { id, name, emoji: (x && x.emoji) || null });
          }));
        }
        return [...set.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      });

      function roleKind(r) {
        return r.kind || r.type || 'project';
      }

      function projectKind(st) {
        return st.stage || st.kind || 'early';
      }

      function tagsMatch(itemTags, tagsOnIds) {
        const on = filters.tagsOn || [];
        if (!on.length || on.includes('all')) return true;
        const ids = tagsOnIds || [];
        if (ids.length) return on.some((t) => ids.includes(t));
        const tags = (itemTags || []).map((x) => (typeof x === 'string' ? x : (x.id || x.name)));
        if (!tags.length) return on.includes('all');
        return on.some((t) => tags.includes(t));
      }

      function refreshEmojis() {
        setTimeout(() => {
          try {
            if (typeof window.emojify === 'function') window.emojify();
          } catch (e) { /* ignore */ }
        }, 50);
      }

      // Server paginates; keep light client filters for project stage / openTo
      const filteredOrders = computed(() => orders.value);

      const filteredProjects = computed(() => startups.value.filter((st) => {
        const kind = projectKind(st);
        if (filters.types[kind] === false) return false;
        return true;
      }));

      const filteredPerformers = computed(() => performers.value.filter((p) => {
        if ((filters.openTo || []).length) {
          const open = p.openTo || [];
          if (!filters.openTo.some((x) => open.includes(x))) return false;
        }
        return true;
      }));

      const feedPager = reactive({
        orders: { windowStart: 0, nextOffset: 0, hasMore: true, loadingMore: false, loadingPrev: false },
        projects: { windowStart: 0, nextOffset: 0, hasMore: true, loadingMore: false, loadingPrev: false },
        performers: { windowStart: 0, nextOffset: 0, hasMore: true, loadingMore: false, loadingPrev: false },
      });
      const feedTopSentinel = ref(null);
      const feedBottomSentinel = ref(null);
      let feedObserver = null;
      let feedReloadTimer = null;
      let feedScrollTick = 0;
      const showBackTop = ref(false);
      const BACK_TOP_SHOW_Y = 420;
      const BACK_TOP_HIDE_Y = 160;

      function showToast(msg) {
        toast.value = msg;
        setTimeout(() => { if (toast.value === msg) toast.value = ''; }, 3200);
      }

      function apiErrorCode(e) {
        return (e && (e.code || (e.data && e.data.code))) || '';
      }

      function explainApiError(e) {
        const code = apiErrorCode(e);
        if (code === 'pending_moderation') return t('project_pending');
        if (code === 'rejected') return t('project_rejected');
        return t('error') + (e && e.message ? `: ${e.message}` : '');
      }

      const resolvedProjectLogos = reactive({});
      const projectLogoPending = new Set();
      const projectLogoQueue = [];
      let projectLogoActive = 0;
      const PROJECT_LOGO_CONCURRENCY = 4;

      function projectLogoExplicit(st) {
        if (!st) return '';
        const explicit = String(st.logo || '').trim();
        return explicit && !isWeakLogoUrl(explicit) ? explicit : '';
      }

      function projectLogoInferred(st) {
        if (!st) return '';
        const fromUrl = (raw) => {
          const s = String(raw || '').trim();
          if (!s) return '';
          try {
            const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
            const host = u.hostname.replace(/^www\./i, '').toLowerCase();
            if (host === 'workix.co') return 'https://workix.co/img/logo-pwa.png';
            if (host === 'facetoplace.app') return 'https://facetoplace.app/img/logo/app.png';
            if (/(^|\.)github\.com$/i.test(u.hostname)) {
              const parts = u.pathname.split('/').filter(Boolean);
              const owner = parts[0] === 'orgs' || parts[0] === 'users' ? parts[1] : parts[0];
              if (owner) return `https://github.com/${encodeURIComponent(owner)}.png?size=128`;
            }
          } catch (_) { /* ignore */ }
          return '';
        };
        return fromUrl(st.url) || fromUrl(st.github) || '';
      }

      /** Sync optimistic logo: Logo URL first, then known host shortcuts. */
      function projectLogoSync(st) {
        return projectLogoExplicit(st) || projectLogoInferred(st);
      }

      function projectLogo(st) {
        if (!st) return '';
        const id = String(st.id || st.slug || '');
        if (id && Object.prototype.hasOwnProperty.call(resolvedProjectLogos, id)) {
          return resolvedProjectLogos[id] || '';
        }
        return projectLogoSync(st);
      }

      function projectLogoStyle(st) {
        const url = projectLogo(st);
        if (!url) return {};
        return { backgroundImage: `url(${JSON.stringify(url)})` };
      }

      /** Logo URL → inferred → Google → apple-touch / manifest. */
      async function resolveProjectLogoFull(st) {
        const explicit = projectLogoExplicit(st);
        if (explicit) {
          const ok = await probeImage(explicit, 5000, { rejectGoogleDefault: false });
          if (ok) return ok;
        }
        const inferred = projectLogoInferred(st);
        if (inferred) {
          const ok = await probeImage(inferred, 4000, { rejectGoogleDefault: false });
          if (ok) return ok;
        }
        return (await resolveSiteIcon(String(st.url || '').trim())) || '';
      }

      function drainProjectLogoQueue() {
        while (projectLogoActive < PROJECT_LOGO_CONCURRENCY && projectLogoQueue.length) {
          const st = projectLogoQueue.shift();
          const id = String(st.id || st.slug || '');
          projectLogoActive += 1;
          resolveProjectLogoFull(st).then((url) => {
            resolvedProjectLogos[id] = url || '';
          }).finally(() => {
            projectLogoPending.delete(id);
            projectLogoActive -= 1;
            drainProjectLogoQueue();
          });
        }
      }

      function enqueueProjectLogo(st) {
        if (!st) return;
        const id = String(st.id || st.slug || '');
        if (!id || projectLogoPending.has(id) || Object.prototype.hasOwnProperty.call(resolvedProjectLogos, id)) return;
        const sync = projectLogoSync(st);
        const site = String(st.url || '').trim();
        if (!site && !sync) {
          resolvedProjectLogos[id] = '';
          return;
        }
        // Optimistic Logo URL (priority over Google); async may fall back if it fails to load.
        const explicit = projectLogoExplicit(st);
        if (explicit) resolvedProjectLogos[id] = explicit;
        projectLogoPending.add(id);
        projectLogoQueue.push(st);
        drainProjectLogoQueue();
      }

      function enrichProjectLogos(list) {
        (list || []).forEach((st) => enqueueProjectLogo(st));
      }

      /** Extra links: inferred host icons → Google s2 (skip 16×16 globe) — same idea as projects. */
      const resolvedLinkIcons = reactive({});
      const linkIconPending = new Set();
      const linkIconQueue = [];
      let linkIconActive = 0;
      const LINK_ICON_CONCURRENCY = 4;

      function linkIconKey(l) {
        return String((l && (l.url || l)) || '').trim();
      }

      function linkIconInferred(rawUrl) {
        const s = String(rawUrl || '').trim();
        if (!s) return '';
        try {
          const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
          const host = u.hostname.replace(/^www\./i, '').toLowerCase();
          if (/(^|\.)github\.com$/i.test(host)) {
            const parts = u.pathname.split('/').filter(Boolean);
            const owner = parts[0] === 'orgs' || parts[0] === 'users' ? parts[1] : parts[0];
            if (owner) return `https://github.com/${encodeURIComponent(owner)}.png?size=64`;
            return googleFaviconUrl('github.com');
          }
          if (/(^|\.)linkedin\.com$/i.test(host)) return googleFaviconUrl('linkedin.com');
          if (/(^|\.)(x|twitter)\.com$/i.test(host)) return googleFaviconUrl('twitter.com');
          if (host === 't.me' || host === 'telegram.me' || host === 'telegram.org') {
            return googleFaviconUrl('telegram.org');
          }
          // Mastodon / fediverse instance homepage icon via Google
          if (u.pathname.startsWith('/@') || host === 'toot.io' || host.endsWith('.social')) {
            return googleFaviconUrl(host);
          }
        } catch (_) { /* ignore */ }
        return '';
      }

      function linkIcon(l) {
        const key = linkIconKey(l);
        if (!key) return '';
        if (Object.prototype.hasOwnProperty.call(resolvedLinkIcons, key)) {
          return resolvedLinkIcons[key] || '';
        }
        return linkIconInferred(key);
      }

      async function resolveLinkIconFull(url) {
        const inferred = linkIconInferred(url);
        if (inferred) {
          const ok = await probeImage(inferred, 5000, { rejectGoogleDefault: true });
          if (ok) return ok;
        }
        return (await resolveSiteIcon(url)) || '';
      }

      function drainLinkIconQueue() {
        while (linkIconActive < LINK_ICON_CONCURRENCY && linkIconQueue.length) {
          const url = linkIconQueue.shift();
          linkIconActive += 1;
          resolveLinkIconFull(url).then((icon) => {
            resolvedLinkIcons[url] = icon || '';
          }).finally(() => {
            linkIconPending.delete(url);
            linkIconActive -= 1;
            drainLinkIconQueue();
          });
        }
      }

      function enqueueLinkIcon(l) {
        const url = linkIconKey(l);
        if (!url || linkIconPending.has(url) || Object.prototype.hasOwnProperty.call(resolvedLinkIcons, url)) return;
        if (!originFromSiteUrl(url)) {
          resolvedLinkIcons[url] = '';
          return;
        }
        // Optimistic inferred icon (GitHub avatar / Google) while probe runs
        const inferred = linkIconInferred(url);
        if (inferred) resolvedLinkIcons[url] = inferred;
        linkIconPending.add(url);
        linkIconQueue.push(url);
        drainLinkIconQueue();
      }

      function enrichLinkIcons(list) {
        (list || []).forEach((l) => enqueueLinkIcon(l));
      }

      function isHubAdmin() {
        return !!(me.value && me.value.admin);
      }

      /** Publisher of the listing or hub admin — never by client IP. */
      function canManageStartup(st) {
        if (!st) return false;
        if (isHubAdmin()) return true;
        if (!me.value) return false;
        const uid = String(me.value.id || '').trim();
        if (!uid) return false;
        const pub = String(
          st.publisherId
          || (st.publisher && (st.publisher.userId || st.publisher.id))
          || '',
        ).trim();
        return Boolean(pub && uid === pub);
      }

      function canManageRole(r) {
        if (!r) return false;
        if (isHubAdmin()) return true;
        if (!me.value) return false;
        const uid = String(me.value.id || '').trim();
        if (!uid) return false;
        const pub = String(r.publisherId || '').trim();
        if (pub && uid === pub) return true;
        if (currentStartup.value && canManageStartup(currentStartup.value)) return true;
        return false;
      }

      function statusClass(st) {
        if (st === 'approved' || st === 'active' || st === 'open') return 'ok';
        if (st === 'pending' || st === 'draft' || st === 'frozen') return 'warn';
        return 'bad';
      }

      /** Form/API: active ↔ approved (live). */
      function toFormListingStatus(st) {
        const s = String(st || '').toLowerCase();
        if (s === 'approved' || s === 'open' || s === 'active') return 'active';
        return s || 'pending';
      }

      function toApiListingStatus(st) {
        const s = String(st || '').toLowerCase();
        if (s === 'active') return 'approved';
        return s || 'pending';
      }

      function statusLabel(st) {
        const s = String(st || '').toLowerCase();
        const key = (s === 'approved' || s === 'open') ? 'active' : s;
        return t(`status_${key}`) || st;
      }

      function availabilityLabel(code) {
        const key = `avail_${code || 'open'}`;
        return t(key) || code || '';
      }

      function contactLabel(kind) {
        if (kind === 'telegram') return t('contact_telegram');
        if (kind === 'email') return t('contact_email');
        return t('contact_link');
      }

      /** Public contact buttons from prefs matrix (public_contact). */
      function performerContacts(p) {
        if (!p) return [];
        if (Array.isArray(p.contacts) && p.contacts.length) return p.contacts;
        if (p.contactUrl) {
          return [{ kind: p.contactKind || 'link', url: p.contactUrl }];
        }
        return [];
      }

      function stashPendingForm(kind) {
        try {
          const payload = kind === 'startup'
            ? {
              kind: 'startup',
              hash: location.hash || '#/new-startup',
              form: {
                name: formStartup.name,
                slug: formStartup.slug,
                url: formStartup.url,
                github: formStartup.github,
                logo: formStartup.logo,
                description: formStartup.description,
                tags: formStartup.tags,
                linksText: formStartup.linksText,
                applyDefaults: { ...(formStartup.applyDefaults || {}) },
                stage: formStartup.stage,
                status: formStartup.status,
              },
            }
            : {
              kind: 'role',
              hash: location.hash || '#/new-role',
              form: JSON.parse(JSON.stringify(formRole)),
            };
          sessionStorage.setItem(PENDING_FORM_KEY, JSON.stringify(payload));
        } catch (e) { /* ignore */ }
      }

      async function flushPendingFormAfterAuth() {
        let raw = null;
        try { raw = sessionStorage.getItem(PENDING_FORM_KEY); } catch (e) { return false; }
        if (!raw) return false;
        let data = null;
        try { data = JSON.parse(raw); } catch (e) { return false; }
        try { sessionStorage.removeItem(PENDING_FORM_KEY); } catch (e) { /* ignore */ }
        if (!data || !data.form) return false;
        if (data.hash) {
          const h = String(data.hash).replace(/^#/, '');
          if (h) location.hash = h;
        }
        if (data.kind === 'startup') {
          Object.assign(formStartup, data.form);
          if (data.form.applyDefaults) {
            formStartup.applyDefaults = { ...data.form.applyDefaults };
          }
          await saveStartup({ skipAuthGate: true });
          return true;
        }
        if (data.kind === 'role') {
          Object.assign(formRole, data.form);
          await saveRole({ skipAuthGate: true });
          return true;
        }
        return false;
      }

      function promptAuthToSave(kind) {
        stashPendingForm(kind);
        showToast(t('auth_needed_save'));
        loginMvse();
        if (route.value.name !== 'auth') navigate('auth');
      }

      function openAccountMenu() {
        langOpen.value = false;
        notifyOpen.value = false;
        if (!me.value) {
          accountOpen.value = false;
          navigate('auth');
          return;
        }
        accountOpen.value = !accountOpen.value;
      }

      function flagClass(code) {
        const row = languages.find((l) => l.code === code);
        const country = (row && row.flag) || code || 'gb';
        return `flag flag-country-${country}`;
      }

      const localeLoading = ref(false);
      const loadedLocales = new Set(['en', 'ru']);

      async function loadLocale(lang) {
        const next = String(lang || 'en').slice(0, 8);
        if (next === 'en' || next === 'ru') {
          loadedLocales.add(next);
          return;
        }
        localeLoading.value = true;
        try {
          const apply = (res) => {
            if (res && res.strings) {
              WorkixI18n.setLocaleStrings(next, res.strings);
              sloganTick.value += 1;
            }
          };
          // Start background MVSE translate; apply cached/partial immediately
          const first = await WorkixAPI.i18n(next);
          apply(first);
          loadedLocales.add(next);
          let missing = Number(first && first.missing) || 0;
          let warming = Boolean(first && first.warming);
          for (let i = 0; (missing > 0 || warming) && i < 45; i += 1) {
            await new Promise((r) => setTimeout(r, 2000));
            const again = await WorkixAPI.i18n(next, { skipTranslate: '1' }).catch(() => null);
            if (!again) break;
            apply(again);
            missing = Number(again.missing) || 0;
            warming = Boolean(again.warming);
            if (missing === 0 && !warming) break;
          }
        } catch (e) {
          console.warn('[workix:i18n]', next, e);
          if (typeof WEB3 !== 'undefined' && typeof WEB3.translate === 'function') {
            try { WEB3.translate(next); } catch (err) { /* ignore */ }
          }
        } finally {
          localeLoading.value = false;
          setTimeout(() => refreshEmojis(), 40);
        }
      }

      async function setLang(lang) {
        const next = String(lang || 'en');
        locale.value = next;
        localStorage.setItem('workix_lang', next);
        document.documentElement.lang = next === 'zh' ? 'zh-CN' : (next === 'ja' ? 'ja' : (next === 'ko' ? 'ko' : next));
        if (WorkixAPI.setContentLang) WorkixAPI.setContentLang(next);
        await loadLocale(next);
        // Re-fetch feeds so descriptions match the new language
        try {
          if (route.value && route.value.name === 'catalog') await loadCatalog();
          else if (route.value && route.value.name === 'order' && route.value.id) await openOrder(route.value.id);
          else if (route.value && route.value.name === 'performer' && route.value.id) await openPerformer(route.value.id);
          else if (route.value && route.value.name === 'startup' && route.value.slug) await openStartup(route.value.slug);
          else if (route.value && route.value.name === 'go') await openGo(route.value.startupSlug, route.value.roleSlug);
          else if (route.value && route.value.name === 'role' && route.value.id) await openRole(route.value.id);
          else await loadCatalog();
        } catch (e) {
          /* ignore content refresh errors */
        }
      }

      async function pickLang(lang) {
        await setLang(lang);
        langOpen.value = false;
      }

      async function refreshMe() {
        if (!WorkixAuth.bearer()) {
          me.value = null;
          return;
        }
        try {
          me.value = await WorkixAPI.me();
        } catch (e) {
          me.value = null;
        }
      }

      let catalogLangTimer = null;

      function activeTagIds() {
        const tags = (filters.tagsOn || []).filter((x) => x && x !== 'all');
        return tags;
      }

      function activeOrderTypes() {
        const ids = Object.entries(filters.types || {})
          .filter(([, on]) => on)
          .map(([id]) => id);
        const allOn = feedTypeOptions.value.every((tp) => filters.types[tp.id] !== false);
        return allOn ? [] : ids;
      }

      function feedQuery(extra = {}) {
        const query = { limit: FEED_PAGE, ...extra };
        const needle = String(q.value || '').trim();
        if (needle) query.q = needle;
        const tags = activeTagIds();
        if (tags.length) query.tags = tags;
        if (feed.value === 'orders') {
          const types = activeOrderTypes();
          if (types.length) query.types = types;
          if (filters.priceFrom != null && filters.priceFrom > 0) query.priceFrom = filters.priceFrom;
        }
        return query;
      }

      function mapOrderItems(items) {
        return (items || []).map((item) => ({
          ...item,
          kind: item.kind || item.type || 'task',
        }));
      }

      function mapRoleItems(items) {
        return (items || []).map((item) => ({
          ...item,
          kind: item.kind || item.type || 'project',
          budget: item.budget != null ? item.budget : (item.payment && item.payment.budget) || 0,
        }));
      }

      async function preserveScroll(mutate) {
        const before = document.documentElement.scrollHeight;
        const y = window.scrollY || window.pageYOffset || 0;
        await mutate();
        await nextTick();
        const after = document.documentElement.scrollHeight;
        const delta = after - before;
        if (delta) window.scrollTo(0, Math.max(0, y + delta));
      }

      function feedPageMeta(res, offset) {
        const pageOffset = Number(res && res.offset);
        const pageLimit = Number(res && res.limit);
        const off = Number.isFinite(pageOffset) ? pageOffset : Number(offset) || 0;
        const lim = Number.isFinite(pageLimit) && pageLimit > 0 ? pageLimit : FEED_PAGE;
        return {
          hasMore: !!(res && res.hasMore),
          pageOffset: off,
          pageLimit: lim,
          // DB cursor — not list.length (host featuring can prepend extra rows on offset=0)
          nextOffset: off + lim,
        };
      }

      async function fetchFeedPage(kind, offset) {
        const query = feedQuery({ offset });
        if (kind === 'orders') {
          const res = await WorkixAPI.listOrders(query);
          return { items: mapOrderItems(res.items), ...feedPageMeta(res, offset) };
        }
        if (kind === 'projects') {
          const res = await WorkixAPI.listStartups(query);
          return { items: res.items || [], ...feedPageMeta(res, offset) };
        }
        const res = await WorkixAPI.listPerformers(query);
        return { items: res.items || [], ...feedPageMeta(res, offset) };
      }

      async function resetFeed(kind) {
        const pager = feedPager[kind];
        pager.windowStart = 0;
        pager.nextOffset = 0;
        pager.hasMore = true;
        pager.loadingMore = false;
        pager.loadingPrev = false;
        const page = await fetchFeedPage(kind, 0).catch(() => ({
          items: [], hasMore: false, nextOffset: 0, pageOffset: 0, pageLimit: FEED_PAGE,
        }));
        if (kind === 'orders') orders.value = page.items;
        else if (kind === 'projects') {
          startups.value = page.items;
          enrichProjectLogos(page.items);
        } else performers.value = page.items;
        pager.hasMore = page.hasMore;
        pager.windowStart = 0;
        pager.nextOffset = page.nextOffset;
        if (kind === 'orders' || kind === 'performers') {
          prefetchFxRates(page.items);
        }
        refreshEmojis();
      }

      async function loadMoreDown() {
        const kind = feed.value;
        const pager = feedPager[kind];
        if (!pager || !pager.hasMore || pager.loadingMore || pager.loadingPrev) return;
        if (route.value.name !== 'catalog' || loading.value) return;
        pager.loadingMore = true;
        try {
          const listRef = kind === 'orders' ? orders : kind === 'projects' ? startups : performers;
          const offset = Number.isFinite(pager.nextOffset)
            ? pager.nextOffset
            : pager.windowStart + (listRef.value || []).length;
          const page = await fetchFeedPage(kind, offset);
          pager.nextOffset = page.nextOffset;
          if (!page.items.length) {
            pager.hasMore = false;
            return;
          }
          const seen = new Set((listRef.value || []).map((x) => String(x.id || x.sid || x.slug)));
          const add = page.items.filter((x) => !seen.has(String(x.id || x.sid || x.slug)));
          if (add.length) {
            listRef.value = [...(listRef.value || []), ...add];
            if (kind === 'projects') enrichProjectLogos(add);
          }
          pager.hasMore = page.hasMore;
          if (listRef.value.length > FEED_WINDOW) {
            const drop = listRef.value.length - FEED_WINDOW;
            const before = document.documentElement.scrollHeight;
            const y = window.scrollY || 0;
            listRef.value = listRef.value.slice(drop);
            pager.windowStart += drop;
            await nextTick();
            const after = document.documentElement.scrollHeight;
            window.scrollTo(0, Math.max(0, y - (before - after)));
          }
          if (kind === 'orders' || kind === 'performers') prefetchFxRates(add);
          refreshEmojis();
        } catch (e) {
          console.warn('[workix:feed-more]', e);
        } finally {
          pager.loadingMore = false;
        }
      }

      async function loadMoreUp() {
        const kind = feed.value;
        const pager = feedPager[kind];
        if (!pager || pager.windowStart <= 0 || pager.loadingPrev || pager.loadingMore) return;
        if (route.value.name !== 'catalog' || loading.value) return;
        pager.loadingPrev = true;
        try {
          const listRef = kind === 'orders' ? orders : kind === 'projects' ? startups : performers;
          const fetchOffset = Math.max(0, pager.windowStart - FEED_PAGE);
          const page = await fetchFeedPage(kind, fetchOffset);
          const want = pager.windowStart - fetchOffset;
          const chunk = (page.items || []).slice(0, want);
          if (!chunk.length) {
            pager.windowStart = 0;
            return;
          }
          await preserveScroll(async () => {
            const seen = new Set((listRef.value || []).map((x) => String(x.id || x.sid || x.slug)));
            const add = chunk.filter((x) => !seen.has(String(x.id || x.sid || x.slug)));
            listRef.value = [...add, ...(listRef.value || [])];
            pager.windowStart = fetchOffset;
            if (listRef.value.length > FEED_WINDOW) {
              listRef.value = listRef.value.slice(0, FEED_WINDOW);
              pager.hasMore = true;
              pager.nextOffset = pager.windowStart + listRef.value.length;
            }
          });
          refreshEmojis();
        } catch (e) {
          console.warn('[workix:feed-prev]', e);
        } finally {
          pager.loadingPrev = false;
        }
      }

      function bindFeedSentinels() {
        if (feedObserver) {
          feedObserver.disconnect();
          feedObserver = null;
        }
        if (typeof IntersectionObserver === 'undefined') return;
        if (route.value.name !== 'catalog' || loading.value) return;
        const top = feedTopSentinel.value;
        const bottom = feedBottomSentinel.value;
        if (!top && !bottom) return;
        feedObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            if (route.value.name !== 'catalog' || loading.value) continue;
            if (entry.target === bottom) loadMoreDown();
            if (entry.target === top) loadMoreUp();
          }
        }, { root: null, rootMargin: '320px 0px', threshold: 0 });
        if (top) feedObserver.observe(top);
        if (bottom) feedObserver.observe(bottom);
      }

      function updateBackTop() {
        const y = window.scrollY || window.pageYOffset || 0;
        if (showBackTop.value) {
          if (y < BACK_TOP_HIDE_Y) showBackTop.value = false;
        } else if (y > BACK_TOP_SHOW_Y) {
          showBackTop.value = true;
        }
      }

      function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function onFeedWindowScroll() {
        if (feedScrollTick) return;
        feedScrollTick = requestAnimationFrame(() => {
          feedScrollTick = 0;
          updateBackTop();
          if (route.value.name !== 'catalog' || loading.value) return;
          const doc = document.documentElement;
          const remain = doc.scrollHeight - (window.scrollY + window.innerHeight);
          if (remain < 480) loadMoreDown();
          if (window.scrollY < 120) loadMoreUp();
        });
      }

      async function loadCatalog() {
        const [r, tg, on] = await Promise.all([
          WorkixAPI.listRoles({}).catch(() => ({ items: [] })),
          WorkixAPI.listTags().catch(() => ({ items: [] })),
          WorkixAPI.online().catch(() => ({ online: 0 })),
        ]);
        roles.value = mapRoleItems(r.items);
        boardTags.value = tg.items || [];
        online.value = Number(on.online || 0);
        if (!filters.tagsOn.length) filters.tagsOn = ['all'];
        await resetFeed(feed.value);
        // Warm the other feeds lightly (first page only)
        const others = ['projects', 'performers', 'orders'].filter((k) => k !== feed.value);
        await Promise.all(others.map((k) => resetFeed(k).catch(() => {})));
        await nextTick();
        bindFeedSentinels();
        // Soft translation refresh for active window
        if (catalogLangTimer) clearTimeout(catalogLangTimer);
        catalogLangTimer = setTimeout(async () => {
          try {
            const kind = feed.value;
            const pager = feedPager[kind];
            const page = await fetchFeedPage(kind, pager.windowStart);
            const listRef = kind === 'orders' ? orders : kind === 'projects' ? startups : performers;
            const cur = listRef.value || [];
            if (page.items.length && cur.length) {
              listRef.value = page.items.concat(cur.slice(page.items.length));
              refreshEmojis();
            }
          } catch (e) { /* ignore */ }
        }, 5000);
      }

      function setFeed(name) {
        feed.value = name;
        localStorage.setItem('workix_feed', name);
        filters.tagsOn = ['all'];
        filters.openTo = [];
        filters.priceFrom = null;
        resetFeed(name).then(() => nextTick().then(bindFeedSentinels));
        window.scrollTo(0, 0);
      }

      function scheduleFeedReload() {
        if (feedReloadTimer) clearTimeout(feedReloadTimer);
        feedReloadTimer = setTimeout(() => {
          if (route.value.name !== 'catalog') return;
          resetFeed(feed.value).then(() => nextTick().then(bindFeedSentinels));
          window.scrollTo(0, 0);
        }, 280);
      }

      function kindLabel(kind) {
        const map = {
          task: 'type_task',
          project: 'type_project',
          time_job: 'type_time_job',
          full_job: 'type_full_job',
          fixes: 'type_fixes',
          idea: 'type_idea',
          stealth: 'type_stealth',
          preseed: 'type_preseed',
          seed: 'type_seed',
          mvp: 'type_mvp',
          early: 'type_early',
          growth: 'type_growth',
          scale: 'type_scale',
          mature: 'type_mature',
        };
        return t(map[kind] || 'type_project');
      }

      function stageLabel(stage) {
        return kindLabel(stage || 'early');
      }

      function sourceCurrency(r) {
        const cur = (r && (r.currency || (r.payment && r.payment.cur))) || 'USDT';
        return String(cur).toUpperCase();
      }

      function formatMoney(n) {
        const num = Number(n);
        if (!Number.isFinite(num)) return '—';
        try {
          return new Intl.NumberFormat(locale.value === 'ru' ? 'ru-RU' : 'en-US', {
            maximumFractionDigits: num >= 100 ? 0 : 2,
          }).format(num);
        } catch (e) {
          return String(Math.round(num * 100) / 100);
        }
      }

      function budgetView(r) {
        const amount = Number(r && r.budget != null ? r.budget : 0);
        if (!amount || amount <= 0) return { empty: true, amount: 0, currency: displayCurrency.value };
        const from = sourceCurrency(r);
        const to = String(displayCurrency.value || 'USDT').toUpperCase();
        if (from === to) return { empty: false, amount, currency: to };
        const rate = fxRates[`${from}_${to}`];
        if (rate != null && rate > 0) {
          return { empty: false, amount: amount * rate, currency: to };
        }
        return { empty: false, amount, currency: from };
      }

      function formatBudget(r) {
        const v = budgetView(r);
        if (v.empty) return '—';
        return `${formatMoney(v.amount)} ${v.currency}`;
      }

      async function ensureFxRate(from, to) {
        const src = String(from || 'USDT').toUpperCase();
        const dst = String(to || 'USDT').toUpperCase();
        if (src === dst) return 1;
        const key = `${src}_${dst}`;
        if (fxRates[key] != null) return fxRates[key];
        try {
          const res = await WorkixAPI.convertFx({ amount: 1, from: src, to: dst });
          const price = res && res.price != null ? Number(res.price) : null;
          if (Number.isFinite(price) && price > 0) {
            fxRates[key] = price;
            return price;
          }
        } catch (e) { /* keep source currency */ }
        return null;
      }

      async function prefetchFxRates(items) {
        const to = String(displayCurrency.value || 'USDT').toUpperCase();
        const fromSet = new Set();
        for (const item of items || []) {
          if (!item || !(Number(item.budget) > 0)) continue;
          const from = sourceCurrency(item);
          if (from !== to) fromSet.add(from);
        }
        await Promise.all([...fromSet].map((from) => ensureFxRate(from, to)));
        setTimeout(() => refreshEmojis(), 40);
      }

      function setDisplayCurrency(cur) {
        const next = String(cur || 'USDT').toUpperCase();
        displayCurrency.value = payCurrencies.includes(next) ? next : 'USDT';
        localStorage.setItem('workix_display_cur', displayCurrency.value);
        if (profile.value) profile.value.displayCurrency = displayCurrency.value;
        prefetchFxRates([...orders.value, ...performers.value]);
        if (currentPerformer.value) prefetchFxRates([currentPerformer.value]);
      }

      function installPwa() {
        if (!deferredPwaPrompt) return;
        deferredPwaPrompt.prompt();
        deferredPwaPrompt.userChoice.finally(() => {
          deferredPwaPrompt = null;
          pwaCanInstall.value = false;
        });
      }

      async function loadMine() {
        await refreshMe();
        if (!me.value) {
          mineStartups.value = [];
          return;
        }
        const s = await WorkixAPI.listStartups({ mine: 'true' });
        mineStartups.value = s.items || [];
      }

      async function openStartup(slug) {
        routeError.value = null;
        currentStartup.value = null;
        roles.value = [];
        try {
          currentStartup.value = await WorkixAPI.getStartup(slug);
        } catch (e) {
          const code = apiErrorCode(e);
          if (code === 'pending_moderation' || code === 'rejected') {
            routeError.value = { code, kind: 'startup' };
            return;
          }
          // Root /{slug} is shared: projects win, else try performer vanity slug
          if (e && e.status === 404) {
            try {
              await openPerformer(slug);
              if (currentPerformer.value) {
                route.value = {
                  name: 'performer',
                  id: currentPerformer.value.slug || currentPerformer.value.id,
                };
                const canon = performerPublicPath(currentPerformer.value);
                if ((location.pathname || '/') !== canon) {
                  history.replaceState(null, '', canon);
                }
                return;
              }
            } catch (_) { /* not a performer either */ }
          }
          throw e;
        }
        const r = await WorkixAPI.listRoles({ startup: slug });
        roles.value = r.items || [];
      }

      async function openGo(startupSlug, roleSlug) {
        currentStartup.value = await WorkixAPI.getStartup(startupSlug);
        const r = await WorkixAPI.listRoles({ startup: startupSlug });
        const items = r.items || [];
        currentRole.value = roleSlug
          ? items.find((x) => x.slug === roleSlug || x.id === roleSlug) || items[0] || null
          : items[0] || null;
        if (currentRole.value && currentRole.value.id) {
          try {
            currentRole.value = await WorkixAPI.getRole(currentRole.value.id);
          } catch (e) { /* keep list localization */ }
        }
        const all = await WorkixAPI.listRoles({});
        carousel.value = (all.items || []).filter((x) => !currentRole.value || x.id !== currentRole.value.id).slice(0, 12);
        await WorkixAPI.track('share_view', {
          startupSlug,
          roleSlug: currentRole.value && currentRole.value.slug,
        });
      }

      async function openRole(id) {
        currentRole.value = await WorkixAPI.getRole(id);
        if (currentRole.value && currentRole.value.startupSlug) {
          currentStartup.value = await WorkixAPI.getStartup(currentRole.value.startupSlug);
        }
        // Upgrade /role/:id (and any leftover #/role/:id) to the canonical
        // /{slug}/{role} path once we know the project, so the address bar and
        // any copy/share action land on the crawlable, JobPosting-carrying URL.
        const r = currentRole.value;
        if (r && r.startupSlug) {
          const canon = projectPath(r.startupSlug, r.slug || r.id);
          if (location.pathname + location.hash !== canon) {
            history.replaceState(null, '', canon);
          }
        }
      }

      async function loadProfile() {
        await refreshMe();
        if (!me.value) {
          profile.value = {};
          profileLinksText.value = '';
          return;
        }
        const p = await WorkixAPI.getProfile() || {};
        if (!p.payment || typeof p.payment !== 'object') {
          p.payment = { budget: '', type: 'work', cur: 'USDT' };
        }
        if (!p.displayCurrency) {
          p.displayCurrency = displayCurrency.value || 'USDT';
        } else {
          setDisplayCurrency(p.displayCurrency);
        }
        if (!p.availability) p.availability = 'open';
        profile.value = p;
        profileLinksText.value = linksToText(p.links);
      }

      async function loadPrefs() {
        await refreshMe();
        if (!me.value) return;
        prefs.value = normalizePrefsClient(await WorkixAPI.getPrefs());
      }

      async function loadNotifications() {
        await refreshMe();
        if (!me.value) {
          notifications.value = [];
          notifyUnread.value = 0;
          return;
        }
        try {
          const res = await WorkixAPI.listNotifications({ limit: 40 });
          notifications.value = (res && res.items) || [];
          notifyUnread.value = Number((res && res.unread) || 0);
        } catch (e) {
          notifications.value = [];
          notifyUnread.value = 0;
        }
      }

      async function toggleNotifyPanel() {
        accountOpen.value = false;
        langOpen.value = false;
        notifyOpen.value = !notifyOpen.value;
        if (notifyOpen.value) await loadNotifications();
      }

      function formatNotifyTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        try {
          return d.toLocaleString(locale.value === 'ru' ? 'ru-RU' : 'en-US', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          });
        } catch (e) {
          return d.toISOString().slice(0, 16).replace('T', ' ');
        }
      }

      async function openNotification(n) {
        if (!n) return;
        if (!n.readAt) {
          try {
            await WorkixAPI.markNotificationsRead([n.id]);
            n.readAt = new Date().toISOString();
            notifyUnread.value = Math.max(0, notifyUnread.value - 1);
          } catch (e) { /* ignore */ }
        }
        notifyOpen.value = false;
        if (n.href) {
          if (String(n.href).startsWith('#/')) {
            location.hash = String(n.href).replace(/^#/, '');
          } else if (String(n.href).startsWith('http')) {
            window.open(n.href, '_blank', 'noopener');
          } else {
            navigate(String(n.href).replace(/^#?\/?/, ''));
          }
        } else {
          navigate('prefs');
        }
      }

      async function markAllNotificationsRead() {
        if (!me.value) return;
        await WorkixAPI.markNotificationsRead(null);
        notifications.value = notifications.value.map((n) => Object.assign({}, n, {
          readAt: n.readAt || new Date().toISOString(),
        }));
        notifyUnread.value = 0;
      }

      async function openPerformer(id) {
        currentPerformer.value = await WorkixAPI.getPerformer(id);
        if (currentPerformer.value) {
          prefetchFxRates([
            currentPerformer.value,
            ...(currentPerformer.value.orders || []),
          ]);
          const canon = performerPublicPath(currentPerformer.value);
          const path = location.pathname || '/';
          // Prefer vanity /{slug}; keep /performer/{id|slug} as aliases
          if (currentPerformer.value.slug && path !== canon && /^\/performer\//i.test(path)) {
            history.replaceState(null, '', canon);
          }
        }
        setTimeout(() => refreshEmojis(), 80);
      }

      function openPerformerRole(role) {
        if (!role) return;
        if (role.startupSlug && (role.slug || role.id)) {
          navigateProject(role.startupSlug, role.slug || null);
          return;
        }
        if (role.id) navigate(`role/${encodeURIComponent(role.id)}`);
      }

      function resetProposalForm(order) {
        const mine = order && order.myProposal;
        formProposal.Interesity = mine && mine.Interesity != null ? Number(mine.Interesity) : null;
        formProposal.Difficulty = mine && mine.Difficulty != null ? Number(mine.Difficulty) : null;
        formProposal.Understandability = mine && mine.Understandability != null ? Number(mine.Understandability) : null;
        formProposal.Budget = mine && mine.Budget != null ? mine.Budget : '';
        formProposal.Currency = (mine && mine.Currency)
          || (order && order.currency)
          || 'USDT';
        formProposal.Time = mine && mine.Time != null ? Number(mine.Time) : null;
        formProposal.Description = (mine && mine.Description) || '';
        formProposal.score = mine && mine.score != null ? mine.score : null;
      }

      async function openOrder(id) {
        try {
          currentOrder.value = await WorkixAPI.getOrder(id);
        } catch (e) {
          currentOrder.value = null;
        }
        resetProposalForm(currentOrder.value);
        if (currentOrder.value) prefetchFxRates([currentOrder.value]);
        setTimeout(() => refreshEmojis(), 80);
      }

      function publisherWallet(order, chain) {
        const w = order && order.publisher && order.publisher.wallets;
        return w && w[chain] ? w[chain] : null;
      }

      function publisherWalletList(order) {
        const w = order && order.publisher && order.publisher.wallets;
        if (!w) return [];
        return walletChains.map((c) => w[c]).filter(Boolean);
      }

      function fromNow(input) {
        if (!input) return '';
        const d = new Date(input);
        if (Number.isNaN(d.getTime())) return '';
        const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
        const abs = Math.abs(diffSec);
        const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
          ? new Intl.RelativeTimeFormat(locale.value === 'ru' ? 'ru' : 'en', { numeric: 'auto' })
          : null;
        const units = [
          ['year', 31536000],
          ['month', 2592000],
          ['week', 604800],
          ['day', 86400],
          ['hour', 3600],
          ['minute', 60],
          ['second', 1],
        ];
        for (const [unit, sec] of units) {
          if (abs >= sec || unit === 'second') {
            const val = Math.round(diffSec / sec);
            if (rtf) return rtf.format(val, unit);
            return `${Math.abs(val)} ${unit}${Math.abs(val) === 1 ? '' : 's'} ago`;
          }
        }
        return '';
      }

      async function sendOrderProposal() {
        if (!currentOrder.value || !me.value) {
          navigate('auth');
          return;
        }
        proposalSaving.value = true;
        try {
          const res = await WorkixAPI.postOrderProposal(currentOrder.value.sid || currentOrder.value.id, {
            Interesity: formProposal.Interesity,
            Difficulty: formProposal.Difficulty,
            Understandability: formProposal.Understandability,
            Budget: formProposal.Budget,
            Currency: formProposal.Currency,
            Time: formProposal.Time,
            Description: formProposal.Description,
          });
          if (res && res.order) {
            currentOrder.value = res.order;
            resetProposalForm(res.order);
          } else if (res && res.score != null) {
            formProposal.score = res.score;
          }
          showToast(t('proposal_saved'));
          setTimeout(() => refreshEmojis(), 80);
        } catch (e) {
          showToast((e && e.message) || t('error') || 'Error');
        } finally {
          proposalSaving.value = false;
        }
      }

      async function routeLoad() {
        loading.value = true;
        routeError.value = null;
        for (const k of Object.keys(expandedBodies)) delete expandedBodies[k];
        try {
          const r = route.value;
          if (r.name === 'catalog') await loadCatalog();
          if (r.name === 'mine') await loadMine();
          if (r.name === 'startup') await openStartup(r.slug);
          if (r.name === 'go') await openGo(r.startupSlug, r.roleSlug);
          if (r.name === 'role') await openRole(r.id);
          if (r.name === 'performer') await openPerformer(r.id);
          if (r.name === 'order') await openOrder(r.id);
          if (r.name === 'apply') {
            await openRole(r.roleId);
            resetApplyForm(currentRole.value);
          }
          if (r.name === 'startup-form') {
            await refreshMe();
            if (r.slug) {
              const s = await WorkixAPI.getStartup(r.slug);
              if (!canManageStartup(s)) {
                navigateProject(s.slug || r.slug);
                return;
              }
              Object.assign(formStartup, {
                name: s.name, slug: s.slug, url: s.url || '', github: s.github || '', logo: s.logo || '',
                description: s.description || '',
                tags: (s.tags || []).join(', '),
                linksText: linksToText(s.links),
                applyDefaults: Object.assign({ apply_url: '', apply_email: '', apply_telegram: '' }, s.applyDefaults || {}),
                stage: s.stage || s.kind || 'early',
                status: toFormListingStatus(s.status),
              });
            } else {
              Object.assign(formStartup, {
                name: '', slug: '', url: '', github: '', logo: '', description: '', tags: '',
                linksText: '',
                applyDefaults: { apply_url: '', apply_email: '', apply_telegram: '' },
                stage: 'early',
                status: 'pending',
              });
            }
          }
          if (r.name === 'role-form') {
            await refreshMe();
            if (me.value) await loadMine().catch(() => {});
            if (r.id) {
              const role = await WorkixAPI.getRole(r.id);
              if (!canManageRole(role)) {
                navigate(`role/${role.id || r.id}`);
                return;
              }
              Object.assign(formRole, {
                startupId: role.startupId || '',
                title: role.title,
                slug: role.slug,
                description: role.description || '',
                tags: (role.tags || []).join(', '),
                kind: role.kind || 'task',
                project: role.project || '',
                payment: Object.assign({ budget: '', type: 'work', cur: 'USDT' }, role.payment || {}),
                apply_url: role.apply_url || '',
                apply_email: role.apply_email || '',
                apply_telegram: role.apply_telegram || '',
                linksText: linksToText(role.links),
                status: toFormListingStatus(role.status),
                _id: role.id,
              });
            } else {
              Object.assign(formRole, {
                startupId: r.startupId || '',
                title: '', slug: '', description: '', tags: '',
                kind: 'task', project: '',
                payment: { budget: '', type: 'work', cur: 'USDT' },
                apply_url: '', apply_email: '', apply_telegram: '', linksText: '',
                status: 'pending', _id: null,
              });
            }
          }
          if (r.name === 'profile') {
            await refreshMe();
            const storedKey = WorkixAuth.get().agentApiKey || '';
            if (storedKey) {
              onceKey.value = storedKey;
              keyDraft.value = storedKey;
            }
            await loadProfile();
            if (me.value) await loadPrefs();
          }
          if (r.name === 'prefs') {
            await loadNotifications();
            await loadPrefs();
          }
          if (r.name === 'auth') await refreshMe();
          if (r.name === 'onboarding') await refreshMe();
          if (r.name === 'support') {
            await refreshMe();
            if (me.value) {
              try {
                const p = await WorkixAPI.getProfile().catch(() => null);
                const contact = (p && (p.telegram || p.email))
                  || (me.value.email)
                  || '';
                if (contact && !formSupport.contact) formSupport.contact = contact;
              } catch (e) { /* ignore */ }
            }
          }
          if (r.name === 'startup-form' || r.name === 'role-form' || r.name === 'profile') {
            setTimeout(() => refreshEmojis(), 80);
          }
        } catch (e) {
          console.error(e);
          showToast(explainApiError(e));
        } finally {
          loading.value = false;
          // Catalog is v-else-if behind loading — bind sentinels only after it mounts
          if (route.value.name === 'catalog') {
            await nextTick();
            bindFeedSentinels();
          }
        }
      }

      function ensureOnboarding() {
        const seg = localStorage.getItem('workix_segment');
        if (!seg && route.value.name === 'catalog') {
          navigate('onboarding', true);
          return true;
        }
        return false;
      }

      const agentPrompt = computed(() => t('agent_prompt'));

      async function chooseSegment(segment) {
        localStorage.setItem('workix_segment', segment);
        if (segment === 'publish') {
          feed.value = 'projects';
          localStorage.setItem('workix_feed', 'projects');
          await WorkixAPI.track('entry_segment', { segment });
          if (WorkixAuth.bearer()) {
            try { await WorkixAPI.patchMe({ segment: 'projects' }); } catch (e) { /* ignore */ }
          }
          showToast(t('segment_saved'));
          navigate('new-startup');
          return;
        }
        if (segment === 'orders' || segment === 'roles') {
          // Заказ и Роль — лента заказов (роли проектов тоже здесь)
          feed.value = 'orders';
          localStorage.setItem('workix_feed', 'orders');
        } else if (segment === 'projects' || segment === 'performers') {
          feed.value = segment;
          localStorage.setItem('workix_feed', segment);
        } else {
          // «Просто смотрю» → главная лента = проекты
          feed.value = 'projects';
          localStorage.setItem('workix_feed', 'projects');
        }
        await WorkixAPI.track('entry_segment', { segment });
        if (WorkixAuth.bearer()) {
          try {
            const meSeg = (segment === 'roles') ? 'orders' : segment;
            await WorkixAPI.patchMe({ segment: meSeg });
          } catch (e) { /* ignore */ }
        }
        showToast(t('segment_saved'));
        navigate('catalog');
      }

      function copyAgentPrompt() {
        copyText(agentPrompt.value);
      }

      async function doRegister() {
        const res = await WorkixAPI.register();
        WorkixAuth.set({
          userId: res.userId,
          agentApiKey: res.agentApiKey,
          publicKey: res.publicKey,
        });
        onceKey.value = res.agentApiKey || '';
        keyDraft.value = res.agentApiKey || '';
        await refreshMe();
        showToast(t('auth_registered'));
        const flushed = await flushPendingFormAfterAuth();
        if (!flushed && route.value.name !== 'profile') navigate('profile');
      }

      const displayedAgentKey = computed(() => {
        const fromOnce = String(onceKey.value || '').trim();
        if (fromOnce) return fromOnce;
        const fromAuth = String((authStore.value && authStore.value.agentApiKey) || '').trim();
        return fromAuth || '';
      });

      async function doRotate() {
        if (!me.value) {
          navigate('auth');
          return;
        }
        keyRotating.value = true;
        try {
          const res = await WorkixAPI.rotateKey();
          const key = res && res.agentApiKey;
          if (!key) {
            showToast(t('error'));
            return;
          }
          WorkixAuth.set({ agentApiKey: key });
          onceKey.value = key;
          keyDraft.value = key;
          if (me.value) me.value = { ...me.value, hasAgentKey: true };
          showToast(t('auth_registered'));
        } catch (e) {
          showToast((e && e.message) || t('error'));
        } finally {
          keyRotating.value = false;
        }
      }

      function doLogout() {
        WorkixAuth.clear();
        me.value = null;
        onceKey.value = '';
        keyDraft.value = '';
        accountOpen.value = false;
        // Drop in-memory MVSE/WEB3 session so next login can pick another profile
        try {
          if (typeof WEB3 !== 'undefined' && WEB3.user) {
            WEB3.user.profile = {};
          }
        } catch (e) { /* ignore */ }
        location.reload();
      }

      async function setAgentKey(key) {
        const k = String(key || '').trim();
        if (!k) {
          showToast(t('error'));
          return;
        }
        WorkixAuth.set({ agentApiKey: k, token: null });
        keyDraft.value = k;
        await refreshMe();
        if (me.value) {
          showToast(t('auth_mvse_ok'));
          const flushed = await flushPendingFormAfterAuth();
          if (!flushed && route.value.name !== 'profile') navigate('profile');
        } else showToast(t('error'));
      }

      function extractMvseProfile() {
        const w = typeof WEB3 !== 'undefined' ? WEB3 : null;
        const profile = (w && w.user && w.user.profile) || {};
        const mvseUserId = String(
          profile.id
          || profile.user_id
          || profile._id
          || (w && w.user && (w.user.id || w.user.user_id))
          || '',
        ).trim();
        return {
          mvseUserId,
          name: profile.name || profile.username || profile.email || '',
          avatar: profile.avatar || profile.photo || '',
        };
      }

      async function finishMvseLogin() {
        const p = extractMvseProfile();
        if (!p.mvseUserId) {
          showToast(t('error'));
          return;
        }
        try {
          const res = await WorkixAPI.loginMvse(p);
          WorkixAuth.set({
            userId: res.userId,
            token: res.token,
            agentApiKey: res.agentApiKey || WorkixAuth.get().agentApiKey || null,
            mvseUserId: p.mvseUserId,
          });
          if (res.agentApiKey) {
            onceKey.value = res.agentApiKey;
            keyDraft.value = res.agentApiKey;
          } else {
            // Returning MVSE user: plaintext key is not re-sent — show profile key block
            const existing = WorkixAuth.get().agentApiKey;
            if (existing) {
              onceKey.value = existing;
              keyDraft.value = existing;
            }
          }
          await refreshMe();
          showToast(t('auth_mvse_ok'));
          const flushed = await flushPendingFormAfterAuth();
          if (!flushed && route.value.name !== 'profile') navigate('profile');
        } catch (e) {
          showToast(t('error'));
        }
      }

      function loginMvse() {
        if (typeof WEB3 === 'undefined' || !WEB3.auth) {
          showToast('MVSE unavailable — use agent key');
          return;
        }
        const already = extractMvseProfile();
        if (already.mvseUserId) {
          finishMvseLogin();
          return;
        }
        WEB3.auth({
          methods: ['telegram', 'email', 'google'],
          project: 'workix.co',
          style: { bg: 'blur', buttons: 'center' },
        });
      }

      function goLegacyMvse() {
        loginMvse();
      }

      /** Save without forcing draft — keeps live status on edit; draft only for new listings. */
      async function saveStartupKeep(opts = {}) {
        if (!route.value.slug) formStartup.status = 'draft';
        return saveStartup(opts);
      }

      async function saveRoleKeep(opts = {}) {
        if (!formRole._id) formRole.status = 'draft';
        return saveRole(opts);
      }

      async function saveStartup(opts = {}) {
        if (!opts.skipAuthGate && !me.value) {
          promptAuthToSave('startup');
          return;
        }
        const body = {
          name: formStartup.name,
          slug: formStartup.slug || undefined,
          url: formStartup.url,
          github: formStartup.github,
          logo: formStartup.logo,
          description: formStartup.description,
          tags: splitTagList(formStartup.tags),
          links: parseLinksText(formStartup.linksText),
          applyDefaults: formStartup.applyDefaults,
          stage: formStartup.stage || 'early',
          status: toApiListingStatus(formStartup.status),
        };
        try {
          if (route.value.slug) {
            await WorkixAPI.updateStartup(route.value.slug, body);
          } else {
            const created = await WorkixAPI.createStartup(body);
            showToast(t('saved'));
            navigateProject(created.slug);
            return;
          }
          showToast(t('saved'));
          navigateProject(formStartup.slug || route.value.slug);
        } catch (e) {
          if (e && e.status === 401) {
            promptAuthToSave('startup');
            return;
          }
          showToast((e && e.message) || t('error'));
        }
      }

      async function saveRole(opts = {}) {
        if (!opts.skipAuthGate && !me.value) {
          promptAuthToSave('role');
          return;
        }
        const startupId = String(formRole.startupId || '').trim();
        const body = {
          title: formRole.title,
          slug: formRole.slug || undefined,
          description: formRole.description,
          tags: splitTagList(formRole.tags),
          kind: formRole.kind || 'task',
          project: formRole.project || '',
          payment: {
            budget: (formRole.payment && formRole.payment.budget) || '',
            type: (formRole.payment && formRole.payment.type) || 'work',
            cur: (formRole.payment && formRole.payment.cur) || 'USDT',
          },
          apply_url: formRole.apply_url,
          apply_email: formRole.apply_email,
          apply_telegram: formRole.apply_telegram,
          links: parseLinksText(formRole.linksText),
          status: toApiListingStatus(formRole.status || 'pending'),
        };
        if (startupId) body.startupId = startupId;
        try {
          if (formRole._id) {
            if (!startupId && WorkixAPI.updateOrder) {
              await WorkixAPI.updateOrder(formRole._id, body);
            } else {
              await WorkixAPI.updateRole(formRole._id, body);
            }
            showToast(t('saved'));
            if (!startupId) navigate(`order/${formRole._id}`);
            else navigate(`role/${formRole._id}`);
            return;
          }
          if (!startupId) {
            const created = await WorkixAPI.createOrder(body);
            showToast(t('saved'));
            navigate(`order/${created.sid || created.id}`);
            return;
          }
          const created = await WorkixAPI.createRole(body);
          showToast(t('saved'));
          navigate(`role/${created.id}`);
        } catch (e) {
          if (e && e.status === 401) {
            promptAuthToSave('role');
            return;
          }
          showToast((e && e.message) || t('error'));
        }
      }

      async function saveProfile() {
        const p = Object.assign({}, profile.value || {});
        if (!p.payment || typeof p.payment !== 'object') {
          p.payment = { budget: '', type: 'work', cur: 'USDT' };
        }
        p.displayCurrency = displayCurrency.value || p.displayCurrency || 'USDT';
        p.links = parseLinksText(profileLinksText.value);
        p.slug = String(p.slug || '').trim().toLowerCase();
        try {
          profile.value = await WorkixAPI.updateProfile(p) || p;
          profileLinksText.value = linksToText((profile.value && profile.value.links) || p.links);
          if (profile.value && profile.value.displayCurrency) {
            setDisplayCurrency(profile.value.displayCurrency);
          }
          showToast(t('saved'));
        } catch (e) {
          if (e && e.status === 409) {
            showToast(t('slug_taken') || 'Slug taken');
            return;
          }
          showToast((e && e.message) || t('error'));
        }
      }

      async function doImportProfile() {
        const res = await WorkixAPI.importProfile({ text: importText.value });
        profile.value = Object.assign({}, profile.value, res.suggestion || {});
        showToast(t('saved'));
      }

      async function savePrefs() {
        const body = normalizePrefsClient(prefs.value);
        prefs.value = normalizePrefsClient(await WorkixAPI.updatePrefs(body));
        showToast(t('saved'));
      }

      function onPrefsUpdated(next) {
        prefs.value = normalizePrefsClient(next || prefs.value);
      }

      async function sendSupport() {
        const message = String(formSupport.message || '').trim();
        if (message.length < 20) {
          showToast(t('support_msg_short'));
          return;
        }
        if (supportSending.value) return;
        supportSending.value = true;
        try {
          await WorkixAPI.feedback({
            type: 'support',
            subject: 'Support',
            message,
            contact: String(formSupport.contact || '').trim() || undefined,
            context: { path: location.pathname + location.hash, locale: locale.value },
          });
          formSupport.message = '';
          showToast(t('support_sent'));
        } catch (e) {
          const code = apiErrorCode(e) || (e && e.message) || '';
          const retry = e && e.data && e.data.retryAfterSec;
          if (code === 'cooldown' || (e && e.status === 429 && (e.data && e.data.error) === 'cooldown')) {
            const mins = retry ? Math.max(1, Math.ceil(Number(retry) / 60)) : 60;
            showToast(t('support_cooldown').replace('{mins}', String(mins)));
          } else if (code === 'daily_limit' || (e && e.data && e.data.error) === 'daily_limit') {
            showToast(t('support_daily_limit'));
          } else {
            showToast((e && e.message) || t('error'));
          }
        } finally {
          supportSending.value = false;
        }
      }

      function resetApplyForm(role) {
        formApply.name = (me.value && me.value.name) || formApply.name || '';
        formApply.contact = formApply.contact || '';
        formApply.Interesity = null;
        formApply.Difficulty = null;
        formApply.Understandability = null;
        formApply.Budget = '';
        formApply.Currency = (role && role.payment && role.payment.cur) || 'USDT';
        formApply.Time = null;
        formApply.Description = '';
        formApply.score = null;
      }

      async function sendApply() {
        if (!currentRole.value) return;
        if (!me.value) {
          navigate('auth');
          return;
        }
        applySaving.value = true;
        try {
          await WorkixAPI.track('apply_click', { roleId: currentRole.value.id });
          const res = await WorkixAPI.apply({
            roleId: currentRole.value.id,
            name: formApply.name,
            contact: formApply.contact,
            message: formApply.Description,
            Description: formApply.Description,
            Interesity: formApply.Interesity,
            Difficulty: formApply.Difficulty,
            Understandability: formApply.Understandability,
            Budget: formApply.Budget,
            Currency: formApply.Currency,
            Time: formApply.Time,
          });
          if (res && res.score != null) formApply.score = res.score;
          showToast(t('proposal_saved') || t('saved'));
          const ext = (isExternalApplyUrl(currentRole.value.apply_url) ? currentRole.value.apply_url : '')
            || (currentRole.value.apply_email ? `mailto:${currentRole.value.apply_email}` : '')
            || (currentRole.value.apply_telegram ? `https://t.me/${String(currentRole.value.apply_telegram).replace('@', '')}` : '');
          if (ext) setTimeout(() => { window.open(ext, '_blank'); }, 400);
        } catch (e) {
          if (e && e.status === 401) {
            navigate('auth');
            return;
          }
          showToast((e && e.message) || t('error'));
        } finally {
          applySaving.value = false;
        }
      }

      /** True only for a real off-site apply page (not Workix / relative /order/…). */
      function isExternalApplyUrl(raw) {
        const s = String(raw || '').trim();
        if (!s) return false;
        if (s.startsWith('#') || s.startsWith('/') || s.startsWith('?')) return false;
        if (!/^https?:\/\//i.test(s)) return false;
        try {
          const u = new URL(s);
          const host = String(u.hostname || '').toLowerCase().replace(/^www\./, '');
          if (!host) return false;
          if (host === 'workix.co' || host.endsWith('.workix.co')) return false;
          if (typeof location !== 'undefined' && location.hostname) {
            const here = String(location.hostname).toLowerCase().replace(/^www\./, '');
            if (host === here) return false;
          }
          return true;
        } catch (e) {
          return false;
        }
      }

      function absoluteShareUrl(pathOrHash) {
        const raw = String(pathOrHash || '');
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.startsWith('#')) return `${location.origin}/${raw}`;
        if (raw.startsWith('/')) return `${location.origin}${raw}`;
        return `${location.origin}/${raw.replace(/^\//, '')}`;
      }

      function entityShareUrl(kind, entity) {
        if (!entity) return location.href;
        if (kind === 'order') {
          const sid = entity.sid || entity.id;
          return absoluteShareUrl(`/order/${encodeURIComponent(sid)}`);
        }
        if (kind === 'performer') {
          return absoluteShareUrl(performerPublicPath(entity));
        }
        if (kind === 'startup' || kind === 'project') {
          return absoluteShareUrl(projectPath(entity.slug || entity.id));
        }
        if (kind === 'role') {
          const st = entity.startupSlug || (currentStartup.value && currentStartup.value.slug);
          const roleKey = entity.slug || entity.id;
          if (st && roleKey) {
            return absoluteShareUrl(projectPath(st, roleKey));
          }
          return absoluteShareUrl(`/role/${encodeURIComponent(entity.id)}`);
        }
        return location.href;
      }

      async function sharePage(opts = {}) {
        const title = String(opts.title || 'Workix').trim();
        const text = String(opts.text || title).trim();
        const url = absoluteShareUrl(opts.url || location.href);
        try {
          if (navigator.share) {
            await navigator.share({ title, text, url });
            return url;
          }
        } catch (e) {
          if (e && e.name === 'AbortError') return url;
        }
        try {
          await navigator.clipboard.writeText(url);
          showToast(t('copied'));
        } catch (e) {
          showToast(url);
        }
        return url;
      }

      function shareLink(startupSlug, roleSlug) {
        return sharePage({
          title: 'Workix',
          text: roleSlug ? `${startupSlug} / ${roleSlug}` : startupSlug,
          url: projectPath(startupSlug, roleSlug),
        });
      }

      function shareOrder(order) {
        const o = order || currentOrder.value;
        if (!o) return;
        const text = [o.title, o.description].filter(Boolean).join(' — ').slice(0, 280);
        return sharePage({
          title: o.title || t('order_title'),
          text: text || o.title || t('order_title'),
          url: entityShareUrl('order', o),
        });
      }

      function sharePerformer(performer) {
        const p = performer || currentPerformer.value;
        if (!p) return;
        const text = [p.name, p.headline || p.bio || p.description].filter(Boolean).join(' — ').slice(0, 280);
        return sharePage({
          title: p.name || t('performer_title'),
          text: text || p.name || t('performer_title'),
          url: entityShareUrl('performer', p),
        });
      }

      const pdfSaving = ref(false);
      async function savePerformerPdf(performer) {
        const p = performer || currentPerformer.value;
        if (!p || pdfSaving.value) return;
        pdfSaving.value = true;
        showToast(t('save_pdf_loading'));
        try {
          const lang = String(locale.value || 'en').slice(0, 8);
          const path = p.slug
            ? `/${encodeURIComponent(p.slug)}/pdf`
            : `/performer/${encodeURIComponent(p.id)}/pdf`;
          const url = `${path}?lang=${encodeURIComponent(lang)}`;
          const res = await fetch(url, { credentials: 'omit' });
          if (!res.ok) throw new Error((await res.text().catch(() => '')) || `PDF ${res.status}`);
          const blob = await res.blob();
          const cvPdf = (typeof window !== 'undefined' ? window : globalThis).WorkixCvPdf;
          const filename = (cvPdf && typeof cvPdf.performerPdfFilename === 'function')
            ? cvPdf.performerPdfFilename(p)
            : `${(p.name || 'Performer').trim()} — workix.pdf`;
          const a = document.createElement('a');
          const objectUrl = URL.createObjectURL(blob);
          a.href = objectUrl;
          a.download = filename;
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
          showToast(t('save_pdf_done'));
        } catch (e) {
          console.error('[workix:pdf]', e);
          // Fallback: client html2pdf with already-localized card fields
          try {
            const cvPdf = (typeof window !== 'undefined' ? window : globalThis).WorkixCvPdf;
            if (!(cvPdf && typeof cvPdf.downloadPerformerPdf === 'function')) throw e;
            const bv = budgetView(p);
            const rateText = bv.empty
              ? ''
              : `${t('pdf_rate') || 'Rate'}: ${formatMoney(bv.amount)} ${bv.currency}`;
            await cvPdf.downloadPerformerPdf(p, {
              contacts: performerContacts(p),
              availability: availabilityLabel(p.availability || 'open'),
              rateText,
              locale: locale.value,
              labels: {
                about: t('pdf_about'),
                skills: t('pdf_skills'),
                links: t('pdf_links'),
                rate: t('pdf_rate'),
                generated: t('pdf_generated'),
                telegram: t('contact_telegram'),
                email: t('contact_email'),
                link: t('contact_link'),
              },
            });
            showToast(t('save_pdf_done'));
          } catch (e2) {
            console.error('[workix:pdf:fallback]', e2);
            showToast((e2 && e2.message) || (e && e.message) || t('error'));
          }
        } finally {
          pdfSaving.value = false;
        }
      }

      function shareStartup(startup) {
        const s = startup || currentStartup.value;
        if (!s) return;
        const text = [s.name, s.description].filter(Boolean).join(' — ').slice(0, 280);
        return sharePage({
          title: s.name || t('feed_projects'),
          text: text || s.name || t('feed_projects'),
          url: entityShareUrl('startup', s),
        });
      }

      function openOrderCard(id) {
        navigate(`order/${encodeURIComponent(id)}`);
      }

      /** Orders feed mixes board tasks + project roles. */
      function openFeedOrder(r) {
        if (r && r.source === 'role' && r.startupSlug) {
          navigateProject(r.startupSlug, r.roleSlug || r.slug || null);
          return;
        }
        openOrderCard((r && (r.sid || r.id)) || r);
      }

      function openPerformerCard(idOrEntity) {
        if (idOrEntity && typeof idOrEntity === 'object') {
          const key = idOrEntity.slug
            || idOrEntity.performerId
            || idOrEntity.id
            || idOrEntity.userId;
          const url = performerPublicPath({
            slug: idOrEntity.slug,
            id: key,
          });
          if (url.startsWith('/performer/')) {
            navigate(`performer/${encodeURIComponent(key)}`);
          } else {
            history.pushState(null, '', url);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
          return;
        }
        navigate(`performer/${encodeURIComponent(idOrEntity)}`);
      }

      function openStartupCard(slug) {
        navigateProject(slug);
      }

      function goHome() {
        setFeed('projects');
        navigate('catalog');
      }

      /** Rewrite hash/legacy URLs to path forms crawlers can preview (Telegram etc.). */
      function canonicalizeShareUrls() {
        const path = location.pathname || '/';
        const hash = String(location.hash || '');

        let m = hash.match(/^#\/performer\/([^/]+)\/?$/i);
        if (m) {
          const id = encodeURIComponent(decodeURIComponent(m[1]));
          const canon = `/performer/${id}`;
          if (path + hash !== canon) {
            history.replaceState(null, '', canon);
            return true;
          }
        }
        m = hash.match(/^#\/order\/([^/]+)\/?$/i);
        if (m) {
          const id = encodeURIComponent(decodeURIComponent(m[1]));
          const canon = `/order/${id}`;
          if (path + hash !== canon) {
            history.replaceState(null, '', canon);
            return true;
          }
        }
        // Bare "#/role/:id" (no startup context in the hash itself). If the current
        // pathname already names a project (e.g. /vpnbox#/role/abc from a stale link),
        // reuse it as the startup slug; otherwise fall back to the global /role/:id path
        // so the URL is at least absolute and crawlable instead of hash-only.
        m = hash.match(/^#\/role\/([^/]+)\/?$/i);
        if (m) {
          const id = encodeURIComponent(decodeURIComponent(m[1]));
          const pathSlug = path.replace(/^\//, '').split('/')[0] || '';
          const canon = pathSlug && !isReservedPathSegment(pathSlug)
            ? `/${encodeURIComponent(pathSlug)}/${id}`
            : `/role/${id}`;
          if (path + hash !== canon) {
            history.replaceState(null, '', canon);
            return true;
          }
        }

        let slug = null;
        let role = null;
        m = path.match(/^\/(?:go|p)\/([^/]+)(?:\/([^/]+))?\/?$/i);
        if (m) {
          slug = decodeURIComponent(m[1]);
          role = m[2] && m[2] !== 'edit' ? decodeURIComponent(m[2]) : null;
          if (m[2] === 'edit') {
            history.replaceState(null, '', `/p/${encodeURIComponent(slug)}/edit`);
            return true;
          }
        }
        m = hash.match(/^#\/(?:go|p|project|startup)\/([^/]+)(?:\/([^/]+))?\/?$/i);
        if (!slug && m) {
          slug = decodeURIComponent(m[1]);
          role = m[2] && m[2] !== 'edit' ? decodeURIComponent(m[2]) : null;
          if (m[2] === 'edit') {
            history.replaceState(null, '', `/p/${encodeURIComponent(slug)}/edit`);
            return true;
          }
        }
        if (slug && !isReservedPathSegment(slug)) {
          const canon = projectPath(slug, role);
          if (path + hash !== canon) {
            history.replaceState(null, '', canon);
            return true;
          }
        }
        return false;
      }

      function copyText(text) {
        navigator.clipboard?.writeText(text || '');
        showToast(t('copied'));
      }

      function onRoute() {
        accountOpen.value = false;
        langOpen.value = false;
        notifyOpen.value = false;
        canonicalizeShareUrls();
        route.value = parseRoute();
        if (ensureOnboarding()) return;
        routeLoad();
      }

      function closeHelpTips(except) {
        document.querySelectorAll('.wx-help.is-open').forEach((el) => {
          if (except && el === except) return;
          el.classList.remove('is-open', 'tip-above', 'tip-below');
        });
      }

      function positionHelpTip(el) {
        if (!el) return;
        const margin = 12;
        const maxW = Math.min(288, Math.max(160, window.innerWidth - margin * 2));
        const rect = el.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - maxW / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - margin - maxW));
        const spaceAbove = rect.top - margin;
        const preferBelow = window.innerWidth < 768 || spaceAbove < 96;
        el.classList.toggle('tip-below', preferBelow);
        el.classList.toggle('tip-above', !preferBelow);
        if (preferBelow) {
          el.style.setProperty('--tip-top', `${Math.round(rect.bottom + 8)}px`);
        } else {
          el.style.setProperty('--tip-top', `${Math.round(rect.top - 8)}px`);
        }
        el.style.setProperty('--tip-left', `${Math.round(left)}px`);
        el.style.setProperty('--tip-width', `${Math.round(maxW)}px`);
      }

      onMounted(async () => {
        document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : locale.value;
        document.addEventListener('click', (event) => {
          const t = event.target;
          if (!(t && t.closest && t.closest('.wx-lang'))) langOpen.value = false;
          if (!(t && t.closest && t.closest('.wx-account'))) accountOpen.value = false;
          if (!(t && t.closest && t.closest('.wx-notify'))) notifyOpen.value = false;

          const help = t && t.closest && t.closest('.wx-help');
          if (help) {
            event.preventDefault();
            const willOpen = !help.classList.contains('is-open');
            closeHelpTips();
            if (willOpen) {
              positionHelpTip(help);
              help.classList.add('is-open');
            }
            return;
          }
          closeHelpTips();
        });
        window.addEventListener('scroll', () => {
          closeHelpTips();
          onFeedWindowScroll();
        }, { passive: true, capture: true });
        window.addEventListener('resize', () => closeHelpTips(), { passive: true });

        const params = new URLSearchParams(location.search);
        if (params.get('mock') === '1') {
          WorkixAPI.setMock(true);
        } else if (params.get('mock') === '0') {
          WorkixAPI.setMock(false);
        } else {
          // Prefer live hub API when available on same origin
          try {
            const h = await fetch(`${WorkixAPI.getState().base}/api/v1/health`, { method: 'GET' });
            if (h.ok) WorkixAPI.setMock(false);
          } catch (e) {
            /* keep previous mock preference */
          }
        }
        keyDraft.value = WorkixAuth.get().agentApiKey || '';
        if (WorkixAPI.setContentLang) WorkixAPI.setContentLang(locale.value);
        if (WorkixAPI.setFeatureHost) {
          const params = new URLSearchParams(location.search);
          // Keep parity with legacy URLi.host → socket data.host
          WorkixAPI.setFeatureHost(params.get('host') || params.get('site') || location.host || location.hostname || '');
        }
        applySiteBrand();
        await loadLocale(locale.value);
        await refreshMe();
        // Listeners must be live BEFORE the first onRoute(): on a first visit
        // ensureOnboarding() redirects via navigate(), which dispatches popstate
        // synchronously. If nothing is listening yet that event is lost and the
        // early return skips routeLoad() — leaving the app stuck on "Loading…".
        window.addEventListener('hashchange', onRoute);
        window.addEventListener('popstate', onRoute);
        onRoute();
        window.addEventListener('WEB3', () => {
          finishMvseLogin();
        });

        setInterval(advanceSlogan, 7000);

        setInterval(() => {
          WorkixAPI.online().then((x) => { online.value = Number(x.online || 0); }).catch(() => {});
        }, 60000);

        const refreshUnread = () => {
          if (!WorkixAuth.bearer()) return;
          WorkixAPI.listNotifications({ limit: 1 }).then((res) => {
            notifyUnread.value = Number((res && res.unread) || 0);
          }).catch(() => {});
        };
        refreshUnread();
        setInterval(refreshUnread, 60000);

        window.addEventListener('beforeinstallprompt', (event) => {
          event.preventDefault();
          deferredPwaPrompt = event;
          pwaCanInstall.value = true;
        });

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/hub/sw.js').catch(() => { /* optional */ });
        }

        // Server-rendered SEO block: real HTML so crawlers see content and links
        // without running JS, and it covers the v-cloak gap while Vue boots.
        // Drop it once the app owns the screen.
        document.querySelectorAll('.wx-seo-fallback, .wx-boot').forEach((el) => el.remove());
      });

      watch(q, () => scheduleFeedReload());
      watch(
        () => [
          feed.value,
          filters.priceFrom,
          (filters.openTo || []).join(','),
          (filters.tagsOn || []).join(','),
          JSON.stringify(filters.types),
        ],
        (next, prev) => {
          if (!prev) return;
          if (next[0] !== prev[0]) return; // setFeed handles feed switch
          scheduleFeedReload();
        },
      );

      watch([filteredOrders, filteredProjects, filteredPerformers, availableTags, feed], () => refreshEmojis());
      watch(filteredProjects, (list) => enrichProjectLogos(list), { deep: false });
      watch(performerProjects, (list) => enrichProjectLogos(list), { deep: false });
      watch(mineStartups, (list) => enrichProjectLogos(list), { deep: false });
      watch(currentStartup, (st) => {
        if (st) {
          enqueueProjectLogo(st);
          enrichLinkIcons(st.links);
        }
      });
      watch(currentPerformer, (p) => { if (p) enrichLinkIcons(p.links); });
      watch(currentOrder, (o) => { if (o) enrichLinkIcons(o.links); });
      watch(currentRole, (r) => { if (r) enrichLinkIcons(r.links); });
      watch(() => route.value.name, (name) => {
        if (name === 'catalog') nextTick().then(bindFeedSentinels);
      });
      watch(loading, (v) => {
        if (!v && route.value.name === 'catalog') nextTick().then(bindFeedSentinels);
      });

      return {
        locale, route, loading, toast, me, startups, roles, orders, performers, boardTags,
        online, mineStartups,
        currentStartup, currentRole, currentPerformer, currentOrder, routeError, carousel, profile, prefs, q, onceKey, keyDraft,
        performerProjects, performerOrders, performerRoles,
        keyRotating, displayedAgentKey,
        importText, apiMeta, authStore, formStartup, formRole, formApply, formSupport, formProposal,
        proposalSaving, applySaving, supportSending, walletChains, proposalCurrencies,
        feed, filters, slogans, sloganIndex, sloganTick, prevSlogan, currentSlogan, siteBrand,
        feedTitle, feedSearchPlaceholder,
        feedTypeOptions, openToOptions, availableTags,
        filteredOrders, filteredProjects, filteredPerformers,
        feedPager, feedTopSentinel, feedBottomSentinel,
        pwaCanInstall, appVersion, footerYear, showBackTop, scrollToTop,
        hubCases, hubPartners,
        languages, langOpen, accountOpen, notifyOpen, notifications, notifyUnread,
        localeLoading, flagClass, pickLang,
        payCurrencies, taskKinds, profileLinksText,
        availabilityOptions, listingStageOptions, projectStageOptions, availabilityLabel, contactLabel, performerContacts, openAccountMenu,
        stageLabel,
        isHubAdmin, canManageStartup, canManageRole,
        t, projectLogo, projectLogoStyle, linkIcon, statusClass, statusLabel, isExternalApplyUrl, setLang, navigate, goHome, chooseSegment, agentPrompt, copyAgentPrompt,
        doRegister, doRotate, doLogout, setAgentKey, loginMvse, saveStartup, saveStartupKeep, saveRole, saveRoleKeep, saveProfile,
        doImportProfile, savePrefs, onPrefsUpdated, sendApply, sendSupport, sendOrderProposal, shareLink, sharePage, shareOrder, sharePerformer, savePerformerPdf, pdfSaving, shareStartup,
        openOrderCard, openFeedOrder, openPerformerCard, openStartupCard, openPerformerRole, copyText, splitTagList,
        bodyKey, bodyNeedsExpand, isBodyExpanded, toggleBodyExpand, renderMarkdown,
        publisherWallet, publisherWalletList, fromNow,
        rolesForStartup, goLegacyMvse, refreshMe, loadMine,
        setFeed, kindLabel, projectKind, formatBudget, budgetView, formatMoney, installPwa, refreshEmojis,
        displayCurrency, setDisplayCurrency,
        toggleNotifyPanel, formatNotifyTime, openNotification, markAllNotificationsRead,
      };
    },
  }).mount('#app');
})();
