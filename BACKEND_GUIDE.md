# SriPage Backend: A From-the-Beginning Guide

This document explains how the SriPage backend works as it exists in this repository. It is written as a code-reading guide: start with the runtime model, then follow a request through the API, database, object storage, queue, and worker.

## 1. What the backend is

SriPage is a local-first document-parsing demo with two backend processes:

1. **HTTP API** - a NestJS application that accepts requests, creates jobs, exposes job status, and creates temporary MinIO URLs.
2. **Worker** - a separate NestJS application context that consumes BullMQ jobs and runs parsers.

Three infrastructure services support them:

| Service    | Purpose                                   | Used by        |
| ---------- | ----------------------------------------- | -------------- |
| PostgreSQL | Durable job records and JSON results      | API and worker |
| Redis      | BullMQ queue state and messages           | API and worker |
| MinIO      | Uploaded input PDFs and result JSON files | API and worker |

The important design decision is that the browser does **not** upload the file through NestJS. The API gives the browser a temporary, signed MinIO URL; the browser uploads directly to MinIO; then the API records and queues a job.

The complete lifecycle is:

```text
Browser
  │
  ├─ POST /uploads/presign ───────────────► API ──► MinIO signed PUT URL
  │
  ├─ PUT file to signed URL ──────────────► MinIO
  │
  └─ POST /jobs ──────────────────────────► API
                                             │
                                             ├─ save queued row ──► PostgreSQL
                                             └─ add queue message ─► Redis/BullMQ

Worker ◄──────── consumes queue message from Redis
  │
  ├─ mark job processing ─► PostgreSQL
  ├─ run selected parser
  ├─ write result JSON ───► MinIO
  └─ mark completed/failed ► PostgreSQL

Browser ── GET /jobs and GET /jobs/:id ───► API ──► PostgreSQL
```

## 2. How NestJS is organized

NestJS applications are assembled from **modules**. A module groups related controllers and providers.

- A **controller** declares HTTP routes.
- A **service/provider** contains application logic and can be injected into other classes.
- A **module** declares which controllers/providers exist and which dependencies are imported/exported.
- `@Injectable()` marks a class as available to Nest's dependency-injection container.
- `@Entity()` maps a TypeScript class to a PostgreSQL table through TypeORM.

The backend's source layout is:

```text
backend/src/
├── main.ts                 HTTP API entrypoint
├── worker-main.ts          worker entrypoint
├── app.module.ts           root dependency graph and database setup
├── app.controller.ts       GET / starter route
├── app.service.ts          starter response
├── jobs/                   job entity, DTOs, routes, and orchestration
├── queue/                  BullMQ queue definition
├── workers/                BullMQ consumer
├── storage/                MinIO client and signed URLs
└── parsers/                parser contract, registry, and demo parsers
```

## 3. Startup: the API process

`backend/src/main.ts` is the HTTP entrypoint.

```ts
const app = await NestFactory.create(AppModule);
```

`NestFactory.create` builds a normal HTTP Nest application from `AppModule`.

### CORS

```ts
app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
```

The API permits browser requests from the comma-separated origins in `CORS_ORIGIN`. If the variable is absent, CORS is broadly enabled. The local default is `http://localhost:3001`.

### Request validation

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

This applies to every request:

- `class-validator` decorators on DTOs validate incoming JSON.
- `whitelist: true` removes properties that are not declared in the DTO.
- `transform: true` allows class transformation and type conversion behavior.

For example, `CreateJobDto` accepts `filename`, `mimeType`, `size`, `inputObjectKey`, and optional `method`; arbitrary extra fields are not part of the accepted DTO shape.

### Bull Board

Unless `BULL_BOARD_ENABLED=false`, the API mounts Bull Board at `BULL_BOARD_PATH`, defaulting to `/admin/queues`.

```ts
createBullBoard({
  queues: [new BullMQAdapter(app.get(PARSE_QUEUE_TOKEN))],
  serverAdapter,
});
```

The queue dashboard is an operational view over Redis/BullMQ. It is useful for inspection, but PostgreSQL remains the source of truth for the application's visible job record.

Finally, the API listens on `PORT` (default `3000`).

## 4. Startup: the worker process

`backend/src/worker-main.ts` does not create an HTTP server. It creates an application context:

```ts
const app = await NestFactory.createApplicationContext(WorkerAppModule);
```

