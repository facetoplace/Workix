# Workix storefront (Docker)

Serves only the **UI** (`views/` + `assets/`). Catalog data comes from the central hub API.

```bash
# from repo root
docker build -t workix-ui -f docker/Dockerfile .
docker run --rm -p 8080:80 workix-ui
```

Open http://localhost:8080 — API calls go to `https://workix.co` (see meta tag in `views/workix.html` / nginx sub_filter if you override).

## CNAME

Point `work.yourdomain.com` at the host that runs this image (or any static host of `views/` + `assets/`).  
Listings matching that domain are **featured** in the feeds for visitors on that host. Details: root [README.md](../README.md).
