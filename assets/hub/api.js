(function (global) {
  function detectApiBase() {
    const meta = document.querySelector('meta[name="workix-api"]');
    if (global.WORKIX_API) return String(global.WORKIX_API).replace(/\/$/, '');
    if (meta && String(meta.content || '').trim()) {
      return String(meta.content).trim().replace(/\/$/, '');
    }
    // Local hub process (API on same origin)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return location.origin;
    }
    // CNAME / self-host UI mirrors: catalog lives on the central hub
    return 'https://workix.co';
  }

  function wantMock() {
    const params = new URLSearchParams(location.search);
    if (params.get('mock') === '1') return true;
    if (params.get('mock') === '0') return false;
    if (localStorage.getItem('workix_mock') === '1') return true;
    if (localStorage.getItem('workix_mock') === '0') return false;
    return false;
  }

  function detectFeatureHost() {
    try {
      const params = new URLSearchParams(location.search);
      // Explicit override (mirrors /?host= for share links)
      if (params.get('host')) return String(params.get('host'));
      if (params.get('site')) return String(params.get('site'));
      // Legacy socket used URLi.host (hostname[:port]); work.* stripped server-side
      return location.host || location.hostname || '';
    } catch (e) {
      return '';
    }
  }

  const state = {
    base: detectApiBase(),
    mock: wantMock(),
    contentLang: (typeof localStorage !== 'undefined' && localStorage.getItem('workix_lang')) || 'en',
    featureHost: detectFeatureHost(),
  };

  function withLangParams(query = {}) {
    const out = { ...(query || {}) };
    if (!out.lang && !out.locale) out.lang = state.contentLang || 'en';
    // Same as legacy socket.emit('get', { type:'tasks', host: URLi.host })
    if (state.featureHost) out.host = out.host || state.featureHost;
    return out;
  }

  function buildQs(query = {}, { arrays = false } = {}) {
    const qs = new URLSearchParams();
    Object.entries(withLangParams(query)).forEach(([k, v]) => {
      if (arrays && Array.isArray(v)) {
        if (v.length) qs.set(k, v.join(','));
      } else if (v !== undefined && v !== null && v !== '') {
        qs.set(k, String(v));
      }
    });
    return qs.toString();
  }

  async function liveRequest(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = global.WorkixAuth && global.WorkixAuth.bearer();
    if (token) headers.Authorization = `Bearer ${token}`;
    // Explicit page host (API may be on another origin; Host header alone is wrong)
    if (state.featureHost) headers['X-Workix-Host'] = state.featureHost;
    const res = await fetch(`${state.base}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
    if (!res.ok) {
      const err = new Error((data && data.error) || res.statusText || 'Request failed');
      err.status = res.status;
      err.data = data;
      err.code = data && data.code;
      throw err;
    }
    return data;
  }

  function requireUser(db) {
    const auth = global.WorkixAuth.get();
    let user = null;
    if (auth.userId && db.users[auth.userId]) user = db.users[auth.userId];
    if (!user && auth.agentApiKey) {
      user = Object.values(db.users).find((u) => u.agentApiKey === auth.agentApiKey) || null;
    }
    if (!user) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    return user;
  }

  /** Same funnel as lib/hub-applications.js. */
  const APPLICATION_STATUSES = [
    'draft', 'sent', 'viewed', 'reply', 'interview', 'offer', 'hired', 'rejected', 'closed',
  ];

  /** Signed-in user without throwing — used where auth is optional. */
  function currentUser(db) {
    try {
      return requireUser(db);
    } catch (e) {
      return null;
    }
  }

  /** Anonymous apply counter for one card: how many, and is the viewer one of them. */
  function appliedStats(db, item) {
    const rows = db.applications || [];
    const key = String((item && (item.id || item.sid)) || '');
    if (!key) return { count: 0, byMe: false };
    const mine = currentUser(db);
    const matching = rows.filter((a) => a.status !== 'draft'
      && (String(a.targetId) === key || String(a.orderId) === key || String(a.roleId) === key));
    return {
      count: matching.length,
      byMe: !!(mine && matching.some((a) => a.userId === mine.id)),
    };
  }

  function publicStartup(s) {
    return { ...s };
  }

  function publicRole(r) {
    return { ...r };
  }

  async function mockRequest(path, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    const db = global.WorkixMockDb.load();
    const url = new URL(path, 'http://mock.local');
    const p = url.pathname;
    const q = Object.fromEntries(url.searchParams.entries());

    // AUTH
    if (method === 'POST' && p === '/api/v1/auth/register') {
      const id = global.WorkixMockDb.uid('user');
      const agentApiKey = `wix_mock_${global.WorkixMockDb.uid('k')}`;
      const publicKey = `pk_${global.WorkixMockDb.uid('p')}`;
      const privateKeyOnce = `sk_${global.WorkixMockDb.uid('s')}`;
      db.users[id] = {
        id,
        name: 'New builder',
        avatar: '',
        segment: null,
        publicKey,
        privateKey: privateKeyOnce,
        agentApiKey,
        profile: { name: 'New builder', headline: '', bio: '', skills: [], links: [], location: '', openTo: [] },
      };
      global.WorkixMockDb.save(db);
      global.WorkixAuth.set({ userId: id, agentApiKey, publicKey, privateKey: privateKeyOnce });
      return {
        userId: id,
        publicKey,
        privateKeyOnce,
        agentApiKey,
        seedOnce: privateKeyOnce,
      };
    }

    if (method === 'POST' && p === '/api/v1/auth/challenge') {
      return { challenge: `chal_${Date.now()}`, expiresAt: new Date(Date.now() + 300000).toISOString() };
    }

    if (method === 'POST' && p === '/api/v1/auth/verify') {
      const user = Object.values(db.users).find((u) => u.publicKey === (opts.body && opts.body.publicKey));
      if (!user) { const e = new Error('Unknown key'); e.status = 404; throw e; }
      const token = `jwt_mock_${user.id}`;
      global.WorkixAuth.set({ userId: user.id, token, agentApiKey: user.agentApiKey });
      return { token, expiresAt: new Date(Date.now() + 3600000).toISOString() };
    }

    if (method === 'POST' && p === '/api/v1/auth/link-mvse') {
      const user = requireUser(db);
      user.mvseUserId = opts.body && opts.body.mvseUserId;
      global.WorkixMockDb.save(db);
      return { ok: true, userId: user.id };
    }

    if (method === 'POST' && p === '/api/v1/auth/mvse') {
      const body = opts.body || {};
      const mvseUserId = String(body.mvseUserId || body.userId || body.id || '').trim();
      if (!mvseUserId) {
        const err = new Error('mvseUserId required');
        err.status = 400;
        throw err;
      }
      let user = Object.values(db.users).find((u) => String(u.mvseUserId) === mvseUserId) || null;
      let created = false;
      let agentApiKey;
      if (!user) {
        created = true;
        const id = global.WorkixMockDb.uid('u');
        agentApiKey = `wix_mock_${global.WorkixMockDb.uid('k')}`;
        user = {
          id,
          name: body.name || 'Builder',
          avatar: body.avatar || '',
          segment: null,
          publicKey: `pk_mock_${id}`,
          agentApiKey,
          mvseUserId,
          profile: { name: body.name || 'Builder', headline: '', bio: '', skills: [], links: [], location: '', openTo: [] },
        };
        db.users[id] = user;
        global.WorkixMockDb.save(db);
      }
      const token = `jwt_mock_${user.id}`;
      global.WorkixAuth.set({
        userId: user.id,
        token,
        agentApiKey: agentApiKey || user.agentApiKey,
        mvseUserId,
      });
      const out = {
        userId: user.id,
        token,
        created,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          segment: user.segment,
          publicKey: user.publicKey,
          hasAgentKey: !!user.agentApiKey,
        },
      };
      if (agentApiKey) out.agentApiKey = agentApiKey;
      return out;
    }

    if (method === 'GET' && p === '/api/v1/me') {
      const user = requireUser(db);
      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        segment: user.segment,
        publicKey: user.publicKey,
        hasAgentKey: !!user.agentApiKey,
      };
    }

    if (method === 'PATCH' && p === '/api/v1/me') {
      const user = requireUser(db);
      Object.assign(user, opts.body || {});
      global.WorkixMockDb.save(db);
      return { id: user.id, name: user.name, avatar: user.avatar, segment: user.segment, publicKey: user.publicKey, hasAgentKey: !!user.agentApiKey };
    }

    if (method === 'POST' && p === '/api/v1/me/agent-key/rotate') {
      const user = requireUser(db);
      user.agentApiKey = `wix_mock_${global.WorkixMockDb.uid('k')}`;
      global.WorkixMockDb.save(db);
      global.WorkixAuth.set({ userId: user.id, agentApiKey: user.agentApiKey });
      return { agentApiKey: user.agentApiKey };
    }

    // STARTUPS
    if (method === 'GET' && p === '/api/v1/startups') {
      let items = Object.values(db.startups);
      if (q.mine === 'true') {
        const user = requireUser(db);
        items = items.filter((s) => s.publisherId === user.id);
      } else {
        items = items.filter((s) => s.status === 'approved');
      }
      if (q.status) items = items.filter((s) => s.status === q.status);
      if (q.q) {
        const n = q.q.toLowerCase();
        items = items.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(n));
      }
      return { items: items.map(publicStartup) };
    }

    if (method === 'POST' && p === '/api/v1/startups') {
      const user = requireUser(db);
      const body = opts.body || {};
      const slug = global.WorkixMockDb.slugify(body.slug || body.name);
      if (Object.values(db.startups).some((s) => s.slug === slug)) {
        const e = new Error('Slug taken'); e.status = 409; throw e;
      }
      const id = global.WorkixMockDb.uid('st');
      const st = {
        id,
        slug,
        name: body.name,
        logo: body.logo || '',
        url: body.url || '',
        description: body.description || '',
        status: body.status === 'draft' ? 'draft' : 'pending',
        publisherId: user.id,
        applyDefaults: body.applyDefaults || {},
        stats: { shareViews: 0, applyClicks: 0 },
        createdAt: global.WorkixMockDb.now(),
        updatedAt: global.WorkixMockDb.now(),
      };
      // mock auto-approve pending for nicer demo
      if (st.status === 'pending') st.status = 'approved';
      db.startups[id] = st;
      global.WorkixMockDb.save(db);
      return publicStartup(st);
    }

    const stMatch = p.match(/^\/api\/v1\/startups\/([^/]+)$/);
    if (stMatch) {
      const slug = decodeURIComponent(stMatch[1]);
      const st = Object.values(db.startups).find((s) => s.slug === slug || s.id === slug);
      if (!st) { const e = new Error('Not found'); e.status = 404; throw e; }
      if (method === 'GET') {
        if (st.status !== 'approved') {
          let viewer = null;
          try { viewer = requireUser(db); } catch (e) { viewer = null; }
          if (!viewer || String(viewer.id) !== String(st.publisherId)) {
            if (st.status === 'pending') {
              const e = new Error('Pending moderation');
              e.status = 403;
              e.code = 'pending_moderation';
              e.data = { error: e.message, code: e.code, status: 'pending' };
              throw e;
            }
            if (st.status === 'rejected') {
              const e = new Error('Rejected');
              e.status = 403;
              e.code = 'rejected';
              e.data = { error: e.message, code: e.code, status: 'rejected' };
              throw e;
            }
            const e = new Error('Not found'); e.status = 404; throw e;
          }
        }
        return publicStartup(st);
      }
      if (method === 'PATCH') {
        const user = requireUser(db);
        if (st.publisherId !== user.id) { const e = new Error('Forbidden'); e.status = 403; throw e; }
        const body = opts.body || {};
        ['name', 'logo', 'url', 'description', 'applyDefaults'].forEach((k) => {
          if (body[k] !== undefined) st[k] = body[k];
        });
        if (body.status === 'draft' || body.status === 'pending') {
          st.status = body.status === 'pending' ? 'approved' : 'draft';
        }
        st.updatedAt = global.WorkixMockDb.now();
        global.WorkixMockDb.save(db);
        return publicStartup(st);
      }
    }

    // ROLES
    if (method === 'GET' && p === '/api/v1/roles') {
      let items = Object.values(db.roles);
      if (q.mine === 'true') {
        const user = requireUser(db);
        items = items.filter((r) => r.publisherId === user.id);
      } else {
        items = items.filter((r) => r.status === 'approved');
      }
      if (q.startup) {
        items = items.filter((r) => r.startupSlug === q.startup || r.startupId === q.startup);
      }
      if (q.q) {
        const n = q.q.toLowerCase();
        items = items.filter((r) => `${r.title} ${r.description}`.toLowerCase().includes(n));
      }
      return { items: items.map(publicRole) };
    }

    if (method === 'POST' && p === '/api/v1/roles') {
      const user = requireUser(db);
      const body = opts.body || {};
      const st = Object.values(db.startups).find((s) => s.id === body.startupId || s.slug === body.startupId);
      if (!st) { const e = new Error('Startup not found'); e.status = 404; throw e; }
      if (st.publisherId !== user.id) { const e = new Error('Forbidden'); e.status = 403; throw e; }
      const id = global.WorkixMockDb.uid('role');
      const role = {
        id,
        slug: global.WorkixMockDb.slugify(body.slug || body.title),
        startupId: st.id,
        startupSlug: st.slug,
        title: body.title,
        description: body.description || '',
        status: body.status === 'draft' ? 'draft' : 'approved',
        apply_url: body.apply_url || (st.applyDefaults && st.applyDefaults.apply_url) || '',
        apply_email: body.apply_email || (st.applyDefaults && st.applyDefaults.apply_email) || '',
        apply_telegram: body.apply_telegram || (st.applyDefaults && st.applyDefaults.apply_telegram) || '',
        tags: body.tags || [],
        highlightPriority: 0,
        publisherId: user.id,
        createdAt: global.WorkixMockDb.now(),
        updatedAt: global.WorkixMockDb.now(),
      };
      db.roles[id] = role;
      global.WorkixMockDb.save(db);
      return publicRole(role);
    }

    const roleMatch = p.match(/^\/api\/v1\/roles\/([^/]+)$/);
    if (roleMatch) {
      const id = decodeURIComponent(roleMatch[1]);
      const role = Object.values(db.roles).find((r) => r.id === id || (r.startupSlug + '/' + r.slug) === id || r.slug === id);
      if (!role) { const e = new Error('Not found'); e.status = 404; throw e; }
      if (method === 'GET') return publicRole(role);
      if (method === 'PATCH') {
        const user = requireUser(db);
        if (role.publisherId !== user.id) { const e = new Error('Forbidden'); e.status = 403; throw e; }
        const body = opts.body || {};
        ['title', 'description', 'apply_url', 'apply_email', 'apply_telegram', 'tags', 'slug'].forEach((k) => {
          if (body[k] !== undefined) role[k] = body[k];
        });
        if (body.status) role.status = body.status === 'pending' ? 'approved' : body.status;
        role.updatedAt = global.WorkixMockDb.now();
        global.WorkixMockDb.save(db);
        return publicRole(role);
      }
    }

    // BOARD FEEDS (mock)
    if (method === 'GET' && p === '/api/v1/tags') {
      const fromRoles = new Set();
      Object.values(db.roles).forEach((r) => (r.tags || []).forEach((t) => fromRoles.add(t)));
      return {
        items: [...fromRoles].map((name, i) => ({
          id: `tag_${i}_${name}`,
          name,
          slug: name,
          emoji: null,
          tasks: 1,
        })),
      };
    }
    if (method === 'POST' && p === '/api/v1/orders') {
      const user = requireUser(db);
      const body = opts.body || {};
      if (!body.title) { const e = new Error('title required'); e.status = 400; throw e; }
      const id = global.WorkixMockDb.uid('ord');
      const row = {
        id,
        sid: id,
        title: body.title,
        description: body.description || '',
        type: body.kind || body.type || 'task',
        kind: body.kind || body.type || 'task',
        project: body.project || '',
        budget: Number((body.payment && body.payment.budget) || 0) || 0,
        currency: (body.payment && body.payment.cur) || 'USDT',
        payment: body.payment || { budget: '', type: 'work', cur: 'USDT' },
        tags: (body.tags || []).map((name) => ({ id: name, name, slug: name, emoji: null })),
        tags_on: body.tags || [],
        emoji: null,
        cover: null,
        date: new Date().toISOString(),
        published: new Date().toISOString(),
        updated: new Date().toISOString(),
        url: `/order/${id}`,
        publisherId: user.id,
        status: body.status === 'draft' ? 'draft' : 'approved',
      };
      db.orders = db.orders || {};
      db.orders[id] = row;
      global.WorkixMockDb.save(db);
      return row;
    }
    if (method === 'GET' && p === '/api/v1/orders') {
      const fromRoles = Object.values(db.roles)
        .filter((r) => r.status === 'approved')
        .map((r) => ({
          id: r.id,
          sid: r.id,
          title: r.title,
          description: r.description,
          type: r.kind || 'project',
          kind: r.kind || 'project',
          project: r.startupSlug || '',
          budget: r.budget || 0,
          currency: 'USDT',
          tags: (r.tags || []).map((name) => ({ id: name, name, slug: name, emoji: null })),
          tags_on: r.tags || [],
          emoji: null,
          cover: null,
          date: r.createdAt,
          url: `#/order/${r.id}`,
        }));
      const fromOrders = Object.values(db.orders || {}).filter((o) => o.status !== 'draft');
      let items = fromOrders.concat(fromRoles);
      if (q.q) {
        const n = q.q.toLowerCase();
        items = items.filter((x) => `${x.title} ${x.description}`.toLowerCase().includes(n));
      }
      return { items: items.map((x) => Object.assign({}, x, { applied: appliedStats(db, x) })) };
    }
    {
      const m = p.match(/^\/api\/v1\/orders\/([^/]+)$/);
      if (method === 'GET' && m) {
        const list = await mockRequest('/api/v1/orders', { method: 'GET' });
        const id = decodeURIComponent(m[1]);
        const item = (list.items || []).find((x) => String(x.id) === id || String(x.sid) === id);
        if (!item) { const e = new Error('Not found'); e.status = 404; throw e; }
        return item;
      }
    }

    // APPLICATION TRACKER (mock) — private rows, anonymous counters on cards
    if (p === '/api/v1/applications') {
      const user = requireUser(db);
      db.applications = db.applications || [];
      if (method === 'POST') {
        const b = opts.body || {};
        const targetId = String(b.orderId || b.roleId || '');
        const url = String(b.url || '').trim();
        if (!targetId && !url) { const e = new Error('orderId, roleId or url required'); e.status = 400; throw e; }
        const existing = db.applications.find((a) => a.userId === user.id
          && (targetId ? String(a.targetId) === targetId : a.url === url));
        const now = global.WorkixMockDb.now();
        if (existing) {
          existing.status = b.status || existing.status;
          if (b.text) { existing.text = b.text; existing.textSource = b.textSource || 'user'; }
          if (b.note != null) existing.note = b.note;
          existing.history = (existing.history || []).concat([{ at: now, status: existing.status, note: '' }]);
          global.WorkixMockDb.save(db);
          return { ok: true, created: false, application: existing, order: null, share: 'exists' };
        }
        const row = {
          id: global.WorkixMockDb.uid('app'),
          userId: user.id,
          targetId: targetId || '',
          orderId: b.orderId || null,
          roleId: b.roleId || null,
          url: url || '',
          title: b.title || '',
          external: url ? { platform: b.platform || '', url, externalId: b.externalId || '' } : null,
          status: b.status || 'sent',
          channel: b.channel || '',
          via: b.via || 'web',
          appliedAt: b.appliedAt || now,
          text: b.text || '',
          textSource: b.text ? (b.textSource || 'user') : '',
          note: b.note || '',
          history: [{ at: now, status: b.status || 'sent', note: '' }],
        };
        db.applications.push(row);
        global.WorkixMockDb.save(db);
        return { ok: true, created: true, application: row, order: null, share: url ? 'created' : null };
      }
      if (method === 'GET') {
        let items = db.applications.filter((a) => a.userId === user.id);
        if (q.status) {
          const wanted = String(q.status).split(',');
          items = items.filter((a) => wanted.includes(a.status));
        }
        if (q.q) {
          const n = String(q.q).toLowerCase();
          items = items.filter((a) => `${a.title} ${a.note}`.toLowerCase().includes(n));
        }
        return { items, hasMore: false, limit: 50, offset: 0, statuses: APPLICATION_STATUSES };
      }
    }
    {
      const m = p.match(/^\/api\/v1\/applications\/([^/]+)$/);
      if (method === 'PATCH' && m) {
        const user = requireUser(db);
        db.applications = db.applications || [];
        const id = decodeURIComponent(m[1]);
        const row = db.applications.find((a) => a.id === id && a.userId === user.id);
        if (!row) { const e = new Error('Not found'); e.status = 404; throw e; }
        const b = opts.body || {};
        if (b.status) row.status = b.status;
        if (b.text != null) { row.text = b.text; row.textSource = b.textSource || 'user'; }
        if (b.note != null) row.note = b.note;
        row.history = (row.history || []).concat([{ at: global.WorkixMockDb.now(), status: row.status, note: '' }]);
        global.WorkixMockDb.save(db);
        return { ok: true, application: row };
      }
      if (method === 'DELETE' && m) {
        const user = requireUser(db);
        db.applications = db.applications || [];
        const id = decodeURIComponent(m[1]);
        const idx = db.applications.findIndex((a) => a.id === id && a.userId === user.id);
        if (idx < 0) { const e = new Error('Not found'); e.status = 404; throw e; }
        const [row] = db.applications.splice(idx, 1);
        global.WorkixMockDb.save(db);
        return { ok: true, deleted: row };
      }
    }
    if (method === 'GET' && p === '/api/v1/performers') {
      const items = Object.values(db.users).map((u) => {
        const pfl = u.profile || {};
        const telegram = pfl.telegram || '';
        const github = pfl.github || '';
        let contactUrl = pfl.contactUrl || pfl.portfolio || '';
        if (!contactUrl && telegram) contactUrl = `https://t.me/${String(telegram).replace(/^@/, '')}`;
        if (!contactUrl && github) {
          contactUrl = /^https?:\/\//i.test(github) ? github : `https://github.com/${String(github).replace(/^@/, '')}`;
        }
        const slug = String(pfl.slug || '').trim().toLowerCase() || null;
        return {
          id: u.id,
          userId: u.id,
          slug: slug || undefined,
          name: pfl.name || u.name,
          headline: pfl.headline || '',
          bio: pfl.bio || '',
          description: pfl.bio || '',
          skills: pfl.skills || [],
          tags: (pfl.skills || []).map((name) => ({ id: name, name, slug: name, emoji: null })),
          tags_on: pfl.skills || [],
          openTo: pfl.openTo || [],
          budget: 0,
          emoji: null,
          avatar: u.avatar || '',
          location: pfl.location || '',
          github,
          contactUrl: contactUrl || null,
          date: null,
          url: slug ? `/${encodeURIComponent(slug)}` : `/performer/${encodeURIComponent(u.id)}`,
        };
      }).filter((x) => {
        const hasInfo = !!(x.bio || x.headline || (x.skills && x.skills.length) || (x.openTo && x.openTo.length) || x.location);
        const hasContact = !!x.contactUrl;
        return hasInfo && hasContact;
      });
      return { items };
    }
    {
      const m = p.match(/^\/api\/v1\/performers\/([^/]+)$/);
      if (method === 'GET' && m) {
        const key = decodeURIComponent(m[1]).toLowerCase();
        const list = await mockRequest('/api/v1/performers', { method: 'GET' });
        const item = (list.items || []).find((x) => {
          return String(x.id) === key
            || String(x.id).toLowerCase() === key
            || (x.slug && String(x.slug).toLowerCase() === key);
        });
        if (!item) { const e = new Error('Not found'); e.status = 404; throw e; }
        return item;
      }
    }
    if (method === 'GET' && p === '/api/v1/stats/online') {
      return { online: 12, humans: 9, agents: 3, window: 'day' };
    }
    if (method === 'GET' && p === '/api/v1/search') {
      const scope = q.scope || 'all';
      const items = [];
      if (scope === 'all' || scope === 'orders') {
        const o = await mockRequest('/api/v1/orders', { method: 'GET' });
        (o.items || []).forEach((x) => items.push({ type: 'order', ...x }));
      }
      if (scope === 'all' || scope === 'projects') {
        const s = await mockRequest('/api/v1/startups', { method: 'GET' });
        (s.items || []).forEach((x) => items.push({ type: 'project', ...x, title: x.name }));
      }
      if (scope === 'all' || scope === 'performers') {
        const ppl = await mockRequest('/api/v1/performers', { method: 'GET' });
        (ppl.items || []).forEach((x) => items.push({ type: 'performer', ...x }));
      }
      return { items };
    }

    // PROFILES LIST
    if (method === 'GET' && p === '/api/v1/profiles') {
      const needle = String(q.q || '').trim().toLowerCase();
      const items = Object.values(db.users).map((u) => {
        const pfl = u.profile || {};
        return {
          id: u.id,
          name: pfl.name || u.name || '',
          avatar: u.avatar || pfl.avatar || '',
          headline: pfl.headline || '',
          bio: pfl.bio || '',
          skills: pfl.skills || [],
          links: pfl.links || [],
          location: pfl.location || '',
          openTo: pfl.openTo || [],
        };
      }).filter((item) => {
        const hasSignal = Boolean(item.bio || item.headline || item.skills.length || item.openTo.length);
        if (!hasSignal) return false;
        if (!needle) return true;
        return `${item.name} ${item.headline} ${item.bio} ${item.skills.join(' ')}`.toLowerCase().includes(needle);
      });
      return { items };
    }

    // PROFILE
    if (p === '/api/v1/profile') {
      if (method === 'GET') {
        if (q.userId && db.users[q.userId]) return db.users[q.userId].profile || {};
        const user = requireUser(db);
        return user.profile || {};
      }
      if (method === 'PATCH') {
        const user = requireUser(db);
        const body = Object.assign({}, opts.body || {});
        if (body.slug !== undefined) {
          const raw = String(body.slug == null ? '' : body.slug).trim().toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64);
          if (!raw) {
            delete body.slug;
            if (user.profile) delete user.profile.slug;
          } else {
            const taken = Object.values(db.users).some((u) => {
              if (String(u.id) === String(user.id)) return false;
              return String((u.profile && u.profile.slug) || '').toLowerCase() === raw;
            }) || Object.values(db.startups || {}).some((s) => String(s.slug || '').toLowerCase() === raw);
            if (taken) {
              const e = new Error('Slug taken');
              e.status = 409;
              throw e;
            }
            body.slug = raw;
          }
        }
        user.profile = Object.assign({}, user.profile || {}, body);
        if (body.name) user.name = body.name;
        global.WorkixMockDb.save(db);
        return user.profile;
      }
    }

    if (method === 'POST' && p === '/api/v1/profile/import') {
      const user = requireUser(db);
      const text = (opts.body && (opts.body.text || opts.body.linkedinUrl)) || '';
      const suggestion = {
        name: user.name,
        headline: 'Imported profile',
        bio: String(text).slice(0, 800),
        skills: String(text).match(/#[\w-]+/g)?.map((x) => x.slice(1)) || [],
        links: opts.body && opts.body.linkedinUrl ? [opts.body.linkedinUrl] : [],
        location: '',
        openTo: [],
      };
      return { suggestion };
    }

    // FEEDBACK
    if (method === 'POST' && p === '/api/v1/feedback') {
      const msg = String((opts.body && opts.body.message) || '').trim();
      if (msg.length < 20 || msg.length > 2000) {
        const e = new Error('message must be 20–2000 characters');
        e.status = 400;
        throw e;
      }
      const type = ['bug', 'suggestion', 'support', 'other'].includes(opts.body && opts.body.type)
        ? opts.body.type
        : 'other';
      const id = global.WorkixMockDb.uid('fb');
      if (!db.feedback) db.feedback = [];
      const last = [...db.feedback].reverse().find((f) => f.type === type);
      const hourMs = 60 * 60 * 1000;
      if ((type === 'support' || type === 'suggestion') && last && last.createdAt) {
        const age = Date.now() - Date.parse(last.createdAt);
        if (Number.isFinite(age) && age < hourMs) {
          const e = new Error('cooldown');
          e.status = 429;
          e.data = { error: 'cooldown', retryAfterSec: Math.ceil((hourMs - age) / 1000) };
          throw e;
        }
      }
      db.feedback.push({
        id,
        type,
        message: msg,
        subject: (opts.body && opts.body.subject) || '',
        contact: (opts.body && opts.body.contact) || '',
        createdAt: global.WorkixMockDb.now(),
      });
      global.WorkixMockDb.save(db);
      return { ok: true, id, delivered: false, mock: true, limits: { cooldownSec: 3600, dailyMax: 3 } };
    }

    // APPLIES
    if (method === 'POST' && p === '/api/v1/applies') {
      const user = requireUser(db);
      const role = db.roles[opts.body && opts.body.roleId];
      if (!role) { const e = new Error('Role not found'); e.status = 404; throw e; }
      const b = opts.body || {};
      const data = {
        Interesity: b.Interesity != null ? Number(b.Interesity) : null,
        Difficulty: b.Difficulty != null ? Number(b.Difficulty) : null,
        Understandability: b.Understandability != null ? Number(b.Understandability) : null,
        Budget: b.Budget != null && b.Budget !== '' ? b.Budget : '',
        Currency: b.Currency || 'USDT',
        Time: b.Time != null && b.Time !== '' ? Number(b.Time) : null,
        Description: b.Description != null ? String(b.Description) : (b.message || ''),
      };
      const score = Number((
        Number(data.Interesity || 0)
        + Number(5 - Number(data.Difficulty || 0))
        + Number(data.Understandability || 0)
        + Number(100 - Number(data.Time || 0))
      ).toFixed(0));
      const apply = {
        id: global.WorkixMockDb.uid('ap'),
        roleId: role.id,
        userId: user.id,
        name: b.name || user.name,
        contact: b.contact || '',
        message: data.Description || b.message || '',
        data,
        meta: { score },
        createdAt: global.WorkixMockDb.now(),
      };
      db.applies.push(apply);
      const st = db.startups[role.startupId];
      if (st) st.stats.applyClicks = (st.stats.applyClicks || 0) + 1;
      if (!db.notifications) db.notifications = [];
      if (st && st.publisherId) {
        db.notifications.unshift({
          id: global.WorkixMockDb.uid('nt'),
          userId: st.publisherId,
          type: 'applies',
          title: `New apply · ${role.title || 'role'}`,
          body: [apply.name, apply.contact, `score ${score}`, apply.message].filter(Boolean).join(' · ').slice(0, 280),
          href: `#/role/${role.id}`,
          readAt: null,
          createdAt: global.WorkixMockDb.now(),
        });
      }
      global.WorkixMockDb.save(db);
      return { id: apply.id, ok: true, score, data, notify: 'mock-log' };
    }

    // PREFS
    if (p === '/api/v1/notification-prefs') {
      const user = requireUser(db);
      const defaultEvents = {
        public_contact: { email: true, telegram: true },
        applies: { email: true, telegram: true },
        invites: { email: true, telegram: true },
        messages: { email: false, telegram: true },
        digests: { email: true, telegram: false },
        moderation: { email: true, telegram: true },
      };
      const normalize = (raw) => {
        const p0 = raw || {};
        const events = Object.assign({}, defaultEvents, p0.events || {});
        for (const k of Object.keys(defaultEvents)) {
          events[k] = Object.assign({}, defaultEvents[k], (p0.events && p0.events[k]) || {});
        }
        const channels = Object.assign(
          { email: events.applies.email, telegram: events.applies.telegram },
          p0.channels || {},
        );
        if (!p0.events && p0.channels) {
          events.applies = Object.assign({}, events.applies, p0.channels);
          channels.email = events.applies.email;
          channels.telegram = events.applies.telegram;
        }
        const chatId = p0.telegramChatId != null ? String(p0.telegramChatId) : '';
        return {
          email: p0.email || '',
          telegram: p0.telegram || '',
          telegramChatId: chatId,
          telegramLinked: !!chatId,
          channels,
          events,
        };
      };
      if (method === 'GET') {
        return normalize(db.prefs[user.id]);
      }
      if (method === 'PATCH') {
        const cur = normalize(db.prefs[user.id]);
        const body = opts.body || {};
        const next = normalize({
          email: body.email != null ? body.email : cur.email,
          telegram: body.telegram != null ? body.telegram : cur.telegram,
          telegramChatId: cur.telegramChatId,
          channels: Object.assign({}, cur.channels, body.channels || {}),
          events: Object.assign({}, cur.events, body.events || {}),
        });
        if (body.events) {
          for (const k of Object.keys(defaultEvents)) {
            if (body.events[k]) next.events[k] = Object.assign({}, cur.events[k], body.events[k]);
          }
          next.channels.email = next.events.applies.email;
          next.channels.telegram = next.events.applies.telegram;
        }
        db.prefs[user.id] = next;
        global.WorkixMockDb.save(db);
        return next;
      }
    }

    if (method === 'POST' && p === '/api/v1/notification-prefs/telegram-connect') {
      const user = requireUser(db);
      const cur = db.prefs[user.id] || {};
      if (opts.body && opts.body.telegram != null) cur.telegram = opts.body.telegram;
      const token = `wxn_mock${String(Date.now()).slice(-8)}`;
      cur.telegramBindToken = token;
      db.prefs[user.id] = cur;
      global.WorkixMockDb.save(db);
      // Auto-link in mock so UI can verify without a real bot
      cur.telegramChatId = cur.telegramChatId || String(900000000 + Math.floor(Math.random() * 999999));
      if (!cur.telegram) cur.telegram = '@mock_user';
      delete cur.telegramBindToken;
      db.prefs[user.id] = cur;
      global.WorkixMockDb.save(db);
      return {
        url: `https://t.me/workix_tbot?start=${token}`,
        botUsername: 'workix_tbot',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        telegramLinked: true,
      };
    }

    if (method === 'POST' && p === '/api/v1/notification-prefs/telegram-disconnect') {
      const user = requireUser(db);
      const cur = db.prefs[user.id] || {};
      cur.telegramChatId = '';
      delete cur.telegramBindToken;
      db.prefs[user.id] = cur;
      global.WorkixMockDb.save(db);
      return {
        email: cur.email || '',
        telegram: cur.telegram || '',
        telegramChatId: '',
        telegramLinked: false,
        channels: cur.channels || { email: true, telegram: true },
        events: cur.events || {},
      };
    }

    // FX
    if (method === 'GET' && p === '/api/v1/fx/convert') {
      const amount = Number(q.amount);
      const from = String(q.from || 'USDT').toUpperCase();
      const to = String(q.to || 'USDT').toUpperCase();
      if (!Number.isFinite(amount)) {
        const err = new Error('amount required');
        err.status = 400;
        throw err;
      }
      // Mock rough rates vs USDT (~USD)
      const toUsdt = {
        USDT: 1, USD: 1, EUR: 1.08, GBP: 1.27, RUB: 0.011, CNY: 0.14, UAH: 0.024, TON: 5.5,
      };
      const a = toUsdt[from] || 1;
      const b = toUsdt[to] || 1;
      const price = amount * (a / b);
      return { amount, from, to, price };
    }

    // INBOX
    if (p === '/api/v1/notifications') {
      const user = requireUser(db);
      if (!db.notifications) db.notifications = [];
      if (method === 'GET') {
        const items = db.notifications
          .filter((n) => n.userId === user.id)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, Number(q.limit || 30));
        const unread = db.notifications.filter((n) => n.userId === user.id && !n.readAt).length;
        return { items, unread };
      }
    }
    if (method === 'POST' && p === '/api/v1/notifications/read') {
      const user = requireUser(db);
      if (!db.notifications) db.notifications = [];
      const ids = (opts.body && opts.body.ids) || null;
      const idSet = Array.isArray(ids) && ids.length ? new Set(ids.map(String)) : null;
      const now = global.WorkixMockDb.now();
      let count = 0;
      for (const n of db.notifications) {
        if (n.userId !== user.id || n.readAt) continue;
        if (idSet && !idSet.has(String(n.id))) continue;
        n.readAt = now;
        count += 1;
      }
      global.WorkixMockDb.save(db);
      return { ok: true, count };
    }

    // ANALYTICS
    if (method === 'POST' && p === '/api/v1/analytics/events') {
      db.events.push({ ...(opts.body || {}), at: global.WorkixMockDb.now() });
      if (opts.body && opts.body.type === 'share_view' && opts.body.payload) {
        const slug = opts.body.payload.startupSlug;
        const st = Object.values(db.startups).find((s) => s.slug === slug);
        if (st) st.stats.shareViews = (st.stats.shareViews || 0) + 1;
      }
      global.WorkixMockDb.save(db);
      return null;
    }

    // I18N
    const i18nMatch = p.match(/^\/api\/v1\/i18n\/([^/]+)$/);
    if (method === 'GET' && i18nMatch) {
      const locale = i18nMatch[1];
      const base = global.WorkixI18n.dict.en || {};
      const local = global.WorkixI18n.dict[locale] || {};
      return {
        locale,
        supported: global.WorkixI18n.supported || [],
        translated: 0,
        cached: Object.keys(local).length,
        missing: 0,
        strings: Object.assign({}, base, local, db.i18nExtra[locale] || {}),
      };
    }

    const e = new Error(`Mock route not found: ${method} ${p}`);
    e.status = 404;
    throw e;
  }

  async function request(path, opts) {
    if (state.mock) return mockRequest(path, opts);
    try {
      return await liveRequest(path, opts);
    } catch (err) {
      // auto-fallback to mock on network / 404 API missing during local FE-first
      if (err && (err.status === 404 || err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        if (localStorage.getItem('workix_mock') !== '0') {
          console.warn('[workix] live API failed, using mock', err);
          state.mock = true;
          localStorage.setItem('workix_mock', '1');
          return mockRequest(path, opts);
        }
      }
      throw err;
    }
  }

  const api = {
    getState: () => ({ ...state }),
    setMock(on) {
      state.mock = !!on;
      localStorage.setItem('workix_mock', on ? '1' : '0');
    },
    setContentLang(lang) {
      state.contentLang = String(lang || 'en').slice(0, 8);
    },
    setFeatureHost(host) {
      state.featureHost = String(host || '').trim();
    },
    getFeatureHost: () => state.featureHost || '',
    register: () => request('/api/v1/auth/register', { method: 'POST', body: {} }),
    loginMvse: (body) => request('/api/v1/auth/mvse', { method: 'POST', body }),
    me: () => request('/api/v1/me'),
    patchMe: (body) => request('/api/v1/me', { method: 'PATCH', body }),
    rotateKey: () => request('/api/v1/me/agent-key/rotate', { method: 'POST', body: {} }),
    linkMvse: (body) => request('/api/v1/auth/link-mvse', { method: 'POST', body }),
    listStartups: (query = {}) => {
      const q = buildQs(query, { arrays: true });
      return request(`/api/v1/startups${q ? `?${q}` : ''}`);
    },
    getStartup: (slug) => {
      const q = buildQs({});
      return request(`/api/v1/startups/${encodeURIComponent(slug)}${q ? `?${q}` : ''}`);
    },
    createStartup: (body) => request('/api/v1/startups', { method: 'POST', body }),
    updateStartup: (slug, body) => request(`/api/v1/startups/${encodeURIComponent(slug)}`, { method: 'PATCH', body }),
    listRoles: (query = {}) => {
      const q = buildQs(query || {});
      return request(`/api/v1/roles${q ? `?${q}` : ''}`);
    },
    getRole: (id) => {
      const q = buildQs({});
      return request(`/api/v1/roles/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
    },
    createRole: (body) => request('/api/v1/roles', { method: 'POST', body }),
    updateRole: (id, body) => request(`/api/v1/roles/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    getProfile: (userId) => request(`/api/v1/profile${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),
    listProfiles: (query = {}) => {
      const qs = new URLSearchParams();
      Object.entries(query || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      });
      const q = qs.toString();
      return request(`/api/v1/profiles${q ? `?${q}` : ''}`);
    },
    listOrders: (query = {}) => {
      const q = buildQs(query, { arrays: true });
      return request(`/api/v1/orders${q ? `?${q}` : ''}`);
    },
    createOrder: (body) => request('/api/v1/orders', { method: 'POST', body }),
    updateOrder: (id, body) => request(`/api/v1/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    listPerformers: (query = {}) => {
      const q = buildQs(query, { arrays: true });
      return request(`/api/v1/performers${q ? `?${q}` : ''}`);
    },
    getPerformer: (id) => {
      const q = buildQs({});
      return request(`/api/v1/performers/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
    },
    getOrder: (id) => {
      const q = buildQs({});
      return request(`/api/v1/orders/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
    },
    postOrderProposal: (id, body) => request(
      `/api/v1/orders/${encodeURIComponent(id)}/proposals`,
      { method: 'POST', body }
    ),
    listTags: (feed) => request(`/api/v1/tags${feed ? `?feed=${encodeURIComponent(feed)}` : ''}`),
    online: () => request('/api/v1/stats/online'),
    search: (query = {}) => {
      const q = buildQs(query);
      return request(`/api/v1/search${q ? `?${q}` : ''}`);
    },
    updateProfile: (body) => request('/api/v1/profile', { method: 'PATCH', body }),
    bumpProfile: () => request('/api/v1/profile/bump', { method: 'POST', body: {} }),
    importProfile: (body) => request('/api/v1/profile/import', { method: 'POST', body }),
    apply: (body) => request('/api/v1/applies', { method: 'POST', body }),
    /** "I applied to this job" — private tracker; listings only show anonymous counts. */
    trackApplication: (body) => request('/api/v1/applications', { method: 'POST', body }),
    listApplications: (query = {}) => {
      const q = buildQs(query);
      return request(`/api/v1/applications${q ? `?${q}` : ''}`);
    },
    updateApplication: (id, body) => request(
      `/api/v1/applications/${encodeURIComponent(id)}`,
      { method: 'PATCH', body }
    ),
    deleteApplication: (id) => request(
      `/api/v1/applications/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    ),
    feedback: (body) => request('/api/v1/feedback', { method: 'POST', body }),
    getPrefs: () => request('/api/v1/notification-prefs'),
    updatePrefs: (body) => request('/api/v1/notification-prefs', { method: 'PATCH', body }),
    connectTelegram: (body) => request('/api/v1/notification-prefs/telegram-connect', {
      method: 'POST',
      body: body || {},
    }),
    disconnectTelegram: () => request('/api/v1/notification-prefs/telegram-disconnect', {
      method: 'POST',
      body: {},
    }),
    convertFx: ({ amount, from, to }) => {
      const qs = new URLSearchParams({
        amount: String(amount),
        from: String(from || 'USDT'),
        to: String(to || 'USDT'),
      });
      return request(`/api/v1/fx/convert?${qs}`);
    },
    listNotifications: (query = {}) => {
      const qs = new URLSearchParams();
      if (query.limit != null) qs.set('limit', String(query.limit));
      const q = qs.toString();
      return request(`/api/v1/notifications${q ? `?${q}` : ''}`);
    },
    markNotificationsRead: (ids) => request('/api/v1/notifications/read', { method: 'POST', body: { ids: ids || null } }),
    track: (type, payload) => request('/api/v1/analytics/events', { method: 'POST', body: { type, payload } }),
    i18n: (locale, query = {}) => {
      const qs = new URLSearchParams();
      Object.entries(query || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      });
      const q = qs.toString();
      return request(`/api/v1/i18n/${encodeURIComponent(locale)}${q ? `?${q}` : ''}`);
    },
  };

  global.WorkixAPI = api;
})(typeof window !== 'undefined' ? window : globalThis);
