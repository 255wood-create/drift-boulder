import { getJson } from "serpapi";

export const QUERIES = [
  "Things to do in Boulder CO this week",
  "Live music Boulder CO this week",
  "Comedy shows Boulder CO",
  "Concerts Boulder CO",
  "Events in Lyons CO",
  "Events in Louisville CO",
  "Events in Lafayette CO",
  "Events in Nederland CO",
  "Things to do in Boulder CO today",
  "Live music Boulder CO tonight",
  "Things to do in Boulder CO tomorrow",
  "Food events Boulder CO this week",
  "Fox Theatre Boulder CO events",
  "Boulder Theater events",
  "eTown Hall Boulder events",
  "Chautauqua Boulder events",
  "Avery Brewing Boulder events",
  "Wibby Brewing events",
  "Mountain Sun Boulder events",
  "Southern Sun Boulder events",
  "Pumphouse Brewery events",
  "License No. 1 Boulder events",
  "Bohemian Biergarten Boulder events",
  "Comedy Works events",
  "Velvet Elk Lounge Boulder events",
  "Roots Music Project Boulder events",
  "Eventbrite Boulder CO events",
  "University of Colorado Boulder events calendar",
  "Tulagi Boulder events",
  "Junkyard Social Boulder events",
  "Rayback Collective Boulder events",
  "Rosetta Hall Boulder events",
  "Outback Saloon Boulder events",
  "Boulder Social events",
  "The Spotted James Boulder events",
  "Macky Auditorium Boulder events",
  "The Speakeasy Longmont CO events",
  "Oskar Blues Lyons CO events",
  "Louisville Underground events",
  "do303 Boulder CO events",
  "Nissi's Lafayette CO events",
  "Limelight Hotel Boulder events",
  "St Julien Hotel Boulder events",
  "Planet Bluegrass Lyons CO events",
  "Gold Hill Inn Boulder CO events",
  "Folsom Field Boulder CO events",
  "CBar Boulder CO events",
  "Bandsintown Boulder CO events",
];

const SKIP = ["chemical", "engineering", "shares", "internship", "volunteer", "certification", "training course", "webinar", "online", "virtual", "job fair", "hiring", "real estate", "open house", "church service", "bible study", "board meeting", "city council"];
const DENVER = ["denver", "aurora", "lakewood", "littleton", "englewood", "thornton", "arvada", "westminster", "comedy works"];

function isJunk(t) {
  t = (t || "").toLowerCase();
  return SKIP.some((s) => t.indexOf(s) >= 0);
}

