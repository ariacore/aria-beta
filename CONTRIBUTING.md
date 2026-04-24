# Contributing to ARIA

Welcome to the ARIA open-source project! ARIA is the definitive "Jarvis for your computer" – an autonomous, pure-vision agent that can see your screen, control your mouse and keyboard, and solve complex workflows.

## Development Setup

1. **Prerequisites**: Node.js 22 LTS, pnpm 9+
2. **Install**: `pnpm install`
3. **Build**: `pnpm run build`
4. **Test**: `pnpm run test`

## Architecture overview
- **aria-agent**: The core Perception-Reasoning-Action (PRA) loop
- **aria-computer**: Cross-platform system abstraction (Windows, Linux, macOS)
- **aria-llm**: Provider gateways for vision models
- **aria-security**: Action classification and safety gating

## Adding a new Provider
If you want to add support for a new Vision LLM, create a new file in `packages/aria-llm/src/providers/` that implements the `ProviderAdapter` interface.

## Submitting Pull Requests
1. Fork the repository
2. Create a feature branch
3. Ensure `pnpm run test` and `pnpm run typecheck` both pass
4. Submit a PR describing the changes and why they are necessary.

We welcome all contributions!
