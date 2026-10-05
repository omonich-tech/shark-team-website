export type SportCatalogEntry = {
  slug: string;
  nameRu: string;
  nameUz: string;
  descriptionRu: string;
  descriptionUz: string;
  mark: string;
};

export const SPORT_CATALOG: SportCatalogEntry[] = [
  {
    slug: "basketball",
    nameRu: "Баскетбол",
    nameUz: "Basketbol",
    descriptionRu: "Командная игра, координация и уверенность.",
    descriptionUz: "Jamoaviy o‘yin, koordinatsiya va ishonch.",
    mark: "01"
  },
  {
    slug: "football",
    nameRu: "Футбол",
    nameUz: "Futbol",
    descriptionRu: "Техника, скорость и командное мышление.",
    descriptionUz: "Texnika, tezlik va jamoaviy fikrlash.",
    mark: "02"
  },
  {
    slug: "volleyball",
    nameRu: "Волейбол",
    nameUz: "Voleybol",
    descriptionRu: "Реакция, координация и работа в команде.",
    descriptionUz: "Reaksiya, koordinatsiya va jamoada ishlash.",
    mark: "03"
  },
  {
    slug: "athletics",
    nameRu: "Лёгкая атлетика",
    nameUz: "Yengil atletika",
    descriptionRu: "Скорость, выносливость и сильная двигательная база.",
    descriptionUz: "Tezlik, chidamlilik va kuchli harakat bazasi.",
    mark: "04"
  },
  {
    slug: "rhythmic-gymnastics",
    nameRu: "Художественная гимнастика",
    nameUz: "Badiiy gimnastika",
    descriptionRu: "Гибкость, координация, дисциплина и грация.",
    descriptionUz: "Egiluvchanlik, koordinatsiya, intizom va nafislik.",
    mark: "05"
  }
];

export function getSportCatalogEntry(slug: string) {
  return SPORT_CATALOG.find((sport) => sport.slug === slug) ?? null;
}
