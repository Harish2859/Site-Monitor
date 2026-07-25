---
name: WebSocket path must be in artifact.toml
description: /ws path must be declared in the API server's artifact.toml paths array
---

## The rule
The reverse proxy only forwards requests for paths explicitly listed in `artifact.toml`. WebSocket upgrade requests to `/ws` are silently dropped unless `/ws` is in the paths array.

```toml
[[services]]
localPort = 8080
name = "API Server"
paths = ["/api", "/ws"]
```

**Why:** The shared proxy routes by path prefix. Unlisted paths are never forwarded to the service, so WS upgrade handshakes never reach the server and the frontend gets a connection error.

**How to apply:** Whenever an app uses WebSockets, add the WS path to artifact.toml paths alongside the REST API path, then call verifyAndReplaceArtifactToml to apply it.
