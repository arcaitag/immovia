/**
 * Marketingbilder (Unsplash-Lizenz: kostenlose kommerzielle Nutzung ohne Pflicht zur Namensnennung).
 * Quelle jeweils unsplash.com; Fotografen werden im Impressum genannt.
 */
export const MARKETING_IMAGES = {
  hero: {
    // Breiter Ausschnitt aus dem 3840×2880-Original (rect = x,y,Breite,Höhe): Chalet, See und Wiese.
    // Halbiert die Dateigrösse; die Bildposition auf der Startseite ist auf diesen Ausschnitt abgestimmt.
    src: "https://images.unsplash.com/photo-1584098731526-e3924fad98db?rect=0,860,3840,1550",
    alt: "Chalet mit Wiese an einem türkisfarbenen Bergsee",
    credit: "Unsplash",
  },
  livingRoom: {
    src: "https://images.unsplash.com/photo-1600494448850-6013c64ba722",
    alt: "Helles Wohnzimmer mit weissem Sofa und grünen Pflanzen",
    credit: "Collov Home Design",
  },
  villa: {
    src: "https://images.unsplash.com/photo-1750160868338-c0813f5dfa31",
    alt: "Modernes Haus mit Pool und Garten an einem See",
    credit: "Unsplash",
  },
  auth: {
    src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9",
    alt: "Modernes Einfamilienhaus",
    credit: "Unsplash",
  },
  sell: {
    src: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914",
    alt: "Modernes Wohnhaus mit grosser Fensterfront",
    credit: "Unsplash",
  },
  interior: {
    src: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
    alt: "Helle, möblierte Wohnung",
    credit: "Unsplash",
  },
  kitchen: {
    src: "https://images.unsplash.com/photo-1484154218962-a197022b5858",
    alt: "Moderne Küche",
    credit: "Unsplash",
  },
  chalet: {
    src: "https://images.unsplash.com/photo-1584098731526-e3924fad98db",
    alt: "Haus vor Bergkulisse",
    credit: "Unsplash",
  },
} as const;