`WorkerAppModule` imports both `AppModule` and `WorkerModule`. Importing `AppModule` gives the worker access to configuration, PostgreSQL, storage, queue-related dependencies, and parser dependencies. `WorkerModule` provides `WorkerService`.

The worker sets `WORKER_ENABLED=true` before creating the context. `WorkerService` also checks that setting, so a worker normally creates a BullMQ consumer while the API process does not.

`app.enableShutdownHooks()` allows Nest lifecycle shutdown handling to run. `WorkerService.onModuleDestroy()` closes the BullMQ worker connection cleanly.

## 5. Root module and dependency graph

`backend/src/app.module.ts` is the common root module.

### Configuration

```ts
ConfigModule.forRoot({ isGlobal: true })
```

Nest loads environment variables and makes `ConfigService` globally injectable. Services use it for database, Redis, MinIO, and runtime settings.

### PostgreSQL and TypeORM

```ts
TypeOrmModule.forRootAsync({
  useFactory: (config) => ({
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
  }),
})
```

- `DATABASE_URL` is required.
- `autoLoadEntities` discovers entities registered through feature modules.
- `DB_SYNCHRONIZE=true` lets TypeORM adjust the schema automatically. This is convenient for the demo, but production should use reviewed migrations and set it to `false`.

The root module imports `StorageModule`, `QueueModule`, `ParserModule`, and `JobsModule`, which makes the application's capabilities available.

## 6. The database model: `Job`

`backend/src/jobs/job.entity.ts` maps to a table named `jobs`.

| Column              | Meaning                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `id`              | UUID primary key generated by PostgreSQL/TypeORM                               |
| `filename`        | Original client filename                                                       |
| `mimeType`        | Client-provided MIME type                                                      |
| `size`            | File size, stored as PostgreSQL`bigint`                                      |
| `inputObjectKey`  | MinIO key such as`inputs/<uuid>-invoice.pdf`                                 |
| `resultObjectKey` | MinIO result key such as`results/<job-id>.json`                              |
| `method`          | Parser method, currently`non-vlm` or `vlm`                                 |
| `runtime`         | `cpu` or `gpu`; currently selected as the parser's first supported runtime |
| `status`          | `queued`, `processing`, `completed`, or `failed`                       |
| `queuePosition`   | One-based position among queued database jobs, otherwise`null`               |
| `result`          | Parsed output stored as PostgreSQL JSONB                                       |
| `error`           | Failure message, otherwise`null`                                             |
| `createdAt`       | Automatically set creation timestamp                                           |
| `updatedAt`       | Automatically updated timestamp                                                |

There are deliberately two copies of a successful result: structured JSON in PostgreSQL (`result`) for the API/UI, and a JSON artifact in MinIO (`resultObjectKey`) for download.

## 7. DTO validation and the job API

`backend/src/jobs/jobs.dto.ts` defines request shapes.

### `PresignUploadDto`

- `filename`: required string
- `mimeType`: required MIME type
- `size`: required integer at least 1

### `CreateJobDto`

- `filename`: required string
- `mimeType`: required MIME type
- `size`: required integer at least 1
- `inputObjectKey`: required string
- `method`: optional string, defaulting to `non-vlm`

The DTOs validate shape, not the complete upload workflow. In particular, the current code does not enforce a maximum size, restrict MIME types to PDF, or prove that `inputObjectKey` was generated by the API or that the object exists in MinIO.

`backend/src/jobs/jobs.controller.ts` maps routes to `JobsService`:

| Route                     | Behavior                                             |
| ------------------------- | ---------------------------------------------------- |
| `GET /`                 | Starter`Hello World!` response from `AppService` |
| `GET /methods`          | Lists registered parser methods and runtimes         |
| `POST /uploads/presign` | Creates a safe object key and signed upload URL      |
| `POST /jobs`            | Creates a database job and queues it                 |
| `GET /jobs`             | Lists jobs after refreshing queue positions          |
| `GET /jobs/:id`         | Returns one job or 404                               |
| `GET /jobs/:id/result`  | Returns a signed download URL when the result exists |

The controller is intentionally thin. It accepts parameters and delegates to services; orchestration lives in `JobsService`.

## 8. Upload presigning

`JobsService.presign()` does two things:

