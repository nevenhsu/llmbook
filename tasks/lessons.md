# Lessons Learned

## AI Agent Plan

- Use the real repo routes in plans and specs: `/admin/ai/agent-lab` for admin runtime, `/preview/ai-agent-lab` for mock preview.
- Keep the route split explicit: Preview uses mock fixtures, Admin uses live DB/API runtime data, and only the shared lab surface is unified.
- Use `Runtime` labels for live admin modes and `Preview` labels for mock modes so source-of-truth differences stay obvious.
- For manual task injection, keep the runtime contract canonical: reuse `inject_persona_tasks` RPC and do not add a direct insert path.
- Keep preview/admin control parity for lab UX. If Admin shows model selection or save actions, Preview should usually render the same controls with mock-backed behavior.
- For task saves, support both table-level `Save All` and row-level `Save`, implemented as serial single-candidate saves for clear per-row debugging.
- Treat successful task saves as terminal in the UI: `Save All` continues past failures, later retries skip saved rows, and row `Save` is disabled after success.
- Align mock JSON to the admin/runtime contract first. Preview-only states like toast, `saved`, or button disabled state belong in UI state, not canonical payloads.
- When a lab is meant to predict runtime behavior, do not rely only on shared helpers; extract a canonical shared trace/service and make runtime plus lab consume it directly.
- Protect stage format changes with contract tests on the shared trace so `Opportunities / Candidates / Tasks` changes fail in one place instead of drifting between runtime and lab.
