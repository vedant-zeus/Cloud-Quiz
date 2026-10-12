# CloudQuiz — Phase 4: Zero-Dollar ($0.00) Budget Monitoring & Cost Controls

## 1. Zero-Dollar Policy & Safeguard Enforcements

The CloudQuiz project operates under a strict **$0.00 USD total spending ceiling**. No credit card charges are permitted under any circumstances.

### Zero-Dollar Spend Threshold Ladder

| Cumulative Spend | Trigger Level | Action Taken |
|---|---|---|
| **$0.00** | Normal Free Operation | Monitor free-tier usage metrics (bandwidth, build minutes, DB storage). |
| **>$0.01** | Immediate Violation | Immediate investigation: detect which provider initiated a non-free charge. |
| **Approaching Free Tier Limit** | 80% Quota Warning | Scale down test workloads, clean old test session records from PostgreSQL. |
| **End of Event Window** | Cleanup Enforcement | Execute Tier 2 or Tier 3 cleanup in `docs/phase-4-cleanup-runbook.md` to guarantee zero ongoing charges. |

---

## 2. Platform-Specific Zero-Spend Safeguards

### A. Vercel Safeguards
- Operate exclusively on **Vercel Hobby Plan**.
- Ensure **Spend Management** is set to **Pause Project** on quota limit, preventing automatic conversion to paid tiers.
- Free tier limit: 100 GB bandwidth / month (a typical CloudQuiz live competition uses < 2 GB).

### B. Railway Safeguards (If using Railway Trial)
- If using Railway's initial trial credit:
  - Set **Hard Usage Limit** to **$5.00** (or trial credit balance).
  - Enable email alerts when usage hits $2.50.
  - Disable automated account balance top-ups.
  - Delete or stop services as soon as the event concludes.

### C. Render + Neon / Supabase Safeguards (If using 100% Free Stack)
- Render Free Web Service does not require a credit card and cannot generate unexpected bills.
- Neon.tech / Supabase Free Tiers do not require a credit card and automatically cap database sizes at 500 MB without overage billing.

---

## 3. Zero-Dollar Cost Ledger

| Provider | Service | Plan / Tier | Actual Cost | Billing Status | Unresolved Risks |
|---|---|---|---|---|---|
| **Vercel** | React SPA Frontend | Hobby Tier | **$0.00** | Free Forever | None (Hard capped) |
| **Railway / Render** | Node.js Backend API & Socket.IO | Free / Trial | **$0.00** | Verified $0.00 | Trial duration if using Railway |
| **PostgreSQL** | Database (Neon / Supabase / Railway) | Free Tier | **$0.00** | Verified $0.00 | Volume storage limits (500 MB) |
| **Total Project Spend** | All Infrastructure | Zero Budget | **$0.00 USD** | **100% Free** | **Zero Dollar Ceiling Preserved** |
