/* =========================================================
   SHOWMIX — CONTENU DE DÉPART
   Utilisé en MODE DÉMO (avant de brancher Supabase) et pour
   pré-remplir la base au premier lancement.
   ========================================================= */
window.SHOWMIX_SEED = {
  media: {
    name: "SHOWMIX",
    tagline: "Le média qui capture la scène.",
    instagram: "https://www.instagram.com/showmiiix",
    tiktok: "https://www.tiktok.com/@showmiiix",
    email: "showmiiiix@gmail.com"
  },
  photographers: [
    {
      id: "thomas-pan", name: "Thomas Pan", handle: "@zea.raw",
      instagram: "https://www.instagram.com/zea.raw", ownerEmail: "thomas_pan@aol.com, shotbyzea@gmail.com", contactEmail: "shotbyzea@gmail.com", sort: 1,
      bio: "Concerts, backstage et portraits. L'énergie de la scène, sans filtre.",
      photos: [
        { src: "photos/thomas-pan/01.jpg", artist: "Artiste 1", place: "Zénith, Paris", featured: true },
        { src: "photos/thomas-pan/02.jpg", artist: "Artiste 2", place: "Transbordeur, Lyon" },
        { src: "photos/thomas-pan/03.jpg", artist: "Artiste 1", place: "Zénith, Paris" },
        { src: "photos/thomas-pan/04.jpg", artist: "Artiste 3" },
        { src: "photos/thomas-pan/05.jpg", artist: "Artiste 2", featured: true },
        { src: "photos/thomas-pan/06.jpg", artist: "Artiste 3" }
      ]
    },
    {
      id: "louis-pecriaux", name: "Louis Pecriaux", handle: "@leiioxprod_",
      instagram: "https://instagram.com/leiioxprod_", ownerEmail: "louis@showmix.fr", sort: 2,
      bio: "Lumière, mouvement, grain. Chaque show raconte une histoire.",
      photos: [
        { src: "photos/louis-pecriaux/01.jpg", artist: "Artiste A", place: "Le Dôme, Marseille", featured: true },
        { src: "photos/louis-pecriaux/02.jpg", artist: "Artiste B" },
        { src: "photos/louis-pecriaux/03.jpg", artist: "Artiste A" },
        { src: "photos/louis-pecriaux/04.jpg", artist: "Artiste C", place: "Rocher de Palmer, Bordeaux", featured: true },
        { src: "photos/louis-pecriaux/05.jpg", artist: "Artiste B" }
      ]
    },
    {
      id: "gael-shootg2", name: "Gaël", handle: "Shoot G2",
      instagram: "https://instagram.com/", ownerEmail: "gael@showmix.fr", sort: 3,
      bio: "Shooting artistes et live. Du front row au studio.",
      photos: [
        { src: "photos/gael-shootg2/01.jpg", artist: "Artiste X" },
        { src: "photos/gael-shootg2/02.jpg", artist: "Artiste Y", place: "L'Aéronef, Lille", featured: true },
        { src: "photos/gael-shootg2/03.jpg", artist: "Artiste X" },
        { src: "photos/gael-shootg2/04.jpg", artist: "Artiste Z" },
        { src: "photos/gael-shootg2/05.jpg", artist: "Artiste Y", featured: true },
        { src: "photos/gael-shootg2/06.jpg", artist: "Artiste Z" },
        { src: "photos/gael-shootg2/07.jpg", artist: "Artiste X" }
      ]
    }
  ]
};
