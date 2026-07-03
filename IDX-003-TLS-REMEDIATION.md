# IDX-003 — Weak TLS / CBC ciphers on the API endpoint

**Finding class:** CWE-327 (weak crypto), LUCKY13 / BREACH family. Rated **LOW** in the
Infopercept WAPT (ICPL2026/460/1). This doc covers the `ibproduct-vibe-coding`
(vibe) deployment.

## What was observed (2026-07-03, black-box)

The API is called by the frontend directly at its Cloud Function URL:

```
https://asia-south1-ibproduct-vibe-coding.cloudfunctions.net/ib-faq-handler
```

That host (Google-managed `cloudfunctions.net`) **accepts legacy TLS and CBC ciphers**:

```
$ echo | openssl s_client -connect asia-south1-ibproduct-vibe-coding.cloudfunctions.net:443 -tls1
    Protocol : TLSv1              # TLS 1.0 accepted
    Cipher   : ECDHE-RSA-AES128-SHA   # CBC + HMAC-SHA1  (LUCKY13/BREACH class)
```

The Firebase Hosting frontend (`*.web.app`) already rejects TLS < 1.2, but will
still negotiate a CBC cipher at TLS 1.2 if a client offers only those. TLS
version and cipher selection on `cloudfunctions.net` / `web.app` are
**Google-managed and NOT configurable** per-service — you cannot set an SSL
policy on the raw endpoints. The only way to enforce a modern cipher suite is to
put the service behind a **Google Cloud external HTTPS Load Balancer** and attach
an **SSL policy**.

## Decision: accept-risk vs. remediate

| Option | When it's the right call |
|---|---|
| **A — Accept-risk** | Reasonable for vibe. Likelihood is LOW: forward secrecy (ECDHE) is present, all modern browsers negotiate TLS 1.3 / AEAD, and downgrade to TLS 1.0+CBC requires an active MITM. Document the acceptance and move on. |
| **B — Front with GCLB + SSL policy** | Do this if vibe needs a custom domain anyway, or if compliance requires the finding formally closed. Disables TLS < 1.2 and all CBC ciphers. Same infra pattern already used for `uat-support.indiabullssecurities.com`. |

> On raw `*.web.app` / `*.cloudfunctions.net` there is **no third option** — you
> cannot "just turn off" TLS 1.0/CBC without the load balancer.

---

## Option B — runbook (DevOps, run in the `ibproduct-vibe-coding` project)

Fronts the Cloud Function with an HTTPS LB via a **serverless NEG**, attaches a
**RESTRICTED** SSL policy (TLS 1.2 min, GCM-only — no CBC), and serves it on a
custom API domain. Adjust names/region/domain to taste.

```bash
export PROJECT=ibproduct-vibe-coding
export REGION=asia-south1
export FN=ib-faq-handler
export API_DOMAIN=vibe-api.indiabullssecurities.com   # <-- your chosen API host
gcloud config set project "$PROJECT"

# 1. Serverless NEG pointing at the Cloud Function (Gen2)
gcloud compute network-endpoint-groups create ib-faq-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-run-service="$FN" || \
gcloud compute network-endpoint-groups create ib-faq-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-function-name="$FN"
# NOTE: Gen2 functions run on Cloud Run — use --cloud-run-service if the
#       --cloud-function-name form is rejected.

# 2. Backend service + attach the NEG
gcloud compute backend-services create ib-faq-backend \
  --global --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend ib-faq-backend \
  --global --network-endpoint-group=ib-faq-neg \
  --network-endpoint-group-region="$REGION"

# 3. SSL policy — RESTRICTED (TLS 1.2 min, no CBC). Use MODERN if a client needs CBC.
gcloud compute ssl-policies create ib-tls-restricted \
  --profile=RESTRICTED --min-tls-version=1.2

# 4. Reserved IP + Google-managed cert
gcloud compute addresses create ib-faq-ip --global
gcloud compute ssl-certificates create ib-faq-cert \
  --global --domains="$API_DOMAIN"

# 5. URL map -> target HTTPS proxy (with SSL policy) -> forwarding rule
gcloud compute url-maps create ib-faq-urlmap --default-service ib-faq-backend
gcloud compute target-https-proxies create ib-faq-proxy \
  --url-map=ib-faq-urlmap --ssl-certificates=ib-faq-cert \
  --ssl-policy=ib-tls-restricted
gcloud compute forwarding-rules create ib-faq-fr \
  --global --target-https-proxy=ib-faq-proxy \
  --ports=443 --address=ib-faq-ip

# 6. DNS: point $API_DOMAIN A record at the reserved IP
gcloud compute addresses describe ib-faq-ip --global --format='value(address)'
```

Managed-cert provisioning takes ~15–60 min after DNS resolves.

### App changes to route through the LB (in this repo)

Once `https://$API_DOMAIN/ib-faq-handler` serves 200, repoint the app off the raw
function URL:

1. **`.github/workflows/deploy.yml`** — set the build-time API base to the LB:
   `NEXT_PUBLIC_API_BASE=https://vibe-api.indiabullssecurities.com/ib-faq-handler`
2. **`firebase.json`** — update CSP `connect-src` from
   `https://asia-south1-ibproduct-vibe-coding.cloudfunctions.net` to
   `https://vibe-api.indiabullssecurities.com`.
3. **`gcp/.env.yaml`** — add the new origin(s) to `ALLOWED_ORIGINS` if the API
   host differs from the site host.

### Verify closure

```bash
# TLS 1.0/1.1 must now FAIL:
echo | openssl s_client -connect vibe-api.indiabullssecurities.com:443 -tls1_1   # expect: handshake failure
# CBC-only offer must FAIL:
echo | openssl s_client -connect vibe-api.indiabullssecurities.com:443 -tls1_2 \
  -cipher 'AES128-SHA:ECDHE-RSA-AES128-SHA'                                        # expect: no cipher / handshake failure
# API still works:
curl -s -o /dev/null -w '%{http_code}\n' https://vibe-api.indiabullssecurities.com/ib-faq-handler/faq   # expect 200
```

## Cleanup teardown (if you built B for testing and want to revert)

```bash
gcloud compute forwarding-rules delete ib-faq-fr --global -q
gcloud compute target-https-proxies delete ib-faq-proxy -q
gcloud compute url-maps delete ib-faq-urlmap -q
gcloud compute backend-services delete ib-faq-backend --global -q
gcloud compute network-endpoint-groups delete ib-faq-neg --region="$REGION" -q
gcloud compute ssl-certificates delete ib-faq-cert --global -q
gcloud compute ssl-policies delete ib-tls-restricted -q
gcloud compute addresses delete ib-faq-ip --global -q
```
