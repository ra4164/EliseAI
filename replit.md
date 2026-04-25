# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## RMA Lead Enricher — Key Features

- **Left sidebar navigation**: Dashboard, Leads, Sales Data, Outreach (+ Add Leads CTA)
- **Lead enrichment**: U.S. Census, WalkScore, NewsAPI + Gemini AI → lead score, sales insights, outreach email
- **Batch uploads**: CSV upload, bulk paste; batches tagged with ID/label; CSV download
- **Tiered outreach queue**: Hot/Warm/Cold tabs; per-lead mailto pre-fill; approve-and-send flow
- **Duplicate detection** (POST /leads):
  - Same email → skipped (exact duplicate)
  - Same property address + different contact → `conflicts[]` returned, user merges via UI
  - Same name + different address → created normally
- **Additional contacts**: `additionalContacts[]` on Lead; POST `/leads/:id/contacts` to merge; per-contact outreach send in Outreach page
- **9 AM cron auto-enrichment** + manual enrich-all trigger
- **In-memory store** (Map); no database required for the Lead Enricher artifact
