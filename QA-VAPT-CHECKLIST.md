# Release QA & VAPT Checklist — `feature/portal-improvements`

Run this **in a staging environment against a copy of the data — never against
production** — before promoting to `ibproduct-vibe-coding.web.app`. Real end
users are already on the live site.

## What's in this release (4 commits)

| Area | Change | Surface |
|---|---|---|
| Public FAQ | Empty sub-categories hidden; redundant "All" pill removed | `/faq` |
| Public FAQ | "All Topics" removed; lands on first populated topic; **search made global** | `/faq` |
| Backend | Audit before→after diffs; delete snapshots; `/audit-log` date range + pagination; **shared `X-Admin-Secret` retired** (gated off) | Cloud Function |
| Master admin | Audit date filter + "Load older"; full-range CSV export | `/masteradmin` |
| Admin | **Bulk CSV import** for FAQ articles (imports as drafts) | `/admin` |

---

## 0 · Staging setup (prerequisite)

- [ ] Deploy frontend to a **Firebase Hosting preview channel**: `firebase hosting:channel:deploy staging`
- [ ] Deploy the Cloud Function under a **staging name or project** pointing at a **staging Firestore** (never prod Firestore).
- [ ] Point the staging frontend at the staging function (`NEXT_PUBLIC_API_BASE`).
- [ ] Seed representative data: articles across **several topics**, at least one topic with **sub-categories that have their own articles**, some **draft** articles, tickets, and **audit entries spanning multiple days and >200 rows**.
- [ ] Have credentials for a **manager** login and the **master** login in staging.

---

## 1 · Public FAQ — end users (highest priority)

- [ ] Fresh load of `/faq` shows the **first topic (Getting Started, 21 articles)** with articles — **not** a blank page and **no "All Topics" row**.
- [ ] Clicking each top-level topic shows that topic's articles; the count in the sidebar matches the number listed.
- [ ] A topic with populated sub-categories shows sub-pills; clicking a sub narrows to its articles; empty subs are **not** shown.
- [ ] **Global search:** type a term that spans multiple topics → results include articles from **all** topics; heading reads "Search results"; count is correct.
- [ ] Clear the search → returns to the previously selected topic (not blank, not "all").
- [ ] Deep links still work: `/faq/?cat=trading` opens Trading; `/faq/?q=demat` shows global search results.
- [ ] Deep link to an **empty** sub-category (`/faq/?cat=withdrawal`) → falls back to the **parent** topic, not a blank page.
- [ ] Breadcrumb shows `Topic` / `Topic › Sub` (no "All Topics"); the topic link clears the sub filter.
- [ ] Expand an article, submit **Yes/No** feedback → still works and persists.
- [ ] Chatbot widget still returns FAQ results.
- [ ] Mobile width + **dark mode**: sidebar, search, pills, and article cards render correctly.

## 2 · Admin portal — support staff

- [ ] Login gating: `/admin` requires manager login; logged-out users cannot reach the dashboard or mutate data.
- [ ] Existing flows unaffected: **Add / edit / delete** article, reorder, status toggle, tickets, categories, feedback.
- [ ] **Download Template** produces a valid CSV with `title,category,content,status`.
- [ ] **Import CSV — happy path:** upload a small valid file → preview shows "N ready", confirm → progress bar → summary "N added"; the articles appear in the list as **drafts**.
- [ ] Imported drafts do **NOT** appear on the public `/faq` until published.
- [ ] **Duplicates:** a row whose title matches an existing article (published *or draft*) is skipped and listed under skipped rows.
- [ ] **Malformed input:** content with embedded commas/quotes/newlines imports intact; missing required columns is rejected with a clear message; empty file rejected.
- [ ] **Caps:** a file with >2000 rows is rejected; a file >8 MB is rejected.
- [ ] **Partial failure:** include one row the server will reject (e.g. over-length content) → it's reported in the failure summary and the rest still import.
- [ ] Session expiry mid-import → redirected to login cleanly, no half state.

## 3 · Master admin — oversight

- [ ] Login gating: `/masteradmin` requires the master session.
- [ ] Audit tab lists recent entries; clicking one shows detail incl. **before→after `changes`** for an edited article/category and a **`deleted` snapshot** for a delete.
- [ ] **Date filter:** set From/To → list narrows to that range; entries near local midnight are on the correct day (IST).
- [ ] **Load older entries:** button appears when more exist, loads older rows, and does **not** duplicate rows; disappears when history is exhausted.
- [ ] **Load older with an active action/text filter** that matches nothing loaded → the button is still shown so older history can be pulled in.
- [ ] **Export CSV** downloads the **full** date-range history (not just the rows on screen); open the file and confirm the row count.
- [ ] Other tabs (managers, tickets, feedback, analytics, categories) unaffected.

