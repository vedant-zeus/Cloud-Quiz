# CloudQuiz — Phase 4: Zero-Dollar ($0.00) Production Cost Estimate & Budget Plan

## 1. Executive Summary & Zero-Budget Policy

- **Total Approved Project Budget Ceiling**: **$0.00 USD (Strict Zero-Dollar Budget)**
- **Target Spending**: **$0.00 USD**
- **Allowable Out-of-Pocket Expense**: **$0.00 USD**
- **Date of Policy Update**: October 12, 2026
- **Objective**: Deploy and run CloudQuiz for college competitions without spending a single dollar, utilizing verified perpetual or promotional free tiers across modern cloud providers.

---

## 2. Cloud Provider Free Tier Reality & Platform Evaluation

When operating under a strict **$0.00 budget**, provider selection must be scrutinized for hidden paywalls, card verification requirements, and auto-billing risks:

### A. Frontend: Vercel (Hobby Tier — 100% Free Forever)
- **Status**: **100% FREE ($0.00)**.
- **Specifications**:
  - 100 GB / month outbound bandwidth.
  - 6,000 build minutes / month.
  - Global Edge CDN with automated HTTPS / SSL.
  - Unlimited non-commercial deployments.
- **Zero-Spend Safeguard**: Hard quota limit built-in; projects pause if free quota is exceeded rather than generating credit card charges.

### B. Backend & Database: Comparison of Zero-Dollar Hosting Options

| Provider Architecture | Backend Compute | PostgreSQL Database | Real-Time WebSockets (Socket.IO) | Cost | Credit Card Required? | Expiration / Sleep Behavior |
|---|---|---|---|---|---|---|
| **Option A: Vercel + Render + Neon / Supabase** *(Recommended $0.00 Stack)* | Render Free Web Service (512 MB RAM) | Neon Serverless Postgres (0.5 GB) or Supabase (0.5 GB) | **Fully Supported** over HTTPS/WSS | **$0.00 / mo** | **No credit card required** | Backend spins down after 15 min idle; wakes up in ~30s on first hit. DB is persistent. |
| **Option B: Vercel + Railway Trial** | Railway Hobby Container | Railway PostgreSQL Plugin | **Fully Supported** | **$0.00** *(Trial only)* | **Requires Card** for verification on signup | Railway offers a $5.00 trial credit; once trial is consumed or expires after 30 days, billing commences unless deleted. |
| **Option C: Vercel + Local Tunnel (Cloudflare Tunnel)** | Self-Hosted Node.js (College Laptop) | Local Docker PostgreSQL 16 | **Fully Supported** (Lowest latency for campus events) | **$0.00 / mo** | **No credit card required** | Active while college host laptop is running. Zero cloud compute limits. |

---

## 3. Recommended $0.00 Architecture (Option A: Vercel + Render + Neon/Supabase)

### Monthly Cost Breakdown: **$0.00 Total**

| Component | Provider & Tier | Cost | Inclusions |
|---|---|---|---|
| **Frontend** | Vercel (Hobby Tier) | **$0.00** | 100 GB Bandwidth, Edge CDN, HTTPS |
| **Backend API & WebSockets** | Render (Free Web Service) | **$0.00** | 512 MB RAM, 0.1 CPU, Persistent Socket.IO |
| **Database** | Neon.tech / Supabase (Free Tier) | **$0.00** | 0.5 GB NVMe Storage, Full PostgreSQL 16 |
| **Redis Cache** | *Omitted (Not required)* | **$0.00** | Single-node Node.js scoring engine |
| **Data Egress** | Included free tiers | **$0.00** | Sufficient for college tournaments (100–500 players) |
| **Total Monthly Spend** | | **$0.00 USD** | **Guaranteed Zero Cost** |

---

## 4. Railway Free-Trial Spending Safeguards (If Deploying on Railway at $0.00)

If you proceed with Railway using trial credits:
1. **Configure Hard Limit to $0.00 / $5.00 Trial**: In Account Settings > Billing > Hard Limit.
2. **Delete Project Immediately After Event**: To prevent any post-trial automated subscriptions.
3. **Monitor Usage Daily**: Ensure usage does not exceed the free promotional grant.
