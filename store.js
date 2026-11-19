/* =========================================================
   SHOWMIX — COUCHE DE DONNÉES
   Deux modes : "supabase" (en ligne, multi-utilisateurs)
   ou "demo" (navigateur local). Même interface pour les deux.
   ========================================================= */
(function () {
  const cfg = window.SHOWMIX_CONFIG || {};
  const SEED = window.SHOWMIX_SEED;
  const useSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const BUCKET = "photos";
  const LS_KEY = "showmix-demo-v3";
  const LS_SESSION = "showmix-demo-session";

  const uid = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photographe";

  // Redimensionne une image avant envoi (plus léger, plus rapide)
  async function compress(file, max = 2000, quality = 0.85) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`Image illisible : « ${file.name || "fichier"} ». Essaie en JPG.`)); i.src = url; });
      if (!img.width || !img.height || img.width * img.height > 80e6) throw new Error("Dimensions d'image non valides.");
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res) => c.toBlob(res, "image/jpeg", quality));
    } finally { URL.revokeObjectURL(url); }
  }
  const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

  /* ------------------------- MODE DÉMO ------------------------- */
  let mem = null, memSession = null;
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  function demoLoad() {
    if (mem) return mem;
    const raw = lsGet(LS_KEY);
    if (raw) { try { mem = JSON.parse(raw); return mem; } catch (e) {} }
    mem = {
      media: { ...SEED.media },
      photographers: SEED.photographers.map((p) => ({
        ...p, photos: p.photos.map((ph, i) => ({ id: uid(), src: ph.src, artist: ph.artist, place: ph.place || "", sort: i, featured: !!ph.featured }))
      }))
    };
    return mem;
  }
  function demoSave() {
    if (!lsSet(LS_KEY, JSON.stringify(mem))) throw new Error("Stockage du navigateur plein (mode démo). Supprime quelques photos ou passe en mode en ligne.");
  }

  const demo = {
    mode: "demo",
    async getData() {
      const d = demoLoad();
      return JSON.parse(JSON.stringify({
        media: d.media,
        photographers: [...d.photographers].sort((a, b) => a.sort - b.sort)
          .map((p) => ({ ...p, photos: [...p.photos].sort((a, b) => a.sort - b.sort) }))
      }));
    },
    async session() {
      if (memSession) return memSession;
      const raw = lsGet(LS_SESSION);
      try { memSession = raw ? JSON.parse(raw) : null; } catch (e) { memSession = null; }
      return memSession;
    },
    async demoLogin(role, photographerId) {
      const d = demoLoad();
      const p = d.photographers.find((x) => x.id === photographerId);
      memSession = role === "admin"
        ? { email: "admin@showmix.fr", role: "admin" }
        : { email: p.ownerEmail, role: "photographer", photographerId: p.id };
      lsSet(LS_SESSION, JSON.stringify(memSession));
      return memSession;
    },
    async signOut() { memSession = null; try { localStorage.removeItem(LS_SESSION); } catch (e) {} },
    async saveMedia(fields) { const d = demoLoad(); Object.assign(d.media, fields); demoSave(); },
    async createPhotographer(fields) {
      const d = demoLoad(); let id = slug(fields.name); while (d.photographers.some((p) => p.id === id)) id += "-2";
      d.photographers.push({ id, name: fields.name, handle: fields.handle || "", instagram: fields.instagram || "", bio: fields.bio || "",
        ownerEmail: fields.ownerEmail || "", sort: d.photographers.length + 1, photos: [] });
      demoSave(); return id;
    },
    async updatePhotographer(id, fields) { const d = demoLoad(); Object.assign(d.photographers.find((p) => p.id === id), fields); demoSave(); },
    async deletePhotographer(id) { const d = demoLoad(); d.photographers = d.photographers.filter((p) => p.id !== id); demoSave(); },
    async addPhoto(pid, file, meta) {
      const d = demoLoad(); const p = d.photographers.find((x) => x.id === pid);
      const blob = await compress(file, 1400, 0.8);
      const src = await blobToDataURL(blob);
      const min = p.photos.reduce((m, x) => Math.min(m, x.sort), 0);
      p.photos.push({ id: uid(), src, artist: meta.artist || "", place: meta.place || "", sort: min - 1, featured: false });
      try { demoSave(); } catch (e) { p.photos.pop(); throw e; }
    },
    async updatePhoto(pid, id, fields) { const d = demoLoad(); Object.assign(d.photographers.find((p) => p.id === pid).photos.find((x) => x.id === id), fields); demoSave(); },
    async deletePhoto(pid, id) { const d = demoLoad(); const p = d.photographers.find((x) => x.id === pid); p.photos = p.photos.filter((x) => x.id !== id); demoSave(); },
    async reorder(pid, ids) { const d = demoLoad(); const p = d.photographers.find((x) => x.id === pid); ids.forEach((id, i) => { p.photos.find((x) => x.id === id).sort = i; }); demoSave(); },
    async reset() { try { localStorage.removeItem(LS_KEY); } catch (e) {} mem = null; }
  };

  /* ----------------------- MODE SUPABASE ----------------------- */
  let sb = null;
  if (useSupabase) sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const publicUrl = (path) => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const online = {
    mode: "supabase",
    async getData() {
      const [settings, phs, photos] = await Promise.all([
        sb.from("settings").select("*").eq("id", 1).maybeSingle().then(chk),
        sb.from("photographers").select("id,name,handle,instagram,bio,cover,sort").order("sort").then(chk),
        sb.from("photos").select("id,photographer_id,url,path,artist,place,featured,sort,created_at").order("sort").order("created_at", { ascending: false }).then(chk)
      ]);
      // emails propriétaires : seulement si l'utilisateur connecté est admin (sinon liste vide)
      let owners = [];
      try { const { data: ses } = await sb.auth.getSession(); if (ses.session) owners = chk(await sb.rpc("owner_emails")) || []; } catch (e) { owners = []; }
      const ownerOf = Object.fromEntries(owners.map((o) => [o.id, o.owner_email || ""]));
      return {
        media: settings ? { name: settings.name, tagline: settings.tagline, instagram: settings.instagram, tiktok: settings.tiktok || "", email: settings.email } : SEED.media,
        photographers: phs.map((p) => ({
          id: p.id, name: p.name, handle: p.handle || "", instagram: p.instagram || "", bio: p.bio || "", ownerEmail: ownerOf[p.id] || "", sort: p.sort, cover: p.cover || "",
          photos: photos.filter((x) => x.photographer_id === p.id).map((x) => ({ id: x.id, src: x.url, path: x.path, artist: x.artist || "", place: x.place || "", sort: x.sort, featured: !!x.featured, created: x.created_at }))
        }))
      };
    },
    async session() {
      const { data } = await sb.auth.getSession();
      const email = data.session && data.session.user.email;
      if (!email) return null;
      if (chk(await sb.rpc("is_admin"))) return { email, role: "admin" };
      const mine = chk(await sb.rpc("my_portfolio"));
      if (mine) return { email, role: "photographer", photographerId: mine };
      return { email, role: "none" };
    },
    async signIn(email, password) { chk(await sb.auth.signInWithPassword({ email, password })); },
    async signUp(email, password) { const d = chk(await sb.auth.signUp({ email, password })); return !d.session; /* true = email de confirmation */ },
    async resetPassword(email) { chk(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] })); },
    async signOut() { await sb.auth.signOut(); },
    async saveMedia(f) { chk(await sb.from("settings").upsert({ id: 1, name: f.name, tagline: f.tagline, instagram: f.instagram, tiktok: f.tiktok, email: f.email })); },
    async createPhotographer(f) {
      let id = slug(f.name);
      const existing = chk(await sb.from("photographers").select("id,sort"));
      while (existing.some((p) => p.id === id)) id += "-2";
      chk(await sb.from("photographers").insert({ id, name: f.name, handle: f.handle, instagram: f.instagram, bio: f.bio,
        owner_email: (f.ownerEmail || "").toLowerCase() || null, sort: existing.length + 1 }));
      return id;
    },
    async updatePhotographer(id, f) {
      const row = {};
      if ("name" in f) row.name = f.name; if ("handle" in f) row.handle = f.handle; if ("instagram" in f) row.instagram = f.instagram;
      if ("bio" in f) row.bio = f.bio; if ("sort" in f) row.sort = f.sort; if ("cover" in f) row.cover = f.cover || null;
      if ("ownerEmail" in f) row.owner_email = (f.ownerEmail || "").toLowerCase() || null;
      chk(await sb.from("photographers").update(row).eq("id", id));
    },
    async deletePhotographer(id) {
      const files = chk(await sb.from("photos").select("path").eq("photographer_id", id)).map((x) => x.path).filter(Boolean);
      if (files.length) await sb.storage.from(BUCKET).remove(files);
      chk(await sb.from("photographers").delete().eq("id", id));
    },
    async addPhoto(pid, file, meta) {
      const blob = await compress(file);
      const path = `${pid}/${uid()}.jpg`;
      chk(await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" }));
      const first = chk(await sb.from("photos").select("sort").eq("photographer_id", pid).order("sort").limit(1));
      const sort = first.length ? first[0].sort - 1 : 0;
      chk(await sb.from("photos").insert({ photographer_id: pid, url: publicUrl(path), path, artist: meta.artist, place: meta.place, sort }));
    },
    async updatePhoto(pid, id, f) { const row = {}; ["artist", "place", "featured"].forEach((k) => { if (k in f) row[k] = f[k]; }); chk(await sb.from("photos").update(row).eq("id", id)); },
    async deletePhoto(pid, id) {
      const row = chk(await sb.from("photos").select("path").eq("id", id).maybeSingle());
      chk(await sb.from("photos").delete().eq("id", id));
      if (row && row.path) await sb.storage.from(BUCKET).remove([row.path]);
    },
    async reorder(pid, ids) { await Promise.all(ids.map((id, i) => sb.from("photos").update({ sort: i }).eq("id", id).then(chk))); }
  };

  /* -------------------- GARDE-FOUS (sécurité) --------------------
     Tout ce qui entre ou sort passe par ici : textes coupés à une longueur
     max, liens limités à https (Instagram/TikTok), images vérifiées.
     La base Supabase refait ces contrôles côté serveur (setup.sql). */
  const LIM = { name: 60, handle: 40, bio: 400, artist: 80, place: 120, tagline: 140 };
  const MAX_FILE = 30 * 1024 * 1024; // 30 Mo avant compression
  const OK_TYPES = /^image\/(jpeg|png|webp|heic|heif|avif)$/i;
  const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  const cleanBio = (v) => String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, "").trim().slice(0, LIM.bio);
  const socialUrl = (v, host) => {
    v = String(v ?? "").trim(); if (!v) return "";
    if (/^@?[\w.]{1,40}$/.test(v)) v = `https://www.${host}/${host.startsWith("tiktok") ? "@" : ""}${v.replace(/^@/, "")}`;
    try { const u = new URL(v); if (u.protocol === "https:" && (u.hostname === host || u.hostname.endsWith("." + host))) return u.href; } catch (e) {}
    throw new Error(`Lien ${host.split(".")[0]} invalide (ex : https://www.${host}/pseudo)`);
  };
  const safeSocial = (v) => { try { const u = new URL(String(v || "")); return u.protocol === "https:" && /(^|\.)(instagram|tiktok)\.com$/.test(u.hostname) ? u.href : ""; } catch (e) { return ""; } };
  const safeImg = (v) => {
    v = String(v || "");
    if (/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(v)) return v;
    if (/^photos\/[\w-]+\/[\w.-]+\.(jpe?g|png|webp)$/i.test(v)) return v;           // photos de démo locales
    try { const u = new URL(v); if (u.protocol === "https:" && u.pathname.includes("/storage/v1/object/public/" + BUCKET + "/")) return u.href; } catch (e) {}
    return "";
  };
  const emailOk = (v) => /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i.test(String(v || "").trim());
  const safeId = (v) => /^[a-z0-9-]{1,80}$/.test(String(v)) ? String(v) : null;

  function sanitizeData(d) {
    const m = d.media || {};
    return {
      media: { name: clean(m.name, 40) || "SHOWMIX", tagline: clean(m.tagline, LIM.tagline), instagram: safeSocial(m.instagram), tiktok: safeSocial(m.tiktok), email: emailOk(m.email) ? String(m.email).trim() : "" },
      photographers: (d.photographers || []).filter((p) => safeId(p.id)).map((p) => ({
        ...p, name: clean(p.name, LIM.name), handle: clean(p.handle, LIM.handle), bio: cleanBio(p.bio), instagram: safeSocial(p.instagram),
        photos: (p.photos || []).map((x) => ({ ...x, src: safeImg(x.src), artist: clean(x.artist, LIM.artist), place: clean(x.place, LIM.place), featured: !!x.featured })).filter((x) => x.src)
      }))
    };
  }
  function cleanProfile(f) {
    const o = {};
    if ("name" in f) { o.name = clean(f.name, LIM.name); if (!o.name) throw new Error("Le nom est obligatoire."); }
    if ("handle" in f) o.handle = clean(f.handle, LIM.handle);
    if ("bio" in f) o.bio = cleanBio(f.bio);
    if ("instagram" in f) o.instagram = socialUrl(f.instagram, "instagram.com");
    if ("ownerEmail" in f) { o.ownerEmail = String(f.ownerEmail || "").trim().toLowerCase(); if (o.ownerEmail && !emailOk(o.ownerEmail)) throw new Error("Email du photographe invalide."); }
    if ("cover" in f) o.cover = f.cover ? String(f.cover).slice(0, 80) : "";
    if ("sort" in f) o.sort = Number(f.sort) | 0;
    return o;
  }
  const impl = useSupabase ? online : demo;
  const guarded = {
    mode: impl.mode,
    getData: async () => sanitizeData(await impl.getData()),
    session: () => impl.session(),
    signOut: () => impl.signOut(),
    async saveMedia(f) {
      if (f.email && !emailOk(f.email)) throw new Error("Email de contact invalide.");
      return impl.saveMedia({ name: clean(f.name, 40) || "SHOWMIX", tagline: clean(f.tagline, LIM.tagline), instagram: socialUrl(f.instagram, "instagram.com"), tiktok: socialUrl(f.tiktok, "tiktok.com"), email: String(f.email || "").trim() });
    },
    createPhotographer: (f) => impl.createPhotographer(cleanProfile({ handle: "", bio: "", instagram: "", ownerEmail: "", ...f })),
    updatePhotographer: (id, f) => { if (!safeId(id)) throw new Error("Identifiant invalide."); return impl.updatePhotographer(id, cleanProfile(f)); },
    deletePhotographer: (id) => { if (!safeId(id)) throw new Error("Identifiant invalide."); return impl.deletePhotographer(id); },
    async addPhoto(pid, file, meta) {
      if (!safeId(pid)) throw new Error("Identifiant invalide.");
      if (!(file instanceof Blob)) throw new Error("Fichier invalide.");
      if (file.type && !OK_TYPES.test(file.type)) throw new Error(`« ${file.name} » n'est pas une image acceptée (JPG, PNG, WEBP, HEIC).`);
      if (file.size > MAX_FILE) throw new Error(`« ${file.name} » est trop lourde (max 30 Mo).`);
      const artist = clean(meta.artist, LIM.artist); if (!artist) throw new Error("Le nom de l'artiste est obligatoire.");
      return impl.addPhoto(pid, file, { artist, place: clean(meta.place, LIM.place) });
    },
    updatePhoto(pid, id, f) {
      const o = {};
      if ("artist" in f) { o.artist = clean(f.artist, LIM.artist); if (!o.artist) throw new Error("Le nom de l'artiste est obligatoire."); }
      if ("place" in f) o.place = clean(f.place, LIM.place);
      if ("featured" in f) o.featured = !!f.featured;
      return impl.updatePhoto(pid, id, o);
    },
    deletePhoto: (pid, id) => impl.deletePhoto(pid, id),
    reorder: (pid, ids) => impl.reorder(pid, ids.map(String).slice(0, 5000))
  };
  if (useSupabase) Object.assign(guarded, {
    signIn: (e, p) => impl.signIn(String(e).trim().toLowerCase(), String(p)),
    signUp: (e, p) => { if (String(p).length < 10) throw new Error("Mot de passe : 10 caractères minimum."); return impl.signUp(String(e).trim().toLowerCase(), String(p)); },
    resetPassword: (e) => impl.resetPassword(String(e).trim().toLowerCase())
  });
  else Object.assign(guarded, { demoLogin: (r, id) => impl.demoLogin(r, id), reset: () => impl.reset() });

  Object.defineProperty(window, "Store", { value: Object.freeze(guarded), writable: false, configurable: false });
})();
