// ─── Static lookup maps ───────────────────────────────────────────────────────

export const GENRE_MAP: Record<string, string> = {
  "триллер": "Thriller",
  "драма": "Drama",
  "криминал": "Crime",
  "мелодрама": "Romance",
  "боевик": "Action",
  "комедия": "Comedy",
  "фантастика": "Sci-Fi",
  "приключения": "Adventure",
  "биография": "Biography",
  "история": "History",
  "фэнтези": "Fantasy",
  "ужасы": "Horror",
  "аниме": "Anime",
  "семейный": "Family",
  "документальный": "Documentary",
  "музыка": "Music",
  "мюзикл": "Musical",
  "вестерн": "Western",
  "спорт": "Sport",
  "военный": "War",
  "короткометражка": "Short Film",
  "для взрослых": "Adult",
  "новости": "News",
  "реальное ТВ": "Reality TV",
  "ток-шоу": "Talk Show",
  "игра": "Game Show",
};

export const COUNTRY_MAP: Record<string, string> = {
  "США": "USA",
  "Великобритания": "UK",
  "Франция": "France",
  "Германия": "Germany",
  "Италия": "Italy",
  "Япония": "Japan",
  "Китай": "China",
  "Южная Корея": "South Korea",
  "Австралия": "Australia",
  "Канада": "Canada",
  "Испания": "Spain",
  "Россия": "Russia",
  "СССР": "USSR",
  "Индия": "India",
  "Дания": "Denmark",
  "Швеция": "Sweden",
  "Норвегия": "Norway",
  "Финляндия": "Finland",
  "Нидерланды": "Netherlands",
  "Бельгия": "Belgium",
  "Швейцария": "Switzerland",
  "Австрия": "Austria",
  "Польша": "Poland",
  "Чехия": "Czech Republic",
  "Венгрия": "Hungary",
  "Румыния": "Romania",
  "Ирландия": "Ireland",
  "Новая Зеландия": "New Zealand",
  "Мексика": "Mexico",
  "Бразилия": "Brazil",
  "Аргентина": "Argentina",
  "Израиль": "Israel",
  "Иран": "Iran",
  "Турция": "Turkey",
  "Гонконг": "Hong Kong",
  "Тайвань": "Taiwan",
  "Таиланд": "Thailand",
  "ЮАР": "South Africa",
  "Португалия": "Portugal",
  "Греция": "Greece",
};

export function translateGenre(ru: string): string {
  return GENRE_MAP[ru.toLowerCase()] || GENRE_MAP[ru] || ru;
}

export function translateCountry(ru: string): string {
  return COUNTRY_MAP[ru] || ru;
}

// ─── Auto-translate via Google Translate (unofficial, no key needed) ──────────

export async function translateText(text: string, from = "ru", to = "en"): Promise<string> {
  if (!text || !isRussian(text)) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const res  = await fetch(url);
    const json = await res.json();
    // Response shape: [[[translatedText, originalText], ...], ...]
    const translated = (json[0] as [string, string][]).map(chunk => chunk[0]).join("");
    return translated || text;
  } catch {
    return text; // fallback to original on error
  }
}

// Heuristic: contains Cyrillic characters
export function isRussian(text: string): boolean {
  return /[а-яё]/i.test(text);
}

// ─── Preferred English name helper ────────────────────────────────────────────

export function getEnglishName(nameRu?: string, nameEn?: string, nameOriginal?: string): string {
  // Prefer English > Original > Russian
  if (nameEn && !isRussian(nameEn)) return nameEn;
  if (nameOriginal && !isRussian(nameOriginal)) return nameOriginal;
  return nameRu || nameEn || nameOriginal || "Unknown";
}
