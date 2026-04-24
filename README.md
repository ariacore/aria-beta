# ⌬ ARIA — Autonomous Reasoning & Interaction Agent

<p align="center">
    <picture>
        <img src="./assets/aria-logo.png" alt="ARIA Logo" width="180">
    </picture>
</p>

<p align="center">
  <strong>VISION FOR YOUR COMPUTER</strong>
</p>

<p align="center">
  <a href="https://github.com/ariacore/aria-beta/actions/workflows/publish.yml"><img src="https://img.shields.io/github/actions/workflow/status/ariacore/aria-beta/publish.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/ariacore/aria-beta/releases"><img src="https://img.shields.io/github/v/release/ariacore/aria-beta?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**ARIA** is a *personal AI assistant* that natively controls your own devices.
Unlike browser extensions or DOM-parsing scripts, ARIA relies on **Pure Vision**. If a human can see it, ARIA can interact with it. It captures the screen, processes it with a state-of-the-art vision language model, and executes native hardware inputs across Windows, macOS, and Linux.

If you want a personal, single-user assistant that feels local, fast, and remarkably capable across native applications, video games, terminals, and web browsers, this is it.

[Architecture](ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md)

---

## ⚡ Quick Start

Runtime: **Node 22 LTS or newer**.

```bash
# Global installation via pnpm (recommended)
pnpm add -g @aria/cli

# Run the interactive onboarding wizard
aria onboard

# Start the background daemon to listen for remote commands (e.g., Telegram)
aria serve

# Direct execution
aria run "Open YouTube, search for trending music, and take a screenshot"
```

*Upgrading? Run `npm i -g @aria/cli@latest` followed by `aria doctor` to ensure system health.*

## 🌟 Highlights

- **Pure Vision** — If a human can see it, ARIA can click it. No DOM parsing, no brittle CSS selectors. Natively supports desktops, mobile emulators, video games, and terminals.
- **Cross-Platform Native Input** — Directly dispatches low-level hardware events using Windows (PowerShell), macOS (osascript), and Linux (xdotool).
- **Meta-Cognition Engine** — When ARIA encounters an unknown interface, it automatically triggers a research phase, opening a browser to search for instructions before resuming the task.
- **Episodic & Procedural Memory** — Powered by `node:sqlite` for step-by-step audit logs and `LanceDB` for storing successful workflows, allowing ARIA to remember how to solve previously encountered UI problems.
- **Job Checkpointing** — API rate limit? Computer shutdown? Resume halted workflows instantly from exact step states using `aria resume <jobId>`.
- **Omni-Channel Delivery** — Receive real-time telemetry, screenshots, and Markdown reports via Telegram, Webhook, or Email.

## 📦 Models & Providers

ARIA supports a wide array of state-of-the-art vision models via built-in provider adapters. 
Configure your preferred models during `aria onboard`:

- **Anthropic** (`claude-3-5-sonnet-latest`)
- **OpenAI** (`gpt-4o`)
- **Google** (`gemini-1.5-pro`)
- **Local Vision Models** via Ollama (`qwen2-vl`, `llava`)

## 🛡️ Security & Sandboxing

ARIA connects directly to your operating system. Treat untrusted tasks with extreme caution.

- **Human-in-the-Loop (HITL)** — All actions classified as `destructive` (e.g., shell commands, file deletions) require explicit user approval.
- **Sandboxed Execution** — Run ARIA inside an isolated Ubuntu Docker container complete with an Xvfb virtual display and noVNC.
- **Artifact Auditing** — Every step ARIA takes is documented with a before-and-after PNG screenshot stored locally in `.aria/artifacts/`.

Run `aria doctor` to audit your security configuration.

## 🛠️ Development

We use `pnpm` and Turborepo for workspace management.

```bash
git clone https://github.com/ariacore/aria-beta.git
cd aria

pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
```

## 🤝 Community & Contributing

We welcome pull requests for new providers, platform adapters, and UI improvements. 
Please review our [Contributing Guidelines](CONTRIBUTING.md) before submitting a PR.

## 📜 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
