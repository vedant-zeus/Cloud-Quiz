# CloudQuiz — Phase 3: Leaderboards, Analytics, Historical Results, and Competition Experience

[![Node.js 22 LTS](https://img.shields.io/badge/Node.js-22_LTS-green.svg)](https://nodejs.org/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Prisma 6.19.0](https://img.shields.io/badge/Prisma-6.19.0-purple.svg)](https://www.prisma.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.1-black.svg)](https://socket.io/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

---

## 1. Project Overview

**CloudQuiz** is a production-minded, cloud-native live quiz competition platform engineered for collegiate hackathons, technical symposiums, inter-college quiz bowls, and student club competitions.

### Phase 1: Foundation (Completed)
- Host authentication with bcrypt, JWT in HTTP-only cookies, and HMAC CSRF tokens.
- Complete Quiz & Question authoring with draft, publish, archive, and deletion lifecycles.
- PostgreSQL 16 persistence via Prisma ORM v6.19.0.
- Modern SaaS host dashboard built with React 18, Vite, and Tailwind CSS.

### Phase 2: Real-Time Multiplayer Engine (Completed)
- **Live Quiz Sessions**: Authenticated hosts create live competition sessions from published quizzes with a 6-character room code (e.g., `ABC123`).
- **Participant Joining**: Students enter via room code and display name. The server issues a cryptographically secure participant token, storing only its SHA-256 hash in PostgreSQL.
- **Synchronized Game Engine**: Socket.IO-driven live event orchestration controlling question delivery, server-enforced absolute deadlines, answer submission locks, and progression.
- **Cheating Prevention & Answer Privacy**: `correctAnswer` is strictly omitted from all active question broadcasts and room sync states; it is only revealed after the question closes.
- **Transactional Scoring**: Server calculates answer correctness and increments participant scores within atomic database transactions with uniqueness constraints.
- **Reconnection & State Recovery**: Safe `room:sync` restores the client's exact live room state without data duplication.

### Phase 3: Leaderboards, Analytics, Historical Results, and Competition Experience (Completed)
- **Live Leaderboard Service**: Authoritative ranking service derived exclusively from database records using a documented 5-step deterministic tie-breaking policy, top-3 podium visuals, and rank change deltas.
- **Authoritative Question Analytics**: Comprehensive breakdown for closed questions (total participants, submitted answers, correct/incorrect/unanswered counts, percentage accuracy, option selection distribution, average response times, response time distribution).
- **Competition-Level Analytics**: Post-competition aggregation (participation rate, overall accuracy, mean response time, highest and median scores, score brackets, hardest and easiest questions, and question performance trends).
- **Personalized Participant Results**: Secure participant view showing their rank, score, accuracy, response time, and question-by-question breakdown with options selected, points earned, and revealed correct answers.
- **Host Analytics Dashboard**: Polished interactive presentation view for completed competitions with score distribution, question accuracy charts, summary KPIs, and podium.
- **Historical Competition Reports**: Host-authenticated competition archive (`/history` and `/history/:sessionId`) with pagination, title search, date filtering, and host ownership isolation.
- **Secure CSV Exports**: Authenticated downloads for Leaderboard (`/export/leaderboard.csv`) and Answer Submissions (`/export/answers.csv`) featuring RFC 4180 escaping and CSV formula injection protection (`=`, `+`, `-`, `@`, `\t`, `\r`).

### Phase 4: Zero-Dollar ($0.00) Production Deployment (Completed)
- **Strict $0.00 Budget**: Zero dollars out-of-pocket, zero credit card commitments, and zero risk of unexpected bills.
- **Frontend on Vercel**: 100% Free Hobby edge deployment with SPA routing (`vercel.json`) and automated SSL.
- **Backend on Render**: 100% Free Web Service with native persistent Socket.IO WebSockets over WSS, health probes, and `render.yaml` blueprint.
- **Database on Neon / Supabase**: 100% Free managed PostgreSQL 16 with TLS connection pooling and Prisma migration automation.
- **Railway Compatibility**: Full `railway.json` and production Dockerfile retained for optional deployment.
- **Production Verification**: 100% clean TypeScript checks, ESLint, 59 backend integration tests, 4 frontend tests, and production builds.

---

## 2. Technology Stack

### Backend
- **Runtime**: Node.js 22 LTS / Node 20+
- **Framework**: Express.js with TypeScript
- **Real-Time Engine**: Socket.IO v4.8 attached directly to the Express HTTP server
- **Database ORM**: Prisma ORM pinned to version `6.19.0`
- **Database**: PostgreSQL 16 (in Docker Compose)
- **Validation**: Zod schema validation for REST payloads and Socket.IO events
- **Security**: Helmet, CORS with explicit allowlisting, bcrypt (10 rounds), SHA-256 token hashing, HTTP-only cookies, HMAC CSRF protection, and express-rate-limit

### Frontend
- **Framework**: React 18 with Vite and TypeScript
- **Real-Time Client**: `socket.io-client` v4.8 with reconnection management
- **Styling**: Tailwind CSS with custom palette (Dark Navy / Indigo SaaS aesthetic)
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors, credentials support, and automatic CSRF header forwarding
- **Icons**: Lucide React

---

## 3. Authoritative Ranking & Tie-Breaking Policy

The CloudQuiz leaderboard enforces strict deterministic ranking derived solely from persisted database records. Client-submitted scores or ranks are never trusted.

When sorting participants, the ranking engine evaluates criteria in this exact sequential order:

1. **Total Score (`score DESC`)**: Higher points rank higher.
2. **Correct Answer Count (`correctCount DESC`)**: Participants with more correct answers rank higher.
3. **Cumulative Response Time for Correct Answers (`cumulativeResponseTimeMs ASC`)**: Participants who solved correct answers faster rank higher.
4. **Earliest Score Timestamp (`lastCorrectSubmittedAt ASC`)**: Participant who achieved their tied score first ranks higher.
5. **Stable Tie-Break (`participantId ASC`)**: Deterministic alphanumeric sorting of participant IDs ensures stable rankings without randomness.

*Rank Change Tracking*: The leaderboard service calculates rank change deltas (`rankChange`) relative to the prior published question snapshot to display upward (`+1`) or downward (`-1`) progression during live gameplay.

---

## 4. Analytics Metric Definitions & Denominators

All metrics use explicit, well-defined mathematical definitions:

| Metric | Formula / Definition | Zero-Case Handling |
|---|---|---|
| **Question Accuracy %** | `(correctAnswers / submittedAnswers) * 100` | Returns `0` if `submittedAnswers === 0` |
| **Unanswered Count** | `totalParticipantsInSession - submittedAnswers` | Non-negative integer (never classified as incorrect submitted answer) |
| **Option Selection %** | `(optionCount / submittedAnswers) * 100` | Returns `0` if `submittedAnswers === 0` |
| **Average Response Time** | `sum(validResponseTimesMs) / count(validResponseTimesMs)` | Returns `0` if no recorded submission times exist |
| **Participation Rate %** | `(participantsWithAtLeastOneAnswer / totalParticipants) * 100` | Returns `0` if `totalParticipants === 0` |
| **Overall Competition Accuracy %** | `(totalCorrectAnswers / totalAcceptedAnswers) * 100` | Returns `0` if `totalAcceptedAnswers === 0` |
| **Median Score** | Middle score from sorted participant scores (average of two middle scores if even) | Returns `0` if participant count is `0` |
| **Most Challenging Question** | Question with the lowest accuracy percentage among questions with submitted answers | If no answers submitted across quiz, returns question 1 |
| **Easiest Question** | Question with the highest accuracy percentage among questions with submitted answers | If no answers submitted across quiz, returns question 1 |

---

## 5. REST API Endpoints

### Session & Analytics Endpoints (`/api/v1/sessions`)

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/sessions` | Host (Owner) | Create a live session from a published quiz |
| `GET` | `/api/v1/sessions/:roomCode` | Public | Get safe room metadata (status, quiz title, count) |
| `GET` | `/api/v1/sessions/:roomCode/results` | Host or Completed Public | Authoritative leaderboard and final completion standings |
| `GET` | `/api/v1/sessions/:roomCode/analytics` | Host (Owner) | Full competition-level and question-by-question analytics |
| `GET` | `/api/v1/sessions/:roomCode/participant-results` | Participant (`x-participant-token`) | Personalized results for the authenticated participant |
| `GET` | `/api/v1/sessions/:roomCode/export/leaderboard.csv` | Host (Owner) | Authenticated CSV export of the final leaderboard |
| `GET` | `/api/v1/sessions/:roomCode/export/answers.csv` | Host (Owner) | Authenticated CSV export of all participant answer submissions |

### Historical Competition Endpoints (`/api/v1/history`)

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/history` | Host | List historical competitions owned by the host with pagination (`page`, `limit`), title search (`search`), and date filtering (`startDate`, `endDate`) |
| `GET` | `/api/v1/history/:sessionId` | Host (Owner) | Retrieve comprehensive historical report and analytics for a specific session |

---

## 6. Secure CSV Export & Formula Injection Protection

The CSV generation module enforces RFC 4180 compliance and strict formula injection defense:

- **Formula Injection Mitigation**: Any text field starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is safely prefixed with a single quote (`'`), rendering it inert in spreadsheet processors (Microsoft Excel, Google Sheets, LibreOffice Calc).
- **Escaping & Quoting**: Values containing commas, double quotes, or newlines are wrapped in double quotes, with internal quotes escaped as `""`.
- **MIME & Headers**: Returns `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="leaderboard-ROOMCODE.csv"`.
- **Sensitive Data Exclusion**: Participant tokens, password hashes, CSRF secrets, and internal keys are completely excluded from exports.
- **Premature Disclosure Protection**: Exporting answers for an active question before completion is disallowed.

---

## 7. Socket.IO Event Protocol

### Client-to-Server Events

| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ roomCode: string, displayName: string }` | Student joins room; returns credentials & safe room state |
| `room:sync` | `{ roomCode: string, token?: string }` | Restores client state upon reconnection |
| `quiz:start` | `{ roomCode: string }` | Host starts the quiz |
| `question:next` | `{ roomCode: string }` | Host advances to the next question or completes the quiz |
| `question:close` | `{ roomCode: string }` | Host closes active question before deadline expires |
| `answer:submit` | `{ roomCode: string, questionId: string, selectedOption: number, submissionId: string, token: string }` | Participant submits single answer choice |
| `quiz:end` | `{ roomCode: string }` | Host ends the quiz explicitly |

### Server-to-Client Events

| Event | Payload | Description |
|---|---|---|
| `room:joined` | `{ participantId: string, roomCode: string }` | Confirmation sent to joining participant |
| `room:participant-count` | `{ count: number }` | Broadcast to room when participants join |
| `room:state` | `SafeRoomState` | Snapshot of room state |
| `quiz:started` | `{ roomCode: string }` | Broadcast when host initiates the quiz |
| `question:started` | `SafeQuestion` | Broadcast active question (**never includes `correctAnswer`**) |
| `answer:ack` | `{ submissionId: string, accepted: boolean, message?: string }` | Acknowledgment of answer submission |
| `question:ended` | `{ questionId: string, correctAnswer: number, stats: AnswerStats, questionNumber: number, totalQuestions: number, detailedAnalytics?: DetailedQuestionAnalytics }` | Broadcast when question closes; reveals correct answer, stats, and analytics |
| `leaderboard:update` | `{ leaderboard: LeaderboardEntry[] }` | Broadcast authoritative updated standings after question closes |
| `quiz:ended` | `{ roomCode: string, leaderboard: LeaderboardEntry[] }` | Broadcast when quiz finishes with final standings |
| `server:error` | `{ code: string, message: string }` | Error notification |

---

## 8. Database Schema & Migrations

### Migration `20261011010000_phase3_analytics_updates`
- Added `startedAt DateTime?` to `QuizSession` to record exact session commencement time.
- Added `responseTimeMs Int?` to `Answer` to record participant submission latency in milliseconds.
- Created multi-column index on `QuizSession (hostId, status, createdAt)` for historical query performance.
- Created index on `Answer (sessionId, questionId)` and `Participant (sessionId, score)` for analytical queries.

---

## 9. Local Setup and Startup

### Prerequisites
- Node.js 22 LTS or Node.js 20+
- Docker and Docker Compose (for PostgreSQL 16)
- npm v10+

### Step-by-Step Instructions

1. **Clone and Install Dependencies**:
   ```bash
   git clone https://github.com/cloudquiz/cloudquiz.git
   cd cloudquiz
   npm install
   ```

2. **Start Database Services**:
   ```bash
   docker compose up -d
   ```

3. **Configure Environment Variables**:
   Ensure `apps/backend/.env` contains:
   ```env
   NODE_ENV=development
   PORT=4000
   DATABASE_URL="postgresql://cloudquiz:cloudquiz_secret_pw@127.0.0.1:5434/cloudquiz_dev?schema=public"
   TEST_DATABASE_URL="postgresql://cloudquiz:cloudquiz_secret_pw@127.0.0.1:5434/cloudquiz_test?schema=public"
   JWT_SECRET="super-secret-jwt-key-with-at-least-32-chars-long"
   CSRF_SECRET="super-secret-csrf-key-with-at-least-32-chars-long"
   CORS_ORIGIN="http://localhost:5173"
   COOKIE_DOMAIN="localhost"
   COOKIE_SECURE="false"
   ```

4. **Apply Prisma Migrations**:
   ```bash
   npm run db:migrate
   ```

5. **Start Development Servers**:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:4000`
   - Socket.IO gateway: `http://localhost:4000`

---

## 10. Automated Testing & Verification

Run all test suites and quality checks:

```bash
# 1. TypeScript checks across all workspaces (0 errors)
npm run typecheck

# 2. Linting (0 errors, 0 warnings)
npm run lint

# 3. Backend integration tests (59 tests across 7 suites)
npm run test:backend

# 4. Frontend tests (4 tests)
npm run test:frontend

# 5. Production builds
npm run build
```

### Verified Test Summary:
- **Backend Tests**: 59 passed (100%)
  - `analyticsAndLeaderboard.test.ts` (14 tests: score rankings, tie-breakers, question analytics, competition analytics, participant results, history pagination/search, CSV generation & injection defense)
  - `socketGameplay.test.ts` (6 tests: room join, duplicate nicknames, live answering, server scoring, deadline locking, reconnection sync)
  - `session.test.ts` (5 tests: session creation, quiz ownership, published checks, public room retrieval)
  - `quiz.test.ts` (11 tests: authoring, publishing, archiving, ownership)
  - `question.test.ts` (8 tests: options, points, time limits, reordering)
  - `auth.test.ts` (11 tests: host registration, login, logout, cookies)
  - `health.test.ts` (4 tests: health probes and database liveness)
- **Frontend Tests**: 4 passed
- **Typecheck & Linting**: 100% clean
- **Production Build**: 100% clean

---

## 11. Known Limitations & Architecture Notes

- **Single-Process In-Memory Timers**: Question deadlines are computed from absolute server timestamps and enforced both via database timestamps and an in-memory timer registry. In Phase 3, this is optimized for single-instance Node.js deployments.
- **Horizontal Scaling & Redis Adapter**: Redis is prepared in Docker Compose. Phase 4 will introduce `@socket.io/redis-adapter` for multi-node cluster broadcasting and distributed Redis-based deadline job workers.
