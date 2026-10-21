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
  "реальное тв": "Reality TV",
  "реальное ТВ": "Reality TV",
  "ток-шоу": "Talk Show",
  "игра": "Game Show",
  "мультфильм": "Animation",
  "концерт": "Concert",
  "церемония": "Ceremony",
  "эротика": "Erotic",
  "детектив": "Detective",
  "детский": "Children",
  "фильм-нуар": "Film Noir",
};

export const COUNTRY_MAP: Record<string, string> = {
  // Major
  "США": "USA",
  "Великобритания": "UK",
  "Франция": "France",
  "Германия": "Germany",
  "Германия (ФРГ)": "Germany (FRG)",
  "Германия (ГДР)": "Germany (GDR)",
  "Италия": "Italy",
  "Япония": "Japan",
  "Китай": "China",
  "Южная Корея": "South Korea",
  "Корея Южная": "South Korea",
  "Корея Северная": "North Korea",
  "Корея": "Korea",
  "Австралия": "Australia",
  "Канада": "Canada",
  "Испания": "Spain",
  "Россия": "Russia",
  "Российская империя": "Russian Empire",
  "СССР": "USSR",
  "Индия": "India",
  "Гонконг": "Hong Kong",
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
  "Сербия и Черногория": "Serbia and Montenegro",
  "Словакия": "Slovakia",
  "Словения": "Slovenia",
  "Босния и Герцеговина": "Bosnia and Herzegovina",
  "Босния": "Bosnia",
  "Северная Македония": "North Macedonia",
  "Македония": "North Macedonia",
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
  "Белоруссия": "Belarus",
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
  "Киргизия": "Kyrgyzstan",
  "Андорра": "Andorra",
  "Сан-Марино": "San Marino",
  "Ватикан": "Vatican",
  "Монако": "Monaco",
  "Лихтенштейн": "Liechtenstein",
  "Фарерские острова": "Faroe Islands",
  "Гренландия": "Greenland",
  "Гибралтар": "Gibraltar",
  "Югославия": "Yugoslavia",
  "Югославия (ФР)": "Yugoslavia (FR)",
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
  "Пуэрто-Рико": "Puerto Rico",
  "Пуэрто Рико": "Puerto Rico",
  "Гватемала": "Guatemala",
  "Никарагуа": "Nicaragua",
  "Гондурас": "Honduras",
  "Сальвадор": "El Salvador",
  "Доминикана": "Dominican Republic",
  "Доминика": "Dominica",
  "Гаити": "Haiti",
  "Багамы": "Bahamas",
  "Ямайка": "Jamaica",
  "Барбадос": "Barbados",
  "Тринидад и Тобаго": "Trinidad and Tobago",
  "Антигуа и Барбуда": "Antigua and Barbuda",
  "Сент-Китс и Невис": "Saint Kitts and Nevis",
  "Сент-Люсия": "Saint Lucia",
  "Сент-Винсент и Гренадины": "Saint Vincent and the Grenadines",
  "Гренада": "Grenada",
  "Бермуды": "Bermuda",
  "Каймановы острова": "Cayman Islands",
  "Виргинские Острова (США)": "US Virgin Islands",
  "Виргинские Острова (Великобритания)": "British Virgin Islands",
  "Виргинские Острова": "Virgin Islands",
  "Американские Виргинские острова": "US Virgin Islands",
  "Аруба": "Aruba",
  "Антильские Острова": "Antilles",
  "Гваделупа": "Guadeloupe",
  "Мартиника": "Martinique",
  "Французская Гвиана": "French Guiana",
  "Гайана": "Guyana",
  "Суринам": "Suriname",
  "Белиз": "Belize",
  "Монтсеррат": "Montserrat",
  "Внешние малые острова США": "US Minor Outlying Islands",
  "Американское Самоа": "American Samoa",
  // Asia & Middle East
  "Израиль": "Israel",
  "Иран": "Iran",
  "Турция": "Turkey",
  "Тайвань": "Taiwan",
  "Таиланд": "Thailand",
  "Вьетнам": "Vietnam",
  "Вьетнам Северный": "North Vietnam",
  "Индонезия": "Indonesia",
  "Малайзия": "Malaysia",
  "Филиппины": "Philippines",
  "Сингапур": "Singapore",
  "Пакистан": "Pakistan",
  "Бангладеш": "Bangladesh",
  "Шри-Ланка": "Sri Lanka",
  "Непал": "Nepal",
  "Мьянма": "Myanmar",
  "Бирма": "Burma",
  "Камбоджа": "Cambodia",
  "Монголия": "Mongolia",
  "Лаос": "Laos",
  "Саудовская Аравия": "Saudi Arabia",
  "ОАЭ": "UAE",
  "Катар": "Qatar",
  "Кувейт": "Kuwait",
  "Иордания": "Jordan",
  "Ливан": "Lebanon",
  "Сирия": "Syria",
  "Ирак": "Iraq",
  "Афганистан": "Afghanistan",
  "Оман": "Oman",
  "Бахрейн": "Bahrain",
  "Йемен": "Yemen",
  "Палестина": "Palestine",
  "Оккупированная Палестинская территория": "Palestinian Territory",
  "Макао": "Macau",
  "Сиам": "Siam",
  "Бруней-Даруссалам": "Brunei",
  "Тимор-Лесте": "East Timor",
  "Мальдивы": "Maldives",
  "Бутан": "Bhutan",
  "Папуа - Новая Гвинея": "Papua New Guinea",
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
  "Кот-д\u2019Ивуар": "Ivory Coast",
  "Берег Слоновой кости": "Ivory Coast",
  "Намибия": "Namibia",
  "Ливия": "Libya",
  "Судан": "Sudan",
  "Ангола": "Angola",
  "Мозамбик": "Mozambique",
  "Мадагаскар": "Madagascar",
  "Руанда": "Rwanda",
  "Бурунди": "Burundi",
  "Либерия": "Liberia",
  "Лесото": "Lesotho",
  "Ботсвана": "Botswana",
  "Замбия": "Zambia",
  "Малави": "Malawi",
  "Сомали": "Somalia",
  "Эритрея": "Eritrea",
  "Джибути": "Djibouti",
  "Габон": "Gabon",
  "Конго": "Congo",
  "Конго (ДРК)": "DR Congo",
  "Заир": "Zaire",
  "ЦАР": "Central African Republic",
  "Чад": "Chad",
  "Нигер": "Niger",
  "Буркина-Фасо": "Burkina Faso",
  "Гвинея": "Guinea",
  "Гвинея-Бисау": "Guinea-Bissau",
  "Экваториальная Гвинея": "Equatorial Guinea",
  "Сьерра-Леоне": "Sierra Leone",
  "Гамбия": "Gambia",
  "Кабо-Верде": "Cape Verde",
  "Сан-Томе и Принсипи": "São Tomé and Príncipe",
  "Коморы": "Comoros",
  "Маврикий": "Mauritius",
  "Мавритания": "Mauritania",
  "Реюньон": "Réunion",
  "Того": "Togo",
  "Бенин": "Benin",
  "Эсватини": "Eswatini",
  "Свазиленд": "Swaziland",
  // Pacific
  "Новая Каледония": "New Caledonia",
  "Французская Полинезия": "French Polynesia",
  "Фиджи": "Fiji",
  "Самоа": "Samoa",
  "Тонга": "Tonga",
  "Вануату": "Vanuatu",
  "Соломоновы Острова": "Solomon Islands",
  "Кирибати": "Kiribati",
  "Тувалу": "Tuvalu",
  "Палау": "Palau",
  "Маршалловы острова": "Marshall Islands",
  "Федеративные Штаты Микронезии": "Micronesia",
  "Острова Кука": "Cook Islands",
  "Остров Мэн": "Isle of Man",
  "Остров Святой Елены": "Saint Helena",
  "Фолклендские острова": "Falkland Islands",
  "Шпицберген и Ян-Майен": "Svalbard and Jan Mayen",
  "острова Теркс и Кайкос": "Turks and Caicos Islands",
  "Мелкие отдаленные острова США": "US Minor Outlying Islands",
  "Западная Сахара": "Western Sahara",
  "Антарктида": "Antarctica",
  "Гуам": "Guam",
};

