<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Deployment workflow

Do not assume `https://scentual.vercel.app/` reflects the current working branch.

For now, every deploy must follow this order:
1. Push the work branch first so Vercel creates or updates a Preview deployment.
2. Verify the Preview deployment passes and shows the intended app behavior.
3. Only then promote the change to `main` and push `main` so production updates.
4. Verify production at `https://scentual.vercel.app/` after the `main` deploy is ready.

Do not push straight to `main` without a passing Preview unless the user explicitly says to bypass this flow.

Unless the user explicitly asks for local-only work, docs-only exploration, or no deploy, do not stop at code changes. Finish the request end-to-end:
1. make the requested changes
2. update `architecture.md` if the change affects architecture, routes, schema, queries, scrapers, design tokens, env, or config
3. commit the intended files
4. push the work branch and verify the Preview deployment
5. promote the verified commit to `main`, push `main`, and verify production

Treat commit + full deployment as part of completing the request, not as an optional follow-up step.
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
