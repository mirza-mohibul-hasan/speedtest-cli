# speedtest-cli

[![CI](https://github.com/mirza-mohibul-hasan/speedtest-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/mirza-mohibul-hasan/speedtest-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/speedtest-cli.svg)](https://www.npmjs.com/package/speedtest-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade Node.js internet speed and network diagnostics CLI with ping, download, upload, DNS, TCP, TLS, HTTP reachability, history, config, server selection, and watch mode.

## Install

```powershell
npm install -g @mirza-mohibul-hasan/speedtest-cli
```

Run without installing:

```powershell
npx speedtest-cli test
```

Install from GitHub:

```powershell
npm install -g github:mirza-mohibul-hasan/speedtest-cli
```

## Usage

```powershell
speedtest test
speedtest test --json
speedtest test --csv
speedtest test --server asia
speedtest test --watch 30
speedtest diagnose
speedtest diagnose github.com --samples 10
speedtest diagnose https://example.com --json
speedtest history --last 5
speedtest config set unit MBps
speedtest config get unit
speedtest config reset
```

## Demo

```text
                    _ _            _              _ _
 ___ _ __   ___  __| | |_ ___  ___| |_        ___| (_)
/ __| '_ \ / _ \/ _  | __/ _ \/ __| __|_____ / __| | |
\__ \ |_) |  __/ (_| | ||  __/\__ \ ||_____| (__| | |
|___/ .__/ \___|\__,_|\__\___||___/\__|     \___|_|_|
    |_|

[OK] Speed Test Results
+-----------+--------------------------+
| Metric    | Value                    |
+-----------+--------------------------+
| Ping      | 42.18 ms                 |
| Jitter    | 6.72 ms                  |
| Download  | 94.62 Mbps               |
| Upload    | 125.83 Mbps              |
| Server    | Cloudflare - Global      |
| Timestamp | 2026-06-04T12:00:00.000Z |
+-----------+--------------------------+
```

## Diagnostics

```powershell
speedtest diagnose [target]
```

The diagnostics command checks the network path to a target with DNS lookup timing, TCP connect timing, TLS handshake validation, HTTP reachability timing, repeated latency samples, request loss, jitter, and a simple health verdict.

## Development

```powershell
npm install
npm run lint
npm run smoke
npm run ui:demo
```

## Notes

Network providers may rate-limit repeated test runs. The CLI handles transfer rate limits gracefully and reports the data collected during the measurement window.

## License

MIT
