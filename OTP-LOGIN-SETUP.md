# Email-OTP Login — Setup & Staging Rollout

Admin and master-admin sign in with their **official @indiabulls.com email + a
6-digit one-time code**, and every audited action is attributed to that email.
This is **additive** — the old username/password and master-password logins
still work as break-glass until you retire them (below), so no one is locked
out during rollover.

**Do the staging steps first — never test auth changes straight on production.**

## 1. Provision the SMTP relay (required — OTP can't send without this)

The Cloud Function reads SMTP config from env + Secret Manager.

**Non-secret config** — already in `gcp/.env.yaml`; set the real relay host:
```yaml
OTP_ALLOWED_DOMAIN: "indiabulls.com"
OTP_FROM_ADDR: "no-reply@indiabulls.com"   # a mailbox your relay may send as
OTP_SEED_MASTERS: "sumit.bagewadi@indiabulls.com"
SMTP_PORT: "587"                            # 587 STARTTLS, or 465 implicit TLS
SMTP_HOST: "<your-corporate-relay-host>"    # ← set this
```

**Secrets** — create in Secret Manager:
```bash
PROJECT=ibproduct-vibe-coding
printf '%s' '<smtp-username>' | gcloud secrets create SMTP_USER --data-file=- --project "$PROJECT"
printf '%s' '<smtp-password>' | gcloud secrets create SMTP_PASS --data-file=- --project "$PROJECT"

# Let the function's runtime SA read them (same SA used for JWT_SECRET etc.):
RUNTIME_SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
for S in SMTP_USER SMTP_PASS; do
  gcloud secrets add-iam-policy-binding "$S" --project "$PROJECT" \
    --member="serviceAccount:$RUNTIME_SA" --role="roles/secretmanager.secretAccessor"
done
```
The deploy workflow already mounts `SMTP_USER`/`SMTP_PASS` into the function.

> If SMTP isn't configured, `/auth/request-otp` returns 503 ("Login email is
> not configured yet") — the old logins still work, so this is safe to defer.

## 2. Provision who is allowed (the allow-list)

A valid @indiabulls.com email grants nothing on its own — the email must be an
**active manager** (role `manager`) or **master admin** (role `masteradmin`) in
the `managers` collection, set via the master-admin **Manager Accounts** screen.
Each manager's `email` must be their real @indiabulls.com address.

- `sumit.bagewadi@indiabulls.com` is **seeded** as master admin (via
  `OTP_SEED_MASTERS`) so the very first master login isn't locked out. Add the
  rest through the Managers screen, then you can remove the seed.

## 3. Staging test (before prod)

```bash
npm ci && npm run build
firebase hosting:channel:deploy staging --project ibproduct-vibe-coding
# deploy the function to a staging name pointing at a staging Firestore, OR a
# separate staging project, with the SMTP secrets above.
```
Then, on the staging URL:
- [ ] `/masteradmin` → enter `sumit.bagewadi@indiabulls.com` → **receive the code by email** → verify → you're in.
- [ ] A non-`@indiabulls.com` email is rejected at step 1.
- [ ] An @indiabulls.com email that is **not** provisioned gets the generic "if authorised, a code has been sent" and **no email arrives** (no account enumeration).
- [ ] Wrong code / expired code (>10 min) / 6th attempt all fail cleanly.
- [ ] After login, perform an edit → the **Audit Log entry's "Performed by" shows the email**, not `masteradmin`/`mgr_…`.
- [ ] `/admin` → provision a manager with an @indiabulls.com email → that email can OTP-log-in; the manager JWT works for article/ticket actions.
- [ ] Break-glass: the "Trouble receiving the code?" toggle still logs in via password / master password.
- [ ] Rate limits: 6th OTP request in a minute from one IP is throttled (429).

## 4. Go-live

Deploy frontend + function together (they're coupled), after a Firestore
backup. Watch the function logs for `OTP send failed` / SMTP errors.

## 5. Retire the fallbacks (after OTP is proven in prod)

Once every admin/master has an email set and has logged in via OTP:
- Remove the `ALLOW_LEGACY_ADMIN_SECRET` path usage (already off by default).
- Retire the shared master password: unset `MASTER_ADMIN_SECRET` (masterlogin
  then returns 503) — do this only after confirming OTP master login works.
- Optionally remove the username/password fallback UI + `/auth/login`.

## Security notes
- Codes are stored **hashed** (scrypt) with a 10-minute expiry, single-use, and
  a 5-attempt cap; requests are rate-limited per IP and per email.
- The response to `/auth/request-otp` is identical whether or not the email is
  registered, to prevent account enumeration.
- Master session tokens now carry the email so master actions are individually
  attributable in the audit log.
