# CloudQuiz — Phase 4: Zero-Dollar ($0.00) Deployment Runbook

Follow this step-by-step guide to deploy CloudQuiz for **$0.00 total expense** using **Vercel** (Frontend), **Render** (Backend), and **Neon / Supabase** (PostgreSQL). No credit cards are required.

---

## Step 1: Provision Free PostgreSQL Database (Neon or Supabase)

*Takes ~2 minutes. 100% Free.*

### Option A: Using Neon.tech (Recommended for fast serverless Postgres)
1. Sign up for free at [neon.tech](https://neon.tech/) using your GitHub account (no credit card asked).
2. Click **Create Project**.
3. Name your project `cloudquiz-prod`.
4. Copy the connection string under **Connection Details**:
   ```
   postgresql://<user>:<password>@<endpoint>.neon.tech/neondb?sslmode=require
   ```
   *(Keep this connection string ready for Step 2).*

### Option B: Using Supabase
1. Sign up at [supabase.com](https://supabase.com/) with GitHub.
2. Click **New Project** > Name it `cloudquiz-prod` > Set a database password.
3. Go to **Project Settings** > **Database** > **Connection string** > **URI**.
4. Select **Transaction pooler (Port 6543)** or **Direct (Port 5432)** and copy the URI.

---

## Step 2: Deploy Backend & WebSockets on Render.com

*Takes ~3 minutes. 100% Free.*

1. Sign up for free at [render.com](https://render.com/) with your GitHub account.
2. In the Render Dashboard, click **New +** > **Blueprint**.
3. Select your `CloudQuiz` repository.
4. Render detects [`render.yaml`](file:///e:/CloudQuiz/render.yaml) automatically:
   - **Service Name**: `cloudquiz-backend`
   - **Plan**: `Free`
   - **Build Command**: `npm install && npm run prisma:generate && npm run build:backend`
   - **Start Command**: `npm run prisma:migrate:deploy && npm run start:backend`
   - **Healthcheck Path**: `/health`
5. Under Environment Variables:
   - For `DATABASE_URL`: Paste the PostgreSQL URI from Step 1.
   - For `CORS_ORIGIN`: Leave as placeholder for now (e.g. `*` or update after Step 3).
6. Click **Apply**.
7. Render will build the project, run database migrations (`prisma migrate deploy`), and launch the service.
8. Once live, note your backend public URL:
   ```
   https://cloudquiz-backend.onrender.com
   ```

---

## Step 3: Deploy Frontend on Vercel

*Takes ~2 minutes. 100% Free.*

1. Sign up at [vercel.com](https://vercel.com/) with your GitHub account.
2. Click **Add New...** > **Project** > Import the `CloudQuiz` repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables**:
   - `VITE_API_BASE_URL` = `https://cloudquiz-backend.onrender.com/api/v1`
   - `VITE_SOCKET_URL` = `https://cloudquiz-backend.onrender.com`
5. Click **Deploy**.
6. When deployment finishes, copy your frontend URL (e.g., `https://cloudquiz.vercel.app`).

---

## Step 4: Final Connection & CORS Lock

1. Go back to your [Render Dashboard](https://dashboard.render.com/) > `cloudquiz-backend` > **Environment**.
2. Update `CORS_ORIGIN` with your real Vercel URL:
   ```
   https://cloudquiz.vercel.app
   ```
3. Save changes. Render automatically performs a zero-downtime redeploy.

---

## Step 5: Production Verification Checklist

1. **Verify Backend Health**:
   ```bash
   curl -i https://cloudquiz-backend.onrender.com/health
   # Returns 200 OK with process uptime
   ```
2. **Verify Database Readiness**:
   ```bash
   curl -i https://cloudquiz-backend.onrender.com/ready
   # Returns 200 OK with {"status":"ready","database":"connected"}
   ```
3. **Open Frontend**:
   - Navigate to `https://cloudquiz.vercel.app`.
   - Register a host account.
   - Create and publish a quiz.
   - Start a live session and join from a phone or second browser tab using the 6-character room code.
   - Verify real-time countdown timers, answer scoring, and live leaderboards!
