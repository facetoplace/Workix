# Static Workix storefront only — no hub database.
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY views/workix.html /usr/share/nginx/html/workix.html
COPY assets/hub /usr/share/nginx/html/hub
COPY assets/api.txt assets/llms.txt assets/openapi-v1.yaml /usr/share/nginx/html/
COPY assets/.well-known /usr/share/nginx/html/.well-known

# Optional: force hub API origin for mirrored hosts
# ENV is not read by static HTML; set <meta name="workix-api"> in workix.html or inject at build time.

EXPOSE 80
