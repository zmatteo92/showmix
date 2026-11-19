"use strict";
(async function () {
  const app = document.getElementById("app");
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const pad = (n) => String(n).padStart(2, "0");
  const handleOf = (url) => { const m = String(url || "").match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#]+)/i); return m ? m[1] : ""; };
  const ICON = {
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    tt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
  };
  let toastT;
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200); };

  let DATA;
  try { DATA = await Store.getData(); }
  catch (e) { app.innerHTML = `<div class="empty" style="padding-top:140px">Impossible de charger le site : ${esc(e.message)}</div>`; return; }
  if (Store.mode === "demo") document.body.insertAdjacentHTML("beforeend", `<div class="demo-banner">● MODE DÉMO</div>`);

  const M = DATA.media, PH = DATA.photographers;
  PH.forEach((p) => { p.coverPhoto = p.photos.find((x) => x.id === p.cover) || p.photos[0]; p.all = p.photos.map((x) => ({ ...x, by: p })); });
  const ALL = (() => {
    const t = PH.map((p) => p.all);
    if (t.flat().length && t.flat().every((x) => x.created)) return t.flat().sort((a, b) => (a.created < b.created ? 1 : -1));
    const out = [], max = Math.max(0, ...t.map((x) => x.length));
    for (let i = 0; i < max; i++) t.forEach((x) => x[i] && out.push(x[i]));
    return out;
  })();
  const ARTISTS = {};
  ALL.forEach((x) => { if (x.artist) (ARTISTS[slug(x.artist)] ||= { name: x.artist, photos: [] }).photos.push(x); });
  const nArt = Object.keys(ARTISTS).length;
  const igH = handleOf(M.instagram), ttH = handleOf(M.tiktok);

  /* ---------- nav + footer ---------- */
  { const h = Math.ceil(M.name.length / 2); $("#brand").innerHTML = `${esc(M.name.slice(0, h))}<em>${esc(M.name.slice(h))}</em>`; }
  $("#tabs").innerHTML = `<a class="tab" href="#" data-r="">Accueil</a>` +
    PH.map((p) => `<a class="tab" href="#${esc(p.id)}" data-r="${esc(p.id)}">${esc(p.name)}</a>`).join("") +
    "";
  // menu mobile plein écran
  const mm = $("#mmenu"), mb = $("#menu-btn");
  mm.innerHTML = `<nav class="mm-list">
      <a href="#" data-r=""><span class="mm-n">00</span>Accueil</a>
      ${PH.map((p, i) => `<a href="#${esc(p.id)}" data-r="${esc(p.id)}"><span class="mm-n">${pad(i + 1)}</span>${esc(p.name)}<small>${p.photos.length} photos</small></a>`).join("")}
      <a href="#contact" data-r="contact"><span class="mm-n">✉</span>Contact</a>
    </nav>
    <div class="mm-foot"><a href="mailto:${esc(M.email)}">${esc(M.email)}</a>${igH ? `<a href="${esc(M.instagram)}" target="_blank" rel="noopener">Instagram</a>` : ""}${ttH ? `<a href="${esc(M.tiktok)}" target="_blank" rel="noopener">TikTok</a>` : ""}</div>`;
  const setMenu = (open) => { document.body.classList.toggle("menu-open", open); mb.setAttribute("aria-expanded", open); mm.setAttribute("aria-hidden", !open); mb.firstChild.textContent = open ? "Fermer" : "Menu"; };
  mb.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  mm.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  $("#nav-r").innerHTML = `
    ${M.instagram ? `<a href="${esc(M.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${ICON.ig}</a>` : ""}
    ${M.tiktok ? `<a href="${esc(M.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok">${ICON.tt}</a>` : ""}<a class="nav-contact" href="#contact" data-r="contact">Contact</a>`;
  $("#ftr").innerHTML = `<div>${esc(M.name)} © ${new Date().getFullYear()}</div>
    <span>${igH ? `<a href="${esc(M.instagram)}" target="_blank" rel="noopener">@${esc(igH)}</a>` : ""}${ttH ? `<a href="${esc(M.tiktok)}" target="_blank" rel="noopener">TikTok</a>` : ""}<a href="mailto:${esc(M.email)}">${esc(M.email)}</a><a href="admin.html">Espace admin</a></span>`;

  /* ---------- helpers ---------- */
  async function share(hash, title) {
    const url = location.href.split("#")[0] + (hash ? "#" + hash : "");
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); toast("Lien copié"); } catch (e) { toast(url); }
  }
  document.addEventListener("click", async (e) => {
    const s = e.target.closest("[data-share]"); if (s) return share(s.dataset.share, document.title);
    const c = e.target.closest("[data-copy]"); if (!c) return;
    try { await navigator.clipboard.writeText(c.dataset.copy); toast("Adresse copiée"); } catch (err) { toast(c.dataset.copy); }
  });
  function contactBlock(title = "Un shooting, un concert, une collab ?") {
    return `<section class="contact-sec" id="contact-sec">
      <div class="readout">CONTACT // <span>RÉPONSE RAPIDE</span></div>
      <h2>${esc(title)}</h2>
      <div class="contact">
        <div class="ct"><span class="ic">${ICON.mail}</span><div><small>Email</small><b><a href="mailto:${esc(M.email)}">${esc(M.email)}</a></b></div><button class="copy" data-copy="${esc(M.email)}">Copier</button></div>
        ${M.instagram ? `<a class="ct" href="${esc(M.instagram)}" target="_blank" rel="noopener"><span class="ic">${ICON.ig}</span><div><small>Instagram</small><b>@${esc(igH)}</b></div><span style="color:var(--v)">↗</span></a>` : ""}
        ${M.tiktok ? `<a class="ct" href="${esc(M.tiktok)}" target="_blank" rel="noopener"><span class="ic">${ICON.tt}</span><div><small>TikTok</small><b>@${esc(ttH)}</b></div><span style="color:var(--v)">↗</span></a>` : ""}
      </div></section>`;
  }

  /* ---------- photo strips ---------- */
  const strips = [];
  function strip(list, { more = null, credit = false } = {}) {
    const id = strips.push(list) - 1;
    return `<div class="film"><div class="film-lbl"><span>SMX ▸ ${esc(String(list[0] ? (credit ? "MIX" : list[0].by.name) : "").toUpperCase())}</span><span>${pad(list.length + (more ? more.rest : 0))} EXP. ◂</span></div><div class="hscroll" data-strip="${id}">${list.map((x, i) => `
      <figure class="pf" data-i="${i}" style="aspect-ratio:3/4">
        <img src="${esc(x.src)}" alt="${esc(x.artist)} — photo ${esc(x.by.name)}" loading="lazy" draggable="false">
        <i class="c c1"></i><i class="c c2"></i><i class="c c3"></i><i class="c c4"></i>
        <span class="idx">${pad(i + 1)}A</span>
        <figcaption class="cap"><b>${esc(credit ? x.by.name : x.artist)}</b><span>${esc(credit ? x.artist : (x.place || x.by.name))}</span></figcaption>
      </figure>`).join("")}
      ${more ? `<a class="pf more" href="#${esc(more.p.id)}"><span class="big">+${more.rest}</span><p>Encore ${more.rest} photo${more.rest > 1 ? "s" : ""} de ${esc(more.p.name)}</p><span class="btn">Ouvrir →</span></a>` : ""}
    </div></div>`;
  }
  function bindStrips(root) {
    root.querySelectorAll(".hscroll").forEach((sc) => {
      const list = strips[+sc.dataset.strip];
      sc.querySelectorAll(".pf img").forEach((im) => {
        const done = () => { im.classList.add("ld"); if (im.naturalWidth) im.parentElement.style.aspectRatio = `${im.naturalWidth}/${im.naturalHeight}`; };
        im.complete && im.naturalWidth ? done() : im.addEventListener("load", done, { once: true });
      });
      sc.querySelectorAll(".pf[data-i]").forEach((f) => f.addEventListener("click", () => { if (moved > 6) return; current = list; openLB(+f.dataset.i); }));
      // drag to scroll (mouse)
      let down = false, sx = 0, sl = 0, moved = 0;
      sc.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = 0; sx = e.clientX; sl = sc.scrollLeft; });
      addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); if (moved > 6) sc.classList.add("drag"); sc.scrollLeft = sl - dx; });
      addEventListener("pointerup", () => { if (!down) return; down = false; setTimeout(() => sc.classList.remove("drag"), 0); });
    });
    root.querySelectorAll("[data-arr]").forEach((b) => b.addEventListener("click", () => {
      const sc = b.closest(".block").querySelector(".hscroll");
      sc.scrollBy({ left: (+b.dataset.arr) * sc.clientWidth * 0.8, behavior: "smooth" });
    }));
  }
  const arrows = `<button class="arr" data-arr="-1" aria-label="Défiler à gauche">←</button><button class="arr" data-arr="1" aria-label="Défiler à droite">→</button>`;

  /* ========== HOME ========== */
  let heroTimer;
  function home() {
    document.title = `${M.name} — Portfolio`;
    const feat = ALL.filter((x) => x.featured);
    const pool = [...feat, ...ALL.filter((x) => !x.featured)];
    const cells = pool.slice(0, 8);
    app.className = "home";
    app.innerHTML = `
      <section class="hero" id="hero">
        <div class="hero-bg">${cells.map((x, i) => `<img src="${esc(x.src)}" alt="" class="${i ? "" : "on"}" ${i ? 'loading="lazy"' : ""}>`).join("")}</div>
        <div class="vf" aria-hidden="true"><i class="k1"></i><i class="k2"></i><i class="k3"></i><i class="k4"></i>
          <div class="bl" id="vf-cap"></div>
          <div class="br" id="vf-n"></div>
        </div>
        <div class="hero-c">
          <h1 class="h-title">${esc(M.name.slice(0, Math.ceil(M.name.length / 2)))}<span class="v">${esc(M.name.slice(Math.ceil(M.name.length / 2)))}</span></h1>
          <div class="hero-row">
            <p class="sub"><b>${esc(M.tagline || "Le média qui capture la scène.")}</b> Concerts, backstage, artistes. Choisis un photographe et plonge dans ses séries.</p>
            <div class="pcards">${PH.map((p) => `<a class="pcard" href="#${esc(p.id)}"><span class="th">${p.coverPhoto ? `<img src="${esc(p.coverPhoto.src)}" alt="">` : ""}</span><div><b>${esc(p.name)}</b><small>${p.photos.length} photos${p.handle ? " · " + esc(p.handle) : ""}</small></div><span class="ar">→</span></a>`).join("")}</div>
          </div>
        </div>
      </section>
      ${PH.map((p, i) => {
        const shown = p.all.slice(0, 8), rest = p.all.length - shown.length;
        const nA = new Set(p.photos.map((x) => x.artist).filter(Boolean)).size;
        return `<section class="block">
          <div class="block-h"><div><div class="eyebrow">Portfolio ${pad(i + 1)}/${pad(PH.length)}</div><h2 class="block-name">${esc(p.name)}</h2>
            <div class="block-meta">${p.handle ? esc(p.handle) + " · " : ""}${p.photos.length} photos · ${nA} artiste${nA > 1 ? "s" : ""}</div></div>
            <div class="block-act">${arrows}<a class="btn" href="#${esc(p.id)}">Voir<span class="hm"> le portfolio</span> →</a></div></div>
          ${shown.length ? strip(shown, { more: rest > 0 ? { p, rest } : null }) : `<div class="empty">Bientôt en ligne</div>`}
        </section>`; }).join("")}
      ${contactBlock()}`;
    bindStrips(app);
    // hero: slideshow + viewfinder timecode
    clearInterval(heroTimer);
    const imgs = [...document.querySelectorAll(".hero-bg img")]; let k = 0, f = 0;
    const cap = () => { const x = cells[k]; if (!x) return; $("#vf-cap").textContent = `${x.artist || ""}${x.place ? " — " + x.place : ""} · PH. ${x.by.name}`.toUpperCase(); $("#vf-n").textContent = `${pad(k + 1)}/${pad(cells.length)}`; };
    cap();
    heroTimer = setInterval(() => {
      f++; const fr = f % 25, sec = Math.floor(f / 25);
      if (!$("#vf-cap")) return clearInterval(heroTimer);
      if (imgs.length > 1 && f % 125 === 0) { imgs[k].classList.remove("on"); k = (k + 1) % imgs.length; imgs[k].classList.add("on"); cap(); }
    }, 40);
  }

  /* ========== PHOTOGRAPHER ========== */
  function photographer(p) {
    const i = PH.indexOf(p);
    document.title = `${p.name} — ${M.name}`;
    const ig = handleOf(p.instagram);
    const series = {};
    p.all.forEach((x) => { const k = x.artist || "Sans titre"; (series[k] ||= []).push(x); });
    const keys = Object.keys(series);
    const next = PH[(i + 1) % PH.length];
    app.className = "";
    app.innerHTML = `
      <section class="phead">
        <div class="phead-bg">${p.all.slice(0, 3).map((x) => `<div><img src="${esc(x.src)}" alt=""></div>`).join("")}</div>
        <div class="readout">PHOTOGRAPHE: <span>${pad(i + 1)}/${pad(PH.length)}</span>${p.handle ? ` // HANDLE: <span>${esc(p.handle)}</span>` : ""}</div>
        <h1>${esc(p.name)}</h1>
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}
        <div class="stats"><div><b>${p.photos.length}</b>Photos</div><div><b>${keys.length}</b>Séries</div></div>
        <div class="acts">${ig ? `<a class="btn" href="${esc(p.instagram)}" target="_blank" rel="noopener">${ICON.ig} @${esc(ig)}</a>` : ""}<button class="btn ghost" data-share="${esc(p.id)}">Partager</button></div>
        ${keys.length > 1 ? `<div class="series-idx">${keys.map((k, j) => `<a href="#" data-goto="s${j}">${pad(j + 1)} — ${esc(k)} (${series[k].length})</a>`).join("")}</div>` : ""}
      </section>
      ${keys.length ? keys.map((k, j) => {
        const list = series[k], place = (list.find((x) => x.place) || {}).place;
        return `<section class="block" id="s${j}">
          <div class="block-h"><div><div class="eyebrow">Série ${pad(j + 1)}/${pad(keys.length)}</div><h2 class="block-name">${esc(k)}</h2>
            <div class="block-meta">${place ? esc(place) + " · " : ""}${list.length} photo${list.length > 1 ? "s" : ""}</div></div>
            <div class="block-act">${arrows}</div></div>
          ${strip(list)}
        </section>`; }).join("") : `<div class="empty">Les photos arrivent bientôt</div>`}
      ${PH.length > 1 ? `<a class="next" href="#${esc(next.id)}"><small>Photographe suivant</small><div>${esc(next.name)} <span>→</span></div></a>` : ""}
      ${contactBlock()}`;
    bindStrips(app);
    app.querySelectorAll("[data-goto]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById(a.dataset.goto)?.scrollIntoView({ behavior: "smooth" }); }));
  }

  /* ========== ARTIST ========== */
  function artist(a) {
    document.title = `${a.name} — ${M.name}`;
    const byP = {};
    a.photos.forEach((x) => (byP[x.by.id] ||= { p: x.by, list: [] }).list.push(x));
    app.className = "";
    app.innerHTML = `
      <section class="phead">
        <div class="phead-bg">${a.photos.slice(0, 3).map((x) => `<div><img src="${esc(x.src)}" alt=""></div>`).join("")}</div>
        <div class="readout">ARTISTE // <span>${a.photos.length} PHOTOS</span></div>
        <h1>${esc(a.name)}</h1>
        <p class="bio">Shooté par ${Object.values(byP).map((o) => esc(o.p.name)).join(", ").replace(/, ([^,]*)$/, " et $1")}.</p>
      </section>
      ${Object.values(byP).map(({ p, list }) => `<section class="block">
        <div class="block-h"><div><div class="eyebrow">Photographe</div><h2 class="block-name">${esc(p.name)}</h2><div class="block-meta">${list.length} photo${list.length > 1 ? "s" : ""}</div></div>
          <div class="block-act">${arrows}<a class="btn" href="#${esc(p.id)}">Son portfolio →</a></div></div>
        ${strip(list)}</section>`).join("")}`;
    bindStrips(app);
  }

  /* ========== CONTACT ========== */
  function contactPage() {
    document.title = `Contact — ${M.name}`;
    app.className = "";
    app.innerHTML = `<div style="height:calc(80px + env(safe-area-inset-top))"></div>${contactBlock("Parlons de ton projet.")}
      <section class="contact-sec" style="border-top:0;padding-top:30px"><div class="panel" style="margin:0;max-width:none">
        <div class="panel-h"><span>Les portfolios</span><b>${ALL.length} fichiers</b></div>
        ${PH.map((p, i) => `<a class="prow" href="#${esc(p.id)}"><span class="n">${pad(i + 1)}</span><span><b>${esc(p.name)}</b> <small>${p.handle ? "· " + esc(p.handle) : ""}</small></span><small>${p.photos.length} photos</small><span class="ar">→</span></a>`).join("")}
      </div></section>`;
  }

  /* ========== LIGHTBOX ========== */
  let current = [], li = 0;
  const lb = $("#lb"), lbImg = $("#lb-img");
  function showLB() {
    const x = current[li];
    lbImg.classList.add("swap");
    const pre = new Image(); pre.onload = pre.onerror = () => { lbImg.src = x.src; lbImg.alt = x.artist; lbImg.classList.remove("swap"); }; pre.src = x.src;
    [1, -1].forEach((d) => { const n = current[(li + d + current.length) % current.length]; if (n) new Image().src = n.src; });
    $("#lb-artist").textContent = x.artist || "";
    $("#lb-place").textContent = x.place || "";
    $("#lb-by").innerHTML = `PHOTO // <a href="#${esc(x.by.id)}">${esc(x.by.name)}</a>`;
    $("#lb-count").textContent = `${pad(li + 1)}/${pad(current.length)}`;
    const th = $("#lb-thumbs"); th.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === li));
    th.children[li]?.scrollIntoView({ inline: "center", block: "nearest" });
  }
  function openLB(i) {
    li = i; lb.classList.add("open"); document.body.style.overflow = "hidden";
    const th = $("#lb-thumbs");
    th.innerHTML = current.length > 1 ? current.map((x, k) => `<button data-k="${k}" aria-label="Photo ${k + 1}"><img src="${esc(x.src)}" alt="" loading="lazy"></button>`).join("") : "";
    th.querySelectorAll("button").forEach((b) => b.onclick = () => { li = +b.dataset.k; showLB(); });
    showLB();
  }
  function closeLB() { lb.classList.remove("open"); document.body.style.overflow = ""; }
  const step = (d) => { li = (li + d + current.length) % current.length; showLB(); };
  $("#lb-share").onclick = () => { const x = current[li]; share(x.by.id, `${x.artist} — photo ${x.by.name}`); };
  $("#lb-close").onclick = closeLB;
  $("#lb-prev").onclick = (e) => { e.stopPropagation(); step(-1); };
  $("#lb-next").onclick = (e) => { e.stopPropagation(); step(1); };
  $("#lb-stage").addEventListener("click", (e) => { if (e.target.id === "lb-stage") closeLB(); });
  addEventListener("keydown", (e) => { if (!lb.classList.contains("open")) return; if (e.key === "Escape") closeLB(); if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
  let tx = 0, ty = 0;
  $("#lb-stage").addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  $("#lb-stage").addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1); else if (dy > 90) closeLB();
  });

  /* ========== ROUTER ========== */
  function route() {
    closeLB(); clearInterval(heroTimer); strips.length = 0;
    const h = decodeURIComponent(location.hash.slice(1));
    const p = PH.find((x) => x.id === h);
    document.querySelectorAll(".tab,.nav-contact,.mm-list a").forEach((t) => t.classList.toggle("on", t.dataset.r === (p ? p.id : h)));
    app.classList.remove("enter"); void app.offsetWidth;
    if (p) photographer(p);
    else if (h === "contact") contactPage();
    else if (h.startsWith("artiste-") && ARTISTS[h.slice(8)]) artist(ARTISTS[h.slice(8)]);
    else home();
    app.classList.add("enter");
    window.scrollTo(0, 0);
    document.querySelector(".tab.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }
  const totop = $("#totop");
  const navEl = $(".nav");
  const onScroll = () => { totop.classList.toggle("show", scrollY > innerHeight * 1.5); navEl.classList.toggle("solid", scrollY > 40); };
  addEventListener("scroll", onScroll, { passive: true });
  totop.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
  addEventListener("hashchange", route);
  route();
})();
