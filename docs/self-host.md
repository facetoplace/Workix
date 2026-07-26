# Self-host the Workix storefront

Canonical guide: [README.md — CNAME / self-host](../README.md#cname--self-host-featured-by-domain).

Short version:

1. Host `views/` + `assets/` (or `docker/`) on `work.yourdomain.com`
2. `API_BASE` / meta `workix-api` → `https://workix.co`
3. Publish a project whose URL matches your domain
4. Visitors on that host see matching listings **featured** at the top of feeds