```ts
const safeName = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
const objectKey = `inputs/${randomUUID()}-${safeName}`;
```

The filename is sanitized to replace characters outside letters, numbers, dots, underscores, and hyphens. A UUID prevents common filename collisions. The method returns:

```json
{
  "objectKey": "inputs/UUID-invoice.pdf",
  "uploadUrl": "temporary-minio-put-url"
}
```

The browser then performs a direct `PUT` to that URL. The API does not receive the file bytes.

## 9. MinIO storage service

`backend/src/storage/storage.service.ts` creates two MinIO clients.

### Internal client

`client` uses `MINIO_ENDPOINT` and is used by the backend process to:

- create/check the bucket at startup;
- write result JSON.

In Docker, this is normally `minio:9000`, which is reachable from backend containers.

### Presigning client

`presignClient` uses `MINIO_PUBLIC_ENDPOINT` and is used to generate URLs that the browser can reach. In local development this is normally `localhost:9000`; the Docker service name `minio` would not be reachable from the host browser.

### Lifecycle and methods

`onModuleInit()` creates the configured bucket if it does not exist.

- `presignUpload(objectKey)` creates a 15-minute signed PUT URL.
- `putJson(objectKey, value)` serializes the value with two-space indentation and writes it as `application/json`.
- `presignDownload(objectKey)` creates a 15-minute signed GET URL.

The service stores objects under one bucket, usually `sripage`, with `inputs/` and `results/` prefixes.

## 10. Job creation and queueing

`JobsService.create()` is the API-side orchestration step.

1. `parsers.get(dto.method)` validates that the method exists. An unknown method throws Nest's `NotFoundException`.
2. The runtime is selected as the parser's first supported runtime, or `cpu` if none exists.
3. A `Job` row is saved with `queued` status, no result, no error, and no result object key.
4. A BullMQ job named `parse-pdf` is added to the `pdf-parsing` queue with `{ jobId }` as its payload.
5. BullMQ uses the database job ID as its job ID and retains up to 100 completed and 100 failed queue entries.
6. `refreshPositions()` recalculates visible queue positions.
7. The saved job is returned through `get()`.

The database save happens before the Redis queue add. This makes the job visible durably before processing begins, but it also means a Redis failure after the database save can leave a permanently queued database row. There is no transaction/outbox recovery mechanism yet.

## 11. Queue definition

`backend/src/queue/queue.module.ts` defines:

```ts
export const PARSE_QUEUE = 'pdf-parsing';
export const PARSE_QUEUE_TOKEN = 'PARSE_QUEUE';
```

The module manually constructs a BullMQ `Queue` using `REDIS_URL`, provides it under `PARSE_QUEUE_TOKEN`, and exports that token for injection into `JobsService` and `main.ts`.

BullMQ is the asynchronous execution layer. Redis knows about queue state, retries/failures, and worker activity; PostgreSQL stores the application-level status shown to users.

## 12. Worker processing

`WorkerService.onModuleInit()` starts a BullMQ `Worker` only when `WORKER_ENABLED` equals `true`.

```ts
new Worker(
  PARSE_QUEUE,
  async (queueJob) => this.process(queueJob),
  {
    connection: { url: REDIS_URL },
    concurrency: Number(WORKER_CONCURRENCY || 1),
  },
)
```

`WORKER_CONCURRENCY` controls how many queue jobs one worker process can execute concurrently. The default is 1.

### One job's worker path

`process()` receives a payload typed as `{ jobId: string }`.

1. It loads the job from PostgreSQL with `jobs.get()`.
2. It updates status to `processing` and clears its queue position.
3. It refreshes positions for the jobs still marked `queued`.
4. It calls `ParserService.parse()` with metadata: job ID, filename, input object key, and MIME type.
5. It writes the parser output to `results/<job-id>.json` in MinIO.
6. It updates PostgreSQL to `completed`, storing both JSON result and result object key.
7. If an exception occurs, it updates the job to `failed` with an error message and rethrows the error so BullMQ also records the queue failure.
8. The `finally` block refreshes queue positions regardless of success or failure.

The worker never returns the parsed result directly to the browser. The browser observes the PostgreSQL status through `GET /jobs/:id` and can obtain a temporary artifact URL through `GET /jobs/:id/result`.

## 13. Queue position logic

