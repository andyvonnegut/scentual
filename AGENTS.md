<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Deployment workflow

Do not assume `https://scentual.vercel.app/` reflects the current working branch.

For now, every deploy must follow this order:
1. Push the work branch first so Vercel creates or updates a Preview deployment.
2. Verify the Preview deployment passes and shows the intended app behavior.
3. Only then promote the change to `main` and push `main` so production updates.

Do not push straight to `main` without a passing Preview unless the user explicitly says to bypass this flow.
<!-- END:nextjs-agent-rules -->
