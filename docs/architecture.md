# 🏗️ Antigravity Bypass & Regional Unlocker — Architecture Guide (v2.0)

## 📌 Executive Summary

**Antigravity Bypass & Regional Unlocker** is a systems-level utility designed to bypass regional geo-restrictions (`ineligible_tiers`, `User location is not supported`, `geo-block`) across Google Antigravity developer tools without requiring a VPN.

The architecture combines three distinct layers:
1. **Application-Layer Binary & Script Patching:** In-place modification of compiled Go/C++ binaries and Electron/Node.js JavaScript sources.
2. **Network-Layer Selective Routing (SmartDNS + NRPT):** Kernel-level policy routing using Windows Name Resolution Policy Table (NRPT) coupled with a zero-leak loopback DNS forwarder.
3. **Resilience & Lifecycle Management:** Continuous file modification monitoring (Watchdog daemon) and atomic backups.

---

## 🏛️ System Architecture Diagram

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    Antigravity Bypass CLI (cli.js)                     │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────────────┐            ┌──────────────────────────────┐
│       Patcher Subsystem      │            │     SmartDNS & NRPT Subsystem │
│     (src/bypass/patch.js)    │            │  (src/bypass/dns-bypass.js)  │
└──────────────┬───────────────┘            └──────────────┬───────────────┘
               │                                           │
  ┌────────────┴────────────┐                 ┌────────────┴────────────┐
  │ • Chunked 4MB Scanner   │                 │ • DNS Relay 127.0.0.53  │
  │ • Byte Signature Engine │                 │ • DoH & UDP Race Pool   │
  │ • Balanced JS Parser    │                 │ • Validated Responses   │
  │ • Atomic Safe Writer    │                 │ • Windows NRPT Rules    │
  │ • Bit-Exact Backups     │                 │ • Hosts Fallback Pin    │
  └─────────────────────────┘                 └─────────────────────────┘
```

---

## ⚙️ Core Subsystems

### 1. Binary Patch Engine (`src/bypass/patcher/binary.js`)

#### Byte Signatures
Google Antigravity tools (including `agy.exe`, `language_server.exe`, and `language_server_windows_x64.exe`) contain hardcoded checks for regional eligibility. The binary patch engine executes byte-for-byte exact replacements:

| Target Signature | Replacement Signature | Byte Length | Purpose |
| :--- | :--- | :--- | :--- |
| `ineligible` | `inexigible` | 10 bytes | Bypasses tier/regional eligibility evaluations in compiled Go/C++ code |
| `https_proxy` | `AG_LS_PROXY` | 11 bytes | Prevents language server proxy hijacking and isolates bypass networking |

#### Memory-Efficient Chunked Scanning
Unlike naive patchers that allocate 200MB+ buffers in the V8 heap:
- Uses a **4MB chunked sliding window** with a 32-byte overlap across chunk boundaries.
- Uses `fs.openSync` and `fs.readSync` with an early-exit condition once both patched signatures are identified.
- Reduces memory footprint from **>250MB per binary down to <4MB**, completely avoiding V8 garbage collection stalls.

#### Atomic Writing & File Lock Mitigation (`src/bypass/patcher/process.js`)
On Windows, binaries currently mapped into running processes trigger `EBUSY` or `EPERM` errors:
- `killAffectedProcesses()` identifies and closes orphaned `language_server.exe` and `agy.exe` background tasks.
- Writes to a temporary `.agtmp` file in the destination folder first.
- Renames or atomic-copies the file into place with exponential backoff retries.

---

### 2. JavaScript & Electron AST Patcher (`src/bypass/patcher/ide.js`)

Antigravity IDE runs on top of Electron/VS Code (`resources/app/out/main.js` and `extension.js`):
- **Balanced Parentheses Scanner:** Implements a token-aware scanner that counts parenthesis depth while ignoring string literals (`'...'`, `"..."`, `` `...` ``) and comments (`//`, `/* ... */`).
- **Declaration Protection:** Differentiates call sites (e.g., `isAllowedCountry(user)`) from method/function declarations (e.g., `class Geo { isAllowedCountry(c) { ... } }` or `isAllowedCountry(c): boolean {`). Function and class method definitions are left intact, eliminating `SyntaxError` risks.
- **Literal Pattern Replacements:** Replaces `ineligible_tiers` with `inexigible_tiers` and `"SET_INELIGIBLE"` with `"SET_INEXIGIBLE"`.

---

### 3. SmartDNS & Windows NRPT Routing (`src/bypass/dns/`)

```
               Google API DNS Query
                       │
                       ▼
        Windows DNS Client (svchost.exe)
                       │
            [ Windows NRPT Rules ]
                       │
       Does hostname match *.googleapis.com?
             /                  \
          [YES]                [NO]
           /                      \
          ▼                        ▼
 Local Relay (127.0.0.53:53)   System Default DNS
          │
  [ DoH / UDP Fast Race ]
  (Validated NOERROR & ANCOUNT > 0)
          │
          ▼
 Unblock DNS Providers (comss.one, dns-ai.ru, geohide.ru)
```

#### Windows NRPT (Name Resolution Policy Table)
- Directs DNS queries for specific hostnames (`cloudcode-pa.googleapis.com`, `generativelanguage.googleapis.com`, etc.) to the local relay `127.0.0.53:53`.
- **Zero Impact on Regular Traffic:** Normal browsing, corporate VPNs, and internal domains bypass NRPT entirely and query the default gateway DNS.
- Applied safely in memory via PowerShell `Add-DnsClientNrptRule` using `-EncodedCommand`.

#### Validated DNS Race Condition Prevention
- Queries multiple DoH (HTTP/2) and UDP DNS endpoints simultaneously.
- Every response is validated using RFC 1035 wire specifications:
  - `QR === 1` (Must be a response, not a query).
  - `RCODE === 0` (Must be `NOERROR`; ignores premature `NXDOMAIN`, `SERVFAIL`, or `REFUSED` errors).
  - `ANCOUNT > 0` (Must contain at least one valid answer record).
- The first valid answer is forwarded to the client; all losing sockets are immediately aborted via `AbortController`.

#### Hosts Fallback Pinning
- On Windows Home editions (where Group Policy NRPT cmdlets are unavailable), the system automatically pins resolved unblocked IPs into `C:\Windows\System32\drivers\etc\hosts`.
- Handles Windows Read-Only file attributes (`attrib -R`) and maintains CRLF line endings.

---

### 4. Background Watchdog (`src/bypass/watchdog.js`)

When Google Antigravity IDE or CLI auto-updates:
- Periodically checks file modification timestamps (`mtimeMs`) and sizes without reading file contents into memory.
- If a target executable is replaced by an updater, the Watchdog immediately reapplies the binary patches and emits a `repatched` event.

---

## 📁 File Structure Reference

For a complete breakdown of every file, function, and module in the repository, see [`docs/file-tree.md`](file-tree.md).
