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

// ─── Bidirectional International & Non-English Film Title Alias Dictionary ────
// Maps non-English native titles (Spanish, Korean, French, Japanese, German, Italian, etc.)
// and Russian Kinopoisk titles to their canonical English release titles so cross-language
// searches (e.g. "Money Heist" <-> "La casa de papel" <-> "Бумажный дом") match in 0ms.

export interface InternationalTitleAlias {
  en: string;
  orig: string[];
  ru: string[];
}

export const INTERNATIONAL_TITLE_ALIASES: InternationalTitleAlias[] = [
  // Spanish & Latin American hits
  {
    en: "Money Heist",
    orig: ["La casa de papel", "Casa de papel"],
    ru: ["Бумажный дом"],
  },
  {
    en: "Pan's Labyrinth",
    orig: ["El laberinto del fauno", "Laberinto del fauno"],
    ru: ["Лабиринт Фавна"],
  },
  {
    en: "The Platform",
    orig: ["El hoyo"],
    ru: ["Платформа"],
  },
  {
    en: "The Invisible Guest",
    orig: ["Contratiempo"],
    ru: ["Невидимый гость"],
  },
  {
    en: "The Secret in Their Eyes",
    orig: ["El secreto de sus ojos"],
    ru: ["Тайна в его глазах"],
  },
  {
    en: "Wild Tales",
    orig: ["Relatos salvajes"],
    ru: ["Дикие истории"],
  },
  {
    en: "Society of the Snow",
    orig: ["La sociedad de la nieve"],
    ru: ["Общество снега"],
  },
  {
    en: "The Body",
    orig: ["El cuerpo"],
    ru: ["Тело"],
  },
  {
    en: "The Orphanage",
    orig: ["El orfanato"],
    ru: ["Приют"],
  },
  {
    en: "Mirage",
    orig: ["Durante la tormenta"],
    ru: ["Во время грозы"],
  },
  {
    en: "The Skin I Live In",
    orig: ["La piel que habito"],
    ru: ["Кожа, в которой я живу"],
  },
  {
    en: "Talk to Her",
    orig: ["Hable con ella"],
    ru: ["Поговори с ней"],
  },
  {
    en: "All About My Mother",
    orig: ["Todo sobre mi madre"],
    ru: ["Все о моей матери"],
  },
  {
    en: "The Hidden Face",
    orig: ["La cara oculta"],
    ru: ["Бункер"],
  },
  {
    en: "Sleep Tight",
    orig: ["Mientras duermes"],
    ru: ["Крепкий сон"],
  },
  {
    en: "Cell 211",
    orig: ["Celda 211"],
    ru: ["Камера 211"],
  },
  {
    en: "Amores Perros",
    orig: ["Amores perros", "Love's a Bitch"],
    ru: ["Сука-любовь"],
  },
  {
    en: "Y Tu Mamá Также",
    orig: ["Y tu mamá también", "And Your Mother Too"],
    ru: ["И твою маму тоже"],
  },
  {
    en: "Elite",
    orig: ["Élite"],
    ru: ["Элита"],
  },
  {
    en: "Locked Up",
    orig: ["Vis a vis"],
    ru: ["Визави"],
  },
  {
    en: "Sky Rojo",
    orig: ["Sky Rojo"],
    ru: ["Красный дерматин"],
  },
  {
    en: "Berlin",
    orig: ["Berlín", "La casa de papel: Berlín"],
    ru: ["Берлин"],
  },
  {
    en: "Nowhere",
    orig: ["Nowhere"],
    ru: ["Нигде"],
  },
  {
    en: "Through My Window",
    orig: ["A través de mi ventana"],
    ru: ["Из моего окна"],
  },
  {
    en: "My Fault",
    orig: ["Culpa mía"],
    ru: ["Моя вина"],
  },
  {
    en: "Your Fault",
    orig: ["Culpa tuya"],
    ru: ["Твоя вина"],
  },
  // Korean hits
  {
    en: "Oldboy",
    orig: ["Oldeuboi", "올드보이"],
    ru: ["Олдбой"],
  },
  {
    en: "Parasite",
    orig: ["Gisaengchung", "기생충"],
    ru: ["Паразиты"],
  },
  {
    en: "Squid Game",
    orig: ["Ojingeo geim", "오징어 게임"],
    ru: ["Игра в кальмара"],
  },
  {
    en: "Train to Busan",
    orig: ["Busanhaeng", "부산행"],
    ru: ["Поезд в Пусан"],
  },
  {
    en: "Memories of Murder",
    orig: ["Salinui chueok", "살인의 추억"],
    ru: ["Воспоминания об убийстве"],
  },
  {
    en: "I Saw the Devil",
    orig: ["Akmareul boatda", "악마를 보았다"],
    ru: ["Я видел дьявола"],
  },
  {
    en: "The Handmaiden",
    orig: ["Ah-ga-ssi", "Agassi", "아가씨"],
    ru: ["Служанка"],
  },
  {
    en: "The Wailing",
    orig: ["Gokseong", "곡성"],
    ru: ["Вопль"],
  },
  {
    en: "Burning",
    orig: ["Beoning", "버닝"],
    ru: ["Пылающий"],
  },
  {
    en: "The Chaser",
    orig: ["Chugyeokja", "추격자"],
    ru: ["Преследователь"],
  },
  {
    en: "A Taxi Driver",
    orig: ["Taeksi unjeonsa", "택시운전사"],
    ru: ["Таксист"],
  },
  {
    en: "Decision to Leave",
    orig: ["Heojil kyolshim", "헤어질 결심"],
    ru: ["Решение уйти"],
  },
  {
    en: "Sympathy for Mr. Vengeance",
    orig: ["Boksuneun naui geot"],
    ru: ["Сочувствие господину Месть"],
  },
  {
    en: "Lady Vengeance",
    orig: ["Chinjeolhan geumjassi"],
    ru: ["Сочувствие госпоже Месть"],
  },
  {
    en: "All of Us Are Dead",
    orig: ["Jigeum 우리 학교는", "Jigeum uri hakgyoneun"],
    ru: ["Мы все мертвы"],
  },
  // French, German, Italian & European hits
  {
    en: "The Intouchables",
    orig: ["Intouchables"],
    ru: ["1+1"],
  },
  {
    en: "Amélie",
    orig: ["Le Fabuleux Destin d'Amélie Poulain", "Amelie"],
    ru: ["Амели"],
  },
  {
    en: "La Haine",
    orig: ["La Haine", "Hate"],
    ru: ["Ненависть"],
  },
  {
    en: "Anatomy of a Fall",
    orig: ["Anatomie d'une chute"],
    ru: ["Анатомия падения"],
  },
  {
    en: "Portrait of a Lady on Fire",
    orig: ["Portrait de la jeune fille en feu"],
    ru: ["Портрет девушки в огне"],
  },
  {
    en: "Lupin",
    orig: ["Lupin"],
    ru: ["Люпен"],
  },
  {
    en: "All Quiet on the Western Front",
    orig: ["Im Westen nichts Neues"],
    ru: ["На Западном фронте без перемен"],
  },
  {
    en: "The Lives of Others",
    orig: ["Das Leben der Anderen"],
    ru: ["Жизнь других"],
  },
  {
    en: "Downfall",
    orig: ["Der Untergang"],
    ru: ["Бункер"],
  },
  {
    en: "Run Lola Run",
    orig: ["Lola rennt"],
    ru: ["Беги, Лола, беги"],
  },
  {
    en: "Life Is Beautiful",
    orig: ["La vita è bella"],
    ru: ["Жизнь прекрасна"],
  },
  {
    en: "Cinema Paradiso",
    orig: ["Nuovo Cinema Paradiso"],
    ru: ["Новый кинотеатр «Парадизо»"],
  },
  {
    en: "Another Round",
    orig: ["Druk"],
    ru: ["Еще по одной", "Ещё по одной"],
  },
  {
    en: "The Hunt",
    orig: ["Jagten"],
    ru: ["Охота"],
  },
  {
    en: "City of God",
    orig: ["Cidade de Deus"],
    ru: ["Город Бога"],
  },
  // Japanese & Asian hits
  {
    en: "Spirited Away",
    orig: ["Sen to Chihiro no kamikakushi"],
    ru: ["Унесённые призраками", "Унесенные призраками"],
  },
  {
    en: "Your Name",
    orig: ["Kimi no na wa.", "Kimi no na wa"],
    ru: ["Твоё имя", "Твое имя"],
  },
  {
    en: "Princess Mononoke",
    orig: ["Mononoke-hime"],
    ru: ["Принцесса Мононоке"],
  },
  {
    en: "Howl's Moving Castle",
    orig: ["Hauru no ugoku shiro"],
    ru: ["Ходячий замок"],
  },
  {
    en: "My Neighbor Totoro",
    orig: ["Tonari no Totoro"],
    ru: ["Мой сосед Тоторо"],
  },
  {
    en: "Grave of the Fireflies",
    orig: ["Hotaru no haka"],
    ru: ["Могила светлячков"],
  },
  {
    en: "Seven Samurai",
    orig: ["Shichinin no samurai"],
    ru: ["Семь самураев"],
  },
  {
    en: "Attack on Titan",
    orig: ["Shingeki no Kyojin"],
    ru: ["Атака титанов"],
  },
  {
    en: "Demon Slayer",
    orig: ["Kimetsu no Yaiba"],
    ru: ["Истребитель демонов"],
  },
  {
    en: "Jujutsu Kaisen",
    orig: ["Jujutsu Kaisen"],
    ru: ["Магическая битва"],
  },
  {
    en: "Death Note",
    orig: ["Desu noto", "Death Note"],
    ru: ["Тетрадь смерти"],
  },
  {
    en: "Crouching Tiger, Hidden Dragon",
    orig: ["Wo hu cang long"],
    ru: ["Крадущийся тигр, затаившийся дракон"],
  },
  {
    en: "In the Mood for Love",
    orig: ["Fa yeung nin wa"],
    ru: ["Любовное настроение"],
  },
];