## 4 · Backend / API

- [ ] `GET /faq/search` and `GET /faq` behave as before for the public.
- [ ] Every admin mutation still writes an audit record; the master admin sees it.
- [ ] `GET /audit-log?from=&to=&before=&limit=` returns a JSON array, newest first, correctly bounded; `limit=-5` and `limit=abc` do **not** 500 (clamped).
- [ ] Confirm **no missing-index error** in Cloud Function logs for the manager audit path (uses the existing `performedBy, timestamp` index).
- [ ] Article/category **content is unchanged** by this release (spot-check a few docs before/after deploy).

## 5 · Security / VAPT

- [ ] **Retired shared secret:** with `ALLOW_LEGACY_ADMIN_SECRET` unset, a request carrying only `X-Admin-Secret` is **rejected (401)** on every mutating endpoint; the admin portal (manager JWT) and master-token auth **still work**.
- [ ] Temporarily set `ALLOW_LEGACY_ADMIN_SECRET=true` → the secret works again and its actions audit as **`admin (legacy secret)`**. Unset it again for go-live.
- [ ] **CSV import authZ:** the import calls (`POST /faq`) fail without a valid manager token; a logged-out/expired session cannot import.
- [ ] **XSS:** import an article whose content/title contains `<script>` and HTML → it renders as **escaped text** on `/faq`, never executes.
- [ ] **CSV formula injection:** import content starting with `=`, `+`, `@`; later **export** from master admin and open in Excel → confirm your risk posture (audit `meta` serialises as JSON; `entityTitle`/article export is pre-existing behaviour — decide if formula-prefixing on export is needed).
- [ ] **Input validation:** over-length content, invalid status, and empty fields are rejected server-side (per-row for import).
- [ ] **Rate limiting / DoS:** confirm the import's sequential uploads don't trip or bypass any API rate limit; a huge file is blocked client-side by the caps.
- [ ] Security headers (CSP, HSTS, X-Frame-Options, `noindex` on `/admin` `/masteradmin`) unchanged after deploy.
- [ ] No secrets in the client bundle (`grep -ri "ADMIN_SECRET\|JWT_SECRET" out/` returns nothing meaningful).

## 6 · Cross-cutting

- [ ] Responsive (mobile/tablet/desktop) and **light + dark** themes across all three surfaces.
- [ ] **Deploy-skew safety:** if only the frontend deploys first, `/masteradmin` audit still loads (date filter just no-ops until the function deploys); if only the function deploys, the public site is unaffected. Prefer deploying **frontend + function together**.
- [ ] Basic a11y: keyboard focus visible; new buttons have accessible labels/titles.

## 7 · Go-live runbook

1. [ ] **Back up Firestore** (`gcloud firestore export`) before deploying.
2. [ ] Confirm `ALLOW_LEGACY_ADMIN_SECRET` is **unset** (or intentionally `true` if an integration still needs it — verify first).
3. [ ] Deploy **frontend + Cloud Function together** to prod.
4. [ ] Smoke test on prod: `/` FAQ loads on a topic, global search works, chatbot works, `/admin` and `/masteradmin` login, one audit entry shows before→after, a 1-row CSV import lands as a draft.
5. [ ] Watch Cloud Function logs for errors (esp. Firestore index/query errors) for the first 15–30 min.
6. [ ] **Rollback plan:** redeploy the previous frontend build + previous function revision (`gcloud functions deploy ... ` from the prior commit, or `gcloud run revisions` rollback for gen2). Keep the prior commit hash handy.

## 8 · Known low-risk items (accepted, from code review)

- Audit "Load older" / export can omit rows only if **more than one page-size of entries share the exact same millisecond timestamp** at a boundary — not expected for sequential audit writes. Export is also capped at 20,000 rows per download.
- `setAuditHasMore` is called inside a state updater (harmless; dev-only double-invoke is idempotent).

---

# Release 2 — CSV import hardening, draft visibility, bulk actions, FAQ cache

Commits `cee2e2d`..`HEAD`. Written after the incident where a 100-row import
appeared to do nothing: 310 articles across 4 categories were invisible in both
portals because the admin fetched `GET /faq` unauthenticated and the endpoint
returns published articles only to anonymous callers.

**Automated coverage that already exists** (run before staging, no environment
needed): `tsc --noEmit`, `eslint`, `next build`, `node --check gcp/index.mjs`,
25 CSV-parser cases and 12 FAQ-cache cases extracted from the live source.
**Everything below is runtime behaviour that no automated check covers.**

