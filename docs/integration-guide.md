# ChatBridge Integration Guide

**ChatBridge** is a chat-agnostic platform for embedding interactive apps inside conversational interfaces. It consists of:

- **Bridge Server** — A Node.js REST API that handles OAuth brokering, app registry, and session management
- **App SDK** — A lightweight TypeScript contract (~110 lines) defining the `postMessage` protocol between a host chat UI and embedded apps
- **Sample Apps** — Chess, Weather, Spotify, and Quiz apps that implement the contract

The platform is **UI-agnostic**. The Chatbox fork included in this repo is one possible frontend, but any chat interface (React, Vue, vanilla JS, mobile) can host ChatBridge apps by implementing the host side of the postMessage bridge.

```
┌─────────────────────────────────┐
│  Your Chat UI                   │
│  ┌───────────────────────────┐  │
│  │  iframe: Chess App        │  │  ← postMessage bridge
│  └───────────────────────────┘  │
└────────────┬────────────────────┘
             │ REST
             ▼
┌─────────────────────────────────┐
│  Bridge Server                  │
│  • App Registry                 │
│  • OAuth Broker                 │
│  • Session Store                │
└─────────────────────────────────┘
```

---

## Host-App Contract

The bridge protocol uses `window.postMessage` between your chat UI (the host) and apps running in sandboxed iframes. All messages are typed objects with a `type` and `payload`.

### Host → App Events

| Event | When to send | Payload |
|---|---|---|
| `host:init` | After app emits `app:ready` | `{ appId, appSessionId, chatSessionId }` |
| `host:resume-session` | Restoring a previous session | `{ appSessionId, state }` |
| `host:tool-result` | Returning data the app requested | `{ toolName, result }` |
| `host:request-complete` | Asking the app to wrap up | `{ summary? }` |
| `host:auth-state` | OAuth status changed | `{ status, scopes }` |

### App → Host Events

| Event | When emitted | Payload |
|---|---|---|
| `app:ready` | App iframe loaded | `{ appId, version }` |
| `app:resize` | App needs more/less height | `{ height }` |
| `app:request-tool` | App needs to call a tool | `{ toolName, args }` |
| `app:save-state` | App wants to persist state | `{ state }` |
| `app:complete` | Task finished | `{ summary, output? }` |
| `app:error` | Something went wrong | `{ message }` |

### Lifecycle Flow

```
Host                          App (iframe)
 │                              │
 │  ◄── app:ready ──────────── │
 │  ─── host:init ───────────► │
 │                              │
 │  ◄── app:request-tool ───── │
 │  ─── host:tool-result ────► │
 │                              │
 │  ◄── app:complete ───────── │
 │                              │
```

---

## Bridge Server API

The Bridge Server is the only backend component. It exposes REST endpoints for app discovery, OAuth brokering, and API proxying.

### Base URL

In development: `http://localhost:3300`
In production: your deployed server URL (e.g., `https://bridge.yourdomain.com`)

### App Registry

The Bridge server maintains a registry of available apps and their manifests. Each manifest declares the app's tools, permissions, and entry URL.

### OAuth Endpoints

These endpoints handle the Spotify OAuth flow. The same pattern applies for adding other OAuth providers.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/auth/spotify/start` | Returns the Spotify authorization URL to redirect the user to |
| `GET` | `/auth/spotify/callback` | OAuth redirect handler — exchanges code for tokens |
| `GET` | `/auth/spotify/status` | Returns current auth state (`disconnected`, `connecting`, `connected`, `expired`) |
| `POST` | `/auth/spotify/disconnect` | Revokes token and clears stored credentials |

### Proxy Endpoints

Authenticated API calls are proxied through the Bridge server so that access tokens never reach the browser.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/spotify/playlists` | Proxies to Spotify's playlist API |
| `GET` | `/api/spotify/me` | Proxies to Spotify's user profile API |

### Environment Variables

