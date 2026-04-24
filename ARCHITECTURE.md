# ⌬ ARIA Architecture

<p align="center">
    <picture>
        <img src="./assets/aria-logo.png" alt="ARIA Logo" width="120">
    </picture>
</p>

This document details the architectural foundation of the **ARIA (Autonomous Reasoning & Interaction Agent)** system.

---

## 1. Core Paradigm: Pure Vision

Unlike conventional automation frameworks that rely on DOM parsing, accessibility trees, or UI selectors, ARIA is engineered entirely around **Pure Vision**. 

### The Perception-Reasoning-Action (PRA) Loop

```text
 ┌──────────────┐     Goal + Screenshot     ┌──────────────┐
 │ OS Hardware  │ ───────────────────────►  │  Vision LLM  │
 └──────┬───────┘                           └──────┬───────┘
        │                                          │
        │ Action (Click, Type)                     │ JSON Response
        ▼                                          ▼
 ┌──────────────┐      Validate Action      ┌──────────────┐
 │  Computer    │ ◄───────────────────────  │ Safety Gate  │
 │  Adapter     │                           └──────────────┘
 └──────────────┘
```

1. **Perception**: ARIA captures a high-fidelity screenshot of the current display state.
2. **Reasoning**: The visual payload, alongside the active goal and procedural memory, is dispatched to a Vision LLM.
3. **Decision**: The model returns a normalized `AriaToolAction` (e.g., precise `[x, y]` coordinate interaction).
4. **Action**: The platform adapter translates the action into a native OS hardware interrupt.
5. **Verification**: A secondary screenshot is captured to validate the delta.

This decoupled architecture guarantees that ARIA can automate **any** GUI surface: browsers, legacy enterprise software, or terminal emulators.

## 2. Monorepo Topology

The codebase is organized as a strict Turborepo monorepo, separating concerns into discrete, composable packages:

```text
aria/
├── apps/
│   └── aria-cli/        (Node.js executable, TUI, onboarding)
├── packages/
│   ├── aria-agent/      (Orchestrator, PRA Loop)
│   ├── aria-computer/   (Windows/macOS/Linux hardware hooks)
│   ├── aria-config/     (Schema & JSON config resolution)
│   ├── aria-delivery/   (Telegram, Webhook, Email transports)
│   ├── aria-llm/        (Anthropic, OpenAI, Ollama adapters)
│   ├── aria-logger/     (Pino JSON logging)
│   ├── aria-memory/     (SQLite + LanceDB)
│   ├── aria-security/   (Action classification & HITL)
│   └── aria-types/      (Shared TypeScript interfaces)
```

## 3. Cognitive Systems

### Meta-Cognition Engine
ARIA possesses self-awareness regarding its limitations. If the model computes a confidence score below the `escalationConfidenceThreshold`, the `MetaCognitionService` halts execution. The agent will autonomously escalate the sub-task to a higher-parameter "helper" model, or navigate to a web browser to research the required UI workflow.

```text
 ┌─────────────┐   Low Confidence   ┌─────────────┐
 │ Primary LLM │ ─────────────────► │ Helper LLM  │
 └─────────────┘                    └──────┬──────┘
                                           │
                                           │ Resolves Workflow
                                           ▼
                                    ┌─────────────┐
                                    │   LanceDB   │ (Stores Procedure)
                                    └─────────────┘
```

### Procedural Memory
Once ARIA successfully resolves an unknown workflow, it distills the step sequence into a semantic `ProcedureRecord`. This is embedded into LanceDB. Future jobs querying similar goals will inject this procedure into the system prompt, bypassing the research phase.

## 4. Execution Environments

ARIA is designed to run locally, but can be sandboxed for enhanced security.

- **Native Execution**: ARIA executes directly on the host OS, utilizing the active window manager.
- **Sandboxed Execution**: ARIA is containerized within a headless Linux environment. Utilizing `Xvfb` and `noVNC`, it provides a safe, ephemeral workspace for untrusted operations.
