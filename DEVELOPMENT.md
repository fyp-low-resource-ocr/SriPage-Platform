# SriPage Developer Runbook

This runbook describes the complete PDF parsing flow and how developers can run, inspect, and manually exercise SriPage without the frontend.

## 1. Architecture

SriPage contains:

| Component | Responsibility | Local address |
| --- | --- | --- |
| Next.js frontend | Upload UI, polling, queue and result views | http://localhost:3001 |
| NestJS API | Presigned URLs, job API, PostgreSQL updates | http://localhost:3000 |
| NestJS worker | BullMQ consumer and parser execution | No HTTP port |
| PostgreSQL | Durable job state and JSONB results | localhost:5432 |
| Redis | BullMQ queue state | localhost:6379 |
| MinIO | PDF inputs and JSON result artifacts | http://localhost:9000 |
| MinIO Console | Object browser | http://localhost:9001 |

The request lifecycle is:

1. The client calls `POST /uploads/presign`.
2. The client uploads the PDF directly to MinIO with the returned URL.
3. The client calls `POST /jobs` to finalize the upload.
4. The API saves a `queued` job in PostgreSQL and adds a message to the `pdf-parsing` BullMQ queue.
5. The worker changes the job to `processing`.
6. The worker resolves the parser method, runs it, and stores the output in PostgreSQL JSONB and MinIO.
7. The worker changes the job to `completed`, or `failed` with an error message.
8. The frontend polls `GET /jobs/:id` while the job is active.

Current parser:

| Method | Runtime | Behavior |
| --- | --- | --- |
| `vlm` | CPU | Dummy parser waits 10 seconds and returns deterministic JSON |

## 2. Repository layout

```
backend/src/jobs/       Job entity, DTOs, controller, and queue position logic
backend/src/parsers/    Parser contract, registry, and dummy VLM parser
backend/src/queue/      BullMQ queue definition
backend/src/storage/    MinIO client and presigned URLs
backend/src/workers/    BullMQ worker processor
backend/src/main.ts     HTTP API entrypoint
backend/src/worker-main.ts  Worker entrypoint
frontend/app/page.tsx   Dashboard UI
docker-compose.dev.yml  PostgreSQL, Redis, and MinIO
docker-compose.prod.yml Full production stack
```

## 3. Prerequisites

Install or have available:

- Node.js 22+
- pnpm
- Docker and Docker Compose
- curl
- jq
- Optional: psql and redis-cli

Install dependencies:

```bash
cd backend && pnpm install
cd ../frontend && pnpm install
```

## 4. Local development

### 4.1 Start infrastructure

From the repository root:

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

Development credentials:

| Service | Value |
| --- | --- |
| PostgreSQL database | `sripage` |
| PostgreSQL user | `sripage` |
| PostgreSQL password | `sripage` |
| MinIO username | `minio` |
| MinIO password | `miniosecret` |
| Redis password | none |

### 4.2 Configure and start the API

Copy the example file:

```bash
cp backend/.env.example backend/.env
```

Load it into the current shell and start Nest:

```bash
set -a; source backend/.env; set +a
cd backend
pnpm start:dev
```

The API should be available at `http://localhost:3000`.

### 4.3 Start the worker

Use a second terminal:

```bash
set -a; source backend/.env; set +a
cd backend
pnpm build
WORKER_ENABLED=true pnpm start:worker
```

Keep this process running. If it is stopped, new jobs remain queued.

### 4.4 Start the frontend

Use a third terminal:

```bash
cp frontend/.env.example frontend/.env.local
cd frontend
pnpm dev
```

Open `http://localhost:3001`.

## 5. Inspect MinIO

### 5.1 Web console

