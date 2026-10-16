# 🚀 Antigravity Bypass & Regional Unlocker

<div align="center">

**High-performance regional bypass, binary patcher, and SmartDNS unlocker for Google Antigravity (AGY), Antigravity 2.0, and Antigravity IDE.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-blue.svg)](https://microsoft.com/windows)
[![Antigravity](https://img.shields.io/badge/Antigravity-Unlocked-orange.svg)](https://antigravity.google)
[![No VPN Needed](https://img.shields.io/badge/Network-No%20VPN%20Needed-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 🌟 Overview

**Antigravity Bypass & Regional Unlocker** is an all-in-one developer tool engineered to eliminate geographic restrictions (`User location is not supported`, `ineligible_tiers`, `geo-block`) across the entire Google Antigravity ecosystem.

It operates **completely standalone directly over your local internet connection without requiring a commercial VPN**. It achieves this through a combination of in-place byte-level binary patching, balanced JavaScript AST injection, and low-latency Windows NRPT (Name Resolution Policy Table) SmartDNS routing.

---

## ✨ Key Features

- **🔍 Automatic Multi-Target Discovery:**
  Automatically locates all Antigravity installations on your machine:
  - `ANTIGRAVITY IDE` (`main.js` + `language_server_windows_x64.exe`)
  - `ANTIGRAVITY 2.0` (`language_server.exe`)
  - `ANTIGRAVITY CLI` (`agy.exe`)
  - `AGY BIN (.gemini)` (`agy.exe`)
  - `ANTIGRAVITY VS CODE / CURSOR / WINDSURF EXTENSIONS`
- **🔢 Interactive Numbered Selection:**
  Lists all detected installations with target file paths, patch state (`[PATCHED ✓]` / `[NOT PATCHED ✗]`), file sizes, and versions.
- **⚡ Selective or Bulk Patching:**
  Patch any specific installation by its number, or press `[A]` to patch all installations in one operation.
- **🌐 SmartDNS & Windows NRPT Engine:**
  Routes Antigravity Google API hostnames through high-speed DoH/UDP providers via a loopback relay (`127.0.0.53:53`) with zero DNS leaks and automated hosts fallback.
- **🛡️ Bit-Exact Atomic Backups:**
  Creates `.ag_backup` copies prior to modifying any file. Restores can be triggered at any time with option `[R]` or `antigravity-bypass restore`.
- **🔄 Auto-Repatch Watchdog Daemon:**
  Background monitor (`[W]` or `antigravity-bypass watchdog`) that watches binary file modification times (`mtime`) and automatically reapplies patches if Antigravity updates itself.
- **📦 Single Standalone Executable (.EXE):**
  Packaged with `pkg` into a single standalone `antigravity-bypass.exe` requiring no Node.js installation on target systems.

---

## 🚀 Quick Start

### Option 1: Standalone .EXE (No Node.js Required)

1. Download or build `dist/antigravity-bypass.exe`.
2. Double-click `antigravity-bypass.exe` (automatically requests Administrator elevation via UAC).
3. Follow the interactive menu on screen.

### Option 2: Running via Node.js

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- Windows 10 or 11 (64-bit)
- PowerShell 5.1+ (built into Windows)

#### Installation & Launch
```bash
# Clone the repository
git clone https://github.com/muzaffarbekmustafayev/antigravity.git
cd antigravity

# Install dependencies
npm install

# Launch interactive CLI
npm start
```

---

## 🖥️ Interactive CLI Interface

When launched, the CLI runs an instant hardware and software scan:

```text
╔══════════════════════════════════════════════════════════╗
║         🚀  ANTIGRAVITY BYPASS & UNLOCKER  🚀            ║
║        Complete Regional Restrictions Bypass             ║
╚══════════════════════════════════════════════════════════╝

Network: 92.63.65.94 (Internet) 🌐 [RU, Tomsk]  [Admin: Yes ✓]

] Searching for installations...
  ─ ANTIGRAVITY IDE ───────────────────────────────
      Target:  C:\Users\...\Antigravity IDE\resources\app\out\main.js
      Status:  found
      Patch:   already patched
      Version: 2.5.5
      Size:    14.3 MB

  ─ ANTIGRAVITY 2.0 ───────────────────────────────
      Target:  C:\Users\...\antigravity\resources\bin\language_server.exe
      Status:  found
      Patch:   already patched
      Version: 2.23.1
      Size:    161.3 MB

═══════════════════════════════════════════════════════════
  📦 DETECTED INSTALLATIONS:
═══════════════════════════════════════════════════════════

  [1] ANTIGRAVITY IDE  [PATCHED ✓]
      Path:    C:\Users\...\Antigravity IDE\resources\app\out\main.js
      Info:    Version: 2.5.5  │  Size: 14.3 MB

  [2] ANTIGRAVITY 2.0  [PATCHED ✓]
      Path:    C:\Users\...\antigravity\resources\bin\language_server.exe
      Info:    Version: 2.23.1  │  Size: 161.3 MB

───────────────────────────────────────────────────────────
  ⚡ Available Commands:
    [1 - 2]  Patch selected installation
    [A]      Patch ALL detected installations (Recommended)
    [R]      Restore original files (Restore / Unpatch)
    [S]      System status & diagnostics (Network, DNS, NRPT)
    [W]      Start Watchdog daemon (Auto-repatch background observer)
    [Q]      Quit
───────────────────────────────────────────────────────────
```

---

## ⌨️ Command Line Usage

The tool also supports headless and automated script execution:

| Command | Description |
| :--- | :--- |
| `npm start` / `node cli.js` | Launches the interactive terminal menu |
| `npm run status` / `node cli.js status` | Prints network diagnostics, installation states, and NRPT status |
| `node cli.js patch` | Patches all detected Antigravity installations and sets up SmartDNS |
| `node cli.js patch 1` | Patches only installation #1 from the detected list |
| `node cli.js restore` | Restores all files from backups and removes NRPT rules |
| `node cli.js watchdog` | Starts the background daemon to watch for app updates |
| `npm run clean` | Cleans temporary `.agtmp` files and build caches |
| `npm run build:exe` | Compiles the project into `dist/antigravity-bypass.exe` |

---

## 🏛️ Architecture & How It Works

```text
┌────────────────────────────────────────────────────────┐
│            Antigravity Bypass CLI (cli.js)             │
└──────────────────────────┬─────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│   Detector & Patch   │        │     Network & DNS    │
│ (src/bypass/patch.js)│        │(src/bypass/dns-bypass)
└──────────┬───────────┘        └──────────┬───────────┘
           │                               │
           ├─ Chunked 4MB Signature Scan   ├─ Validated DNS Race (NOERROR/ANCOUNT)
           ├─ Atomic File Write & Backup   ├─ Loopback SmartDNS (127.0.0.53:53)
           ├─ Balanced JS AST Call Hook    ├─ Non-Interfering Windows NRPT Rules
           └─ Multi-Target Detection       └─ Safe /etc/hosts Fallback
```

For comprehensive engineering details on byte replacement signatures, DNS wire protocol parsing, and concurrency handling, refer to [`docs/architecture.md`](docs/architecture.md).

---

## 🛠️ Building the Standalone .EXE

To compile the entire codebase (including all Node.js runtime code and submodules) into a single Windows executable:

```bash
npm run build:exe
```

The output binary will be generated at:
```text
dist/antigravity-bypass.exe (~36 MB)
```

This executable has zero external dependencies and can be copied to any compatible 64-bit Windows PC.

---

## ❓ Troubleshooting

### Administrator Rights
- **Issue:** `Administrator privileges required` notification appears.
- **Solution:** Right-click the terminal or `antigravity-bypass.exe` and select **"Run as administrator"**. Administrator rights are mandatory for Windows NRPT rules and loopback DNS socket binding (`127.0.0.53:53`).

### Windows Home Edition
- Windows Home editions do not support Group Policy NRPT cmdlets (`Add-DnsClientNrptRule`).
- **Solution:** The tool automatically detects this and falls back to atomic `hosts` file IP pinning (`C:\Windows\System32\drivers\etc\hosts`).

### Resetting DNS & Network Rules
To manually revert all DNS rules back to Windows defaults:
```bash
npm run restore
# or run the emergency script:
clean-hosts.bat
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
