const kwork = require("kwork-api");

const login = process.env.KWORK_LOGIN;
const password = process.env.KWORK_PASSWORD;
const phone4 = process.env.KWORK_PHONE4;
const proxy = process.argv[2];

if (!login || !password || !phone4) {
  console.error("Need KWORK_LOGIN KWORK_PASSWORD KWORK_PHONE4");
  process.exit(1);
}

(async () => {
  console.log("login", login, "proxy", proxy || "none");
  try {
    const kw = proxy
      ? new kwork(login, password, phone4, proxy)
      : new kwork(login, password, phone4);
    const me = await kw.getMe();
    console.log("getMe", JSON.stringify(me).slice(0, 500));
    const p = await kw.getProjects();
    const list = (p && p.response) || p || [];
    console.log("projects", Array.isArray(list) ? list.length : typeof list);
    if (Array.isArray(list)) {
      for (const x of list.slice(0, 5)) {
        console.log(
          "-",
          x.price_limit || "-",
          (x.name || x.title || "").slice(0, 80),
        );
      }
    }
  } catch (e) {
    console.error("FAIL", e && e.message ? e.message : e);
  }
})();
