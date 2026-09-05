/** Natural-language parsing for EN + RU voice / typed capture */

const WEEKDAY_MAP_EN = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
};
const WEEKDAY_MAP_RU = {
  воскресенье: 0, понедельник: 1, вторник: 2, среда: 3, среды: 3,
  четверг: 4, пятница: 5, суббота: 6
};

const MONTHS_EN = {
  january:0,jan:0,february:1,feb:1,march:2,mar:2,april:3,apr:3,may:4,
  june:5,jun:5,july:6,jul:6,august:7,aug:7,september:8,sep:8,sept:8,
  october:9,oct:9,november:10,nov:10,december:11,dec:11
};
const MONTHS_RU = {
  января:0,январь:0,февраля:1,февраль:1,марта:2,март:2,апреля:3,апрель:3,
  мая:4,май:4,июня:5,июнь:5,июля:6,июль:6,августа:7,август:7,
  сентября:8,сентябрь:8,октября:9,октябрь:9,ноября:10,ноябрь:10,
  декабря:11,декабрь:11
};

function pad(n) { return String(n).padStart(2, "0"); }

/** Boundary-safe match for Latin + Cyrillic */
function findWord(text, words) {
  const list = Array.isArray(words) ? words : [words];
  for (const w of list) {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${w})(?=[^\\p{L}\\p{N}]|$)`, "iu");
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

export function todayISO(base = new Date()) {
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

function nextWeekday(fromISO, targetDow) {
  const d = new Date(`${fromISO}T12:00:00`);
  const cur = d.getDay();
  let delta = (targetDow - cur + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}

function formatDisplayTime(h, m) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${ampm}`;
}

function parseTime(text) {
  const t = text.toLowerCase();
  let m = t.match(/([01]?\d|2[0-3])[:.]([0-5]\d)/);
  if (m) {
    return { time: formatDisplayTime(+m[1], +m[2]), raw: m[0] };
  }
  m = t.match(/(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)/i);
  if (m) {
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    const ap = m[3].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return { time: formatDisplayTime(h, min), raw: m[0] };
  }
  // в 15 / в 15:00 / к 10 / в 10 часов
  m = t.match(/(?:^|[\s,])(?:в|к)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?(?:\s*ч(?:ас(?:а|ов)?)?)?/i);
  if (m) {
    return { time: formatDisplayTime(+m[1], m[2] ? +m[2] : 0), raw: m[0].trim() };
  }
  m = t.match(/at\s+([01]?\d|2[0-3])(?!\s*(am|pm))/i);
  if (m) {
    return { time: formatDisplayTime(+m[1], 0), raw: m[0] };
  }
  return null;
}

function parseDate(text, baseISO) {
  const t = text.toLowerCase();
  let hit;

  hit = findWord(t, ["today", "сегодня"]);
  if (hit) return { date: baseISO, raw: hit };

  hit = findWord(t, ["tomorrow", "завтра"]);
  if (hit) return { date: addDaysISO(baseISO, 1), raw: hit };

  hit = findWord(t, ["послезавтра"]);
  if (hit) return { date: addDaysISO(baseISO, 2), raw: hit };
  if (/day after tomorrow/.test(t)) {
    return { date: addDaysISO(baseISO, 2), raw: "day after tomorrow" };
  }

  hit = findWord(t, ["yesterday", "вчера"]);
  if (hit) return { date: addDaysISO(baseISO, -1), raw: hit };

  for (const [word, dow] of Object.entries(WEEKDAY_MAP_EN)) {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:next\\s+)?(${word})(?=[^\\p{L}\\p{N}]|$)`, "i");
    const m = t.match(re);
    if (m) return { date: nextWeekday(baseISO, dow), raw: m[1] };
  }
  for (const [word, dow] of Object.entries(WEEKDAY_MAP_RU)) {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:(?:в|во)\\s+)?(${word})(?=[^\\p{L}\\p{N}]|$)`, "iu");
    const m = t.match(re);
    if (m) return { date: nextWeekday(baseISO, dow), raw: m[1] };
  }

  let m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)/i);
  if (m) {
    const year = new Date(`${baseISO}T12:00:00`).getFullYear();
    return { date: `${year}-${pad(MONTHS_EN[m[2].toLowerCase()] + 1)}-${pad(+m[1])}`, raw: m[0] };
  }
  m = t.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (m) {
    const year = new Date(`${baseISO}T12:00:00`).getFullYear();
    return { date: `${year}-${pad(MONTHS_EN[m[1].toLowerCase()] + 1)}-${pad(+m[2])}`, raw: m[0] };
  }
  m = t.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/iu);
  if (m) {
    const year = new Date(`${baseISO}T12:00:00`).getFullYear();
    return { date: `${year}-${pad(MONTHS_RU[m[2].toLowerCase()] + 1)}-${pad(+m[1])}`, raw: m[0] };
  }

  m = t.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, raw: m[0] };
  m = t.match(/(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?/);
  if (m) {
    const year = m[3] ? +m[3] : new Date(`${baseISO}T12:00:00`).getFullYear();
    return { date: `${year}-${pad(+m[2])}-${pad(+m[1])}`, raw: m[0] };
  }

  return null;
}

