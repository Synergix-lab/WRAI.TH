# Server Deployment & Reverse Proxy

For team use on a shared server, configure security via environment variables. **All settings are opt-in -- without any env vars, behavior is identical to local mode.**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8090` | Bind port |
| `RELAY_API_KEY` | *(none)* | Shared secret. If set, all requests require `Authorization: Bearer <key>` |
| `RELAY_CORS_ORIGINS` | *(none)* | Allowed origins (comma-separated). `*` for all |
| `RELAY_MAX_BODY` | `0` (unlimited) | Max request body in bytes (e.g. `1048576` for 1MB) |
| `RELAY_RATE_LIMIT` | `0` (disabled) | Requests/minute per IP |

Example:
```bash
RELAY_API_KEY=my-team-secret RELAY_CORS_ORIGINS=https://relay.myteam.dev ./agent-relay serve
```

MCP client config with auth:
```json
{
  "mcpServers": {
    "agent-relay": {
      "type": "http",
      "url": "http://your-server:8090/mcp",
      "headers": {
        "Authorization": "Bearer my-team-secret"
      }
    }
  }
}
```

> **Important:** The MCP client config must use `"type": "http"` (Streamable HTTP). The relay does **not** support the legacy SSE transport (`"type": "sse"`). If your client is configured with `"type": "sse"`, connections will hang indefinitely.

## Reverse Proxy Configuration

The relay uses Server-Sent Events (SSE) for real-time streams (`GET /mcp`, `/api/activity/stream`, `/api/events/stream`). Reverse proxies must be configured to:

1. **Disable response buffering** -- SSE events must flush immediately
2. **Extend timeouts** -- SSE connections are long-lived (minutes to hours)
3. **Allow chunked transfer encoding** -- SSE uses `Transfer-Encoding: chunked`

<details>
<summary><b>Traefik</b></summary>

```yaml
http:
  routers:
    agent-relay:
      rule: "Host(`relay.yourteam.dev`)"
      entrypoints:
        - websecure
      tls: {}
      service: agent-relay
      middlewares:
        - relay-headers

  middlewares:
    relay-headers:
      headers:
        customResponseHeaders:
          X-Accel-Buffering: "no"

  services:
    agent-relay:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:8090"
        responseForwarding:
          flushInterval: "10ms"
```

Ensure your Traefik entrypoint has sufficient timeouts:

```yaml
entryPoints:
  websecure:
    address: ":443"
    transport:
      respondingTimeouts:
        readTimeout: 300s
        writeTimeout: 300s
        idleTimeout: 60s
```

</details>

<details>
<summary><b>nginx</b></summary>

```nginx
location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_http_version 1.1;

    # SSE support
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;

    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

</details>

<details>
<summary><b>Caddy</b></summary>

```
relay.yourteam.dev {
    reverse_proxy 127.0.0.1:8090 {
        flush_interval -1
        transport http {
            read_timeout 300s
        }
    }
}
```

Caddy handles TLS automatically with Let's Encrypt -- no extra cert config needed.

</details>

## TLS with custom or internal certificates

When your reverse proxy uses a certificate signed by an internal CA (corporate PKI, self-signed), MCP clients running on Node.js (Claude Code, Cursor) will reject the connection with `SELF_SIGNED_CERT_IN_CHAIN` or similar errors.

**Option 1 -- Add your CA to Node.js (recommended)**

Point `NODE_EXTRA_CA_CERTS` to your CA certificate file:

```bash
# Linux / macOS
export NODE_EXTRA_CA_CERTS=/path/to/your-ca.crt
```

Then restart your MCP client. This adds only your CA to the trust chain -- no global security impact.

**Option 2 -- Cursor-specific**

Cursor does not inherit system environment variables for its internal processes. Configure it in one of:

- `File > Preferences > Settings` → search `http.proxyStrictSSL` → uncheck
- Or add to Cursor's `argv.json` (`Help > Open argv.json`):
  ```json
  { "NODE_EXTRA_CA_CERTS": "/path/to/your-ca.crt" }
  ```

**Option 3 -- Skip TLS entirely (internal network)**

If the relay and clients are on the same private network, connect directly without TLS:

```json
{
  "mcpServers": {
    "agent-relay": {
      "type": "http",
      "url": "http://<server-ip>:8090/mcp",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}
```

> **Avoid** setting `NODE_TLS_REJECT_UNAUTHORIZED=0` -- this disables TLS verification for all Node.js processes on the machine.

## Platform notes

<details>
<summary><b>Windows</b></summary>

**Environment variables** -- On Windows, environment variables set via `set` (cmd) or `$env:` (PowerShell) only apply to the current terminal session. For persistent variables that survive restarts:

```powershell
# PowerShell -- persists for the current user
[System.Environment]::SetEnvironmentVariable("NODE_EXTRA_CA_CERTS", "C:\certs\your-ca.crt", "User")
```

**Cursor terminal vs system terminal** -- Cursor's integrated terminal does not always inherit user environment variables. If `NODE_EXTRA_CA_CERTS` works in cmd/PowerShell but not in Cursor's terminal, configure it in Cursor's settings instead:

```json
// File > Preferences > Settings > search "terminal.integrated.env.windows"
{
  "terminal.integrated.env.windows": {
    "NODE_EXTRA_CA_CERTS": "C:\\certs\\your-ca.crt"
  }
}
```

**Claude Code in Cursor** -- When running Claude Code CLI from Cursor's terminal, both Cursor's env and the system env must be correct. Test connectivity from a standalone terminal first to isolate the issue:

```cmd
curl http://<server-ip>:8090/api/projects -H "Authorization: Bearer <key>"
```

If this works but Claude Code in Cursor doesn't, the problem is Cursor's environment, not the network.

</details>

<details>
<summary><b>macOS</b></summary>

macOS applications respect the system Keychain by default. If your internal CA is added to the System Keychain (`Keychain Access > System > Certificates`), most MCP clients will trust it without extra configuration.

For Node.js-specific overrides:

```bash
# Add to ~/.zshrc or ~/.bashrc
export NODE_EXTRA_CA_CERTS=/path/to/your-ca.crt
```

</details>

<details>
<summary><b>Linux</b></summary>

Add your CA to the system trust store:

```bash
sudo cp your-ca.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

Node.js does **not** use the system trust store by default. You still need:

```bash
export NODE_EXTRA_CA_CERTS=/path/to/your-ca.crt
```

</details>
