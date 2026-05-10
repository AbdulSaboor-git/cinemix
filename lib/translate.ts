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
  "мультфильм": "Animation",
  "концерт": "Concert",
  "церемония": "Ceremony",
  "эротика": "Erotic",
};

export const COUNTRY_MAP: Record<string, string> = {
  // Major
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
  // Europe
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
  "Чехословакия": "Czechoslovakia",
  "Венгрия": "Hungary",
  "Румыния": "Romania",
  "Ирландия": "Ireland",
  "Португалия": "Portugal",
  "Греция": "Greece",
  "Болгария": "Bulgaria",
  "Хорватия": "Croatia",
  "Сербия": "Serbia",
  "Словакия": "Slovakia",
  "Словения": "Slovenia",
  "Босния и Герцеговина": "Bosnia and Herzegovina",
  "Северная Македония": "North Macedonia",
  "Албания": "Albania",
  "Черногория": "Montenegro",
  "Косово": "Kosovo",
  "Люксембург": "Luxembourg",
  "Исландия": "Iceland",
  "Мальта": "Malta",
  "Кипр": "Cyprus",
  "Эстония": "Estonia",
  "Латвия": "Latvia",
  "Литва": "Lithuania",
  "Беларусь": "Belarus",
  "Украина": "Ukraine",
  "Молдова": "Moldova",
  "Грузия": "Georgia",
  "Армения": "Armenia",
  "Азербайджан": "Azerbaijan",
  "Казахстан": "Kazakhstan",
  "Узбекистан": "Uzbekistan",
  "Туркменистан": "Turkmenistan",
  "Таджикистан": "Tajikistan",
  "Кыргызстан": "Kyrgyzstan",
  // Americas
  "Новая Зеландия": "New Zealand",
  "Мексика": "Mexico",
  "Бразилия": "Brazil",
  "Аргентина": "Argentina",
  "Колумбия": "Colombia",
  "Чили": "Chile",
  "Перу": "Peru",
  "Венесуэла": "Venezuela",
  "Куба": "Cuba",
  "Уругвай": "Uruguay",
  "Боливия": "Bolivia",
  "Эквадор": "Ecuador",
  "Парагвай": "Paraguay",
  "Панама": "Panama",
  "Коста-Рика": "Costa Rica",
  "Ямайка": "Jamaica",
  "Пуэрто-Рико": "Puerto Rico",
  // Asia & Middle East
  "Израиль": "Israel",
  "Иран": "Iran",
  "Турция": "Turkey",
  "Гонконг": "Hong Kong",
  "Тайвань": "Taiwan",
  "Таиланд": "Thailand",
  "Вьетнам": "Vietnam",
  "Индонезия": "Indonesia",
  "Малайзия": "Malaysia",
  "Филиппины": "Philippines",
  "Сингапур": "Singapore",
  "Пакистан": "Pakistan",
  "Бангладеш": "Bangladesh",
  "Шри-Ланка": "Sri Lanka",
  "Непал": "Nepal",
  "Мьянма": "Myanmar",
  "Камбоджа": "Cambodia",
  "Монголия": "Mongolia",
  "Саудовская Аравия": "Saudi Arabia",
  "ОАЭ": "UAE",
  "Катар": "Qatar",
  "Кувейт": "Kuwait",
  "Иордания": "Jordan",
  "Ливан": "Lebanon",
  "Сирия": "Syria",
  "Ирак": "Iraq",
  "Афганистан": "Afghanistan",
  // Africa
  "ЮАР": "South Africa",
  "Египет": "Egypt",
  "Нигерия": "Nigeria",
  "Марокко": "Morocco",
  "Кения": "Kenya",
  "Эфиопия": "Ethiopia",
  "Алжир": "Algeria",
  "Тунис": "Tunisia",
  "Гана": "Ghana",
  "Сенегал": "Senegal",
  "Камерун": "Cameroon",
  "Мали": "Mali",
  "Зимбабве": "Zimbabwe",
  "Танзания": "Tanzania",
  "Уганда": "Uganda",
  "Кот-д'Ивуар": "Ivory Coast",
};

export function translateGenre(ru: string): string {
  return GENRE_MAP[ru.toLowerCase()] ?? GENRE_MAP[ru] ?? ru;
}

export function translateCountry(ru: string): string {
  return COUNTRY_MAP[ru] ?? ru;
}

// ─── Strip HTML tags safely (no XSS risk) ─────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ─── Auto-translate via Google Translate (unofficial, no key needed) ──────────

export async function translateText(text: string, from = "ru", to = "en"): Promise<string> {
  if (!text || !isRussian(text)) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const res  = await fetch(url);
    const json = await res.json();
    const translated = (json[0] as [string, string][]).map(chunk => chunk[0]).join("");
    return translated || text;
  } catch {
    return text;
  }
}

/** Strip HTML first, then translate — safe alternative to dangerouslySetInnerHTML */
export async function translateHtml(html: string): Promise<string> {
  const plain = stripHtml(html);
  return translateText(plain);
}

// Heuristic: contains Cyrillic characters
export function isRussian(text: string): boolean {
  return /[а-яё]/i.test(text);
}

// ─── Preferred English name helper ────────────────────────────────────────────

export function getEnglishName(nameRu?: string, nameEn?: string, nameOriginal?: string): string {
  if (nameEn && !isRussian(nameEn)) return nameEn;
  if (nameOriginal && !isRussian(nameOriginal)) return nameOriginal;
  return nameRu || nameEn || nameOriginal || "Unknown";
}