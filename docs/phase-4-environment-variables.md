# CloudQuiz — Phase 4: Production Environment Variables Reference

This document provides a comprehensive inventory of all environment variables used across CloudQuiz, detailing their scope, sensitivity level, hosting target, and validation constraints.

---

## 1. Variable Inventory by Hosting Target

### A. Backend Variables (Configured exclusively in Railway)

| Variable Name | Required | Sensitivity | Default / Example | Validation Constraints | Description |
|---|---|---|---|---|---|
| `PORT` | Auto | Internal | `4000` (Local) / Auto (Railway) | Integer | Port on which the HTTP server listens. Railway provides this automatically. |
| `NODE_ENV` | Yes | Non-sensitive | `production` | `'development' \| 'production' \| 'test'` | Sets execution environment; controls error formatting and cookie defaults. |
| `API_PREFIX` | No | Non-sensitive | `/api/v1` | String starting with `/` | Global prefix for all REST API endpoints. |
| `DATABASE_URL` | Yes | **HIGH SECRET** | `postgresql://...` | Valid PostgreSQL URI | Primary PostgreSQL database connection string with credentials. |
| `CORS_ORIGIN` | Yes | Non-sensitive | `https://cloudquiz.vercel.app` | Comma-separated URLs | Allowed origins for cross-domain REST requests and Socket.IO handshakes. |
| `JWT_SECRET` | Yes | **HIGH SECRET** | Cryptographic random string | String (min 32 characters) | Secret key used to sign and verify Host authentication JWT tokens. |
| `JWT_EXPIRES_IN` | No | Non-sensitive | `7d` | Valid ms/timespan string | Expiration duration for Host JWT tokens. |
| `CSRF_SECRET` | Yes | **HIGH SECRET** | Cryptographic random string | String (min 16 characters) | Secret key used to generate HMAC signatures for CSRF double-submit cookies. |
| `COOKIE_SECRET` | Yes | **HIGH SECRET** | Cryptographic random string | String (min 16 characters) | Secret key used by `cookie-parser` to sign and tamper-proof HTTP cookies. |
| `COOKIE_SECURE` | Yes | Non-sensitive | `true` | Boolean (`'true'` or `'false'`) | Enforces HTTPS-only cookie transmission. Required for production cross-site cookies. |
| `COOKIE_SAME_SITE` | Yes | Non-sensitive | `none` (Production) / `lax` (Dev) | `'lax' \| 'strict' \| 'none'` | Cookie SameSite policy. Must be `none` when frontend and backend use different domains. |
| `REDIS_URL` | No | **SECRET** | Omitted | Optional string | Redis connection string. **Omitted in Phase 4** to eliminate unnecessary infrastructure cost. |

### B. Frontend Variables (Configured exclusively in Vercel)

| Variable Name | Required | Sensitivity | Example | Validation Constraints | Description |
|---|---|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | **PUBLIC** | `https://backend.up.railway.app/api/v1` | Valid HTTPS URL | Base URL for Axios HTTP REST calls made from the user's browser. |
| `VITE_SOCKET_URL` | Yes | **PUBLIC** | `https://backend.up.railway.app` | Valid HTTPS / WSS URL | Base URL for Socket.IO real-time WebSocket connections. |

---

## 2. Security Separation Rules

1. **Client-Side Secret Isolation**: Variables prefixed with `VITE_` are embedded into the client-side JavaScript bundle and downloaded by all site visitors.
   - **RULE**: **NEVER** prefix database credentials, JWT secrets, or administrative API keys with `VITE_`.
   - **RULE**: `DATABASE_URL`, `JWT_SECRET`, and `CSRF_SECRET` must **never** be added to Vercel environment variables.
2. **Cross-Site Cookie Security**: When the frontend is hosted on `*.vercel.app` and backend is hosted on `*.railway.app`:
   - Browsers classify these domains as cross-site.
   - For cookies to be accepted by modern browsers (Chrome, Safari, Firefox), the server must issue cookies with:
     ```
     SameSite=None; Secure
     ```
   - If `COOKIE_SECURE=false` while `COOKIE_SAME_SITE=none`, modern browsers will reject the cookie outright.
3. **Secret Generation**: Production secrets should be generated using a cryptographically secure random source:
   ```bash
   # Generate 32-byte hexadecimal secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
