---
name: Expo mobile artifact workflow issue
description: restart_workflow always fails for kind="mobile" Expo artifacts in this Replit environment — root cause and workaround.
---

# Expo Mobile Artifact Workflow — DIDNT_OPEN_A_PORT

## The rule
`restart_workflow` always fails with "DIDNT_OPEN_A_PORT" for `kind = "mobile"` artifacts, regardless of what the process does.

**Why:** The platform readiness check for mobile artifacts does NOT rely on TCP port detection from inside the container. It appears to use an external HTTPS check against the Expo dev domain that never returns satisfied during `restart_workflow`. This may be a known Replit platform limitation for Expo workflows.

**How to apply:**
- Do NOT attempt to fix the DIDNT_OPEN_A_PORT error with proxy scripts, different ports, SO_REUSEADDR, or `router = "expo-domain"` changes — none of these help.
- Metro DOES start correctly when the workflow runs (confirmed in logs: QR code appears, port opens after ~15s).
- After `restart_workflow` times out, it kills Metro. The process is NOT still running.
- The user must start the workflow manually from the Replit Run button.
- Artifact.toml should have: `router = "expo-domain"`, `localPort = 25459`, no `ensurePreviewReachable`.
- The dev-proxy.js wrapper (opens port immediately, forwards to Metro on port+1) is still useful for when the user manually starts the workflow — it makes the port available faster.
- Expo dev domain for this Repl: `b3133e6c-7f83-4c57-8de8-44f3f83f9255-00-l1vxozqjzicq-un0jz0vb.expo.picard.replit.dev`
