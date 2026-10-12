# CloudQuiz — Phase 4: Production Security & Compliance Checklist

This security checklist documents the protection mechanisms, threat mitigations, and compliance verifications implemented across CloudQuiz.

---

## 1. Network & Transport Security

- [x] **Enforced HTTPS**: All browser traffic to the Vercel frontend is encrypted over TLS 1.3 via Let's Encrypt automated certificates.
- [x] **Enforced WSS**: All Socket.IO real-time traffic connects over secure WebSockets (`wss://`) terminated by Railway edge proxies.
- [x] **Zero Plaintext Fallbacks**: Insecure HTTP requests are automatically redirected to HTTPS.
- [x] **Private Database Networking**: PostgreSQL database is addressed over Railway's private internal network (`postgres.railway.internal`), preventing database ports from being exposed to the public Internet.

---

## 2. Authentication, Session & Token Security

- [x] **Password Protection**: Host passwords are hashed using `bcrypt` with 10 salt rounds before persistence. Plaintext passwords are never logged or stored.
- [x] **JWT Token Signing**: Authentication tokens are signed with HMAC-SHA256 using a minimum 32-character secret key.
- [x] **Participant Token Hashing**: Participant join tokens are generated cryptographically and persisted strictly as SHA-256 hashes (`joinTokenHash`). Compromise of the database cannot reveal valid participant sessions.
- [x] **Cross-Site Cookie Hardening**: HTTP cookies feature `HttpOnly`, `Secure=true`, and `SameSite=None` attributes, preventing XSS-based theft.
- [x] **CSRF Mitigation**: Mutating REST operations require an HMAC-signed `X-CSRF-Token` header, validated using timing-safe comparisons.

---

## 3. Cheating Prevention & Gameplay Integrity

- [x] **Server-Side Scoring**: Answer correctness, scoring formulas, time-penalty deductions, and leaderboard ranks are calculated strictly on the backend. Client-submitted scores or correctness flags are rejected.
- [x] **Zero Premature Answer Disclosure**: Active question broadcasts (`question:started`) strictly omit `correctAnswer`. The correct answer index is revealed to participants only after the question is officially closed.
- [x] **Deadline Enforcement**: Server validates answer submission timestamps against absolute database deadlines (`questionDeadline`). Late submissions are rejected by the server.
- [x] **Duplicate Submission Lock**: PostgreSQL unique constraints (`@@unique([participantId, questionId])`) and atomic transactions prevent players from submitting multiple answers or gaining duplicate points.

---

## 4. Input Validation, Injection Defense & Data Protection

- [x] **Zod Schema Validation**: All REST request bodies and Socket.IO event payloads are validated against strict Zod schemas before processing.
- [x] **SQL Injection Defense**: All database access is mediated by Prisma ORM prepared statements, eliminating SQL injection vectors.
- [x] **CSV Formula Injection Mitigation**: All user-contributed text (participant display names, quiz titles) exported to CSV is sanitized. Fields starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with `'` to prevent command execution in spreadsheet software.
- [x] **Error Information Leakage Prevention**: Production error handlers intercept unhandled exceptions and return sanitized error codes (`INTERNAL_ERROR`, `BAD_REQUEST`). Stack traces and internal database schemas are never transmitted to clients.

---

## 5. Security Checklist Audit Table

| Threat Vector | Mitigation Strategy | Status |
|---|---|---|
| **Eavesdropping / MITM** | TLS 1.3 encryption on both HTTP and WebSockets | Verified |
| **Credential Stuffing** | bcrypt 10 rounds + IP rate-limiting on `/auth/login` | Verified |
| **Client-Side Score Tampering** | Backend-only authoritative scoring in Prisma transactions | Verified |
| **Premature Answer Leak** | Sanitized `SafeQuestion` DTO omitting `correctAnswer` | Verified |
| **Cross-Site Scripting (XSS)** | React DOM escaping + Helmet security headers in Express | Verified |
| **Cross-Site Request Forgery (CSRF)** | Double-submit cookie with cryptographic HMAC verification | Verified |
| **CSV Spreadsheet Injection** | Automatic single-quote sanitization on untrusted cells | Verified |
| **Secret Leakage in Git** | `.gitignore` exclusions + secret detection in CI workflows | Verified |