`JobsService.refreshPositions()` queries all jobs whose database status is `queued`, ordered by `createdAt` ascending. It assigns positions `1, 2, 3, ...` and clears positions on all `processing` jobs.

This is a user-facing estimate, not BullMQ's authoritative internal ordering. It can become briefly stale under concurrent requests because each job is updated independently with `Promise.all()`. It also does not account for jobs that are in Redis but have no matching PostgreSQL row.

## 14. Parser architecture

The parser layer is deliberately small and replaceable.

### Contract

`parser.types.ts` defines:

```ts
type ParserRuntime = 'cpu' | 'gpu';

interface ParserInput {
  jobId: string;
  filename: string;
  inputObjectKey: string;
  mimeType: string;
}

interface ParserOutput {
  method: string;
  pages: number;
  fields: Record<string, unknown>;
}

interface PdfParser {
  method: string;
  supportedRuntimes: ParserRuntime[];
  parse(input: ParserInput): Promise<ParserOutput>;
}
```

Any real parser needs a unique `method`, declares supported runtimes, and implements `parse()`.

### Registry

`ParserService` keeps an in-memory map:

```ts
[
  ['non-vlm', new DummyNonVlmParser()],
  ['vlm', new DummyVlmParser()],
]
```

Its responsibilities are:

- `list()` - expose available methods and runtimes;
- `get(method)` - resolve a method or throw 404;
- `parse(method, runtime, input)` - validate runtime support and invoke the parser.

`initializedRuntimes` records runtime names in a `Set`, but that set is not read anywhere else. It currently has no observable effect and appears to be scaffolding for future runtime initialization.

### Current dummy implementation

`DummyParser` supports CPU only, waits 10 seconds, then returns deterministic demo data including:

- parser method;
- one page;
- document type `dummy-invoice`;
- original filename;
- invoice number `DEMO-0001`;
- total `1234.56`;
- current ISO timestamp.

Despite receiving `inputObjectKey`, the dummy parser does not download or inspect the PDF. Therefore the current system demonstrates job orchestration, not real PDF extraction.

## 15. What happens on errors

Nest automatically turns thrown HTTP exceptions into HTTP error responses. The most explicit cases are:

- unknown parser method: `NotFoundException`;
- missing job: `NotFoundException('Job not found')`;
- result requested before completion: `NotFoundException('Result is not ready')`;
- unsupported parser runtime: normal `Error`, which causes worker failure.

For parser errors, the worker stores a human-readable message in the database and rethrows the original error. BullMQ then marks its queue job as failed. The API's `GET /jobs/:id` still exposes the database status and error field.

There is no custom global exception filter, structured logger, authentication guard, rate limiting, cancellation endpoint, retry policy in application code, or cleanup process for orphaned MinIO inputs.

## 16. Environment variables

The important settings are:

| Variable                           | Meaning                                         | Local default/example                                |
| ---------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `PORT`                           | API port                                        | `3000`                                             |
| `CORS_ORIGIN`                    | Allowed browser origins                         | `http://localhost:3001`                            |
| `DATABASE_URL`                   | PostgreSQL connection string                    | local`sripage` database                            |
| `DB_SYNCHRONIZE`                 | TypeORM schema synchronization                  | `true` for development                             |
| `REDIS_URL`                      | Redis/BullMQ connection                         | `redis://localhost:6379`                           |
| `WORKER_ENABLED`                 | Whether a process consumes jobs                 | `false` for API, `true` for worker               |
| `WORKER_CONCURRENCY`             | Jobs per worker process                         | `1`                                                |
| `BULL_BOARD_ENABLED`             | Enable queue dashboard                          | `true`                                             |
| `BULL_BOARD_PATH`                | Queue dashboard path                            | `/admin/queues`                                    |
| `MINIO_ENDPOINT`/`PORT`        | Backend-reachable MinIO address                 | `localhost:9000` locally, `minio:9000` in Docker |
| `MINIO_PUBLIC_ENDPOINT`/`PORT` | Browser-reachable MinIO address for signed URLs | `localhost:9000`                                   |
| `MINIO_ACCESS_KEY`               | MinIO access key                                | development value in`.env.example`                 |
| `MINIO_SECRET_KEY`               | MinIO secret key                                | development value in`.env.example`                 |
| `MINIO_BUCKET`                   | Object bucket                                   | `sripage`                                          |