function normTitle(t) {
  return (t || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

const DENVER_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" });
function denverDateStr(d) {
  return DENVER_FMT.format(d);
}

// Determines Denver's real UTC offset (in whole hours, negative) for a given
// calendar date, so timestamps can be anchored to Mountain Time explicitly
// instead of depending on whatever local timezone the executing machine
// happens to be set to. This matters because the same date-parsing code runs
// in two different places -- Lindsay's Mac (America/Denver) for the daily
// automatic fetch, and Vercel's servers (UTC) when the admin panel's "Fetch
// New Events" button calls /api/pull-events -- and without this, the exact
// same event date would end up meaning two different UTC instants depending
// on which one ran it, occasionally shifting an event's calendar day by one
// once the app reads it back through America/Denver. That off-by-one made
// same-day events vanish from "Today" hours before they were actually over.
const DENVER_OFFSET_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", timeZoneName: "shortOffset" });
function denverUtcOffsetHours(y, mo, d) {
  // Noon UTC keeps this clear of any DST-transition-day edge case at midnight.
  const probe = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const part = DENVER_OFFSET_FMT.formatToParts(probe).find((p) => p.type === "timeZoneName");
  const m = part && part.value.match(/GMT([+-]\d+)/);
  return m ? parseInt(m[1], 10) : -7; // fall back to Standard Time if this ever fails to parse
}

function getBucket(d) {
  if (!d) return "Upcoming";
  const todayStr = denverDateStr(new Date());
  const eventStr = denverDateStr(new Date(d));
  const diff = Math.round((new Date(eventStr) - new Date(todayStr)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  const dow = new Date(todayStr + "T00:00:00Z").getUTCDay();
  const daysToFriday = (5 - dow + 7) % 7;
  const daysToSunday = daysToFriday + 2;
  if (diff >= daysToFriday && diff <= daysToSunday) return "This Weekend";
  return "Upcoming";
}

const MUSIC_VENUES = /fox theat|boulder theat|nissi|louisville under|louisville undergound|loiusville|velvet elk|etown|gold hill inn|planet bluegrass|oskar blues|roots music|caribou room|avalon ballroom|tulagi|bandshell|chautauqua aud|dog house music|the end lafayette|st julien|rosetta hall|trident|speakeasy|macky|folsom field/i;

function categorizeEvent(title, vibe, query, location) {
  const t = ((title || "") + " " + (vibe || "") + " " + (query || "")).toLowerCase();
  if (/cliff cash|bk sharad|moms unhinged|craig ferguson|samantha bee|steve vanderploeg/.test(t)) return "comedy";
  if (t.match(/comedy|improv|standup|stand-up|comedian|laugh|comic|roast|sketch|humor|open mic night/)) return "comedy";
  if (/goonies|rocket science|ghost show|film|movie|screening|reel rock|mountainfilm|freeski/.test(t)) return "food";
  if (/swing lesson|salsa|bachata|waltz|rueda|dance lesson|dance class|social dance/.test(t)) return "food";
  if (t.match(/trivia|yoga|speed dating|cornhole|book club|farmers m|art fest|exhibition|gallery|poetry|craft|painting|market/)) return "food";
  if (/music fest|festival of choirs|porch festival/.test(t)) return "music";
  if (MUSIC_VENUES.test(location || "")) return "music";
  if (t.match(/music|concert|band|live music|dj |tribute|orchestra|symphony|jazz|bluegrass|acoustic|songwriter|album release|singer|guitar|piano/)) return "music";
  return "food";
}

function venueKey(loc) {
  const v = (loc || "").toLowerCase();
  if (/fox theat/.test(v)) return "fox";
  if (/boulder theat/.test(v)) return "bouldertheater";
  if (/nissi/.test(v)) return "nissis";
  if (/louisville under|loiusville|undergound/.test(v)) return "louisville";
  if (/velvet elk/.test(v)) return "velvetelk";
  if (/etown/.test(v)) return "etown";
  if (/gold hill/.test(v)) return "goldhill";
  if (/planet bluegrass/.test(v)) return "planetbluegrass";
  if (/oskar blues/.test(v)) return "oskarblues";
  if (/roots music/.test(v)) return "rootsmusic";
  if (/caribou/.test(v)) return "caribou";
  if (/chautauqua/.test(v)) return "chautauqua";
  if (/rayback/.test(v)) return "rayback";
  if (/end lafayette/.test(v)) return "endlafayette";
  if (/13th and canyon/.test(v)) return "farmersmarket";
  return v.replace(/[^a-z0-9]/g, "").slice(0, 12);
}
function variantTag(t) {
  const s = (t || "").toLowerCase();
  if (/early show/.test(s)) return "early";
  if (/late show/.test(s)) return "late";
  if (/all ages/.test(s)) return "allages";
  if (/21\+/.test(s)) return "21plus";
  if (/morning show/.test(s)) return "morning";
  return "";
}
function relatedTitle(a, b) {
  const x = normTitle(a), y = normTitle(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.startsWith(y) || y.startsWith(x)) return true;
  const xw = x.split(" "), yw = y.split(" ");
  let n = 0;
  while (n < xw.length && n < yw.length && xw[n] === yw[n]) n++;
  return n >= 2;
}

function guessVenue(query) {
  if (!query) return null;
  if (/events?$/i.test(query.trim())) {
    return query.replace(/\s+events?$/i, "").trim();
  }
  return null;
}

function parseEventDate(dateInput, timeStr) {
  if (!dateInput) return null;

  if (typeof dateInput === "object") {
    if (dateInput.start_date) {
      try {
        const d = new Date(dateInput.start_date);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch {}
    }
    return null;
  }

  if (typeof dateInput !== "string") return null;

  let s = dateInput.replace(/^[A-Za-z]+,\s*/, "");
  s = s.split(/[–-]/)[0].trim();
  if (!s) return null;
  const year = new Date().getFullYear();
  const build = (y) => new Date(timeStr ? (s + " " + y + " " + timeStr) : (s + " " + y));
  let parsed = build(year);
  if (isNaN(parsed.getTime())) return null;
  // No year in the source string. If this year's date is well in the past,
  // the listing almost certainly means next year.
  const twoMonthsAgo = Date.now() - 60 * 86400000;
  if (parsed.getTime() < twoMonthsAgo) {
    const next = build(year + 1);
    if (!isNaN(next.getTime())) parsed = next;
  }
  // `parsed` was constructed in whatever timezone the executing machine is
  // set to (see denverUtcOffsetHours above for why that's a problem). The
  // wall-clock numbers below are exactly what the source string said,
  // regardless of that -- new Date("Sep 19 2026 6:00 PM") always hands back
  // getHours()===18 no matter the system timezone -- so re-anchor those
  // numbers explicitly to Denver's real offset for this date instead of
  // trusting whatever offset the local Date object happened to pick up.
  const y = parsed.getFullYear(), mo = parsed.getMonth() + 1, day = parsed.getDate();
  const h = parsed.getHours(), mi = parsed.getMinutes();
  const offset = denverUtcOffsetHours(y, mo, day);
  const pad = (n) => String(n).padStart(2, "0");
  const offsetStr = (offset <= 0 ? "-" : "+") + pad(Math.abs(offset)) + ":00";
  const anchored = new Date(`${y}-${pad(mo)}-${pad(day)}T${pad(h)}:${pad(mi)}:00${offsetStr}`);
  return isNaN(anchored.getTime()) ? null : anchored.toISOString();
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return results;
}

export async function runFetch({ serpApiKey, supabaseUrl, supabaseKey, log = () => {}, concurrency = 8 }) {
  const headers = { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey };

  const existing = await fetch(supabaseUrl + "/rest/v1/events?select=title,location,starts_at", { headers }).then((r) => r.json());
  const titles = new Set(existing.map((e) => normTitle(e.title)));
  // Index existing events by day+venue so we can catch near-duplicate titles
  const seen = {};
  const addSeen = (title, location, startsAt) => {
    const day = (startsAt || "").slice(0, 10);
    if (!day) return;
    const k = day + "|" + venueKey(location);
    (seen[k] = seen[k] || []).push(title || "");
  };
  const isDup = (title, location, startsAt) => {
    const day = (startsAt || "").slice(0, 10);
    if (!day) return false;
    const list = seen[day + "|" + venueKey(location)] || [];
    return list.some((t) => variantTag(t) === variantTag(title) && relatedTitle(t, title));
  };
  for (const e of existing) addSeen(e.title, e.location, e.starts_at);
  log("Existing: " + titles.size);

  const batches = await mapLimit(QUERIES, concurrency, async (q) => {
    log("Searching: " + q);
    try {
      const r = await getJson({ engine: "google", q, api_key: serpApiKey });
      return { query: q, events: r.events_results || [] };
    } catch (err) {
      log("  search failed for \"" + q + "\": " + err.message);
      return { query: q, events: [] };
    }
  });
  const allEvts = batches.flatMap((b) => b.events.map((e) => ({ ...e, _query: b.query })));
  log("Total found: " + allEvts.length);

  let added = 0, skipped = 0, junk = 0;
  const toInsert = [];
  for (const e of allEvts) {
    if (isJunk(e.title || "")) { junk++; continue; }
    if (titles.has(normTitle(e.title))) { skipped++; continue; }
    const sdEarly = parseEventDate(e.date, e.time);

    const venueGuess = guessVenue(e._query);
    const locationStr = (e.address || []).join(" ") || venueGuess || "Boulder";
    const loc = locationStr.toLowerCase();
    if (DENVER.some((d) => loc.indexOf(d) >= 0)) { junk++; continue; }

    const cat = categorizeEvent(e.title, e.description, e._query, locationStr);

    const sd = sdEarly;
    if (isDup(e.title, locationStr, sd)) { skipped++; continue; }

    titles.add(normTitle(e.title));
    addSeen(e.title, locationStr, sd);
    toInsert.push({
      title: e.title || "X",
      category: cat,
      location: locationStr,
      vibe: e.description ? e.description.substring(0, 80) : null,
      time_bucket: getBucket(sd),
      starts_at: sd,
      lat: 40.015,
      lng: -105.27,
      is_trending: false,
    });
  }

  await mapLimit(toInsert, concurrency, async (evt) => {
    const res = await fetch(supabaseUrl + "/rest/v1/events", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(evt),
    });
    if (res.ok) {
      added++;
      log("  + [" + evt.time_bucket + "] " + evt.title);
    } else {
      log("  x " + evt.title);
    }
  });

  log("Done! Added:" + added + " Skipped:" + skipped + " Junk:" + junk);
  return { added, skipped, junk, totalFound: allEvts.length };
}
