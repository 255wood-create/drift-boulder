# go janey. — Project Handoff (Updated September 19, 2026)

> **This supersedes all older copies.** Several stale versions exist on the MacBook and in
> `~/Downloads/` (numbered copies from repeated downloads). Save this over
> `~/drift-boulder/CLAUDE-CODE-HANDOFF.md` and delete the rest.

## Sept 19 session — what changed, and what's next
Lindsay reported two problems: the site's DNS host got switched away from Vercel, and today's
events had disappeared from the **app** the night before (~9-10pm Sept 18). **Both root causes
found; DNS is fixed and confirmed live. The app fix is written but still waiting on Apple.**

### 1. DNS — FIXED and confirmed live.
Network Solutions had a leftover `www` **A record** (`74.91.138.137`, their own "Starter
(Hosting-Unix)" package IP) instead of pointing at Vercel — that's what made
`www.gojaney.com` show "Invalid Configuration" in Vercel. The root `@` A record
(`76.76.21.21`) was already fine (Vercel's legacy IP).

**Fix applied in Network Solutions' Advanced DNS Records:**
- Deleted the `www` A record (`74.91.138.137`)
- Added `www` CNAME → `00598cb056b92125.vercel-dns-016.com`

Confirmed via `whatsmydns.net` that the new CNAME is publicly resolving, and confirmed by loading
`https://www.gojaney.com` in an incognito window that the real site loads (not the Network
Solutions placeholder). A regular non-incognito browser may still show a stale cached page for a
while — that's local cache, not a real problem; a hard refresh or `?fresh=1` clears it. Network
Solutions still lists `gojaney.com`/`www.gojaney.com` as a "Domain Pointer" under that Hosting-Unix
package (Websites & Hosting section) — harmless now that DNS points elsewhere, but worth knowing
it's still there if something looks off later.

The root `@` A record could optionally be upgraded from the legacy `76.76.21.21` to Vercel's newer
`216.150.1.1` (Vercel dashboard shows this as "DNS Change Recommended," not urgent — legacy value
is explicitly still supported).

**Also:** the Claude Code **Vercel MCP connector needed reauthentication** for most of this
session (`403 Forbidden ... scope 255wood-creates-projects ... must re-authenticate`) even though
Lindsay was logged into the Vercel dashboard in her browser — that's a separate grant. It's since
reconnected; if it 403s again next session, redo that reconnect under Claude.ai connector settings.

### 2. Today's events disappearing from the app — root cause found and fixed on the web; iOS still pending Apple review.
Lindsay was only looking at the **app**, not the website, when she saw "Today" empty at ~9-10pm
Sept 18 — several of those events turned up under "Past" instead, meaning **they were never
deleted from Supabase**, just mis-bucketed. That rules out `refresh-buckets.js` deleting rows as
the cause of *this specific incident* (see Known data issues below — that Sept 14 concern is
still separately unconfirmed/unresolved, just not what happened here).

**Actual cause: the Sept 18 client-side fix to `isPastEvent()` never reached either delivery
path.** It was committed to the `claude/jolly-faraday-odihu1` branch but:
- **Website:** never merged into `main` (no PR was ever opened) — Vercel deploys from `main`, so
  the live site was still running pre-fix code. **Fixed this session:** merged
  `claude/jolly-faraday-odihu1` into `main` and pushed on both repos (drift-app `5592039`,
  drift-boulder `153b1cd`). Vercel auto-deployed; confirmed in the Vercel dashboard that
  Production is now serving that commit, and the deployment preview shows today's events present.
- **iOS app:** version 1.0.6 (build 12) contains the fix but is still **"Waiting for Review"** in
  App Store Connect as of this session. Nothing to do but wait for Apple — once approved and
  released, the app will have the same fix the website now has. Until then, the installed app on
  any device will keep showing the old pre-fix behavior.

**Still open, unrelated to last night's incident:** the Sept 14 "event deleted before it
happened" concern (Moms Unhinged). `refresh-buckets.js` runs only on Lindsay's MacBook via cron
(`0 6 * * *`), is gitignored, and isn't in either repo, so it still hasn't been read or patched.
**Next step whenever picked back up:** get the contents of `~/drift-boulder/refresh-buckets.js`
pasted into the session so its delete condition can be rewritten to the same midnight-Mountain-Time
/ Denver-calendar-day comparison as `denverDay()` in `src/App.jsx:61-69`.

### 3. "This Weekend" bucket showing stale/wrong events — FIXED.
Lindsay reported far-future "Upcoming" events showing under This Weekend, then separately that
9/18 (Friday, already past) events should not appear there either — only 9/19 (Sat) and 9/20
(Sun). Two real bugs in `src/App.jsx`, both fixed:
- `computeBucket()` used `diff<=0` to mean "Today," which also matched any already-past date.
  Combined with the This Weekend filter's rule that pulls in "Today"-bucketed events whenever
  today itself is a weekend day, a stale/past event could ride along into the weekend list.
  Changed to `diff===0` for Today, `diff<0` now routes to Upcoming.
- Events with no `starts_at` fell back to the raw, admin-editable `time_bucket` column (set via
  the dropdown in `admin.html`), which never expires — a dateless event tagged "This Weekend" at
  some point in the past stayed tagged that way forever. Now always resolves to "Upcoming" for
  dateless events, matching the documented intent above (#54 dateless events section, below).

Could not query Supabase directly to find the exact rows that triggered this (this sandbox's
network blocks `supabase.co`, same as it blocked `gojaney.com` earlier) — this was a code-level
fix for the mechanism, not a data cleanup. If a specific event is still stuck wrong after this
deploys, check in the admin panel whether it actually has a real `starts_at` date.

### 4. Found and merged a second, orphaned branch (`claude/attach-latest-handoff-lbo1we`)
While getting Lindsay's Mac ready to cut a new iOS build, her `git pull origin main` failed with
"divergent branches." Turned out her Mac's local `main` had been reset at some point to the tip of
`claude/attach-latest-handoff-lbo1we` — a **separate, previously unmerged branch** (pushed to
GitHub, but never merged into `main`) containing the real Sept 18 sign-in-fix commits (the
`gojaney://` deep link, `@capacitor/app` dependency, Apple sign-in button persistence, the
redesigned sign-in screen). Meanwhile `origin/main` only had this session's DNS/event-timing/
bucket-fix branch. Two genuinely different, non-overlapping sets of work, each missing the other.

**Merged both branches together on both repos** (drift-app and drift-boulder), pushed to `main`.
One real conflict in `src/App.jsx`'s sign-in screen (`ProfileView`), resolved in favor of the
already-fixed version (persisted `isNative` flag instead of calling `CapCore.isNativePlatform()`
live; no "or use email" divider). `Info.plist`, `package.json`, `lib/eventSearch.js`,
`public/admin.html`, and this handoff doc all merged cleanly. Verified both repos build with no
errors after merging.

**Lesson for next time:** before assuming a `git pull` will be a clean fast-forward, check
`git status` first — "divergent branches" almost always means there's unmerged work sitting on
some other branch that needs to be found and reconciled, not just a stale local checkout.

**iOS build status as of this session:** rebuilt and re-synced on Lindsay's Mac after the merge
(confirmed `@capacitor/app` picked up by `cap sync`), bumped to **version 1.0.7, build 13**,
archived and **uploaded to App Store Connect** — containing all of today's web fixes plus the
sign-in fixes. **Deliberately not yet submitted for review** — 1.0.6 (build 12) is still "Waiting
for Review," and the handoff already has one prior note about confusion from overlapping
submissions (stale Xcode upload statuses, a build rejected because a prior version was already
approved). Plan: wait for 1.0.6 to clear (approved/released or rejected), then submit for review
as its own version rather than reusing 1.0.6 — see build number note below, since it's no longer
build 13.

### 5. "This Weekend" pulling in *next* weekend's events on Saturday/Sunday — FIXED.
Found after 1.0.7/build 13 was already uploaded, from a screenshot of the live app on a Saturday:
"This Weekend" showed ~34 events, nearly all dated the *following* Friday/Saturday (9/25, 9/26,
a week out), with only one event actually on 9/20. These had real `starts_at` dates — not the
dateless/stale-`time_bucket` issue from earlier, a genuinely different bug in the date math itself.

Root cause in `computeBucket()` (`src/App.jsx`): `daysToFriday=(5-dow+7)%7` always looks for the
*next* Friday relative to today. When today is itself Saturday or Sunday, that formula lands on
6 or 5 days out instead of recognizing the current weekend is already underway (and already fully
covered by the `diff===0`/`diff===1` Today/Tomorrow checks above it) — so it was quietly
computing *next* weekend's window and mislabeling those events "This Weekend" too. Friday is
unaffected: the same formula happens to evaluate to 0 that day, correctly extending through
Sunday. Fixed by skipping the window check entirely when `dow===6||dow===0`.

**Not in build 13** — found and fixed after that upload. **Lindsay's plan:** fold this fix into
the same 1.0.7 release before submitting for review, so it isn't shipped a fix behind. Since
Apple rejects re-uploading an identical version+build number, this requires bumping to
**build 14** (version stays 1.0.7) rather than replacing build 13 in place — rebuild, re-sync,
re-archive, re-upload, and submit build 14 (not 13) when the time comes.

**Two untracked, unidentified files found on Lindsay's Mac, left alone:** `public/admin-backup.html`
and `t.mjs` in `~/drift-boulder`. Not in git, not matched to anything in the known scripts table
below. Lindsay's guess was they might relate to subscriber event submissions, but that flow is
`public/submit.html` + the `submissions` table already handled in `admin.html` — these two don't
obviously fit that. Worth a `cat` on both next session to identify and decide whether to keep,
gitignore, or delete.

## Sept 18 session — what changed
- **Two real sign-in bugs found and fixed, confirmed working live on Lindsay's iPhone:**
  1. **Email sign-in link opened the website instead of the app.** Root cause: Supabase
     project **"gojaney"** (there are two Supabase projects on this account — the other,
     "255wood@gmail.com's Project," is an unused default and should be ignored; the real one
     is confirmed by its Project URL matching `lknoxozdbkikysxoarzu.supabase.co`) never had
     `gojaney://login-callback` in **Authentication → URL Configuration → Redirect URLs**.
     Without it, Supabase silently ignored `signInWithOtp`'s `emailRedirectTo` and fell back
     to the Site URL (`https://gojaney.com`), so the emailed link always opened Safari.
     **Fixed by adding `gojaney://login-callback` to that Redirect URLs list.** This is a
     **dashboard setting, not app code** — it took effect immediately for the app already
     installed on the test phone, no new build required for this part alone.
  2. **"Sign in with Apple" button disappeared from the sign-in screen after signing in with
     email and then signing out** — never after signing in with Apple. Suspected cause:
     `CapCore.isNativePlatform()` racing the native bridge on the WebView reload that the
     `gojaney://` deep-link hand-off triggers, occasionally reading `false` on that one reload.
     Fixed by persisting the native-platform flag to `localStorage` (key `gj_native`) the first
     time it's correctly read `true` on an ordinary launch, and trusting that saved value on
     every later check instead of re-querying live. Code is in the SIGN IN WITH APPLE section
     below.
  - Both fixes were confirmed with temporary `console.log` debug statements first (removed
    once verified), and by connecting Safari's Web Inspector to the device.
- **Sign-in screen redesigned** to one combined layout, per Lindsay's explicit choice: Apple
  button, email field, and "Send Sign-In Link" button all visible at once. No two-step chooser
  screen, no "or use email" divider text above the button, no Back link.
- **Confusing App Store Connect build history sorted out — read this before archiving again.**
  See the updated iOS section below. Short version: **version 1.0.6 (build 12), containing
  everything above, was submitted for review Sept 18.** Two earlier attempts that day and the
  day before (version 1.0.5, builds 11 and 12) both show **"Upload failed" in Xcode's own
  Organizer**, yet App Store Connect's website showed build 11 as **"Ready to Distribute"**
  regardless — almost certainly a stale/incorrect Xcode status rather than a real successful
  re-upload through some other route, since only Xcode's Distribute App was ever used. Version
  **1.0.5 was already "previously approved"** by the time of these attempts (Apple rejected
  new 1.0.5 uploads for exactly that reason), meaning **it's worth checking directly in App
  Store Connect what version is actually live right now** before assuming 1.0.6 is the first
  fix real users will see.

## Sept 16 session — what changed
- **Found a real barrier to adoption:** App Store users can install the app but **cannot sign
  in** — the magic link opens Safari, not the app. Browsing still works; saving does not.
- **Sign in with Apple COMPLETE and tested on a real iPhone.** Signed in, saved an event, closed
  and reopened the app: still signed in, event still saved. Commit `db7756e`, pushed to both remotes.
- **1.0.4 (build 10) archived and uploaded** to App Store Connect. Next: add version 1.0.4, pick
  build 10, submit for review (if not already done). See the 1.0.4 section.
- First on-device test from Xcode: iPhone registered as "iPhone (4)", Developer Mode enabled.
- Two gotchas hit and fixed — a missing prop (black Profile screen) and a trailing space in the
  version number. Both documented in the SIGN IN WITH APPLE section.

## Sept 14 session — what changed
- **Instagram marketing started** — weekly plan, post templates, and a four-frame weekend Reel.
  See the Instagram section. Nothing posted yet.
- **Seven venues added to `VENUE_GEO`** (CU Grusin, C Bar, KGNU, BMoCA, Lucky Market,
  License No. 1, Nomad Playhouse).
- **Found a real bug:** Moms Unhinged (Sept 22, Nomad Playhouse) had been **deleted from the
  database before the event happened**. Re-added by hand. Cause not yet investigated — if
  `refresh-buckets.js` is removing future events, others will vanish the same way. See Known
  data issues.

## Sept 13 session — what changed
- **Admin panel 401 fixed** — `api()` now fetches a live session token per request instead of
  caching one at page load. Verified by editing an event successfully.
- Confirmed RLS is working correctly; an earlier "write allowed" reading was a test artefact
  (a zero-row PATCH returns 204). See the testing note in the SECURITY section.

## Sept 11 session — what changed
- **SECURITY WORK COMPLETE.** RLS policies now restrict writes to three admin accounts. The
  events table is no longer open to anyone holding the public key.
- **1.0.3 (build 9) submitted, approved and released** with three new App Store screenshots.
- **D-U-N-S number received** (149934013) — usable Sept 15.
- Screenshots hit a **size trap** (6.5" slot, not 6.9") — see the screenshots section.

## Sept 10 session — what changed
- **Admin panel security** — cron scripts moved to the secret key, email sign-in added to the
  panel. Completed Sept 11 with the RLS policy — see the SECURITY section.
- **iOS 1.0.1 approved and released**; **1.0.2 (build 7) submitted** with the map rebuild
- **`gojaney` keyword confirmed working** in App Store search
- **Business licence applied for** (Boulder), files sent to Dun & Bradstreet

## Sept 9 session — what changed
- **Venue names consolidated** 54 → 29; 13 Comedy Works Denver events deleted and blocked
- **Categorization resolved** — four rows, two venue additions, no AI call needed
- **Real venue coordinates** in `VENUE_GEO`, resolved by name at display time
- **Map rebuilt** — filters, search, centred controls, Directions link
- **Farmers market** completed through Nov 21 with `ends_at` times
- **Repo tidied** — iOS version fixes and cache headers committed, one-off scripts gitignored

Each has its own section below.

## What This Is
A mobile-first local event discovery app for Boulder, Colorado and nearby towns. Users open the app to see what's happening today, tomorrow, this weekend, or upcoming. Categories: Live Music, Comedy, Food & Culture. NOT an RSVP or ticketing system — purely discovery.

**Category rule:** there are exactly three. Anything that is not comedy and not live music goes into Food & Culture — that bucket is the catch-all (trivia nights, yoga, theater, films, art openings, dance lessons, actual food events).

## Live URLs
- **App:** https://gojaney.com / https://drift-boulder-now.vercel.app (backup)
- **Admin Panel:** https://drift-boulder-now.vercel.app/admin.html
- **GitHub Repos:** github.com/255wood-create/drift-app (origin) and drift-boulder (boulder remote)
- **Vercel Project:** gojaney
- **Email:** gojaneyboulder@gmail.com

## Tech Stack
- **Frontend:** React (Vite) — single-file app in `src/App.jsx`
- **Database:** Supabase (PostgreSQL) — project ID: `lknoxozdbkikysxoarzu`
- **Hosting:** Vercel
- **Event Scraping:** SerpApi — `fetch3.js` → `lib/eventSearch.js`
- **Auth:** Sign in with Apple in the iOS app (native, `signInWithIdToken`); magic link (email OTP)
  on the website and in the admin panel
- **Fonts:** Inter (body), Caveat (logo "go" text)
- **Domain:** gojaney.com registered at Network Solutions, nameservers pointed to Vercel

## SerpApi — IMPORTANT CHANGES (Sept 2026)
- SerpApi **deprecated the `google_events` engine** during the week of Aug 24–30, 2026. Calls to it now return `Unsupported google_events search engine.`
- The code now uses `engine: "google"` and reads `events_results` out of regular Google search results.
- Account is on the **paid Developer plan ($75/mo, ~5,000 searches)**. One `fetch3.js` run uses ~48 searches.
- Account "Geographic Location" setting was showing Austin, TX. Queries name their cities explicitly so results are still Boulder-area.

### The new response format is much thinner
Each event returns only: `title`, `date` (a plain string like `"Sep 10"`), `time` (`"6:00 PM"`), `source`, `link`, `thumbnail`.

There is **no address field and no description**. Consequences:
- **Venue** is guessed from the search query via `guessVenue()` — queries ending in "events" (e.g. "St Julien Hotel Boulder events") yield the venue name. Generic queries yield nothing, so location falls back to "Boulder".
- **Dates** are parsed by `parseEventDate()` from the plain strings. It also handles a leading weekday ("Tue, Sep 30"), date ranges, and an object form some responses still return.
- Not every query returns `events_results` — Google only shows an events pack for some phrasings. Venue-specific queries work best.

## The Map screen (rebuilt Sept 9)
The map is **real Google Maps**, not the SVG placeholder older notes describe. The API key is
hardcoded at the top of `App.jsx` (`GOOGLE_MAPS_KEY`). Worth checking it has referrer
restrictions set in the Google Cloud console — an unrestricted key in client-side source can
be used by anyone and billed to the account.

### Venue coordinates live in the app, not the database
`VENUE_GEO` in `App.jsx` maps ~37 venue names to lat/lng pairs, and `venueGeo(loc)` resolves a
location string to coordinates. Markers use this rather than the `lat`/`lng` columns, falling
back to the stored values and then Boulder centre.

**Why in the app rather than the data:** manual admin entry produces variation ("Boulderado"
vs "Boulderado Hotel"), and resolving at display time means it works however an event was
entered. `venueGeo` lowercases, strips punctuation, and does substring matching in both
directions, so partial names match.

The database `lat`/`lng` columns were also backfilled (via `geo.js`), so they're roughly
right, but the app doesn't rely on them.

**Coordinates were verified by Lindsay** against her own list — these are not Google's
approximations. `VENUE_GEO` also holds nine venues with no events yet (Boulderado, Limelight,
Moxy, Trident, Boulder Bandshell, Bands on the Bricks, Muse Performance Space, Mountain Sun,
Laughing Goat), ready for when events appear there.

### Map controls
A panel across the top holds a search field, time filters, category filters, and a count.
Filter buttons are centred; the search field is full width.

**Filters are shared with the feed** — changing them on the map changes the feed and vice
versa. One mental model, deliberately.

**Search deliberately ignores the filters.** With the box empty, the map shows `displayed`
(the filtered, grouped list). Type anything and it searches `allEvents` instead, matching
venue name or event title. So searching "Nissi's" finds its events even while the Today
filter is active. Clear the box and filters apply again.

**Known gap:** the map does not recentre on search results. Search a Lyons venue while looking
at downtown Boulder and the markers change but stay off-screen, which reads as broken. Fitting
the viewport to visible markers would fix it.

**Also note:** markers stack at busy venues. Boulder Theater has ~41 events, all at one point,
so only the topmost is clickable. Filtering mitigates this; one-marker-per-venue would solve it
properly.

### Directions link
The event detail panel (opened by tapping a marker) has a Directions link under the venue name.
It builds a `maps.google.com/?q=lat,lng` URL from `venueGeo`, falling back to a name search.
On iOS this hands off to the phone's map app — deliberately not reimplementing navigation.

## Timezone Handling (fixed Sept 6)
All date bucketing and time display now use **America/Denver explicitly**, not the device's timezone. A phone set to another zone was showing events on the wrong day.

- `lib/eventSearch.js` — `getBucket()` uses a Denver `Intl.DateTimeFormat`
- `src/App.jsx` — `denverDay()` helper feeds `isPastEvent()` and `computeBucket()`; the event-card time string uses a Denver `Intl.DateTimeFormat`

### CRITICAL: `denverDay()` can return null — always guard it
`denverDay()` returns `null` for a missing or invalid date. Calling `.split()` on that
result, or passing a bad date to `Intl.DateTimeFormat.format()`, **throws at runtime and
unmounts the entire event list — the app renders with zero events.**

This happened on Sept 6. The first version of the event-card line called
`denverDay(d).split("-")` with no check. `npx vite build` passed cleanly, because this is a
runtime error, not a syntax error. The app deployed and showed a blank list.

Every call site now has a guard. Line 144 pattern:
```js
var dd=denverDay(d);
if(dd){ var dp=dd.split("-"); ... }              // date part
if(dd&&!(um===0&&(...))){ ...format(d)... }      // time part reuses the same check
```
`computeBucket()` returns `"Upcoming"` if either date is null. `isPastEvent()` returns
`false` if either is null.

**If you edit any of these, re-add the guards.** A clean build does not prove this works.

### If the app ever shows zero events
1. Confirm the data is intact: `select count(*) from events;` in Supabase (should be ~330)
2. If the count is fine, it's a rendering crash — roll back immediately:
   ```
   git revert HEAD --no-edit && git push origin main && git push boulder main
   ```
3. Wait ~1 min for Vercel, reload with a new cache-buster (`?fresh=N`)

This affects the **web app only**. The iOS app bundles its own copy of the code, so a bad
deploy can't break it — but by the same token a fix can't reach it without a new build.

**Known quirk left alone:** events whose UTC time is midnight, 6am, or 7am on the dot are treated as "placeholder times" (Google's stand-in when it doesn't know the real time) and have their time hidden on the card. A real event at one of those times would have its time hidden too.

## The "This Weekend" Bug (fixed Sept 6)
Both `getBucket()` and `computeBucket()` computed the weekend window as:
```js
const daysToSunday = (7 - dow) % 7;   // WRONG
```
On Sundays this produces 0 while `daysToFriday` is 5, so the range `5..0` matches nothing and every event fell through to "Upcoming". Corrected to:
```js
const daysToSunday = daysToFriday + 2;
```
This logic is **duplicated** in the two files. Change both together.

## Categorization
`categorizeEvent()` in `lib/eventSearch.js`, checked in this order:
1. Named-comedian exception list (Cliff Cash, BK Sharad, Moms Unhinged, Craig Ferguson, Samantha Bee, Steve Vanderploeg) → comedy
2. Comedy keywords → comedy
3. Film keywords (goonies, rocket science, reel rock, mountainfilm, freeski, etc.) → food
4. Dance-lesson keywords (salsa, bachata, waltz, rueda, swing lesson) → food
5. Other culture keywords (trivia, yoga, cornhole, farmers market, gallery, poetry) → food
6. Music-festival phrases → music
7. **Venue match** (`MUSIC_VENUES` regex) → music
8. Music keywords → music
9. Default → food

**Why venue matters:** most titles are just names. "Ozomatli" and "Cliff Cash" contain no category words at all — keyword matching alone cannot classify them. Nearly all events come from dedicated music rooms, so the venue is the strongest available signal.

`MUSIC_VENUES` covers: Fox Theatre, Boulder Theater, Nissi's, Louisville Underground (plus common misspellings), Velvet Elk, eTown, Gold Hill Inn, Planet Bluegrass, Oskar Blues, Roots Music Project, Caribou Room, Avalon Ballroom, Tulagi, Boulder Bandshell, Chautauqua Auditorium, Dog House Music, The End Lafayette, Trident, Speakeasy, Macky, Folsom Field.

## Categorization — RESOLVED Sept 9 (no AI call needed)
The plan had been to weigh venue expansion against an AI call with its own billing account.
On inspection the problem was far smaller than assumed: of 62 events in Food & Culture, only
**four** were genuinely miscategorised (Phoebe Nix, Dave Tamkin, Catzin Tzlia, J.S. Bach's
The Art of Fugue — all musicians). Everything else — trivia, poker, dance lessons, films,
cornhole, art festivals, the farmers market — belongs there.

Fixed by adding **St Julien** and **Rosetta Hall** to `MUSIC_VENUES` and correcting the four
rows by hand. **The venue-based approach is doing the work**; an AI call would have been
machinery and monthly billing for a handful of rows.

Lindsay confirmed "Spaghetti Western Wine Dinner" and "Fight Club Drag Comp" belong in Food
& Culture, not music.

If name-only titles become a real problem again, revisit — but measure first.

## Venue names — consolidated Sept 9
Location strings went from **54 variants to 29 real venues**. The rule Lindsay chose: **town
appended only when it isn't Boulder.** So "Fox Theatre" and "eTown Hall" carry no town, while
"Nissi's Lafayette", "Oskar Blues Lyons", and "The Speakeasy Longmont" do. Boulder is the
default and goes unstated.

The admin panel's venue dropdown is built from existing rows, so cleaning the data cleaned the
dropdown — they're the same job.

**13 Comedy Works events deleted.** All were Comedy Works *Denver* — national touring comics
at a Denver room. They passed the Denver filter because it checks location strings for city
names and "Comedy Works" contains none. **"comedy works" was added to the `DENVER` blocklist**
so they don't return. Note that list is really a blocklist despite the name.

Side effect of consolidation: rows that previously had different venue strings now share one,
so grouping and dedupe treat them as the same venue. Two different shows at Boulder Theater on
the same night with similar opening words could now group where they didn't before.

## SECURITY — COMPLETE (Sept 11)

### What the problem was
The admin panel and the main app both ship the Supabase **anon key** in client-side source.
That is normal for Supabase — the key is not the secret, the RLS policies are. But `events` had
a single policy, **"Events are public"** (ALL / {public} / qual: true / with_check: true), which
means "anyone may do anything." A test insert with the public key succeeded. Anyone who found
`/admin.html` (unlinked, but not secret) could add, edit, or delete events.

### The fix, in three parts
1. **Cron scripts moved to the secret key.** `fetch3.js` and `refresh-buckets.js` use a Supabase
   **secret key** (formerly `service_role`), which bypasses RLS, so they keep working. Both files
   are gitignored — that key must never be committed or put in a browser.
2. **Admin panel requires email sign-in.** Supabase magic links, same flow as the app.
   `admin.html` loads `@supabase/supabase-js` and has `sendLink()` / `checkSession()` /
   `signOutAdmin()`; `api()` sends the session token as the bearer while keeping the anon key as
   the apikey header. Original backed up at `public/admin-backup.html`.
   **Never commit `admin-backup.html`** — anything in `public/` is published on gojaney.com.
   It is currently untracked; consider moving it out of `public/` or adding it to `.gitignore`.
3. **RLS policies replaced.** The permissive policy was dropped and four created: public SELECT,
   and INSERT / UPDATE / DELETE each restricted to three admin user IDs.

### The admin accounts
- `dd675dff-06eb-4c02-95cf-f95f69163546` — 255wood@gmail.com
- `cb3efe31-fca9-4d4d-a030-242b6c2b9f59` — gojaneyboulder@gmail.com
- `a34b6028-506f-4650-ae8b-9bf20727c716` — lindsayscott170@gmail.com

**Two other accounts exist and are ordinary users** — `lashton@cherrycreekschools.org` and
`lisa.2wxrkclc.paid@icloud.com` are friends. Before this change they could have edited events.

To add an admin later: that person must sign into the app first so Supabase creates their user,
then add their UID to all three write policies.

### Verified after the change
- Anon-key insert → **401 blocked** (`new row violates row-level security policy`)
- Anon-key read → **200, events readable** (the app still works)
- `refresh-buckets.js` → ran fine, 29 updated, 21 deleted (secret key bypasses RLS)
- Adding an event through the signed-in admin panel → **worked**

### Note on the SQL
Running the policy script twice gives `42710: policy ... already exists`. That is the second run
failing, not the first — check `select policyname, cmd from pg_policies where tablename='events'`
before assuming something broke. Supabase also warns about "destructive operations" because of
the `drop policy` line; it drops a policy, not data.

### Testing RLS — a 204 does NOT mean the write succeeded
A PATCH that RLS filters down to zero rows returns **204 / success**, because the request was
valid; it simply matched nothing. A naive test reading only the status code reports "write
allowed" when the write was in fact blocked. This caused a false alarm on Sept 13 and led to a
working UPDATE policy being needlessly rewritten.

**Always use `Prefer: return=representation` when testing writes** and check what comes back.
An empty `[]` means nothing changed — RLS is working. A returned row means it really did write.

### Admin panel 401s — token must be fetched per request, not cached
Symptom: the panel shows **"Signed in"** but every save fails with **401**.

Cause: `TOKEN` was captured once by `checkSession()` at page load. Supabase access tokens expire
in about an hour, and the panel never refreshed, so it kept sending a dead credential while still
believing it was authenticated.

Fix (Sept 13): `api()` now calls `SB.auth.getSession()` on every request and uses the token from
that, letting the Supabase client refresh as needed. `api()` was already promise-returning and
callers already used `.then()`, so nothing else changed.

**If 401s return, check this first** — "Signed in" on screen is not evidence of a live token.

## SIGN IN WITH APPLE — COMPLETE (Sept 16)

### The problem being solved
**App Store users cannot sign into the iOS app.** They install fine and can browse, but tapping
Profile → Send Sign-In Link emails them a magic link that **opens Safari at gojaney.com**, so the
session lands in the browser, not the app. A tester put it exactly: *"Everyone gets a sign in
link but it isn't signing me into the app itself."*

Cause: the iOS app bundles its assets and runs in its own web view. `signInWithOtp` at
`src/App.jsx:393` passes `emailRedirectTo: window.location.origin`, and all of Supabase's
redirect URLs are web addresses, so iOS hands the link to Safari. The app never sees the token.

Browsing still works without an account — only saving events needs one.

### Why Sign in with Apple rather than Universal Links
Universal Links would keep the email flow and make the link open the app (entitlement + an
apple-app-site-association file on gojaney.com + token handling). Sign in with Apple removes the
email round trip entirely: one tap, Face ID, done. Similar effort, better result. Lindsay was
explicit she wanted no codes and no links.

### DONE — Apple Developer portal
- **Sign in with Apple** enabled on App ID `com.gojaney.app`, as a **primary App ID**
- Signing key created: **`AuthKey_7S7TQ75942.p8`** — saved on the MacBook. Apple allows exactly
  one download; if lost, it must be revoked and recreated.
- Services ID created: **`com.gojaney.app.web`** ("go janey web"), configured with
  `com.gojaney.app` as primary, domain `lknoxozdbkikysxoarzu.supabase.co`, return URL
  `https://lknoxozdbkikysxoarzu.supabase.co/auth/v1/callback`

Values worth keeping to hand:
```
Team / Account ID: 2KHJ68T9FX
Key ID:            7S7TQ75942
Bundle ID:         com.gojaney.app
Services ID:       com.gojaney.app.web
```

### DONE — Supabase Apple provider
`Authentication → Sign In / Providers → Apple`, enabled, saved and verified by reload:
- **Client IDs:** `com.gojaney.app.web,com.gojaney.app` — Services ID **first**. Supabase uses
  the first entry for the web OAuth flow and accepts any of them for native sign-in. Reversing
  the order breaks web sign-in.
- **Secret Key:** a JWT generated from the `.p8` using the tool embedded in Supabase's docs at
  `supabase.com/docs/guides/auth/social-login/auth-apple` (Chrome or Firefox — it does not work
  in Safari). The tool takes the `.p8` as a file upload; the key never leaves the browser.
- **Allow users without an email: ON** — not a deliberate choice. The Save button stayed greyed
  out until some field changed, and toggling this was what unstuck it. Means occasional accounts
  with no email. Worth revisiting.

**The Services ID and secret are pure scaffolding.** Native iOS sign-in uses neither — the OS
hands Supabase an `id_token` directly. They exist only because the Supabase dashboard refuses to
save without a secret. This is a known complaint (supabase discussion #44217).

Also note: the secret **expires every 6 months** for web OAuth. Since nothing here uses the web
flow, that shouldn't matter, but a calendar reminder is cheap insurance.

### DONE — the app itself
- Plugin: `@capacitor-community/apple-sign-in@7.1.0`. `npx cap sync` warns it is "built for
  Capacitor 7", but its `Package.swift` requires `capacitor-swift-pm` **from 8.0.0**, so it is
  compatible with our Capacitor 8.5. The warning is safe to ignore.
- Xcode: **Sign In with Apple** capability added → `ios/App/App/App.entitlements` contains
  `com.apple.developer.applesignin` = `Default`.
- `src/App.jsx`:
  - imports `SignInWithApple` and `Capacitor as CapCore` (top of file)
  - `signInApple()` sits just above `signOut`. It makes a random nonce, sends the **SHA-256 hash**
    to Apple and the **raw** nonce to `supabase.auth.signInWithIdToken({provider:'apple', ...})`.
    Swapping them breaks sign-in. On first sign-in it saves Apple's name via
    `updateUser({data:{full_name}})`. A cancelled popup clears the message silently.
  - Profile screen shows a black "Sign in with Apple" button **only when
    `CapCore.isNativePlatform()`** (now read through the `isNative` persisted flag — see
    Sept 18 below). Email sign-in is **also always shown**, deliberately — Lindsay wants both
    options available since some users prefer signing in with email over Apple. As of Sept 18
    the email link works correctly in the native app too (see below); this paragraph is
    superseded, kept for history.
- Added via `add_apple_signin.py` (backup at `/tmp/App.jsx.before-apple`, gone after reboot).

**Gotcha — black Profile screen.** `ProfileView` (line ~325) is a separate component that
receives its functions as props. The first build forgot to pass `signInApple`, so Profile
rendered black. Fixed by adding it to both the `ProfileView({...})` parameter list and the
`<ProfileView ... />` call (line ~567). **A clean Vite build does not catch this** — any new
function used inside `ProfileView` must be passed in both places.

**Gotcha — "copying shared cache symbols".** The first run on a new iPhone copies symbols for
5–15 minutes. Developer Mode must be on (Settings → Privacy & Security → Developer Mode).

**Gotcha — provisioning profile.** After adding the capability, the "gojaney App Store" profile
was invalid (Release signing showed two red errors). Fixed by Edit → Save → Download → double-click
on developer.apple.com, then re-selecting it in Xcode. Any future capability change needs the same.

### Email sign-in in the app — FIXED (Sept 18)
Two separate, unrelated bugs were stacked on top of each other here. Fixing the code alone
did not fix the symptom; the Supabase dashboard setting had to change too.

**Bug 1 — email link opened Safari instead of the app.** `Info.plist` registers a custom URL
scheme:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>gojaney</string></array>
  </dict>
</array>
```
and `signIn()` in `App.jsx` already computed `emailRedirectTo` correctly:
```js
const redirectTo = isNative ? 'gojaney://login-callback' : window.location.origin;
```
That should have been enough. It wasn't, because **Supabase only honors `emailRedirectTo` if
the URL is on its allow list** — Authentication → URL Configuration → Redirect URLs in the
Supabase dashboard (the **"gojaney"** project, not the other empty one on this account). That
list held only `https://` URLs; `gojaney://login-callback` was never added, so Supabase quietly
substituted the Site URL (`https://gojaney.com`) instead, and the emailed link always pointed
at the website. **Fixed by adding `gojaney://login-callback` to that Redirect URLs list.** No
app code changed for this part — it's a server-side setting and took effect immediately.

An `appUrlOpen` listener in `App.jsx` catches the return trip and completes sign-in:
```js
useEffect(()=>{
  if(!isNative)return;
  const sub=CapApp.addListener('appUrlOpen',async({url})=>{
    if(!url||!url.startsWith('gojaney://login-callback'))return;
    const parsed=new URL(url);
    const code=parsed.searchParams.get('code');
    if(code){ await supabase.auth.exchangeCodeForSession(code); return; }
    // hash-fragment token fallback, in case Supabase ever isn't on the PKCE flow
    const params=new URLSearchParams(parsed.hash.replace(/^#/,''));
    const access_token=params.get('access_token'), refresh_token=params.get('refresh_token');
    if(access_token&&refresh_token) await supabase.auth.setSession({access_token,refresh_token});
  });
  return()=>{sub.then(s=>s.remove());};
},[]);
```

**Bug 2 — "Sign in with Apple" button vanished after an email sign-in/out cycle,** but never
after an Apple sign-in/out cycle. Cause: the `gojaney://` deep-link hand-off (email flow only)
appears to reload the WebView, and `CapCore.isNativePlatform()` can lose its race with the
native bridge on that particular reload and read `false` — even though an ordinary app launch
reads it correctly. Fixed by caching the answer permanently once it's correctly read `true`:
```js
const[isNative]=useState(()=>{
  try{
    if(localStorage.getItem('gj_native')==='1')return true;
  }catch(e){}
  const native=CapCore.isNativePlatform();
  if(native){
    try{localStorage.setItem('gj_native','1');}catch(e){}
  }
  return native;
});
```
`isNative` (not a live `CapCore.isNativePlatform()` call) now gates the Apple button, the
`appUrlOpen` listener, and the `emailRedirectTo` choice in `signIn()`.

**If email sign-in ever breaks again after a Supabase project change or a bundle ID / URL
scheme change:** check the Redirect URLs allow list first, before touching any app code. It's
easy to fix the code correctly and still see the bug, because Supabase fails silently rather
than erroring when a redirect URL isn't allow-listed.

### Still worth doing
- **In-app account deletion.** Apple requires it for apps with account creation (guideline
  5.1.1(v)). Not present yet — if review rejects a build for this, add a "Delete account" button.
- Revisit "Allow users without an email" in Supabase (see above).
- Calendar reminder for the 6-month Apple secret expiry (web flow only; not currently used).

## Supabase Schema
```sql
events: id, title, category, location, venue, neighborhood, vibe, time_bucket, starts_at, ends_at, is_trending, lat, lng, emoji, gradient, created_at
saved_events: id, user_id, event_id, created_at
interested: id, user_id, event_id, created_at
user_profiles: id, name, handle, bio, interests, avatar_url, created_at
```
RLS enabled with permissive policies.

## Supabase Connection (CRITICAL)
Two different connection methods, NOT interchangeable:
1. **Main app (App.jsx):** `@supabase/supabase-js` npm package with `sb_publishable_` key via Vercel env vars
2. **Admin panel + all local scripts:** direct REST API `fetch()` with the legacy `eyJ` JWT key

## Vercel Environment Variables
```
VITE_SUPABASE_URL = https://lknoxozdbkikysxoarzu.supabase.co
VITE_SUPABASE_ANON = sb_publishable_myANV71Ao-e3TRTqM5UuOA_mTobfrdH
```

## Git Remotes (from ~/drift-boulder)
- `origin` → github.com/255wood-create/drift-app.git
- `boulder` → github.com/255wood-create/drift-boulder.git
- Push to BOTH: `git push origin main && git push boulder main`

## Local Scripts
**These are gitignored as of Sept 9** — they contain the Supabase key and shouldn't be in the
repo. They live only on the MacBook, so a fresh clone won't have them.

| File | Purpose | Safe to re-run? |
|---|---|---|
| `fetch3.js` | Main event fetch (cron 6:05am) | Yes |
| `refresh-buckets.js` | Daily bucket refresh (cron 6:00am) | Yes |
| `fix-buckets.js` | One-time backfill of `time_bucket` from `starts_at` | Yes |
| `recat2.js` | Category backfill. `node recat2.js` = dry run, `--apply` writes | Yes, dry-run first |
| `findpairs.js` | Finds duplicate pairs by day+venue+title. Dry run by default, `--apply` DELETES | Yes, dry-run first |
| `venues.js` | Read-only: lists venues by event count | Yes |
| `dupes.js` | Read-only: dumps all dated events as `date \| title \| venue` | Yes |
| `datecheck.js` | Read-only: prints raw SerpApi date/time fields for sample queries | Yes |
| `deer.js` | Read-only: one-off title lookup. Handy template for querying by title from Terminal | Yes |
| `fixaddr.js` | Strips street addresses from `location`, leaving venue + town. Dry run by default, `--apply` writes | Yes, dry-run first |
| `fix-categories.js` | **BAD — delete.** Sent ~150 music events to food | **NO** |
| `recat.js` | **BAD — delete.** Sent trivia/yoga/comedy to music | **NO** |

**Always dry-run a backfill script before applying.** Both bad scripts above wrote to all rows on the first try and had to be undone.

## Deploying
```
git add <file>
git commit -m "message"
git push origin main && git push boulder main
```
- Check the build first: `npx vite build 2>&1 | grep -i "error\|built in"`
- A clean build does NOT catch undefined variables — read the changed line before pushing
- `lib/eventSearch.js` is **not** part of the web build; it runs locally via cron, so no Vercel deploy is needed for it
- `public/admin.html` is a **static file** — no build step, it ships as-is. It caches like
  any page, so use `?fresh=N` on the admin URL too when a change doesn't appear.
- **iOS caching:** Safari and home-screen web apps hold onto old versions hard. Force a fresh load with a query string: `https://gojaney.com/?fresh=1` (increment the number each time). Home-screen web apps keep a *separate* cache from Safari — clearing Safari alone won't fix those; delete and re-add the icon.

## Editing files in Terminal
`nano` is error-prone for this. Prefer:
- **Small change:** `sed -i '' 's/old/new/' file.js`
- **Bigger change:** write a Python script to `/tmp/fix.py` with `cat > /tmp/fix.py << 'PYEOF'`, then `python3 /tmp/fix.py`

**Gotcha:** `src/App.jsx` contains non-ASCII characters — a `·` separator and a non-breaking space (`\xa0`) before AM/PM (the latter is intentional, from the Aug 18 wrap fix). String-matching patterns that assume a normal space will silently fail to match. Match on ASCII-only fragments, or locate by index instead of exact text.

**Gotcha:** long heredoc pastes into Terminal frequently truncate, leaving a `heredoc>` prompt or a file with duplicated content. Paste in smaller chunks using `cat >` then `cat >>`, and verify with `grep -c "SUPABASE_URL =" file.js` (should print 1).

## Cron Schedule
```
0 6 * * * cd /Users/lindsayscott/drift-boulder && /usr/local/bin/node refresh-buckets.js >> /tmp/gojaney.log 2>&1
5 6 * * * cd /Users/lindsayscott/drift-boulder && /usr/local/bin/node fetch3.js >> /tmp/gojaney.log 2>&1
```
NOTE: Cron only runs when the laptop is open and awake at 6am.

## Design System
### Colors
- Fog White (background): #F5F3EF
- Charcoal (text): #1F2320
- Charcoal Mute (secondary text): #6B706C
- Pine Green (header/primary): #2F5D50
- Amber (accent): #D9A441
- Sage: #8FAF9A

### Typography
- Body: Inter (400, 500, 600)
- Logo: "go" in Caveat (cursive), "janey." in Inter
- Event title: Inter 15px 600
- Event subtitle: Inter 13px, color #6B706C

### Layout
- Clean list layout — no color cards
- Each event: title + location/date on left, heart save button on right
- Thin divider between events
- Hero photo header with gradient overlay
- Pine green bar with time filters and category buttons
- Bottom nav: Discover, Map, Saved, Profile

### Time Filters (4)
Today, Tomorrow, This Weekend, Upcoming.
`FILTER_LABELS` in App.jsx maps the internal key `Upcoming` to its display text. It was briefly labeled "Ahead" and was changed back on Sept 6.

**Intentional overlap — not a bug.** On line 358, when the active filter is "This Weekend"
and today (or tomorrow) falls on a weekend day, events bucketed "Today" or "Tomorrow" are
also shown under This Weekend. So on a Friday, Friday's events appear under both Today and
This Weekend. This is desired behavior. The empty `{}` blocks in that condition mean
"match, don't filter out" — they look like dead code but are load-bearing.

### The vibe line (added Sept 7)
Optional short descriptor shown on the event card, centered between the title and the
location/time line. Renders only when `event.vibe` has content, so cards stay uniform when
it's empty. Styled Caveat 400 at 15px in `#AEB3AF` — deliberately quiet, so it reads as an
aside rather than another data field.

The Caveat `@import` (line ~369) had to gain weight 400; it previously loaded only 700 for
the logo. A weight that isn't imported gets synthesized by the browser and looks wrong.

Most auto-fetched events will never have a vibe — the current SerpApi format returns no
description field, so this is effectively a hand-entry feature.

Note `vibe` is also rendered in the map's selected-event panel (line ~219) in italic Inter.
Feed rows are NOT tappable: the only thing that sets `selected` is a Google Maps marker
click listener, so that panel is reachable from the Map screen only.

### Grouped recurring events in Upcoming (added Sept 8)
The **Upcoming tab only** collapses repeat occurrences of the same event into a single card:
"Farmers Market · 13th and Canyon · 9/9, 9/12, 9/16, 9/19 +8 more". Today, Tomorrow and This
Weekend are untouched — those filters have already narrowed to one or two dates, so there is
nothing to collapse, and their code path is unchanged.

**Display-only.** The database still holds one row per date. Nothing is written, `time_bucket`
and `starts_at` are untouched, and Map/Saved read `withDist` upstream of this. The grouping is
recomputed on every render.

How it works, in `App.jsx` right after `filtered` is built:
- Groups by normalized title + normalized venue + variant tag
- Keeps the **earliest** occurrence as the card, so the heart saves the next date — this was
  a deliberate choice over saving all dates (clutters Saved) or disabling the heart
  (inconsistent)
- Shows the first date plus up to 3 more, then "+N more"
- Appends a **time only when every occurrence shares it** (`groupSameTime`). A run with
  varying times shows dates without a time rather than a misleading one.
- Never merges distinct showings — Early Show / Late Show / All Ages / 21+ / Morning Show,
  same guard as the fetch dedupe

**The failure mode to watch:** two genuinely different events sharing a normalized title and
venue would collapse, and the second simply wouldn't appear — easy to miss because nothing
looks broken. Check the "N experiences" count at the top of Upcoming after data changes; a
drop larger than the real repetition means something is over-grouping.

**Note the two grouping code paths are separate.** `relatedTitle()` in `lib/eventSearch.js`
(prefix / shared-leading-words, used by dedupe) and the exact-normalized-title match used by
this display grouping are different rules. The display version is stricter on purpose.

### Street addresses in listings — cleaned up Sept 8
Six rows from late July / early August held full street addresses
("eTown Hall, 1535 Spruce St Boulder, CO, United States"). These were **leftovers from the
retired `google_events` engine**, which returned address data. The current fetch has no
address source at all — `e.address` is always empty, which is why `guessVenue()` exists — so
this should not recur.

Cleaned to venue + town via `fixaddr.js`. Side effect worth knowing: those rows now normalize
to the same `venueKey` as their siblings ("Boulder Theater Boulder" and "Boulder Theater" both
→ `bouldertheater`), so some may now group or dedupe where they previously didn't.

### CRITICAL: iOS viewport height — why bottom-padding fixes don't work
The app shell must NOT use `min-height: 100vh`. On iOS, `100vh` is the viewport height with
browser chrome *hidden* — taller than what's actually visible. The shell then extends below
the fold, and any bottom padding on the scrolling `<main>` goes with it. Symptom: the last
event card sits behind the fixed bottom nav and is only visible while you hold the page up
in rubber-band overscroll.

This cost three failed attempts on Sept 7 — raising the padding from 100px to 150px, then
measuring the nav height at runtime in JS (which made it *worse*: `navH` evidently resolved
to an invalid value on device, so the browser dropped the padding declaration entirely and
the card became fully hidden). The padding was never the problem. It was there; it was
off-screen.

The fix is a CSS class, because React style objects can't hold duplicate keys and inline
styles would beat the class:
```css
.app-shell{min-height:100vh;min-height:-webkit-fill-available;min-height:100dvh}
```
Three declarations, each overriding the previous where supported: oldest iOS gets `100vh`
(today's behavior, no worse), middle gets the webkit value, iOS 16+ gets `dvh`. The shell
div carries `className="app-shell"` and no `minHeight` in its inline style.

**If bottom-cutoff symptoms return, check the viewport unit before touching any padding.**

## File Structure
```
drift-boulder/
├── public/
│   ├── admin.html              # Admin panel (REST API + eyJ key)
│   ├── hero.jpg
│   ├── gjicon-192.png, gjicon-512.png, apple-icon-180.png
│   ├── icon.svg, favicon.svg, icons.svg
│   ├── manifest.json
│   └── googleb901090c32930df7.html
├── src/
│   └── App.jsx                 # Main React app (single file)
├── lib/
│   └── eventSearch.js          # Search → filter → categorize → insert pipeline
├── fetch3.js                   # Thin wrapper; holds API keys — NOT in git
├── refresh-buckets.js          # Holds API keys — NOT in git
├── _old/                       # Archived scripts (gitignored)
├── index.html
├── package.json
├── vite.config.js
└── .gitignore
```

## Junk Filter (SKIP list)
chemical, engineering, shares, internship, volunteer, certification, training course, webinar, online, virtual, job fair, hiring, real estate, open house, church service, bible study, board meeting, city council

## Denver Filter (blocked locations)
denver, aurora, lakewood, littleton, englewood, thornton, arvada, westminster

---

# NEXT STEPS

## Immediate
1. **Confirm what version is actually live on the App Store right now.** The Xcode archive
   history alone doesn't make this clear — see the Sept 18 build-history note above. Check
   App Store Connect directly.
2. **1.0.6 (build 12) SUBMITTED Sept 18** — Waiting for Review. Watch for Apple's email. Once
   released, confirm on a real device that the email sign-in link opens the app (not Safari)
   and that the Apple button survives an email sign-in/out cycle — see the Sept 18 section
   above for exactly what to test.
3. **LLC → Organization conversion.** D-U-N-S **149934013** submitted to Apple Developer Support;
   awaiting reply. Check the case thread and email.
4. Watch a `fetch3.js` run and confirm new events get sensible venues, dates, and categories.

**iOS:** 1.0.1–1.0.4 archived/submitted through Sept 16. Version 1.0.5 was approved at some
point after that through a route not fully documented here — see the Sept 18 build-history
note. **1.0.6 (build 12) submitted Sept 18** with the sign-in fixes.

## Sept 7 session — what changed
- **Parser year inference.** `parseEventDate()` now checks whether the parsed date lands
  more than ~60 days in the past; if so it re-parses with next year. Google returns dates
  like `"Apr 17"` with no year, and stamping the current year on those put fall events in
  the spring. Two months of slack, not zero, so genuinely recent events aren't pushed
  forward a year.
- **25 duplicate rows deleted** via `findpairs.js` (356 → 331).
- **Dedupe rewritten.** `runFetch` previously compared exact normalized titles, so
  "The Bends" and "The Bends with Foxtide" both got inserted. It now matches on
  **day + normalized venue + related title**, using `venueKey()`, `variantTag()`, and
  `relatedTitle()`. Verified: a fetch right after the cleanup returned Added:0, Skipped:101.
- **Vibe line added to event cards** — see the design section above.
- **iOS viewport height fixed** (`100vh` → `dvh` with fallbacks) — see the critical section
  above. This is what was cutting off the last card.
- **Cache headers added to `vercel.json`.** `/` and `/index.html` now send
  `Cache-Control: public, max-age=0, must-revalidate`. Vite fingerprints its JS/CSS
  filenames so those cache normally; only the HTML entry point revalidates, which is enough
  to pull a new build. There is **no service worker** in this project, which rules out the
  worst source of stale content.
- **Admin panel sort control.** A dropdown next to "Show past events" offers Newest added
  (the default, `created_at.desc`), Title A-Z, and Event date. Sorting happens client-side
  on a `.slice()` copy — do **not** sort `data` in place, since `allEvts` is built from it
  and the Edit buttons depend on that mapping. Null dates sort to the end.

### Duplicate detection — three mechanisms, none complete
1. **`runFetch` dedupe** (prevents new duplicates): day + venue + related title.
2. **Admin panel highlighting** (lines ~362–381): groups by exact `normTitle` and flags a
   group when two entries share a date or one has a null date. Shows "N possible
   duplicates" in the count line.
3. **`findpairs.js`** (cleanup): the most thorough — prefix and shared-leading-word matching
   plus venue normalization.

What none of them catch, and why sorting Title A-Z matters:
- **Misspellings.** "Deer Creedence" / "Deer Creadence" — same night, same venue, Google
  supplied the typo in one listing. The strings genuinely differ, so no normalization helps.
  Fuzzy-matching titles a letter apart would eventually merge two real acts, which is worse
  than a visible duplicate. **Hand-removal is the right answer for these**; alphabetical
  sort puts them adjacent so you can see them.
- **Title variants** ("The Bends" / "The Bends with Foxtide") — the admin panel misses these
  because it groups on exact `normTitle`; `findpairs.js` catches them.
- **Null dates** — can't be compared by date, so date-collision logic can't flag them.
- **Venue variants** — the admin panel doesn't consider venue at all.

### Dedupe rules — what they do and don't catch
`relatedTitle()` treats two titles as the same event if one is a prefix of the other or
they share the first two words. `variantTag()` blocks merging genuinely distinct showings:
**Early Show / Late Show / All Ages / 21+ / Morning Show** are never collapsed together —
the Craig Ferguson, Reel Rock, and Halloween Silent Disco pairs are real separate events.

Does NOT catch: events with a null `starts_at`, or events whose venue can't be resolved
(e.g. sourced from "Bandsintown Boulder CO events", where `guessVenue()` yields
"Bandsintown Boulder CO" rather than the real room). Expect occasional stragglers.

`findpairs.js` keeps the **longer** title of each pair, on the theory that "Rossi with
Two. S, Jules Oskar" tells a user more than "Rossi". It is dry-run by default; `--apply`
deletes.

## Farmers Market — complete through Nov 21
Real schedule, confirmed by Lindsay:
- **Saturdays 8:00 AM – 2:00 PM**, April 4 – November 21, 2026
- **Wednesdays 3:30 – 7:30 PM**, May 6 – **October 7, 2026** (midweek market ends earlier)

Seven missing Saturdays were added and `ends_at` backfilled on all rows. Wednesdays were
already complete — Oct 7 is genuinely the last one, not a gap.

### `ends_at` now displays on event cards
The card shows "8:00 AM – 2:00 PM" when `ends_at` is set, and just the start time otherwise.
Only the farmers market uses it currently, so most cards are unchanged. Guarded against
invalid dates. On a grouped card the range only shows when every occurrence shares both times.

Worth knowing: any event with a defined run can now use this — a festival, a multi-hour event.

## Known data issues

### UNRESOLVED: an event was deleted before it happened (found Sept 14)
**Moms Unhinged**, Sept 22 at The Nomad Playhouse, vanished from the app. A title search returned
nothing — the row was gone, not merely hidden. The show is real and still weeks away.

`refresh-buckets.js` deletes events whose `starts_at` has passed, so the likely cause is a wrong
stored date. **But this was never confirmed**, and if it's systematic other future events are
being deleted the same way — silently, with no error, listings simply disappearing.

Worth investigating: log what `refresh-buckets.js` deletes on each run rather than letting it
remove rows quietly. Re-added by hand in the meantime.

Related: **The Nomad Playhouse** wasn't in `VENUE_GEO` (now added at 40.048333, -105.279941). The
admin panel's autofill draws on venues already in the database, so a brand-new venue gets nothing
useful — it fills correctly only after the first event there is saved.

1. **~54 events have `starts_at` NULL** and therefore can never appear under Today,
   Tomorrow, or This Weekend — they sit in Upcoming permanently. These are old rows from
   the retired `google_events` engine; **re-fetching cannot recover the dates**, since the
   generic queries that produced them now return zero events. Lindsay is hand-entering
   dates for the ones worth keeping. Many are already past and can simply be deleted.
2. **"Pippin"** is stored as `2026-04-17` (the parser stamped the current year on a bare
   "Apr 17"). Slated for deletion.
3. **~12 name-only titles miscategorized** as Food & Culture — see the open decision above.
4. Roughly a dozen events were **manually entered** through the admin panel (the recurring
   Boulder Farmers Market series, Wednesdays 15:30 and Saturdays 8:00, running through
   Nov 21). Gaps in that series are missing entries, not bugs — Sept 12 was absent, which
   is why This Weekend showed no Food & Culture. A script to bulk-insert a recurring series
   would save entering ~20 more by hand.
5. **Map and profile screens** (lines ~241 and ~276) still use a hardcoded
   `calc(150px + env(safe-area-inset-bottom))` bottom padding. The viewport fix helps them
   too since they share the shell, but if either cuts off at the bottom, that fixed value is
   the place to look.

## Pending, external
6. **Fortinet URL rating.** gojaney.com is categorized "Not Rated," so Fortinet-filtered networks (including Lindsay's workplace guest WiFi) block it. A re-rating request was submitted Sept 6 — review takes days to weeks. Cellular data works meanwhile.

## iOS app — LIVE on the App Store
Released around **August 5, 2026** as version 1.0.

### The app bundles its web assets — deploys do NOT reach App Store users
`~/drift-boulder/capacitor.config.json`:
```json
{
  "appId": "com.gojaney.app",
  "appName": "go janey.",
  "webDir": "dist",
  "backgroundColor": "#F5F3EF",
  "ios": { "backgroundColor": "#F5F3EF" }
}
```
There is **no `server.url`**, so Capacitor packages the built `dist` folder into the binary.
App Store users run the code as it was at submission time, not the live site.

**Consequence:** every fix from Sept 6–7 — the timezone correction, the Sunday "This Weekend"
bug, the null-date guards, the bottom-scroll cutoff, the vibe line — is live on the web but
NOT in the shipped iOS app until a new build is submitted. The Supabase data is shared, so
App Store users see current events, but rendered by August code with the August bugs.

To ship web changes to iOS:
```
npm run build
npx cap sync ios
```
then open the iOS project in Xcode, bump the build number, Archive, and upload to App Store
Connect. Processing takes ~10–30 min before the build appears as selectable.

### SUBMITTED: version 1.0.1 build 6 (Sept 8, 2026)
Uploaded and submitted for review. Contains all Sept 6–7 fixes plus the `gojaney` keyword
addition. Awaiting Apple review (typically 1–2 days).

**Web changes made after the archive are NOT in this build.** The Upcoming-tab grouping and
the address cleanup both landed after build 6 was archived, so they are live on the web only.
They ship to iOS with the next build. This gap will keep opening every time the web is
deployed — worth checking what's actually in the shipped build before assuming a fix reached
App Store users.

**What's New text submitted:** event times in Mountain time, events under the right day,
corrected categories, duplicate listings removed, scroll cutoff fixed.

**Keywords submitted** (95 chars):
```
gojaney,boulder,events,tonight,this weekend,comedy,concerts,live music,lyons,lafayette,gold hill
```

### CRITICAL GOTCHA: Info.plist was overriding the version numbers
This cost several failed archives on Sept 8. Setting Version and Build in Xcode's General
tab did nothing — every archive came out as the previous **1.0 (5)** no matter what the
General tab displayed, and three wasted archives piled up in the Organizer.

Two separate problems, both now fixed:

1. **`project.pbxproj` had `CURRENT_PROJECT_VERSION = " 6";`** — a stray leading space
   inside the quotes. Xcode's build system couldn't parse it and silently fell back.
2. **`ios/App/App/Info.plist` had the values hardcoded**, which overrides the build settings
   entirely:
   ```xml
   <key>CFBundleShortVersionString</key><string>1.0</string>
   <key>CFBundleVersion</key><string>5</string>
   ```
   Now corrected to reference the build settings:
   ```xml
   <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
   <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
   ```

**Because of fix #2, the General tab now works as expected for future builds.** But if an
archive ever shows the wrong version again, check these two files before anything else:
```
grep -n "MARKETING_VERSION\|CURRENT_PROJECT_VERSION" ios/App/App.xcodeproj/project.pbxproj
grep -n -A 2 "CFBundleShortVersionString\|CFBundleVersion" ios/App/App/Info.plist
```
Also: quit Xcode fully (Cmd+Q) after editing these files externally — it caches project
settings and won't notice the change otherwise.

### Full build-and-submit sequence
```
npm run build
npx cap sync ios
npx cap open ios
```
Then in Xcode: set Version and Build in the App target's General tab, select
**Any iOS Device (arm64)** in the scheme selector (Archive is greyed out on a simulator),
then **Product → Archive**. Verify the Organizer shows the *new* version before distributing
— it lists old archives too, and it's easy to distribute the wrong one. Then **Distribute
App → App Store Connect → Distribute**, and **Done** (not Export) when it finishes.

Allow 10–30 min for Apple to process before the build is selectable in App Store Connect.

**Known harmless warning:** "The image set 'Splash' has 3 unassigned children." It shipped
with 1.0 and passed review. Cosmetic; ignore it.

### App Store metadata
App name on the store is **"go janey."** (with the space, lowercase). Apple indexes the app
name and subtitle for search but **not the description**, so the concatenated spelling has to
go in Keywords or someone typing "gojaney" may not find the app. Keyword matching is
case-insensitive.

Keywords limit is 100 characters, comma-separated, **no spaces after commas** (they count
against the limit). Editable with each version submission, so revisit once there's real
install data rather than guessing at search behavior.

### App Store screenshots — submitted with 1.0.3 on Sept 11
Three framed promotional screenshots, **1284 × 2778** (Apple's 6.5" display):

1. **Tonight in Boulder.** — Today / Live Music feed
2. **More than music.** — This Weekend / Food & Culture
3. **Find your fun.** — Upcoming / Comedy

Each shows a different category *and* a different time filter, so the three together cover the
app without repeating. A map screenshot was made and then cut — the map isn't a strong enough
feature to lead with.

Design: Fog White `#F5F3EF` background, Poppins Medium headline in charcoal, status bar cropped
(the sage band is exactly the top 186px of an iPhone 16 Pro Max capture), rounded corners with
a soft shadow, and the final period in each headline set in amber to echo the logo. All three
use an identical fixed headline block so the phone sits at the same size and position in every
image — that's what makes a set look coordinated when someone swipes.

**SIZE TRAP:** this listing's slot is **iPhone 6.5"**, which accepts only 1242 × 2688 or
1284 × 2778. The first attempt was built at 1320 × 2868 (the 6.9" size, and the native
resolution of the iPhone 16 Pro Max captures) and was **rejected**. Don't assume the larger
size is accepted — check what slot the listing actually uses.

Apple also briefly reported "wrong format" on the PNGs. Re-saving as flattened 8-bit RGB with
metadata stripped, and supplying JPEGs (quality 95, no chroma subsampling) as an alternative,
cleared it.

Note: App Store Connect's line about "only the first 3 will be used" refers to the **install
sheet**, not a cap. Apple allows up to 10, and all appear on the product page.

### 1.0.3 (build 9) — submitted Sept 11
No functional change; build 7 already carried everything through Sept 9, and the only later
change (admin panel sign-in) is invisible to App Store users. The build exists to carry the new
screenshots. "What's New" is accordingly modest.

Builds 8 and 9 are identical — Distribute was run twice from the same archive. Build 9 was
selected.

### 1.0.4 (build 10) — uploaded Sept 16
Adds Sign in with Apple. Also carries every web change since build 9.

**What's New:** Sign in with Apple: sign in with one tap and Face ID, no email link needed.
Your saved events stay with you.

**Gotcha — trailing space in Version.** The first upload failed: `CFBundleShortVersionString,
"1.0.4 ", must be composed of one to three period-separated integers.` Typing in Xcode's General
tab left a space. Fixed in Terminal (quit Xcode first):
```
sed -i '' 's/MARKETING_VERSION = "*[ ]*1\.0\.4[ ]*"*;/MARKETING_VERSION = 1.0.4;/' ios/App/App.xcodeproj/project.pbxproj
grep -n "MARKETING_VERSION\|CURRENT_PROJECT_VERSION" ios/App/App.xcodeproj/project.pbxproj
```
Every line must end `= 1.0.4;` / `= 10;` with no quotes or spaces. **Run that grep before every
archive.** Archive needs **Any iOS Device (arm64)** selected, not the iPhone.

**Uncommitted:** the version bump in `project.pbxproj` was made after commit `db7756e`.

### 1.0.5 (builds 11 and 12) — attempted Sept 17 and Sept 18, both "Upload failed" in Xcode
Build 11 was archived Sept 17 at 6:01pm; build 12 (same version, next build number) was
archived Sept 18. **Both show "Upload failed" as their status in Xcode's Organizer window.**
Trying to distribute either one produces:
```
This bundle is invalid. The value for key CFBundleShortVersionString [1.0.5] in the
Info.plist file must contain a higher version than that of the previously approved
version [1.0.5].

Invalid Pre-Release Train. The train version '1.0.5' is closed for new build submissions
```
i.e. version 1.0.5 had **already been approved** by Apple by the time these were attempted —
meaning a 1.0.5 release must have gone out between Sept 16 and Sept 17/18 through some route
not captured in this document. **Worth confirming directly in App Store Connect what version
is currently live**, rather than assuming from the Xcode archive list alone.

**Confusing wrinkle:** despite Xcode showing build 11 as "Upload failed," App Store Connect's
own website showed that same build as **"Ready to Distribute."** Only Xcode's Distribute App
button was ever used to upload it — no Transporter, no command-line tool — so the most likely
explanation is a stale/incorrect Xcode status (the bits made it to Apple's servers, but
Xcode's own confirmation step failed or timed out locally). Since 1.0.5 was already approved,
build 11 **cannot** be attached to a new public release anyway — it would only be usable for
TestFlight testing, and wasn't used for that either. Safe to ignore; nothing was lost, since
whatever code correction build 11 carried is also in build 12/1.0.6 (see below) — both come
from the same continuously-updated `App.jsx`, and 1.0.6 was built from a fresh `git pull`
right before archiving.

### 1.0.6 (build 12) — submitted Sept 18
Carries the Sept 18 sign-in fixes above (Apple + email both working, including after an
email sign-in/out cycle) plus the redesigned sign-in screen. Version bumped straight to
1.0.6 to clear the 1.0.5 conflict with headroom.

**What's New submitted:** "Improved sign-in: fixed an issue where the email sign-in link
would open in a web browser instead of the app. Also fixed an issue where the Apple Sign In
option could disappear after signing in with email. General bug fixes and improvements."

**Status as of Sept 18:** submitted for review, awaiting Apple. Once released, confirm on a
real device that (a) the email link opens the app not Safari, and (b) the Apple button is
still present after an email sign-in/out cycle — both were the exact bugs this build fixes.

## Instagram — started Sept 14

### Where things stand
Account exists (`@gojaney`), **zero followers**, no promotion done yet. App Store analytics not
yet switched on — worth doing, it's free and already collecting.

Lindsay can give this **5 hours a week**. Bio link is set to
`https://apps.apple.com/app/id6797317287` labelled "Download free app".

### Monetization — deliberately deferred
Running costs are about **$128/month** (~$1,540/yr), SerpApi at $75 being the bulk. Covering
costs needs roughly one modest venue sponsorship — a much smaller goal than "build a business",
and worth keeping separate in the mind.

Nothing can be monetized until there's an audience. Options discussed for later: venue
subscriptions (most plausible, but a sales job), sponsored placement, affiliate ticketing
(passive, low rates), local advertising, eventual sale. Most need users first, so the order is
fixed regardless of which is chosen.

Also noted: **SerpApi may be oversized** — ~1,200 searches/month against a 5,000 allowance. The
$25 Starter plan gives 1,000. Trimming a few venue queries would save $50/month.

### The weekly plan
Three posts a week, built from the app's own data:
- **Monday** — one upcoming event worth knowing about
- **Thursday** — the weekend roundup (strongest post: useful, shareable)
- **Midweek** — category rotation

**Tagging is the growth lever.** Every post tags the venues and artists, which puts the account
in their notifications and, when reshared, in front of their followers. That's how small local
accounts grow without ad spend.

Venue handles collected so far: `@the_end_lafayette`, `@thelouisvilleunderground`,
`@license1boulderado`, `@nomadplayhouse`. **Worth compiling the rest once and reusing** — Boulder
Theater, Fox Theatre, eTown Hall, Gold Hill Inn, Oskar Blues Lyons, Nissi's, Velvet Elk, Roots
Music Project, Trident, C Bar, VisionQuest.

### On "prepare to screenshot"
The Austin reel that inspired this ends with "*prepare to screenshot*" — good for them, wrong for
us. It makes the post the destination. Ours says **"Full listings in the free app"** instead,
which points onward. The trade is real: screenshot-friendly posts get saved and shared (reach),
posts that withhold get installs (conversion). Current approach is a middle path — give enough to
be worth saving, make clear the app has the rest.

### Assets built
Templates are generated with Python/PIL — scripts are NOT in the repo, they live only in the chat
session. **If these need rebuilding, the design spec is:**
- Square posts 1080×1080; Reel/Story frames 1080×1920
- Fog White `#F5F3EF` ground, or photo with a dark gradient scrim
- Poppins (Inter isn't available in that environment — geometric where Inter is neutral, fine for
  marketing type, not an exact brand match)
- Pine `#2F5D50` top bar, sage `#8FAF9A` day headers, amber `#D9A441` logo dot
- Footer: "Full listings in the free app." + `@gojaney` left, `go janey.` right

Built so far: a comedy post (square, photo background, licensed Shutterstock mic image) and a
**four-frame weekend Reel** (Flatirons opener, Bands on the Bricks, Boulder Theater, Pearl Street
at night).

### The recurring design problem
Every route to a brighter photo costs text contrast — they're the same variable. Tried and
rejected: full-frame dark gradient (too dark), localised band behind text (visible stripe),
per-glyph shadow (weak at small sizes), cream wash with dark text (killed the photo). Landed on a
**light full-frame gradient with white Poppins**, sized up and bolded for the smaller blocks.

**Practical lesson: pick photos with a calm area.** Sky, road, water. The Boulder Theater and
Pearl Street night shots work; bright midday scenes fight the text throughout.

### Outstanding
- **The Flatirons opener photo is still a watermarked Shutterstock comp** — must be licensed
  before posting
- Lindsay wants a different photo for frame 4
- Switch to a professional Instagram account for Insights (free; Meta Verified at ~$15/month is
  not worth it at this stage)

## Original roadmap, still open

### Getting Lindsay's personal name off the App Store listing
**Status as of Sept 11 — D-U-N-S NUMBER RECEIVED:**

```
D-U-N-S Number: 149934013
Business name:  Go Janey LLC
City:           Boulder, UNITED STATES
Request ID:     102122-10926396
```

Request submitted **Sept 8** and completed the same date; D&B says the number is usable **7 days
after completion, so Sept 15.** Wait for that before contacting Apple — if Apple queries D&B
before the new record has propagated, the lookup fails and the process may have to restart. If
Apple cannot find it, wait a few more days and retry rather than assuming something is broken.

The app currently shows Lindsay's legal name as the seller/developer, because the Apple
Developer account is enrolled as an **Individual**. Per Apple's documentation, renaming the
Apple Account does not change the seller name, and individuals are not permitted to use a
fictitious or "doing business as" name. The only supported path:

1. ~~Form an LLC (Colorado)~~ — done
2. Get an EIN from the IRS
3. Obtain a **D-U-N-S Number** — free, from Dun & Bradstreet, not the state. Use Apple's
   lookup tool: **https://developer.apple.com/enroll/duns-lookup/** It first checks whether
   the business already has one assigned (common — D&B assigns them from public registration
   data). If not listed, the submit option sits *below* the "not found" message and is easy
   to miss.
4. Contact Apple Developer Support (**https://developer.apple.com/contact/**) to request
   conversion from Individual to Organization. This is **not self-service.**

The conversion updates the name shown for **existing** apps, not just new ones.

**Pitfalls hit on Sept 7:**
- Going to the *enrollment* page returns "Sorry, you can't enroll at this time — Your Apple
  Account is already associated with the Account Holder of a membership." That is expected;
  enrollment is for new accounts. The conversion is a support request, not a re-enrollment.
- The D&B captcha fails silently in Chrome for some people. **Try Safari.**
- Enter the legal business name exactly as it appears on the LLC formation documents.
  Mismatches are the main cause of delay.
- Apple's support form may ask for the app's "Apple ID" — that is the ~10-digit number in
  App Store Connect under App Information, not the Apple ID login.

**Timing:** Apple says allow up to 5 business days for the D-U-N-S number and up to 2 more
for Apple to receive it from D&B; other sources say up to 30 business days. Plan long.

**Expect friction at the last step.** A developer on Apple's forums reported that after
converting to Organization with D-U-N-S verified, the seller name still displayed their
personal name with no setting in App Store Connect to change it — it needed a support ticket.

**Not just an App Store decision.** An LLC carries tax and liability consequences. Worth
talking to a Colorado accountant or attorney.

### Everything else
1. **Real coordinates per event.** Everything currently uses Boulder center (40.015, -105.27). Needed before the map is useful.
2. **Real map.** Replace the SVG placeholder with Google Maps or Mapbox — depends on #1.
3. **Push notifications.** "Event you saved starts in 1 hour." Needs a service worker.
   Note: adding one will change the caching picture described above.
4. **Community event submissions.** Public form → staging area → admin approval. A
   `submissions` table already exists — `admin.html` line ~400 queries it for pending rows.
5. **More food events.** Google returns very few; likely needs manual curation.
6. **Feed rows are not tappable.** There is no detail view reachable from the feed; the
   existing one belongs to the Map screen. If per-event detail is wanted, this needs
   building.

## User Context
- Lindsay is not a developer — needs step-by-step guidance
- MacBook Pro; Chrome on laptop and iPhone
- Email: 255wood@gmail.com (personal), gojaneyboulder@gmail.com (app)
- GitHub: 255wood-create
- Node: /usr/local/bin/node (v24)
- Project folder: ~/drift-boulder

## Troubleshooting History
- SerpApi `google_events` engine deprecated Aug 2026 — use `engine: "google"`
- `eventSearch.js` logs `err.message`, which came through as `undefined` for SerpApi failures. To see the real error, curl the endpoint directly: `curl "https://serpapi.com/search.json?engine=google&q=test&api_key=KEY"`
- Supabase `sb_publishable` key doesn't work with the REST API; the `eyJ` legacy key doesn't work with the npm client
- Browser caching hides new deploys — Cmd+Shift+R on desktop, `?fresh=N` on iOS
- Chrome on iPhone doesn't support PWA icons — only Safari does
- Terminal heredocs truncate on long pastes — chunk them and verify
- Ad blocker once blocked Supabase connections — was removed
- Network Solutions DNS is slow to propagate
- Cron only runs when the laptop is open
- SQL goes in the Supabase SQL Editor in a browser, not the Mac Terminal. Clear the editor between queries — leftover text from a previous query will run instead.
