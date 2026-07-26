(function (global) {
  const KEY = 'workix_hub_mock_v2';

  function uid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  }

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || uid('s');
  }

  function now() {
    return new Date().toISOString();
  }

  function seed() {
    const userId = 'user_demo_founder';
    const s1 = {
      id: 'st_workix',
      slug: 'workix',
      name: 'Workix',
      logo: '/img/logo-pwa.png',
      url: 'https://workix.co',
      description: 'Hub to find a place in a startup — profiles, roles, viral share links.',
      status: 'approved',
      stage: 'early',
      publisherId: userId,
      applyDefaults: { apply_email: 'hello@workix.co', apply_telegram: '', apply_url: '' },
      stats: { shareViews: 12, applyClicks: 3 },
      createdAt: now(),
      updatedAt: now(),
    };
    const s2 = {
      id: 'st_facetoplace',
      slug: 'facetoplace',
      name: 'FaceToPlace',
      logo: '',
      url: 'https://facetoplace.app',
      description: 'Tools and products around place, presence, and builders.',
      status: 'approved',
      stage: 'growth',
      publisherId: userId,
      applyDefaults: { apply_url: 'https://facetoplace.app', apply_email: '', apply_telegram: '' },
      stats: { shareViews: 5, applyClicks: 1 },
      createdAt: now(),
      updatedAt: now(),
    };
    const s3 = {
      id: 'st_neon',
      slug: 'neon-desk',
      name: 'Neon Desk',
      logo: '',
      url: '',
      description: 'An idea-stage workspace for remote co-builders.',
      status: 'approved',
      stage: 'idea',
      publisherId: userId,
      applyDefaults: {},
      stats: { shareViews: 2, applyClicks: 0 },
      createdAt: now(),
      updatedAt: now(),
    };
    const roles = [
      {
        id: 'role_wx_fe',
        slug: 'frontend',
        startupId: s1.id,
        startupSlug: s1.slug,
        title: 'Frontend / Tailwind UI',
        description: 'Ship the Getro-lite catalog and share highlight experience.',
        status: 'approved',
        kind: 'time_job',
        budget: 1200,
        apply_url: '',
        apply_email: 'hello@workix.co',
        apply_telegram: '',
        tags: ['frontend', 'tailwind', 'vue'],
        highlightPriority: 10,
        publisherId: userId,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'role_wx_agent',
        slug: 'agent-api',
        startupId: s1.id,
        startupSlug: s1.slug,
        title: 'Agent / MCP engineer',
        description: 'Hub tools for startups & roles over the Workix API.',
        status: 'approved',
        kind: 'project',
        budget: 2500,
        apply_url: '',
        apply_email: 'hello@workix.co',
        apply_telegram: '',
        tags: ['mcp', 'api', 'agents'],
        highlightPriority: 8,
        publisherId: userId,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'role_wx_fix',
        slug: 'pwa-polish',
        startupId: s1.id,
        startupSlug: s1.slug,
        title: 'PWA install polish',
        description: 'One-task polish for manifest, icons, and install prompt UX.',
        status: 'approved',
        kind: 'task',
        budget: 180,
        apply_url: '',
        apply_email: 'hello@workix.co',
        apply_telegram: '',
        tags: ['pwa', 'frontend'],
        highlightPriority: 6,
        publisherId: userId,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'role_f2p_builder',
        slug: 'builder',
        startupId: s2.id,
        startupSlug: s2.slug,
        title: 'Product builder',
        description: 'Co-build early features across the FaceToPlace stack.',
        status: 'approved',
        kind: 'full_job',
        budget: 0,
        apply_url: 'https://facetoplace.app',
        apply_email: '',
        apply_telegram: '',
        tags: ['product', 'fullstack'],
        highlightPriority: 5,
        publisherId: userId,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'role_neon_fix',
        slug: 'landing-fix',
        startupId: s3.id,
        startupSlug: s3.slug,
        title: 'Landing copy fixes',
        description: 'Short fixes for hero copy and CTA clarity.',
        status: 'approved',
        kind: 'fixes',
        budget: 90,
        apply_url: '',
        apply_email: '',
        apply_telegram: '',
        tags: ['copy', 'design'],
        highlightPriority: 3,
        publisherId: userId,
        createdAt: now(),
        updatedAt: now(),
      },
    ];
    const seekerId = 'user_demo_seeker';
    const builderId = 'user_demo_builder';
    return {
      users: {
        [userId]: {
          id: userId,
          name: 'Demo Founder',
          avatar: '',
          segment: null,
          publicKey: 'mock_pk_demo',
          privateKey: 'mock_sk_demo',
          agentApiKey: 'wix_mock_demo_key_change_me',
          profile: {
            name: 'Demo Founder',
            headline: 'Building Workix',
            bio: 'Founder demo profile for the hub mock.',
            skills: ['product', 'node', 'agents'],
            links: ['https://workix.co'],
            location: 'Remote',
            openTo: ['co-build', 'advisors'],
          },
        },
        [seekerId]: {
          id: seekerId,
          name: 'Ada Seeker',
          avatar: '',
          segment: 'seeker',
          publicKey: 'mock_pk_seeker',
          privateKey: 'mock_sk_seeker',
          agentApiKey: '',
          profile: {
            name: 'Ada Seeker',
            headline: 'Vue / design systems',
            bio: 'Looking for an early-stage product role with real ownership.',
            skills: ['vue', 'tailwind', 'design'],
            links: [],
            location: 'EU / Remote',
            openTo: ['part-time', 'co-build'],
          },
        },
        [builderId]: {
          id: builderId,
          name: 'Max Builder',
          avatar: '',
          segment: 'seeker',
          publicKey: 'mock_pk_builder',
          privateKey: 'mock_sk_builder',
          agentApiKey: '',
          profile: {
            name: 'Max Builder',
            headline: 'Full-stack / agents',
            bio: 'Ships MCP tools, APIs, and lean dashboards.',
            skills: ['node', 'mcp', 'api'],
            links: [],
            location: 'Remote',
            openTo: ['full-time', 'contract'],
          },
        },
      },
      startups: { [s1.id]: s1, [s2.id]: s2, [s3.id]: s3 },
      roles: Object.fromEntries(roles.map((r) => [r.id, r])),
      applies: [],
      prefs: {},
      notifications: [],
      events: [],
      i18nExtra: { en: {}, ru: {} },
      sessionUserId: null,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const db = seed();
        save(db);
        return db;
      }
      return JSON.parse(raw);
    } catch (e) {
      const db = seed();
      save(db);
      return db;
    }
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function reset() {
    localStorage.removeItem(KEY);
    return load();
  }

  global.WorkixMockDb = { KEY, uid, slugify, now, load, save, reset, seed };
})(typeof window !== 'undefined' ? window : globalThis);
