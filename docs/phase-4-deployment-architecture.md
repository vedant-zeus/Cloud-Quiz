# CloudQuiz — Phase 4: Production Deployment Architecture (100% Free Forever Stack)

## 1. System Overview

CloudQuiz is deployed under a **Strict $0.00 Budget (Zero Dollars)** using high-availability, perpetual free-tier providers that require **zero credit card commitment and zero risk of unexpected billing**:

```
                             [ USER BROWSERS ]
                     ┌──────────────────────────────┐
                     │ Host Admin / Student Players │
                     └───────┬──────────────┬───────┘
                             │              │
                HTTPS (SPA)  │              │ WSS / HTTPS (REST)
                             ▼              │
    ┌────────────────────────────────┐      │
    │         VERCEL (Edge)          │      │
    │  - React 18 + Vite SPA         │      │
    │  - 100% Free Hobby Tier        │      │
    │  - 100 GB Bandwidth / Month    │      │
    │  - Automatic HTTPS Certificates│      │
    │  - SPA Rewrites (vercel.json)  │      │
    └────────────────────────────────┘      │
                                            ▼
                     ┌────────────────────────────────────────┐
                     │         RENDER.COM (PaaS)              │
                     │  - Free Web Service (Node.js 22 LTS)   │
                     │  - Persistent Socket.IO over WSS       │
                     │  - Authoritative Scoring Engine        │
                     │  - Blueprint Config (render.yaml)      │
                     │  - Liveness Health Probe (/health)     │
                     └──────────────────┬─────────────────────┘
                                        │
                                        │ SSL Encrypted PostgreSQL
                                        │ Connection (Port 5432)
                                        ▼
                     ┌────────────────────────────────────────┐
                     │       NEON.TECH / SUPABASE             │
                     │  - 100% Free Managed PostgreSQL 16     │
                     │  - 500 MB Persistent Storage           │
                     │  - Automated Prisma Migrations         │
                     │  - Zero Card Required, No Overages     │
                     └────────────────────────────────────────┘
```

---

## 2. Infrastructure Components ($0.00 Cost)

### A. Frontend: Vercel (Hobby Tier)
- **Cost**: **$0.00 / month forever** (No credit card required).
- **Domain**: `https://<your-project>.vercel.app` (Free SSL certificate included).
- **Routing**: `apps/frontend/vercel.json` provides SPA rewrites mapping `/(.*)` to `/index.html` to prevent 404s on browser refreshes.
- **Security Headers**: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

### B. Backend: Render (Free Web Service)
- **Cost**: **$0.00 / month forever** (No credit card required).
- **Runtime**: Node.js 22 LTS with Express & Socket.IO.
- **WebSockets**: Render natively supports persistent WebSockets over `wss://` on the free tier.
- **Sleep Behavior**: Inactive services spin down after 15 minutes of idle time and automatically wake up in ~30–45 seconds upon receiving the first HTTP request. (During active quiz events, continuous WebSocket pings and gameplay keep the service fully active).
- **Automated Blueprint**: `render.yaml` automatically configures the build command, start command, health check (`/health`), and generates cryptographic secrets.

### C. Database: Neon.tech or Supabase (Free Tier)
- **Cost**: **$0.00 / month forever** (No credit card required).
- **Engine**: PostgreSQL 16.
- **Capacity**: 500 MB storage (easily supports hundreds of quiz sessions and thousands of student participant answers).
- **Prisma Compatibility**: Compatible with `prisma migrate deploy`. Prisma client connects over TLS with `?sslmode=require`.

### D. Alternative: Railway
- Railway configuration is preserved in `railway.json` if operators possess Railway educational or trial credits.

---

## 3. Cross-Domain Security & Cookies

- **CORS Allowlist**: `CORS_ORIGIN` is configured to the exact Vercel URL (`https://<project>.vercel.app`).
- **Cross-Site Cookies**: `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none` allow modern browsers to transmit authentication cookies across Vercel and Render domains.
- **Token Header Fallback**: The client automatically sends `Authorization: Bearer <token>` and `x-participant-token` in HTTP headers, guaranteeing authentication even if third-party cookies are blocked by strict browser privacy settings.
