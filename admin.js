"use strict";
(async function () {
  const root = document.getElementById("root");
  // Anti-clickjacking : l'admin en ligne refuse de s'afficher dans un cadre (iframe)
  if (Store.mode === "supabase" && window.top !== window.self) {
    root.textContent = "Pour ta sécurité, l'espace admin ne peut pas s'ouvrir dans un cadre. Ouvre admin.html directement.";
    return;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  let toastT;
  const toast = (msg, err) => { const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : ""); clearTimeout(toastT); toastT = setTimeout(() => t.className = "toast", 3200); };
  const ask = (title, text, yes = "Supprimer") => new Promise((res) => {
    const m = $("#modal"); $("#m-t").textContent = title; $("#m-p").textContent = text; $("#m-yes").textContent = yes; m.classList.add("open");
    const done = (v) => { m.classList.remove("open"); $("#m-yes").onclick = $("#m-no").onclick = null; res(v); };
    $("#m-yes").onclick = () => done(true); $("#m-no").onclick = () => done(false);
  });

  let S = null, DATA = null, sel = null; // session, data, selected tab

  async function reload() { DATA = await Store.getData(); }
  const canEdit = (pid) => S && (S.role === "admin" || S.photographerId === pid);

  /* ===================== LOGIN ===================== */
  function loginView(msg) {
    if (Store.mode === "demo") {
      root.innerHTML = `<div class="login"><div class="box">
        <a href="index.html" class="logo">Showmix</a>
        <h1 class="h1" style="margin-top:18px">Espace <em>admin</em></h1>
        <p class="lead">Mode démo : choisis avec quel compte te connecter pour tester.</p>
        <div class="who">
          <button data-role="admin"><span><b>Admin</b><small>Accès total : tous les portfolios, le média</small></span><span class="r a">Admin</span></button>
          ${DATA.photographers.map((p) => `<button data-role="photographer" data-id="${esc(p.id)}"><span><b>${esc(p.name)}</b><small>Ne peut modifier que son portfolio</small></span><span class="r">Photographe</span></button>`).join("")}
        </div>
        <p class="note">Ici tout est enregistré dans <b>ton navigateur</b> uniquement. Pour que les photographes se connectent pour de vrai depuis leur téléphone, branche Supabase (voir <code>LISEZMOI.md</code>).</p>
        <p class="note"><button class="linkish" id="reset">Réinitialiser la démo</button></p>
      </div></div>`;
      root.querySelectorAll(".who button").forEach((b) => b.onclick = async () => { S = await Store.demoLogin(b.dataset.role, b.dataset.id); sel = null; dash(); });
      $("#reset").onclick = async () => { if (await ask("Réinitialiser ?", "Toutes les modifs de la démo seront effacées.", "Réinitialiser")) { await Store.reset(); await reload(); toast("Démo réinitialisée"); loginView(); } };
      return;
    }
    let mode = "in";
    const draw = () => {
      root.innerHTML = `<div class="login"><div class="box">
        <a href="index.html" class="logo">Showmix</a>
        <h1 class="h1" style="margin-top:18px">${mode === "up" ? "Créer un <em>compte</em>" : mode === "reset" ? "Mot de passe <em>oublié</em>" : "Espace <em>admin</em>"}</h1>
        <p class="lead">${mode === "up" ? "Utilise l'email que l'admin a lié à ton portfolio." : mode === "reset" ? "On t'envoie un lien par email." : "Connecte-toi pour gérer ton portfolio."}</p>
        ${msg ? `<p class="note" style="color:var(--accent2)">${esc(msg)}</p>` : ""}
        <form class="form" id="lf" style="grid-template-columns:1fr;margin-top:22px">
          <label class="f">Email<input class="in" type="email" name="email" required autocomplete="email"></label>
          ${mode !== "reset" ? `<label class="f">Mot de passe<input class="in" type="password" name="pw" required minlength="10" autocomplete="${mode === "up" ? "new-password" : "current-password"}"></label>` : ""}
          <button class="btn pri" type="submit">${mode === "up" ? "Créer mon compte" : mode === "reset" ? "Envoyer le lien" : "Se connecter"}</button>
        </form>
        <p class="note" style="display:flex;gap:16px;flex-wrap:wrap">
          ${mode !== "in" ? `<button class="linkish" data-m="in">J'ai déjà un compte</button>` : `<button class="linkish" data-m="up">Créer un compte</button><button class="linkish" data-m="reset">Mot de passe oublié</button>`}
        </p></div></div>`;
      root.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => { mode = b.dataset.m; msg = ""; draw(); });
      $("#lf").onsubmit = async (e) => {
        e.preventDefault(); const f = new FormData(e.target); const btn = e.target.querySelector("button"); btn.disabled = true;
        try {
          if (mode === "in") { await Store.signIn(f.get("email"), f.get("pw")); await start(); }
          else if (mode === "up") { const needConfirm = await Store.signUp(f.get("email"), f.get("pw")); if (needConfirm) { mode = "in"; msg = "Compte créé ! Clique sur le lien reçu par email puis connecte-toi."; draw(); } else await start(); }
          else { await Store.resetPassword(f.get("email")); mode = "in"; msg = "Lien envoyé, regarde tes emails."; draw(); }
        } catch (err) { const m = String(err.message || "");
          toast(/invalid login|invalid credentials/i.test(m) ? "Email ou mot de passe incorrect" : /rate limit|too many/i.test(m) ? "Trop de tentatives, réessaie dans quelques minutes" : /confirm/i.test(m) ? "Confirme d'abord ton email (lien reçu par mail)" : m, true);
          setTimeout(() => { btn.disabled = false; }, 1500); }
      };
    };
    draw();
  }

  /* ===================== DASHBOARD ===================== */
  function dash() {
    if (S.role === "none") {
      root.innerHTML = `<div class="login"><div class="box"><h1 class="h1">Presque <em>prêt</em></h1>
        <p class="lead">Ton compte (${esc(S.email)}) n'est lié à aucun portfolio pour l'instant. Demande à l'admin de SHOWMIX d'ajouter ton email sur ta fiche photographe.</p>
        <div class="row-end" style="justify-content:flex-start"><button class="btn" id="out">Se déconnecter</button><a class="btn" href="index.html">Voir le site</a></div></div></div>`;
      $("#out").onclick = logout; return;
    }
    const list = S.role === "admin" ? DATA.photographers : DATA.photographers.filter((p) => p.id === S.photographerId);
    if (!sel || (sel !== "media" && sel !== "new" && !list.some((p) => p.id === sel))) sel = list[0] ? list[0].id : (S.role === "admin" ? "media" : null);
    const me = DATA.photographers.find((p) => p.id === S.photographerId);
    root.innerHTML = `
      <div class="top">
        <a href="index.html" class="logo">Showmix</a>
        <div class="right">
          <span class="badge ${S.role === "admin" ? "" : "ph"}">${S.role === "admin" ? "Admin" : esc(me ? me.name : "Photographe")}</span>
          <a class="btn sm" href="index.html${sel && sel !== "media" && sel !== "new" ? "#" + esc(sel) : ""}" target="_blank" rel="noopener">Voir le site ↗</a>
          <button class="btn sm" id="out" title="Se déconnecter">Sortir</button>
        </div>
      </div>
      <div class="layout">
        ${S.role === "admin" || list.length > 1 ? `<aside class="side">
          ${S.role === "admin" ? `<h6>Média</h6><button class="tab ${sel === "media" ? "on" : ""}" data-t="media">⚙︎ Réglages du média</button><h6>Photographes</h6>` : ""}
          ${list.map((p) => `<button class="tab ${sel === p.id ? "on" : ""}" data-t="${esc(p.id)}">${esc(p.name)} <small>${p.photos.length}</small></button>`).join("")}
          ${S.role === "admin" ? `<button class="tab add ${sel === "new" ? "on" : ""}" data-t="new">+ Ajouter un photographe</button>` : ""}
        </aside>` : ""}
        <section class="main" id="main"></section>
      </div>`;
    if (!(S.role === "admin" || list.length > 1)) root.querySelector(".layout").style.gridTemplateColumns = "1fr";
    $("#out").onclick = logout;
    root.querySelectorAll(".tab").forEach((t) => t.onclick = () => { sel = t.dataset.t; dash(); scrollTo(0, 0); });
    const main = $("#main");
    // artist suggestions
    const names = [...new Set(DATA.photographers.flatMap((p) => p.photos.map((x) => x.artist)).filter(Boolean))].sort();
    $("#artists-list").innerHTML = names.map((n) => `<option value="${esc(n)}">`).join("");
    if (sel === "media") return mediaView(main);
    if (sel === "new") return photographerForm(main, null);
    const p = DATA.photographers.find((x) => x.id === sel);
    if (p) photographerView(main, p);
  }

  async function logout() { await Store.signOut(); S = null; sel = null; loginView(); }

  /* ---------- Media settings (admin) ---------- */
  function mediaView(main) {
    const m = DATA.media;
    main.innerHTML = `<h1 class="h1">Réglages <em>média</em></h1><p class="lead">Ce qui s'affiche sur la page d'accueil et en bas du site.</p>
      <form class="card form" id="mf">
        <label class="f">Nom du média<input class="in" name="name" value="${esc(m.name)}" required></label>
        <label class="f">Email de contact<input class="in" name="email" type="email" value="${esc(m.email)}"></label>
        <label class="f full">Phrase d'accroche<input class="in" name="tagline" value="${esc(m.tagline)}"></label>
        <label class="f">Lien Instagram du média<input class="in" name="instagram" value="${esc(m.instagram)}" placeholder="https://instagram.com/..."></label>
        <label class="f">Lien TikTok du média<input class="in" name="tiktok" value="${esc(m.tiktok)}" placeholder="https://tiktok.com/@..."></label>
        <div class="full row-end"><button class="btn pri">Enregistrer</button></div>
      </form>`;
    $("#mf").onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      try { await Store.saveMedia(f); await reload(); toast("Réglages enregistrés ✓"); } catch (err) { toast(err.message, true); }
    };
  }

  /* ---------- Photographer profile form ---------- */
  function profileFields(p) {
    const admin = S.role === "admin";
    return `
      <label class="f">Nom affiché<input class="in" name="name" value="${esc(p?.name)}" required placeholder="ex : Thomas Pan"></label>
      <label class="f">Pseudo / @<input class="in" name="handle" value="${esc(p?.handle)}" placeholder="ex : @leiioxprod_"></label>
      <label class="f full">Lien Instagram<input class="in" name="instagram" value="${esc(p?.instagram)}" placeholder="https://instagram.com/..."></label>
      <label class="f full">Bio<textarea class="in" name="bio" placeholder="Une phrase sur ton style…">${esc(p?.bio)}</textarea></label>
      ${admin ? `<label class="f full">Email du compte photographe <span style="opacity:.7">— la personne qui se connecte avec cet email pourra modifier ce portfolio</span><input class="in" type="email" name="ownerEmail" value="${esc(p?.ownerEmail)}" placeholder="photographe@email.com"></label>` : ""}`;
  }
  function photographerForm(main, p) {
    main.innerHTML = `<h1 class="h1">Nouveau <em>photographe</em></h1><p class="lead">Il aura sa propre page portfolio sur le site.</p>
      <form class="card form" id="pf">${profileFields(null)}<div class="full row-end"><button class="btn pri">Créer le portfolio</button></div></form>`;
    $("#pf").onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      try { const id = await Store.createPhotographer(f); await reload(); sel = id; toast("Photographe ajouté ✓"); dash(); } catch (err) { toast(err.message, true); }
    };
  }

  /* ---------- Photographer: photos + profile ---------- */
  function photographerView(main, p) {
    const admin = S.role === "admin";
    main.innerHTML = `
      <h1 class="h1">${esc(p.name)}</h1>
      <p class="lead">${S.role === "admin" ? "Tu peux tout modifier." : "Ton portfolio : ajoute, renomme, réorganise."}</p>
      <div class="dash-stats"><div><b>${p.photos.length}</b>Photos</div><div><b>${new Set(p.photos.map((x) => x.artist).filter(Boolean)).size}</b>Artistes</div><div><b>${p.photos.filter((x) => x.featured).length}</b>À la une</div></div>

      <div class="card">
        <h3>Ajouter des photos</h3>
        <label class="drop" id="drop"><input type="file" id="file" accept="image/*" multiple hidden>
          <b>+ Dépose tes photos</b><span>ou clique pour choisir · autant que tu veux · JPG, PNG, HEIC (selon le navigateur)</span></label>
        <div id="stage-wrap" style="display:none">
          <div class="bulk">
            <label class="f">Artiste pour toutes les photos<input class="in" id="bulk-artist" list="artists-list" placeholder="ex : Ninho"></label>
            <label class="f">Lieu / date (optionnel)<input class="in" id="bulk-place" placeholder="ex : Zénith Paris, mars 2026"></label>
            <button class="btn" id="bulk-apply" type="button">Appliquer à toutes</button>
          </div>
          <div class="stage" id="stage"></div>
          <div class="progress" id="prog"><i></i></div>
          <div class="row-end"><button class="btn" id="st-cancel" type="button">Annuler</button><button class="btn pri" id="st-go" type="button">Publier</button></div>
        </div>
      </div>

      <div class="card">
        <h3><span>Photos en ligne <span style="text-transform:none;letter-spacing:0;opacity:.7">· glisse pour réordonner · ★ = à la une · ◐ = couverture</span></span>${p.photos.length > 4 ? `<input class="in search" id="search" placeholder="Filtrer par artiste…">` : ""}</h3>
        ${p.photos.length ? `<div class="mgrid" id="mgrid"></div>` : `<p class="lead">Aucune photo pour l'instant. Ajoute les premières juste au-dessus.</p>`}
      </div>

      <form class="card form" id="pf"><h3 class="full">Profil</h3>${profileFields(p)}
        <div class="full row-end">${admin ? `<button class="btn red" type="button" id="del-ph">Supprimer ce photographe</button>` : ""}<button class="btn pri">Enregistrer le profil</button></div>
      </form>`;

    /* --- profile --- */
    $("#pf").onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      try { await Store.updatePhotographer(p.id, f); await reload(); toast("Profil enregistré ✓"); dash(); } catch (err) { toast(err.message, true); }
    };
    if (admin) $("#del-ph").onclick = async () => {
      if (!(await ask(`Supprimer ${p.name} ?`, `Son portfolio et ses ${p.photos.length} photos seront supprimés définitivement.`))) return;
      try { await Store.deletePhotographer(p.id); await reload(); sel = null; toast("Photographe supprimé"); dash(); } catch (err) { toast(err.message, true); }
    };

    /* --- upload staging --- */
    let staged = [];
    const drop = $("#drop"), file = $("#file");
    const add = (files) => {
      [...files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).forEach((f) => staged.push({ f, url: URL.createObjectURL(f), artist: $("#bulk-artist").value, place: $("#bulk-place").value }));
      drawStage();
    };
    file.onchange = () => { add(file.files); file.value = ""; };
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => add(e.dataTransfer.files));
    function drawStage() {
      $("#stage-wrap").style.display = staged.length ? "" : "none";
      $("#st-go").textContent = `Publier ${staged.length} photo${staged.length > 1 ? "s" : ""}`;
      $("#stage").innerHTML = staged.map((s, i) => `
        <div class="st-item" data-i="${i}"><img src="${s.url}" alt="">
          <div class="fields"><input class="in" data-k="artist" list="artists-list" placeholder="Nom de l'artiste *" value="${esc(s.artist)}"><input class="in" data-k="place" placeholder="Lieu / date" value="${esc(s.place)}"></div>
          <button class="btn sm red" data-x="${i}" type="button" aria-label="Retirer">✕</button></div>`).join("");
      $("#stage").querySelectorAll("input").forEach((inp) => inp.oninput = () => { staged[+inp.closest(".st-item").dataset.i][inp.dataset.k] = inp.value; });
      $("#stage").querySelectorAll("[data-x]").forEach((b) => b.onclick = () => { URL.revokeObjectURL(staged[+b.dataset.x].url); staged.splice(+b.dataset.x, 1); drawStage(); });
    }
    $("#bulk-apply").onclick = () => { const a = $("#bulk-artist").value, pl = $("#bulk-place").value; staged.forEach((s) => { if (a) s.artist = a; if (pl) s.place = pl; }); drawStage(); };
    $("#st-cancel").onclick = () => { staged.forEach((s) => URL.revokeObjectURL(s.url)); staged = []; drawStage(); };
    $("#st-go").onclick = async () => {
      const missing = staged.findIndex((s) => !s.artist.trim());
      if (missing > -1) { toast("Indique le nom de l'artiste pour chaque photo", true); $("#stage").children[missing].querySelector("input").focus(); return; }
      const go = $("#st-go"), prog = $("#prog"); go.disabled = true; prog.style.display = "block";
      let ok = 0; const items = [...$("#stage").children];
      for (let i = 0; i < staged.length; i++) {
        try { await Store.addPhoto(p.id, staged[i].f, { artist: staged[i].artist.trim(), place: staged[i].place.trim() }); ok++; items[i].classList.add("done"); }
        catch (err) { items[i].classList.add("err"); toast(err.message, true); break; }
        prog.firstElementChild.style.width = ((i + 1) / staged.length * 100) + "%";
      }
      await reload(); toast(`${ok} photo${ok > 1 ? "s" : ""} publiée${ok > 1 ? "s" : ""} ✓`); dash();
    };

    /* --- manage existing --- */
    const grid = $("#mgrid"); if (!grid) return;
    let order = p.photos.map((x) => x.id);
    const byId = Object.fromEntries(p.photos.map((x) => [x.id, x]));
    let filter = "", dragId = null;
    function drawGrid() {
      grid.innerHTML = order.map((id, i) => { const x = byId[id]; if (filter && !(x.artist || "").toLowerCase().includes(filter)) return "";
        const isCover = (p.cover || order[0]) === id;
        return `<div class="mitem${x.featured ? " feat" : ""}" data-id="${esc(id)}" draggable="true">
          <div class="ph"><img src="${esc(x.src)}" alt="" loading="lazy" draggable="false"><span class="pos">#${i + 1}</span>
            <div class="flags"><button class="flag${x.featured ? " on" : ""}" data-feat title="À la une sur l'accueil">★</button><button class="flag${isCover ? " on" : ""}" data-cover title="Photo de couverture du portfolio">◐</button></div>
            ${isCover ? `<span class="cov-lbl">Couverture</span>` : ""}<span class="grip" title="Glisser pour déplacer">⠿</span></div>
          <div class="body">
            <input class="in" data-k="artist" list="artists-list" value="${esc(x.artist)}" placeholder="Artiste">
            <input class="in" data-k="place" value="${esc(x.place)}" placeholder="Lieu / date">
            <div class="acts"><button class="btn sm" data-mv="-1" title="Avancer" ${i === 0 ? "disabled" : ""}>←</button><button class="btn sm" data-mv="1" title="Reculer" ${i === order.length - 1 ? "disabled" : ""}>→</button><button class="btn sm red" data-del title="Supprimer">🗑</button></div>
          </div></div>`; }).join("");
      grid.querySelectorAll(".mitem").forEach((el) => {
        const id = el.dataset.id;
        el.querySelectorAll("input").forEach((inp) => inp.onchange = async () => {
          const x = byId[id]; x[inp.dataset.k] = inp.value.trim();
          try { await Store.updatePhoto(p.id, id, { artist: x.artist, place: x.place }); toast("Enregistré ✓"); } catch (err) { toast(err.message, true); }
        });
        el.querySelectorAll("[data-mv]").forEach((b) => b.onclick = async () => {
          const i = order.indexOf(id), j = i + +b.dataset.mv; [order[i], order[j]] = [order[j], order[i]]; drawGrid();
          try { await Store.reorder(p.id, order); } catch (err) { toast(err.message, true); }
        });
        el.querySelector("[data-del]").onclick = async () => {
          if (!(await ask("Supprimer cette photo ?", `${byId[id].artist || "Photo"} sera retirée du site.`))) return;
          try { await Store.deletePhoto(p.id, id); await reload(); toast("Photo supprimée"); dash(); } catch (err) { toast(err.message, true); }
        };
        el.querySelector("[data-feat]").onclick = async () => {
          const x = byId[id]; x.featured = !x.featured;
          try { await Store.updatePhoto(p.id, id, { featured: x.featured }); drawGrid(); toast(x.featured ? "★ Ajoutée à la une" : "Retirée de la une"); } catch (err) { x.featured = !x.featured; toast(err.message, true); }
        };
        el.querySelector("[data-cover]").onclick = async () => {
          try { await Store.updatePhotographer(p.id, { cover: id }); p.cover = id; drawGrid(); toast("Photo de couverture changée ✓"); } catch (err) { toast(err.message, true); }
        };
        el.addEventListener("dragstart", (e) => { dragId = id; el.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
        el.addEventListener("dragend", () => { el.classList.remove("dragging"); grid.querySelectorAll(".over").forEach((o) => o.classList.remove("over")); });
        el.addEventListener("dragover", (e) => { e.preventDefault(); if (dragId && dragId !== id) el.classList.add("over"); });
        el.addEventListener("dragleave", () => el.classList.remove("over"));
        el.addEventListener("drop", async (e) => {
          e.preventDefault(); el.classList.remove("over"); if (!dragId || dragId === id) return;
          order.splice(order.indexOf(dragId), 1); order.splice(order.indexOf(id), 0, dragId); dragId = null; drawGrid();
          try { await Store.reorder(p.id, order); toast("Ordre enregistré ✓"); } catch (err) { toast(err.message, true); }
        });
      });
    }
    drawGrid();
    const search = $("#search"); if (search) search.oninput = () => { filter = search.value.toLowerCase().trim(); drawGrid(); };
  }

  /* ===================== START ===================== */
  // Déconnexion automatique après 45 min sans activité (mode en ligne)
  let idleT;
  function armIdle() {
    if (Store.mode !== "supabase") return;
    clearTimeout(idleT);
    idleT = setTimeout(async () => { if (S) { await logout(); toast("Déconnecté après 45 min d'inactivité"); } }, 45 * 60 * 1000);
  }
  ["pointerdown", "keydown", "scroll"].forEach((ev) => addEventListener(ev, armIdle, { passive: true }));

  async function start() {
    try { await reload(); S = await Store.session(); }
    catch (err) { root.innerHTML = `<div class="login"><div class="box"><h1 class="h1">Oups</h1><p class="lead">${esc(err.message)}</p><p class="note">Vérifie <code>config.js</code> et que le script <code>setup.sql</code> a bien été lancé dans Supabase.</p></div></div>`; return; }
    S ? (armIdle(), dash()) : loginView();
  }
  start();
})();
