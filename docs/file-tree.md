# 📁 Antigravity Bypass — File Tree & Module Reference

```text
antigravity/
├── .env.example                  # Sample environment configuration file
├── .gitignore                    # Git ignore file (excludes build outputs, node_modules, temp files)
├── README.md                     # Comprehensive documentation and quick start guide
├── package.json                  # Project manifest, dependencies, and build scripts
├── package-lock.json             # Locked dependency versions
├── build-exe.js                  # Standalone single .EXE builder script using pkg
├── cli.js                        # Primary interactive CLI entrypoint
├── patcher.js                    # Quick binary and IDE patcher script
├── clean.js                      # Cache and temporary file cleaner
├── clean-hosts.bat               # Windows NRPT and hosts file cleanup batch script
├── fix-nrpt.ps1                  # PowerShell helper for safe NRPT rule removal
├── start.js                      # Application launcher helper script
├── docs/                         # Extended documentation
│   ├── architecture.md           # Systems architecture, protocols, and optimizations
│   └── file-tree.md              # Complete codebase directory tree reference
└── src/
    ├── config.js                 # Configuration loader and environment normalizer
    ├── logger.js                 # Centralized colorized logging utility
    ├── network.js                # Public IP, geo-location, and ISP detection
    ├── utils.js                  # General helper utilities (encoding, stderr filter, LAN IP)
    ├── ui/                       # Terminal user interface components
    │   ├── colors.js             # ANSI styling, banner rendering, and UAC elevation
    │   ├── views.js              # Installation cards, installed list, and menu layouts
    │   └── handlers.js           # Action handlers for CLI commands (patch, restore, status)
    └── bypass/
        ├── index.js              # High-level bypass API facade
        ├── watchdog.js           # Auto-repatch background observer daemon
        ├── patch.js              # Binary and IDE patching coordinator facade
        ├── dns-bypass.js         # SmartDNS, NRPT, and hosts manager facade
        ├── patcher/              # Specialized patching subsystem
        │   ├── constants.js      # Signatures (ineligible, https_proxy) and state enums
        │   ├── process.js        # Process management, CPU-safe sleep, and atomic writes
        │   ├── binary.js         # Chunked 4MB stream scanner and binary byte patcher
        │   ├── ide.js            # AST-safe JavaScript patcher for IDE main.js
        │   └── detector.js       # Fast cached multi-target installation scanner
        └── dns/                  # SmartDNS & policy routing subsystem
            ├── constants.js      # Hostnames, unblock providers, and relay configuration
            ├── packet.js         # RFC 1035 wire-format DNS builder and parser
            ├── forwarder.js      # Validated DNS race pool (DoH HTTP/2 & UDP)
            ├── egress.js         # Single-pass active network interface detection
            ├── relay.js          # Local loopback UDP DNS relay (127.0.0.53:53)
            ├── nrpt.js           # Windows Name Resolution Policy Table (NRPT) engine
            └── hosts.js          # Safe hosts fallback pinning manager
```