1. Open [http://localhost:9001](http://localhost:9001).
2. Log in with username `minio` and password `miniosecret`.
3. Open the `sripage` bucket.
4. PDFs are under `inputs/`.
5. Result JSON artifacts are under `results/`.

The backend creates the `sripage` bucket during startup.

### 5.2 MinIO command-line inspection

The MinIO container includes `mc`. Configure a local alias:

```bash
docker compose -f docker-compose.dev.yml exec minio mc alias set local http://localhost:9000 minio miniosecret
```

List all objects:

```bash
docker compose -f docker-compose.dev.yml exec minio mc ls --recursive local/sripage
```

Copy a result artifact out of the container:

```bash
docker compose -f docker-compose.dev.yml exec minio mc cp local/sripage/results/JOB_ID.json /tmp/result.json
```

For browser access, `GET /jobs/:id/result` returns a temporary presigned download URL.

## 6. Inspect Redis and BullMQ

The queue name is `pdf-parsing`.

Check Redis:

```bash
docker compose -f docker-compose.dev.yml exec redis redis-cli ping
```

Expected output:

```
PONG
```

List BullMQ keys:

```bash
docker compose -f docker-compose.dev.yml exec redis redis-cli --scan --pattern 'bull:pdf-parsing:*'
```

Inspect waiting and active list lengths:

```bash
docker compose -f docker-compose.dev.yml exec redis redis-cli LLEN bull:pdf-parsing:wait
docker compose -f docker-compose.dev.yml exec redis redis-cli LLEN bull:pdf-parsing:active
```

Useful keys:

| Key | Meaning |
| --- | --- |
| `bull:pdf-parsing:wait` | Waiting job IDs |
| `bull:pdf-parsing:active` | Currently processing jobs |
| `bull:pdf-parsing:completed` | Recently completed BullMQ jobs |
| `bull:pdf-parsing:failed` | Failed BullMQ jobs |
| `bull:pdf-parsing:<id>` | A BullMQ job payload and metadata |

There is currently no Bull Board web dashboard installed. Redis CLI is the queue inspection tool for this version. PostgreSQL and the HTTP API remain the source of truth for user-visible job state.

## 7. Inspect PostgreSQL

Connect to the development database:

```bash
psql postgres://sripage:sripage@localhost:5432/sripage
```

List recent jobs:

```sql
SELECT id, filename, method, runtime, status, queue_position, created_at, updated_at
FROM jobs
ORDER BY created_at DESC;
```

Inspect one job:

```sql
SELECT * FROM jobs WHERE id = 'JOB_ID';
```

View queued jobs in queue order:

```sql
SELECT id, filename, queue_position, created_at
FROM jobs
WHERE status = 'queued'
ORDER BY queue_position ASC, created_at ASC;
```

View structured results:

```sql
SELECT id, result
FROM jobs
WHERE status = 'completed'
ORDER BY updated_at DESC;
```

The development configuration uses TypeORM synchronization. Before production data is important, replace this with a reviewed migration workflow and set `DB_SYNCHRONIZE=false`.

## 8. Complete API-only workflow

Run this with the API and worker running. It does not use the frontend.

Set variables:

```bash
API=http://localhost:3000
FILE=/absolute/path/to/document.pdf
FILENAME=$(basename "$FILE")
SIZE=$(wc -c < "$FILE" | tr -d ' ')
```

### 8.1 List available methods

```bash
curl -s "$API/methods" | jq
```

Expected response:

```json
[
  {
    "method": "vlm",
    "supportedRuntimes": ["cpu"]
  }
]
```

### 8.2 Request a presigned upload URL

```bash
PRESIGN=$(curl -s -X POST "$API/uploads/presign" -H 'Content-Type: application/json' -d "{\"filename\":\"$FILENAME\",\"mimeType\":\"application/pdf\",\"size\":$SIZE}")
echo "$PRESIGN" | jq
OBJECT_KEY=$(echo "$PRESIGN" | jq -r .objectKey)
UPLOAD_URL=$(echo "$PRESIGN" | jq -r .uploadUrl)
```

The URL is temporary. The response contains an object key such as `inputs/UUID-document.pdf`.

### 8.3 Upload directly to MinIO

```bash
curl -i -X PUT "$UPLOAD_URL" -H 'Content-Type: application/pdf' --upload-file "$FILE"
```

A successful upload returns HTTP 200. At this point the PDF exists in MinIO, but no parsing job exists yet.

### 8.4 Finalize and enqueue the job

```bash
JOB=$(curl -s -X POST "$API/jobs" -H 'Content-Type: application/json' -d "{\"filename\":\"$FILENAME\",\"mimeType\":\"application/pdf\",\"size\":$SIZE,\"inputObjectKey\":\"$OBJECT_KEY\",\"method\":\"vlm\"}")
echo "$JOB" | jq
JOB_ID=$(echo "$JOB" | jq -r .id)
```

The response contains the job ID, status, and current queue position.

### 8.5 Poll job status

```bash
while true; do RESPONSE=$(curl -s "$API/jobs/$JOB_ID"); echo "$RESPONSE" | jq '{id,filename,status,queuePosition,error}'; STATUS=$(echo "$RESPONSE" | jq -r .status); if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then break; fi; sleep 2; done
```

Normal lifecycle:

```
queued -> processing -> completed
```

A stopped worker leaves the job queued. Parser errors produce a failed job with an error message.

### 8.6 Read the result

Read the PostgreSQL JSONB result through the API:

```bash
curl -s "$API/jobs/$JOB_ID" | jq .result
```

Request the MinIO artifact URL:

```bash
RESULT_URL=$(curl -s "$API/jobs/$JOB_ID/result" | jq -r .url)
curl -s "$RESULT_URL" | jq
```

List all jobs:

```bash
curl -s "$API/jobs" | jq '[.[] | {id,filename,status,queuePosition,method}]'
```

## 9. API reference

### `GET /methods`

Returns registered parser methods and supported runtimes.

### `POST /uploads/presign`

Request:

```json
{
  "filename": "invoice.pdf",
  "mimeType": "application/pdf",
  "size": 12345
}
```

Response contains `objectKey` and temporary `uploadUrl`.

### `POST /jobs`

Request:

```json
{
  "filename": "invoice.pdf",
  "mimeType": "application/pdf",
  "size": 12345,
  "inputObjectKey": "inputs/UUID-invoice.pdf",
  "method": "vlm"
}
```

### `GET /jobs`

Returns all jobs, newest first.

### `GET /jobs/:id`

Returns job metadata, status, queue position, error, and structured result.

### `GET /jobs/:id/result`

Returns a temporary presigned URL for the result JSON artifact.

## 10. Adding a parser method

Implement `PdfParser` in `backend/src/parsers`, preserve the shared input/output structure, declare supported runtimes, register the parser in `ParserService`, and add tests.

Example:

```ts
export class TextParser implements PdfParser {
  method = 'text';
  supportedRuntimes = ['cpu' as const];

  async parse(input: ParserInput): Promise<ParserOutput> {
    return {
      method: this.method,
      pages: 1,
      fields: { filename: input.filename, text: 'example' },
    };
  }
}
```

Register it:

```ts
private readonly parsers = new Map<string, PdfParser>([
  ['vlm', new DummyVlmParser()],
  ['text', new TextParser()],
]);
```

The frontend currently displays only `vlm`; update the selector or load `GET /methods` dynamically for additional methods.

## 11. Production deployment

Copy the root example file:

```bash
cp .env.example .env
```

Set at least:

- `POSTGRES_PASSWORD`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_PUBLIC_ENDPOINT`
- `MINIO_PUBLIC_PORT`
- `NEXT_PUBLIC_API_URL`
- `CORS_ORIGIN`

`MINIO_PUBLIC_ENDPOINT` must be reachable by the browser. The backend uses the internal Compose hostname `minio` for object operations, while presigned URLs use the public endpoint.

Start the stack:

```bash
docker compose --env-file .env -f docker-compose.prod.yml up --build
```

Inspect services:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f frontend
```

## 12. Troubleshooting

### TypeORM cannot connect

```bash
docker compose -f docker-compose.dev.yml ps postgres
psql postgres://sripage:sripage@localhost:5432/sripage -c 'select 1'
```

Use `localhost` in connection URLs for host processes and `postgres` for Compose containers.

### Redis connection errors

```bash
docker compose -f docker-compose.dev.yml ps redis
docker compose -f docker-compose.dev.yml exec redis redis-cli ping
```

Use `redis://localhost:6379` for host processes and `redis://redis:6379` inside Compose.

### MinIO upload fails

Verify that the `sripage` bucket exists and that the hostname in the presigned URL is reachable by the browser or curl client. Local URLs should normally use `localhost:9000`.

### Jobs stay queued

Check that the worker is running with `WORKER_ENABLED=true`. Then inspect the job and queue:

```bash
curl -s "$API/jobs" | jq
docker compose -f docker-compose.dev.yml exec redis redis-cli --scan --pattern 'bull:pdf-parsing:*'
```

### A job stays processing

The dummy parser intentionally waits ten seconds. Check the worker process and MinIO connectivity. A result artifact should appear under `results/` after successful completion.

### Frontend cannot reach the API

Check `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Check that backend `CORS_ORIGIN` contains the frontend origin, normally `http://localhost:3001`.

## 13. Verification commands

```bash
cd backend
pnpm build
pnpm exec jest --runInBand

cd ../frontend
pnpm exec tsc --noEmit
pnpm build --webpack

cd ..
docker compose --env-file .env.example -f docker-compose.dev.yml config -q
docker compose --env-file .env.example -f docker-compose.prod.yml config -q
```