// ─── Russian relation labels ──────────────────────────────────────────────────
export const RELATION_MAP: Record<string, string> = {
  "ЖЕН.": "wife",
  "МУЖ.": "husband",
  "ЖЕНА": "wife",
  "ЖЕНA": "wife",
  "МУЖ": "husband",
};

export function translateRelation(ru: string): string {
  return RELATION_MAP[ru.trim().toUpperCase()] ?? ru;
}

// ─── Russian award names ──────────────────────────────────────────────────────
export const AWARD_NAME_MAP: Record<string, string> = {
  "Оскар": "Academy Awards (Oscar)",
  "Золотой глобус": "Golden Globe",
  "Британская академия": "BAFTA",
  "Сатурн": "Saturn Award",
  "Сезар": "César Award",
  "Каннский кинофестиваль": "Cannes Film Festival",
  "Венецианский кинофестиваль": "Venice Film Festival",
  "Берлинский кинофестиваль": "Berlin International Film Festival",
  "Премия Гильдии актеров": "Screen Actors Guild Awards",
  "Эмми": "Primetime Emmy Awards",
  "Золотая малина": "Golden Raspberry (Razzie)",
  "Ника": "Nika Award",
  "Золотой орел": "Golden Eagle Award",
  "Жорж": "Georges Award",
  "Кинотавр": "Kinotavr",
  "Сандэнс": "Sundance Film Festival",
  "Гойя": "Goya Awards",
  "Европейская киноакадемия": "European Film Awards",
  "Премия канала «MTV»": "MTV Movie & TV Awards",
  "Азиатская киноакадемия": "Asian Film Awards",
  "Карловы Вары": "Karlovy Vary International Film Festival",
  "Сан-Себастьян": "San Sebastián International Film Festival",
  "Московский международный кинофестиваль": "Moscow International Film Festival",
};

