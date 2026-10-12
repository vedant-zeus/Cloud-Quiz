# CloudQuiz — Phase 4: Teardown, Cost Optimization, and Resource Cleanup Runbook

## 1. Overview & Policy

This runbook outlines safe procedures for pausing, scaling down, or completely decommissioning CloudQuiz resources across **Railway** and **Vercel** when a live college event or demonstration concludes.

**CRITICAL POLICY**:
- **Never delete production database resources without an exported cold backup.**
- **Never execute destructive cleanups automatically without explicit human confirmation.**
- Understand that stopped services on Railway may still incur persistent disk storage fees ($0.25/GB/mo) until volumes are deleted.

---

## 2. Resource Status & Idle Billing Summary

| Provider | Resource | Idle Billable Status | Action Required to Stop Charges |
|---|---|---|---|
| **Vercel** | Frontend Project | **$0.00 / Free** (Hobby plan incurs no charge when idle) | None, or Pause Project in Settings |
| **Railway** | Backend Node.js Service | Compute CPU/RAM stops billing when scaled to 0 | Scale replicas to 0 or Stop Service |
| **Railway** | PostgreSQL Container | Compute stops billing when service is stopped | Stop Service in Railway |
| **Railway** | PostgreSQL Volume | **Continues billing $0.25/GB/mo** while volume exists | Delete volume only after exporting backup |
| **Railway** | Account Base Subscription | $5.00/mo base fee applies if account remains active | Downgrade / Delete project when semester ends |

---

## 3. Tiered Decommissioning Workflows

### Tier 1: Temporary Pause (Between Tournament Rounds)
*Preserves all data, quizzes, and participant accounts while stopping compute charges.*

1. **Verify No Live Quizzes Are Running**:
   - Confirm in Railway logs that no active sessions or countdown timers are executing.
2. **Scale Backend Service to 0**:
   - In Railway Dashboard > Project > `Backend Service` > **Settings**.
   - Set **Service Replicas** to `0` (or click **Stop Service**).
   - *Result*: Compute CPU/RAM billing drops to $0.00/sec immediately.
3. **Leave PostgreSQL Online**:
   - Keep PostgreSQL running for low-cost idle state (~$0.003/hr).

---

### Tier 2: Post-Event Cold Storage (Preserve Data, Stop All Compute)
*Executed at the end of a college event weekend.*

1. **Export Final Database Archive**:
   ```bash
   pg_dump "$DATABASE_URL" --format=custom --blobs --verbose --file="./cloudquiz_post_event_$(date +%Y%m%d).dump"
   ```
2. **Download Historical CSV Reports**:
   - Ensure the event organizer has downloaded the official `leaderboard.csv` and `answers.csv` files for awards ceremonies.
3. **Stop Railway Backend Service**:
   - Click **Stop Service** on the backend container.
4. **Stop Railway PostgreSQL Service**:
   - Click **Stop Service** on the PostgreSQL container.
   - *Result*: Zero compute billing is incurred. Only the storage volume (~$0.25/month) remains active.

---

### Tier 3: Complete Decommissioning (Absolute Zero Ongoing Spend)
*Executed when the project semester is over and zero recurring charges are desired.*

1. **Mandatory Pre-Deletion Archive**:
   - Run `pg_dump` and store the `.dump` file in redundant offline storage (e.g. university Google Drive / local disk).
   - Verify the dump can be read via `pg_restore --list`.
2. **Delete Railway Project**:
   - In Railway Dashboard > Project > **Settings** > Scroll to **Danger Zone**.
   - Click **Delete Project** and type the project name to confirm.
   - *Result*: PostgreSQL volume, compute containers, and networking are purged. All Railway billing stops immediately.
3. **Delete or Pause Vercel Project**:
   - In Vercel Dashboard > Project > **Settings** > **Advanced** > **Delete Project** (or leave paused).
   - *Result*: Vercel project is removed.
4. **Final Cost Ledger Reconciliation**:
   - Check Railway Billing tab to confirm final balance is under the approved budget ceiling.
   - Update `docs/phase-4-cost-control.md` with final actual figures.
