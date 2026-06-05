# WebDiplome AI Worker

Run this on the dedicated AI PC, not on public hosting.

```bash
npm install
export WEBDIPLOME_API_ORIGIN="https://your-hosted-api.example.com"
export AI_WORKER_TOKEN="same secret configured on the hosted API"
export LM_STUDIO_BASE_URL="http://127.0.0.1:1234"
export LM_STUDIO_MODEL="google/gemma-4-e2b"
export LM_STUDIO_CONTEXT_LENGTH="131072"
npm run worker:ai
```

LM Studio must be reachable only from this AI PC. Do not expose LM Studio directly to the public internet.

The worker calls `POST /api/v1/models/load` with `context_length` before each job so JIT-loaded models do not fall back to a 4096-token context (see LM Studio issue #1463). Set `LM_STUDIO_CONTEXT_LENGTH` to match your GUI load setting.

## Multiple PCs (home vs away)

**Hosted jobs:** run `npm run worker:ai` on whichever AI PC is on. Only one worker needs to be online; it polls the hosted API and claims jobs locally against `http://127.0.0.1:1234`.

**Local generator (`server-generate.js`):** configure ordered endpoints in `data/lm_studio.json`. The server probes each host and uses the first reachable one (primary → fallbacks). Add a second entry when you have the away PC address:

```json
{
  "endpoints": [
    { "name": "home", "baseUrl": "http://192.168.1.109:1234", "model": "google/gemma-4-e2b" },
    { "name": "away", "baseUrl": "http://YOUR_AWAY_HOST:1234", "model": "google/gemma-4-e4b" }
  ]
}
```

The away `baseUrl` must be reachable from the machine running `server-generate` (same LAN, Tailscale IP, etc.). A plain `192.168.x.x` address only works on that local network.
