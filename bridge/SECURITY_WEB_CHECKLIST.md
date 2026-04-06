# ChatBridge Web Security Checklist

- Serve third-party apps from their own reviewed `entryUrl` origins in production.
- Ensure each approved manifest declares an `origin` that exactly matches `new URL(entryUrl).origin`.
- Allow the bridge API over CORS only from approved Chatbox web host origins via `CHATBRIDGE_ALLOWED_ORIGINS`.
- Keep the app proxy disabled in production. Enable `ENABLE_APP_PROXY_DEV=true` only for explicit local development.
- Do not store third-party OAuth tokens or PKCE state inside iframe `localStorage`.
- Require a valid bridge client token for session-bound routes, tool execution, and provider auth status/start endpoints.
- Confirm iframe sandbox stays at `allow-scripts allow-forms allow-popups` unless a reviewed exception is approved.