export function translateAwardName(ru: string, enabled = true): string {
  if (!enabled || !ru) return ru;
  const trimmed = ru.trim();
  return AWARD_NAME_MAP[trimmed] ?? ru;
}

// ─── Russian role descriptions ────────────────────────────────────────────────
export const ROLE_MAP: Record<string, string> = {
  "главная роль": "Lead role",
  "озвучка": "Voice",
  "в титрах не указан": "Uncredited",
  "в титрах не указана": "Uncredited",
  "играет самого себя": "Self",
  "играет саму себя": "Self",
  "хроника": "Archive footage",
  "архивные кадры": "Archive footage",
  "рассказчик": "Narrator",
};

export function translateRole(ru: string, enabled = true): string {
  if (!enabled || !ru) return ru;
  const trimmed = ru.trim();
  const lower = trimmed.toLowerCase();
  if (ROLE_MAP[lower]) return ROLE_MAP[lower];
  let result = trimmed;
  for (const [k, v] of Object.entries(ROLE_MAP)) {
    const regex = new RegExp(k, "gi");
    result = result.replace(regex, v);
  }
  return result;
}

/**
 * translateGenre — respects autoTranslateEnabled.
 */
export function translateGenre(ru: string, enabled = true): string {
  if (!enabled || !ru) return ru;
  const trimmed = ru.trim();
  return GENRE_MAP[trimmed.toLowerCase()] ?? GENRE_MAP[trimmed] ?? trimmed;
}

/**
 * translateCountry — respects autoTranslateEnabled.
 */
export function translateCountry(ru: string, enabled = true): string {
  if (!enabled || !ru) return ru;
  const trimmed = ru.trim();
  return COUNTRY_MAP[trimmed] ?? trimmed;
}

/**
 * Safe date formatter that never outputs "Invalid Date".
 */
export function formatDateSafe(
  rawDate?: string | null,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
): string | null {
  if (!rawDate) return null;
  const cleaned = rawDate.trim();
  if (!cleaned || cleaned.endsWith("-00-00")) {
    const yearMatch = cleaned.match(/^(\d{4})/);
    return yearMatch ? yearMatch[1] : null;
  }
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) {
    const yearMatch = cleaned.match(/^(\d{4})/);
    return yearMatch ? yearMatch[1] : null;
  }
  return d.toLocaleDateString("en-US", options);
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
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .trim();
}

// ─── Persistent Translation Cache & Deduplication ─────────────────────────────

const TRANSLATE_CACHE_KEY = "cinemix_translate_cache_v1";
const MAX_TRANSLATE_CACHE = 1500;
let memoryTranslateCache: Record<string, string> | null = null;
const inflightRequests = new Map<string, Promise<string>>();

function getTranslateCache(): Record<string, string> {
  if (memoryTranslateCache) return memoryTranslateCache;
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TRANSLATE_CACHE_KEY);
    memoryTranslateCache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    memoryTranslateCache = {};
  }
  return memoryTranslateCache!;
}

export function getCachedTranslation(text?: string | null): string | undefined {
  if (!text) return "";
  return getTranslateCache()[text];
}

function setCachedTranslation(source: string, translated: string) {
  if (typeof window === "undefined") return;
  const cache = getTranslateCache();
  const keys = Object.keys(cache);
  if (keys.length >= MAX_TRANSLATE_CACHE) {
    delete cache[keys[0]];
  }
  cache[source] = translated;
  try {
    localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage quota errors
  }
}

export async function translateText(
  text: string,
  from = "ru",
  to = "en",
): Promise<string> {
  if (!text || !isRussian(text)) return text;
  const cached = getCachedTranslation(text);
  if (cached) return cached;

  const existing = inflightRequests.get(text);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return text;
      const json = await res.json();
      const translated = (json[0] as [string, string][])
        .map((chunk) => chunk[0])
        .join("");
      const result = translated || text;
      setCachedTranslation(text, result);
      return result;
    } catch {
      return text;
    } finally {
      inflightRequests.delete(text);
    }
  })();

  inflightRequests.set(text, promise);
  return promise;
}

/** Strip HTML first, then translate — safe alternative to dangerouslySetInnerHTML */
export async function translateHtml(html: string): Promise<string> {
  const plain = stripHtml(html);
  return translateText(plain);
}

// Heuristic: contains Cyrillic characters
export function isRussian(text?: string | null): boolean {
  if (!text) return false;
  return /[а-яё]/i.test(text);
}

// ─── Preferred English name helper ────────────────────────────────────────────

/**
 * Returns the best synchronous display name for a film given the translate setting.
 */
export function getEnglishName(
  nameRu?: string,
  nameEn?: string,
  nameOriginal?: string,
  autoTranslateEnabled = true,
): string {
  if (!autoTranslateEnabled) {
    return nameRu || nameEn || nameOriginal || "Unknown";
  }
  if (nameEn && !isRussian(nameEn)) return nameEn;
  if (nameOriginal && !isRussian(nameOriginal)) return nameOriginal;
  const fallback = nameEn || nameOriginal || nameRu || "Unknown";
  if (isRussian(fallback)) {
    const cached = getCachedTranslation(fallback);
    if (cached) return cached;
  }
  return fallback;
}