function normAliasKey(s?: string | null): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ORIG_OR_RU_TO_EN_MAP = new Map<string, string>();
for (const entry of INTERNATIONAL_TITLE_ALIASES) {
  for (const o of entry.orig) {
    const k = normAliasKey(o);
    if (k) ORIG_OR_RU_TO_EN_MAP.set(k, entry.en);
  }
  for (const r of entry.ru) {
    const k = normAliasKey(r);
    if (k) ORIG_OR_RU_TO_EN_MAP.set(k, entry.en);
  }
}

/**
 * Resolves a known English release title from a non-English original or Russian title.
 */
export function resolveEnglishAlias(
  nameRu?: string | null,
  nameOriginal?: string | null,
): string | null {
  if (nameOriginal) {
    const byOrig = ORIG_OR_RU_TO_EN_MAP.get(normAliasKey(nameOriginal));
    if (byOrig) return byOrig;
  }
  if (nameRu) {
    const byRu = ORIG_OR_RU_TO_EN_MAP.get(normAliasKey(nameRu));
    if (byRu) return byRu;
  }
  return null;
}

/**
 * Given a user search query (e.g. "Money Heist" or "La casa de papel"),
 * returns all known cross-language alias terms (English, Spanish/Original, Russian)
 * so the search engine can query Kinopoisk across all language representations.
 */
