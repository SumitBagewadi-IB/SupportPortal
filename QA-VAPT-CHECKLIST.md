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