```
SPOTIFY_CLIENT_ID        # Required — from Spotify Developer Dashboard
SPOTIFY_CLIENT_SECRET    # Required — from Spotify Developer Dashboard
SPOTIFY_REDIRECT_URI     # Required in prod — e.g. https://bridge.yourdomain.com/auth/spotify/callback
```

---

## Deployment

### What you're deploying

| Component | Type | Count |
|---|---|---|
| Bridge Server | Node.js server | 1 |
| Apps (chess, weather, spotify, quiz) | Static files | 4 (or consolidated into 1 host) |

Your chat UI is your own — you deploy it however you already deploy frontends.

### Bridge Server

Any Node.js host works: Railway, Render, Fly.io, a VPS, etc.

```bash
cd bridge
npm install
npm run build
npm start
```

Set your environment variables on the host:

```
SPOTIFY_CLIENT_ID=xxx
SPOTIFY_CLIENT_SECRET=xxx
SPOTIFY_REDIRECT_URI=https://bridge.yourdomain.com/auth/spotify/callback
```

Then update your Spotify Developer Dashboard's redirect URI to match.

### Apps

Each app is a static `public/` directory. Deploy options:

**Option A — Separate deploys** (simplest)
Deploy each `apps/*/public/` folder as its own static site:
- `chess.yourdomain.com`
- `weather.yourdomain.com`
- `spotify.yourdomain.com`
- `quiz.yourdomain.com`

**Option B — Single host with subpaths**
Serve all apps under one domain using nginx, Caddy, or a static host with rewrites:
- `apps.yourdomain.com/chess`
- `apps.yourdomain.com/weather`
- etc.

### Updating the Registry

After deploying, update the app registry so that each app's `entry_url` and `allowed_origin` point to your production URLs. This can be done in `bridge/src/registry/localApps.ts` for the in-memory registry, or via the database if the DB layer is enabled.

Alternatively, externalize these to environment variables so you don't need to rebuild the server when URLs change.

### Production Considerations

- **Persistence** — The Bridge server can store OAuth tokens and sessions in memory or in Postgres. For production, use the database-backed mode so state survives restarts.
- **CORS** — The server currently allows all origins (`origin: true`). Restrict this to your chat UI's domain.
- **HTTPS** — All origins (Bridge, apps, chat UI) must use HTTPS in production for `postMessage` origin checks to work securely.

---

## Implementing the Host Side

Your chat UI needs to do three things: fetch the app registry, mount iframes, and handle the postMessage protocol.

### 1. Fetch Available Apps from the Registry

On startup, pull the list of active apps from the Bridge server. This gives you each app's entry URL, allowed origin, and tool schemas — no hardcoding needed.

```typescript
// GET /api/registry/active
const response = await fetch('https://bridge.yourdomain.com/api/registry/active')
const { apps } = await response.json()

// apps[] contains:
// {
//   app_id, version_id, display_name, display_description,
//   display_category, tools, entry_url, allowed_origin, activated_at
// }

// Build the origin allowlist dynamically
const registeredOrigins = new Set(apps.map(a => a.allowed_origin))
```

### 2. Launch an App Session

When your chat UI decides to launch an app, call the session launch endpoint. This pins the app version so mid-conversation updates don't break a running session.

```typescript
// POST /api/sessions/launch
const { app_session_id, app } = await fetch(
  'https://bridge.yourdomain.com/api/sessions/launch',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_session_id: 'chat-456', app_id: 'chess' })
  }
).then(r => r.json())

// Mount the iframe using the entry_url from the response
const iframe = document.createElement('iframe')
iframe.src = app.entry_url
iframe.sandbox = 'allow-scripts allow-same-origin allow-popups'
container.appendChild(iframe)
```

### 3. Check for Version Updates

For long-running sessions, you can check if a newer app version has been activated:

```typescript
// GET /api/sessions/:appSessionId/status
const status = await fetch(
  `https://bridge.yourdomain.com/api/sessions/${app_session_id}/status`
).then(r => r.json())