export function getSearchQueryAliases(rawQuery: string): string[] {
  const qNorm = normAliasKey(rawQuery);
  if (!qNorm || qNorm.length < 2) return [];
  const results = new Set<string>();

  for (const entry of INTERNATIONAL_TITLE_ALIASES) {
    const allForms = [entry.en, ...entry.orig, ...entry.ru];
    const matched = allForms.some((form) => {
      const fNorm = normAliasKey(form);
      return (
        fNorm === qNorm ||
        (qNorm.length >= 4 && (fNorm.includes(qNorm) || qNorm.includes(fNorm)))
      );
    });
    if (matched) {
      results.add(entry.en);
      entry.orig.forEach((o) => results.add(o));
      entry.ru.forEach((r) => results.add(r));
    }
  }
  return Array.from(results);
}

// ─── Russian relation labels ──────────────────────────────────────────────────
export const RELATION_MAP: Record<string, string> = {
  "ЖЕН.": "wife",
  "МУЖ.": "husband",
  "ЖЕНА": "wife",
  "ЖЕНA": "wife",
  "МУЖ": "husband",
  "СУПРУГА": "wife",
  "СУПРУГ": "husband",
  "СУПРУГ(A)": "spouse",
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

// ─── Persistent Translation Cache & Micro-Batched Persistence ─────────────────

const TRANSLATE_CACHE_KEY = "cinemix_translate_cache_v1";
const MAX_TRANSLATE_CACHE = 1500;
let memoryTranslateCache: Record<string, string> | null = null;
const inflightRequests = new Map<string, Promise<string>>();
let persistTranslateTimer: ReturnType<typeof setTimeout> | null = null;

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

function schedulePersistTranslateCache() {
  if (typeof window === "undefined" || persistTranslateTimer) return;
  persistTranslateTimer = setTimeout(() => {
    persistTranslateTimer = null;
    try {
      const cache = getTranslateCache();
      localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // ignore storage quota errors
    }
  }, 400);
}

function setCachedTranslation(source: string, translated: string) {
  if (typeof window === "undefined") return;
  const cache = getTranslateCache();
  const keys = Object.keys(cache);
  if (keys.length >= MAX_TRANSLATE_CACHE) {
    for (let i = 0; i < 150; i++) {
      delete cache[keys[i]];
    }
  }
  cache[source] = translated;
  schedulePersistTranslateCache();
}

export async function translateText(
  text: string,
  from = "ru",
  to = "en",
): Promise<string> {
  if (!text) return text;
  if (from === "ru" && to === "en" && !isRussian(text)) return text;
  const cacheKey = from === "ru" && to === "en" ? text : `${from}->${to}:${text}`;
  const cached = getCachedTranslation(cacheKey);
  if (cached) return cached;

  const existing = inflightRequests.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) return text;
      const json = await res.json();
      const translated = (json[0] as [string, string][])
        .map((chunk) => chunk[0])
        .join("");
      const result = (translated || text).trim();
      setCachedTranslation(cacheKey, result);
      return result;
    } catch {
      return text;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Translates any non-Russian search query (e.g. English or Spanish) into Russian
 * so Kinopoisk's Russian title index (`nameRu`) can be queried in parallel.
 */
export async function translateQueryToRussian(query: string): Promise<string | null> {
  const clean = query.trim();
  if (!clean || clean.length < 2 || isRussian(clean)) return null;
  const translated = await translateText(clean, "auto", "ru");
  if (!translated || translated.toLowerCase() === clean.toLowerCase()) {
    return null;
  }
  return translated;
}

/**
 * Translates any foreign title (Spanish, French, German, Russian, etc.) into English.
 */
export async function translateAnyToEnglish(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return "";
  return translateText(clean, "auto", "en");
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
 * Prioritizes verified English titles and known international English release aliases
 * (e.g. "Money Heist" instead of "La casa de papel", "Oldboy" instead of "Oldeuboi").
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

  // 1. Check known international English title alias first (e.g., Spanish/Korean/French -> English)
  const aliasEn = resolveEnglishAlias(nameRu, nameOriginal);
  if (aliasEn) return aliasEn;

  // 2. If nameEn is present and non-Russian, use it
  if (nameEn && !isRussian(nameEn)) return nameEn;

  // 3. Check if we already have a cached English translation of nameRu
  if (nameRu && isRussian(nameRu)) {
    const cachedRuEn = getCachedTranslation(nameRu);
    if (cachedRuEn && !isRussian(cachedRuEn)) {
      return cachedRuEn;
    }
  }

  // 4. Fallback to nameOriginal if Latin, or nameRu
  if (nameOriginal && !isRussian(nameOriginal)) return nameOriginal;
  const fallback = nameEn || nameOriginal || nameRu || "Unknown";
  if (isRussian(fallback)) {
    const cached = getCachedTranslation(fallback);
    if (cached) return cached;
  }
  return fallback;
}