The internal and public MinIO endpoints are separate on purpose. This is one of the most important container/browser networking details in the project.

## 17. Docker deployment model

`docker-compose.dev.yml` runs only PostgreSQL, Redis, and MinIO. Developers run the API, worker, and frontend from their package directories.

`docker-compose.prod.yml` runs five services:

- `postgres`
- `redis`
- `minio`
- `backend`, executing `node dist/main`
- `worker`, executing `node dist/worker-main`
- `frontend`, serving the Next.js app

The backend Dockerfile uses a two-stage build:

1. Node 22 Alpine installs all dependencies and compiles TypeScript with `pnpm build`.
2. A smaller Node 22 Alpine runtime installs production dependencies and copies only `dist`.

The API and worker use the same image but different entrypoints. The API listens on port 3000; the worker has no HTTP port.

## 18. Testing and TypeScript configuration

The project uses Jest with `ts-jest`.

- `app.controller.spec.ts` verifies the starter controller returns `Hello World!`.
- `parser.service.spec.ts` verifies the two registered methods and rejects an unknown method.
- `test/app.e2e-spec.ts` boots `AppModule` and verifies `GET /`.

The current tests do not cover database persistence, MinIO, Redis, queueing, worker success/failure, DTO validation, or the upload-to-result lifecycle.

TypeScript is configured for modern Node:

- target `ES2023`;
- decorators and emitted decorator metadata enabled for NestJS;
- strict null checks enabled;
- source maps and declarations emitted;
- build excludes tests and `*.spec.ts` files.

## 19. A concrete request walkthrough

Assume a user selects `invoice.pdf` in the frontend.

1. Frontend sends metadata to `POST /uploads/presign`.
2. API sanitizes the filename and asks MinIO for a signed PUT URL valid for 900 seconds.
3. Frontend uploads bytes directly to MinIO.
4. Frontend sends the returned object key to `POST /jobs` with method `non-vlm`.
5. API resolves `DummyNonVlmParser`, selects `cpu`, saves a queued row, and adds `{ jobId }` to BullMQ.
6. Worker receives `parse-pdf`, loads the row, and marks it processing.
7. Dummy parser waits 10 seconds and returns demo JSON; it does not open the uploaded object.
8. Worker writes `results/<job-id>.json` to MinIO and stores the same object in PostgreSQL JSONB.
9. Worker marks the row completed.
10. Frontend polling sees `completed`, displays the JSON, and can request a signed download URL.

## 20. Important current limitations and extension points

The most useful things to know before extending this backend are:

- **Real parsing:** implement `PdfParser` under `backend/src/parsers`, download/read `inputObjectKey`, produce `ParserOutput`, and register the parser in `ParserService`.
- **Input validation:** enforce PDF MIME types, maximum file size, and ownership/authorization of object keys before production use.
- **Security:** there is currently no authentication or authorization; every exposed job ID is effectively readable by anyone who can call the API.
- **Consistency:** use a transaction plus an outbox/reconciliation strategy if database rows and Redis messages must never diverge.
- **Concurrency:** replace the simple position recalculation with a stronger queue-position model if exact ordering matters.
- **Production schema:** replace TypeORM synchronization with migrations.
- **Lifecycle cleanup:** add retention/deletion rules for old input and result objects.
- **Observability:** add structured logs, metrics, and correlation IDs around API requests and worker jobs.
- **Cancellation/retries:** add explicit application behavior if users need cancellation or controlled parser retries.
- **Result contract:** the demo output is intentionally simple; real parsers should define versioned, validated result schemas.

## 21. How to read the code in the best order

For future changes, use this sequence:

1. Start at `main.ts` or `worker-main.ts` to identify which process you are changing.
2. Read `app.module.ts` to see how dependencies are assembled.
3. Follow an HTTP route from `jobs.controller.ts` into `jobs.service.ts`.
4. Inspect the `Job` entity to understand persisted state.
5. Follow queue creation in `queue.module.ts` and consumption in `worker.service.ts`.
6. Follow parser selection through `ParserService` and the `PdfParser` interface.
7. Inspect `StorageService` whenever a change crosses the browser/backend/MinIO network boundary.
8. Update tests and run the full upload-to-completion flow when changing orchestration.

That path mirrors the actual runtime and makes it easier to distinguish HTTP concerns, durable state, asynchronous execution, parsing logic, and object storage.
