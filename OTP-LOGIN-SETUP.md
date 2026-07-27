# Admin / Master-Admin Login — Setup & Rollout

Admin and master-admin sign in with **"Sign in with Google"** using their
official **@indiabulls.com** Google Workspace account. Every audited action is
attributed to that email. This is **additive** — the old username/password and
master-password logins still work as a fallback until you retire them, so no
one is locked out during rollover.

> There is also a legacy email-OTP path in the backend (`/auth/request-otp`,
> `/auth/verify-otp`) that needs a corporate SMTP relay. It is **not** used by
> the login UI anymore — Google SSO replaced it — so you can ignore SMTP.

## 1. Create the Google OAuth client (you can do this — you're project Owner)

In the **GCP Console**, project `ibproduct-vibe-coding`:
1. **APIs & Services → OAuth consent screen** → **Internal** user type → app name (e.g. "Support Portal Admin") + your support email → save.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → **Web application**.
3. **Authorized JavaScript origins:**
   - `https://ibproduct-vibe-coding.web.app`
   - `http://localhost:3000` (local dev)
   - (add your staging channel origin if you use one)
4. Create → copy the **Client ID** (`…apps.googleusercontent.com`). It is **not secret**.
5. If creation is blocked by an org OAuth-app policy, ask your Google Workspace admin to approve this app — the only possible cross-team step.

## 2. Wire the Client ID in (two non-secret spots)

- **Frontend (build):** GitHub → repo **Settings → Secrets and variables → Actions → Variables → New variable** → name `GOOGLE_CLIENT_ID`, value = the client id. (The deploy workflow injects it as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.)
- **Backend:** set `GOOGLE_CLIENT_ID` in `gcp/.env.yaml` to the same value, then commit + push.

Until both are set, the login page shows "Google sign-in isn't configured yet" and everyone uses the password/master-password fallback (nothing breaks).

## 3. Provision who is allowed (the allow-list)

A valid @indiabulls.com Google account grants nothing on its own — the email
must be an **active manager** (role `manager`) or **master admin** (role
`masteradmin`) in the master-admin **Manager Accounts** screen, and the
`email` must be their real @indiabulls.com address (stored lowercased).

- `sumit.bagewadi@indiabulls.com` is **seeded** as master admin (via
  `OTP_SEED_MASTERS`) so the first master login isn't locked out. Add everyone
  else via the Managers screen (role Manager or Master Admin), then you can
  remove the seed.

## 4. Test in staging (before prod)

```bash
npm ci && npm run build     # with NEXT_PUBLIC_GOOGLE_CLIENT_ID set
firebase hosting:channel:deploy staging --project ibproduct-vibe-coding
# deploy the function to a staging name (with GOOGLE_CLIENT_ID in its env)
```
On the staging URL:
- [ ] `/masteradmin` → "Sign in with Google" → pick `sumit.bagewadi@indiabulls.com` → you're in.
- [ ] A non-@indiabulls.com Google account is rejected ("Sign in with your @indiabulls.com account").
- [ ] An @indiabulls.com account **not** provisioned is rejected ("not authorised — ask a master admin").
- [ ] After login, an edit → the **Audit Log "Performed by" shows the email**, not `masteradmin`/`mgr_…`.
- [ ] `/admin` → a provisioned manager signs in with Google and can manage articles/tickets.
- [ ] Break-glass: the "Use master password / Sign in with password" toggle still works.

## 5. Go-live

Deploy frontend + function together after a Firestore backup. The client id is
public, so there are no secrets to rotate for this feature.

## 6. Retire the fallbacks (after SSO is proven in prod)

- Remove the username/password + master-password fallback UI once everyone uses SSO.
- Unset `MASTER_ADMIN_SECRET` to disable the shared master password.
- Optionally drop the OTP endpoints and the SMTP secrets/config (`SMTP_*`) from the deploy — they're unused by SSO.

## Security notes
- We verify the Google ID token's signature/expiry (via Google), then enforce
  **audience = our client id** (so a token minted for another app is rejected),
  `email_verified`, and the **@indiabulls.com** hosted domain — then the
  allow-list. Google handles the password + 2FA; we never see credentials.
- Master session tokens carry the email, so master actions are individually
  attributable in the audit log.