if (status.version_update_available) {
  // Notify user that a newer version is available
}
```

### 4. Handle the postMessage Bridge

Listen for app events, validate origins from the registry, and respond with host events. See the Host-App Contract section for the full event reference.

```typescript
window.addEventListener('message', (event) => {
  if (!registeredOrigins.has(event.origin)) return

  const { type, payload } = event.data

  switch (type) {
    case 'app:ready':
      iframe.contentWindow.postMessage({
        type: 'host:init',
        payload: {
          appId: app.app_id,
          appSessionId: app_session_id,
          chatSessionId: 'chat-456'
        }
      }, event.origin)
      break

    case 'app:resize':
      iframe.style.height = `${payload.height}px`
      break

    case 'app:request-tool':
      const result = await handleToolCall(payload.toolName, payload.args)
      iframe.contentWindow.postMessage({
        type: 'host:tool-result',
        payload: { toolName: payload.toolName, result }
      }, event.origin)
      break

    case 'app:complete':
      addToChatContext(payload.summary)
      break

    case 'app:error':
      console.error('App error:', payload.message)
      break
  }
})
```

---

## Building a Custom App

A ChatBridge app is a static web page that runs inside an iframe and communicates with the host via `postMessage`. No server required.

### Minimal App Structure

```
my-app/
├── public/
│   ├── index.html
│   └── manifest.json
```

### manifest.json

Declares your app's identity, tools, and permissions:

```json
{
  "id": "my-app",
  "version": "0.1.0",
  "name": "My App",
  "description": "What this app does",
  "entryUrl": "https://my-app.yourdomain.com",
  "origin": "https://my-app.yourdomain.com",
  "permissions": ["session:write"],
  "scopes": [],
  "tools": [
    {
      "name": "launch_my_app",
      "description": "What this tool does — this is what the LLM reads to decide when to invoke your app",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "An input parameter"
          }
        },
        "required": ["query"]
      }
    }
  ]
}
```

**Key fields:**
- `tools[].description` — This is how the LLM decides whether to launch your app. Write it clearly.
- `tools[].inputSchema` — JSON Schema defining what arguments the host passes to your app.
- `permissions` — `session:write` for basic apps. Add `auth:oauth` if your app needs authenticated API access.
- `scopes` — OAuth scopes your app requires (e.g., `["playlist-read-private"]` for Spotify).

### index.html — Minimal Implementation

```html
<!DOCTYPE html>
<html>
<body>
  <div id="app">Loading...</div>
  <script>
    // 1. Signal ready
    window.parent.postMessage({
      type: 'app:ready',
      payload: { appId: 'my-app', version: '0.1.0' }
    }, '*')

    // 2. Listen for host events
    window.addEventListener('message', (event) => {
      const { type, payload } = event.data

      switch (type) {
        case 'host:init':
          // You're live — payload has appId, appSessionId, chatSessionId
          document.getElementById('app').textContent = 'Running!'
          startApp(payload)
          break

        case 'host:tool-result':
          // Response to a tool you requested
          handleResult(payload.toolName, payload.result)
          break

        case 'host:auth-state':
          // OAuth status update (if your app uses auth:oauth)
          updateAuthUI(payload.status)
          break
      }
    })

    function startApp(session) {
      // Your app logic here
    }

    // 3. Request a resize if needed
    function requestResize(height) {
      window.parent.postMessage({
        type: 'app:resize',
        payload: { height }
      }, '*')
    }

    // 4. Signal completion when done
    function finish(summary) {
      window.parent.postMessage({
        type: 'app:complete',
        payload: {
          summary: summary,   // Injected into chat context
          output: {}          // Optional structured data
        }
      }, '*')
    }
  </script>
</body>
</html>
```

### Registering Your App

Add your app's manifest to the Bridge server's registry. This can be done in `bridge/src/registry/localApps.ts` for the in-memory registry, or via the database if the DB layer is enabled.

### Testing Locally

```bash
cd my-app
npx serve public -l 3205
```

Then add the entry to the registry with `entryUrl: "http://localhost:3205"` and launch it from your chat UI.
