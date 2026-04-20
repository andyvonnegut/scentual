<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Development rules - Worktrees

There are multiple people working on this project at any given time.  ALWAYS use worktrees to partition your work.  If another worktree that conflicts with yours is pushed causing merge / pull conflicts, resolve the conflicts when you deploy.

# Deployment workflow

Always push directly to `main`. Production is `https://scentual.vercel.app/`. Do not create work branches, do not wait for Preview verification, do not ask for visual confirmation before promoting — just commit to `main` and push.

Unless the user explicitly asks for local-only work, docs-only exploration, or no deploy, do not stop at code changes. Finish the request end-to-end:
1. make the requested changes
2. update `architecture.md` if the change affects architecture, routes, schema, queries, scrapers, design tokens, env, or config
3. commit the intended files on `main`
4. push `main` so production updates
5. complete any database migrations required to implement the work you did

Treat commit + push as part of completing the request, not as an optional follow-up step.
<!-- END:nextjs-agent-rules -->

# Keep `architecture.md` current

`architecture.md` at the repo root is the canonical description of what the app does, how its pieces fit together, the Supabase schema, the scraper pipeline, and the design tokens. **Whenever you make a change that affects any of those, update `architecture.md` in the same change.** That includes:

- adding / removing / renaming routes, pages, API routes, or server actions
- changes to the Supabase schema (new migrations, renamed columns, new tables, RLS changes)
- new or changed queries in `lib/queries/*` that other code will call
- changes to the scraper pipeline (new source, normalization rules, ingestion behavior, cron schedule)
- new shared components in `components/brand/` or meaningful changes to existing ones
- changes to design tokens, fonts, or the color palette
- new env vars or config changes (`vercel.json`, `next.config.ts`, `tsconfig.json`)

If a change invalidates something in `architecture.md`, fix the doc before you finish. Treat a stale `architecture.md` as a bug.

# Environment variables

Vercel is the source of truth for env vars. Pull them into `.env.local` with `vercel env pull .env.local --environment production --yes` — the file is gitignored. `.env.example` lists the keys the app expects.

`CRON_SECRET` must be set in the Vercel **Production** environment: Vercel only attaches the `Authorization: Bearer $CRON_SECRET` header to cron invocations when that variable exists, and `app/api/cron/scrape/[source]/route.ts` returns 401 without it. If `scrape_runs` has no new rows after a scheduled window, check that this env var is still present before debugging anything else.
