# ARIA Architecture

This document describes the architectural design of the ARIA (Autonomous Reasoning & Interaction Agent) system.

## 1. Core Paradigm: Pure Vision
Unlike other automation tools that rely on DOM parsing, CSS selectors, or accessibility trees, ARIA relies entirely on **Pure Vision**. 
1. The agent takes a screenshot of the computer.
2. The screenshot is sent to a Vision LLM (e.g., Anthropic Claude 3.5 Sonnet, GPT-4o, or Ollama Qwen2-VL) along with the user's natural language goal.
3. The LLM determines the next action (e.g., "Move mouse to [x, y] and left click").
4. ARIA executes the action natively on the OS.
5. ARIA takes a verification screenshot to confirm the result.

This loop guarantees that ARIA can automate **any** application: web browsers, native Windows desktop apps, video games, or terminal windows.

## 2. Monorepo Package Structure
The codebase is structured as a Turborepo monorepo:

- **`@aria/agent`**: Contains the core loop (`AriaAgent`). Orchestrates screenshots, LLM calls, safety checks, and memory storage.
- **`@aria/computer`**: The hardware layer. Uses `node-screenshots` for visual capture and platform-specific scripts (PowerShell for Windows, `osascript` for macOS, `xdotool` for Linux) for mouse/keyboard inputs.
- **`@aria/llm`**: Gateway to multiple LLM providers. Normalizes various API responses into the ARIA Tool Schema.
- **`@aria/memory`**: Dual-store architecture. Uses SQLite for episodic memory (step-by-step logs, costs, job status) and LanceDB for procedural memory (vector search for successful workflows).
- **`@aria/security`**: Implements the Safety Gate. Scores actions as `safe`, `sensitive`, or `destructive`. Prompts the user for `destructive` actions.
- **`@aria/delivery`**: Handles asynchronous reporting. Can send markdown reports locally or interactively stream progress via Telegram.
- **`aria-cli`**: The Node.js executable that ties it all together into the `aria` command.

## 3. Meta-Cognition Engine
When ARIA encounters a UI it doesn't understand, it triggers the `MetaCognitionService`. It will pause its current task, open a web browser, and search the internet or query a smarter model for instructions. Once it succeeds, the workflow is saved to LanceDB. The next time ARIA encounters the same UI, it retrieves the procedural memory and bypasses the search phase.

## 4. Execution Modes
1. **Native Mode**: ARIA runs directly on your host machine.
2. **Sandboxed Mode** (Docker): ARIA runs inside an Ubuntu Docker container with an Xvfb virtual display and noVNC for remote viewing. Safe for destructive or untrusted tasks.
