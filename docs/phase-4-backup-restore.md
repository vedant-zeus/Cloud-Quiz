# CloudQuiz — Phase 4: Database Backup, Recovery, and Disaster Recovery Procedures

## 1. Overview & Policy

This guide details the backup strategy, manual dump processes, and disaster recovery procedures for CloudQuiz's PostgreSQL 16 database running on Railway.

### Backup SLA & Inclusions
- **Automated Snapshots**: Railway takes automated daily volume snapshots. Included with active project storage (~$0.25/GB/mo storage tier).
- **Manual Backups**: Logical database dumps created via `pg_dump` can be exported locally at any time without provider surcharges.
- **Retention Goal**: Keep at least one verified manual dump before every production release or competition event.

---

## 2. Manual Backup Procedure (`pg_dump`)

Operators should take a manual backup before major quiz tournaments or schema migrations.

### Step 1: Obtain Database Connection String
In Railway Dashboard > PostgreSQL Service > **Variables** or **Connect**, copy the external connection string:
```
postgresql://postgres:<PASSWORD>@<HOST>:<PORT>/railway
```

### Step 2: Execute Custom-Format Dump
Run `pg_dump` using the PostgreSQL custom archive format (`-F c`):

```bash
# Set database URL environment variable
export DATABASE_URL="postgresql://postgres:<PASSWORD>@<HOST>:<PORT>/railway"

# Create timestamped compressed backup
pg_dump "$DATABASE_URL" \
  --format=custom \
  --blobs \
  --verbose \
  --file="./cloudquiz_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Step 3: Verify Backup File Integrity
Inspect the generated dump file using `pg_restore`:
```bash
pg_restore --list "./cloudquiz_backup_*.dump" | head -n 30
```
Confirm the presence of core application tables (`users`, `quizzes`, `questions`, `quiz_sessions`, `participants`, `answers`).

---

## 3. Disaster Recovery & Restoration Procedure (`pg_restore`)

If database corruption occurs or a rollback is required:

### Step 1: Pre-Restoration Verification
1. Place the backend service into maintenance mode by stopping the Node.js container in Railway Dashboard to prevent concurrent writes.
2. Verify the target database URL.

### Step 2: Execute Database Restoration
Restore the custom archive dump into the Railway PostgreSQL database:

```bash
# Clean existing database objects and restore all schemas and data
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "./cloudquiz_backup_<TIMESTAMP>.dump"
```

### Step 3: Verify Application State
1. Execute a test database readiness query:
   ```bash
   psql "$DATABASE_URL" -c "SELECT count(*) FROM users; SELECT count(*) FROM quizzes; SELECT count(*) FROM quiz_sessions;"
   ```
2. Restart the Railway Node.js backend container.
3. Access the health endpoint: `https://<backend-domain>/ready` to verify that `status: "ready"` and `database: "connected"` are returned.
4. Log into the Host Dashboard to confirm quiz records and session histories are restored.

---

## 4. Local Backup Restoration Testing

To verify a production backup file locally without risking live data:

```bash
# 1. Start local Docker Compose PostgreSQL
docker compose up -d postgres

# 2. Restore dump into local test database
pg_restore \
  --dbname="postgresql://cloudquiz:cloudquiz_dev_secret@localhost:5434/cloudquiz_dev" \
  --clean \
  --if-exists \
  --no-owner \
  "./cloudquiz_backup_<TIMESTAMP>.dump"

# 3. Test with backend server
npm run dev:backend
```
