# Contributing to ARIA

<p align="center">
    <picture>
        <img src="./assets/aria-logo.png" alt="ARIA Logo" width="120">
    </picture>
</p>

Thank you for your interest in contributing to **ARIA**. This project is built by developers, for developers, aiming to construct the most capable, open-source autonomous agent available. 

Whether you are fixing a bug, adding a new model provider, or improving platform compatibility, your contributions are highly valued.

---

## 🛠️ Development Setup

The ARIA monorepo is managed with Turborepo and `pnpm`.

### Prerequisites
- Node.js `22.x LTS` or higher
- `pnpm` `9.x` or higher

### Bootstrap Local Environment

```bash
# 1. Clone the repository
git clone https://github.com/ariacore/aria-beta.git
cd aria

# 2. Install dependencies across all packages
pnpm install

# 3. Build the monorepo
pnpm run build

# 4. Verify the build and run unit tests
pnpm run test
```

## 🧩 Architectural Overview

Before contributing, please review [ARCHITECTURE.md](ARCHITECTURE.md) for a deep dive into the system design. Key packages include:

- `@aria/agent`: The Perception-Reasoning-Action core.
- `@aria/computer`: Cross-platform OS adapters.
- `@aria/llm`: Gateway for Vision LLM providers.
- `@aria/security`: Action parsing and safety evaluation.

## 🔌 Adding a New Model Provider

ARIA is model-agnostic. To add a new Vision LLM:

1. Navigate to `packages/aria-llm/src/providers/`.
2. Implement the `ProviderAdapter` interface for your target model.
3. Ensure the provider normalizes API responses into the standard `ProviderDecision` format.
4. Add robust unit tests mocking the provider's API.
5. Export the provider in `packages/aria-llm/src/index.ts`.

## 🔄 Pull Request Lifecycle

To ensure high-quality integrations, please adhere to the following workflow:

1. **Fork & Branch**: Fork the repository and create a descriptive branch name (e.g., `feat/anthropic-caching`, `fix/xdotool-parsing`).
2. **Commit Conventions**: Use [Conventional Commits](https://www.conventionalcommits.org/).
3. **Validation**: Ensure your changes pass all CI checks locally:
   ```bash
   pnpm run typecheck
   pnpm run lint
   pnpm run test
   ```
4. **Documentation**: If your change modifies configuration files or the CLI interface, update the respective Markdown files in the documentation suite.
5. **PR Submission**: Open a PR against the `main` branch. Provide a clear description of the problem, your solution, and any required configuration changes.

We are committed to maintaining a collaborative and respectful open-source community. Welcome to ARIA!
