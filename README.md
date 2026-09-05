# SriPage

SriPage is a local-first PDF parsing demo. The browser uploads PDFs directly to MinIO, the API records a job in PostgreSQL and queues it in Redis/BullMQ, and a separate worker runs the selected parser.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the complete developer runbook, API-only workflow, MinIO and Redis inspection commands, database queries, troubleshooting, and parser extension guide.

## Development

1. Start the dependencies with `docker compose -f docker-compose.dev.yml up -d`.
2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`.
3. In `backend`, run `pnpm start:dev`.
4. In another terminal, run `pnpm build && pnpm start:worker` with `WORKER_ENABLED=true` in the environment.
5. In `frontend`, run `pnpm dev`.

## Production

Copy the root `.env.example` to `.env`, set the secrets and public MinIO endpoint, then run:

```bash
docker compose --env-file .env -f docker-compose.prod.yml up --build
```

The frontend dashboard is available on port 3001, the API on port 3000, the interactive API documentation is available at http://localhost:3000/docs, and the BullMQ queue dashboard is available at http://localhost:3000/admin/queues. The raw OpenAPI document is available at http://localhost:3000/docs-json. Set `SWAGGER_PATH` to change the documentation path. Add a parser by implementing `PdfParser` in `backend/src/parsers` and registering it in `ParserService`.
