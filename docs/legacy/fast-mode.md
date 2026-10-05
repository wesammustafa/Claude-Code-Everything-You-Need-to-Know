<a id="fast-mode"></a>
<a id="fast-mode-"></a>
# Fast mode

> [!NOTE]
> From the previous edition, not yet re-verified. The guide is being rebuilt as lessons; this page keeps the earlier material reachable until they land.

`/fast` toggles fast mode, a [research preview](https://code.claude.com/docs/en/fast-mode): up to **2.5× faster output at 2× the price**. Since v2.1.280 it runs on **Opus 5.5** by default; Opus 5 and Opus 4.8 also support it ($10/$50 per MTok in fast mode), Sonnet and Haiku don't. It isn't CLI-only: the VS Code extension has a **Toggle fast mode** command, and claude.ai/code has a toggle in the model menu. The **↯** indicator confirms it's on. On subscription plans, fast mode draws from usage credits rather than plan limits.

| | Standard Opus 5.5 | Fast Mode (Opus 5.5) |
|---|---|---|
| Input (per MTok) | $4 | $8 (2×) |
| Output (per MTok) | $20 | $40 (2×) |

> [!WARNING]
> **Fast mode on older Opus models is gone.** Opus 4.7 fast was deprecated on June 25, 2026 and **removed on July 24, 2026** (v2.1.219), and Opus 4.6 doesn't support fast mode either.

```bash
/fast                                    # toggle on (↯ appears)
> fix the auth bug in src/login.ts       # faster output
/fast                                    # toggle off when done
```

**Decision rule:** use it when latency matters (live debugging, demo prep, time-pressured fixes). At 2× cost it's a much easier call than the old 6×, but background work still doesn't need it. Use `/usage` to monitor.

---

<sub>From the previous edition of [Claude Code: Everything You Need to Know](../../README.md).</sub>