function detectType(text) {
  const t = text.toLowerCase();
  if (
    findWord(t, ["note", "sticky"]) ||
    /заметк/iu.test(t) ||
    /запиш/iu.test(t) ||
    /запомни/iu.test(t) ||
    /remember this/i.test(t)
  ) {
    return "note";
  }
  if (
    findWord(t, ["event", "meeting", "birthday", "holiday", "appointment"]) ||
    /событи/iu.test(t) ||
    /встреч/iu.test(t) ||
    /день рождения/iu.test(t) ||
    /праздник/iu.test(t) ||
    /при[её]м/iu.test(t)
  ) {
    return "event";
  }
  if (
    findWord(t, ["task", "todo", "to-do"]) ||
    /задач/iu.test(t) ||
    /нужно/iu.test(t) ||
    /сделать/iu.test(t)
  ) {
    return "task";
  }
  return "task";
}

function detectUrgency(text) {
  const t = text.toLowerCase();
  if (findWord(t, ["urgent", "asap", "critical", "important"]) || /срочн/iu.test(t) || /важн/iu.test(t) || /горит/iu.test(t)) {
    return "Urgent";
  }
  if (findWord(t, ["calm", "later"]) || /потом/iu.test(t) || /не срочно/iu.test(t) || /когда-нибудь/iu.test(t)) {
    return "Calm";
  }
  if (findWord(t, ["planned", "schedule"]) || /запланир/iu.test(t)) {
    return "Planned";
  }
  return "Today";
}

function stripNoise(text, scraps) {
  let out = text;
  for (const scrap of scraps.filter(Boolean)) {
    out = out.replace(new RegExp(scrap.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  }
  out = out
    .replace(/(?:^|[^\p{L}\p{N}])(add|create|new|please|pls|пожалуйста|добавь|создай|новую?|новый|задача|задачу|task|event|событие|встречу|встреч[ауие]?|note|заметку|заметка|urgent|срочно|asap|today|tomorrow|yesterday|сегодня|завтра|вчера|послезавтра)(?=[^\p{L}\p{N}]|$)/giu, " ")
    .replace(/(?:^|[^\p{L}\p{N}])(at|on|for|to|в|во|к|на|про|это)(?=[^\p{L}\p{N}]|$)/giu, " ")
    .replace(/[^\p{L}\p{N}\s'",.!?-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (out) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

/**
 * Parse spoken / typed natural language into a draft entity.
 */
export function parseUtterance(transcript, opts = {}) {
  const raw = (transcript || "").trim();
  const baseISO = opts.baseDate || todayISO();
  if (!raw) {
    return { type: "task", title: "", date: baseISO, time: "", tag: "Today", confidence: 0, raw };
  }

  const type = detectType(raw);
  const dateHit = parseDate(raw, baseISO);
  const timeHit = parseTime(raw);
  const tag = detectUrgency(raw);
  const date = dateHit ? dateHit.date : baseISO;
  const time = timeHit ? timeHit.time : "";

  let title = stripNoise(raw, [dateHit?.raw, timeHit?.raw]);
  if (!title) title = raw;

  if (type === "note") {
    title = stripNoise(raw, [
      dateHit?.raw,
      timeHit?.raw,
      "note", "заметка", "заметку", "запиши", "remember this", "запомни"
    ]);
    if (!title) title = raw;
  }

  return {
    type,
    title,
    date,
    time,
    tag: type === "task" ? tag : undefined,
    color: type === "note" ? "yellow" : undefined,
    confidence: title ? 0.8 : 0.2,
    raw
  };
}

export function formatLongDate(iso) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "long", day: "numeric"
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

export function formatShortDate(iso) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric"
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}