## R2 · 1 — Draft visibility

- [ ] Admin stat cards show Total = Published + Drafts, and the three numbers reconcile with a Firestore count.
- [ ] `Status → Draft` lists drafts; a draft never appears on public `/faq`.
- [ ] Amber banner appears when any draft exists, states the library-wide count, and is NOT hidden by an active category/status filter.
- [ ] Unpublish an article via the toggle, refresh — it is still listed (as a draft), not vanished.
- [ ] An article with legacy `status: active` / `approved` / no status field is treated as published in both portals AND on public `/faq`.
- [ ] Master admin FAQ list, Total/Published cards and CSV export all include drafts.

## R2 · 2 — CSV import

- [ ] **Blank status column:** upload a file whose `status` column exists but is empty on every row → preview warns, shows the live/draft split as counts, and offers the draft/published choice. Both choices produce the stated result.
- [ ] Mixed file (some rows `published`, some blank) → counts split correctly.
- [ ] Semicolon-delimited and tab-delimited files import; the preview says which delimiter it used.
- [ ] Excel "CSV UTF-8" export (has a BOM) imports without a "needs title, category and content columns" error.
- [ ] Two rows with the same title → second is reported as `Same title as row N in this file`, not "Already exists".
- [ ] Titles differing only by case or internal whitespace are treated as duplicates.
- [ ] A row whose category is not an existing category → preview names it as a new category.
- [ ] An invalid `status` value is reported in the preview, not as an HTTP 400 per row.
- [ ] Re-import an existing file with **Update them** → content is overwritten, and a live article is NOT unpublished.
- [ ] **Download skipped rows** produces a valid CSV with a `reason` column that re-imports after correction.
- [ ] **Stop after the current row** halts the batch; result modal says it stopped; re-importing the same file completes the remainder.
- [ ] Close the tab mid-import → browser warns first.
- [ ] Session expiry mid-import → clean redirect to login, no half state.
- [ ] Row numbers in the preview and failure list match the actual spreadsheet lines (test with blank lines in the file).
- [ ] Duration estimate appears for a large batch and is roughly accurate.
- [ ] **500-row import** completes; created count matches; `importBatch` is stamped on every new document. *(Never yet run at this size.)*
- [ ] Per-category `sortOrder` after two consecutive imports into different categories: no overlapping values.

## R2 · 3 — Bulk actions

- [ ] `Publish all N` only appears under `Status → Draft`; publishes exactly the listed set; confirm dialog names count and filters.
- [ ] `Unpublish all N` only under `Status → Published`; reversible.
- [ ] `Delete all N` is **invisible** with no filter active, **invisible** to a plain manager login, visible to master admin only.
- [ ] Delete confirm requires typing the exact count; a wrong number leaves the button disabled.
- [ ] Deleted articles appear in the audit log with a full `deleted` snapshot including content.
- [ ] Closing the tab mid-bulk warns first.

## R2 · 4 — Public FAQ cache (new)

- [ ] `GET /faq` latency drops substantially on the second call within 60s.
- [ ] Publish an article → it appears on public `/faq` within 60s **and** immediately on the instance that served the write.
- [ ] **Unpublish or delete an article → confirm it disappears from public `/faq` within 60s.** Caches are per-container and `invalidateArticleCache()` only clears the writing instance, so the TTL is the worst-case window for withdrawing content. Verify the bound and confirm 60s is acceptable to compliance.
- [ ] An authenticated `GET /faq` is never served from cache — import an article and immediately reload the admin.
- [ ] `?category=X` filtering still works and does not corrupt later unfiltered responses.

## R2 · 5 — Security / VAPT

- [ ] The public cache can never contain a draft, regardless of who warmed it (covered by unit test; confirm in staging).
- [ ] Bulk delete: a plain manager cannot reach it in the UI. **Note the API still permits single-article DELETE for any manager** — decide whether `DELETE /faq/{id}` needs a server-side role check, given `AUTO_PROVISION_MANAGERS=true` makes any verified @indiabulls.com Google account a manager on first login.
- [ ] `POST /faq` returns 409 on a duplicate title; the importer reports it per row rather than failing the batch.
- [ ] Import an article whose title/content contains `<script>` → renders as escaped text on `/faq`.
- [ ] **CSV formula injection:** import content beginning with `=`, `+`, `@`; export via *Download skipped rows* and via master admin *Export CSV*; open both in Excel → cells must show the literal text, not a computed value.
- [ ] `importBatch` cannot be used to inject unbounded data (sanitised, 64 chars).
