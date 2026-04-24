# ARIA: Autonomous Reasoning & Interaction Agent

**ARIA** is Jarvis for your computer. 

Not an AI tool. Not a chatbot. Not a browser extension. ARIA is a digital employee that sits at your computer and works on your behalf. It uses a **Pure Vision** architecture: it takes screenshots of your screen, processes them with a Vision LLM, and directly controls your mouse and keyboard natively across Windows, macOS, and Linux.

## Features
- **Pure Vision**: If a human can see it, ARIA can interact with it. No DOM parsing, no brittle CSS selectors. Works in desktop apps, video games, terminals, and web browsers alike.
- **Cross-Platform Native Input**: Directly sends low-level hardware inputs to Windows (PowerShell), macOS (osascript), and Linux (xdotool).
- **Meta-Cognition**: If ARIA gets stuck, it pauses, opens a browser, and asks a smarter AI (like Gemini or ChatGPT) for help, then uses LanceDB to memorize the procedure for next time.
- **Telegram Interface**: Text ARIA from anywhere in the world on Telegram and ask it to perform jobs. It will send you screenshots of its progress.
- **Safety Gated**: All destructive actions (like Bash commands or deleting files) require explicit Human-in-the-Loop approval.
- **Job Checkpointing**: Resume halted jobs right where they left off (`aria resume <jobId>`).
- **Bring Your Own Model**: Works with Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o, Google Gemini, OpenRouter, and fully local Vision models via Ollama.

## Installation

### Prerequisites (Linux Only)
If you are running ARIA natively on a Linux machine (Ubuntu/Debian, Arch, etc.), you must install the following system dependencies for screenshot capture and input simulation to work:
```bash
# Ubuntu/Debian
sudo apt-get install imagemagick xdotool

# Arch Linux
sudo pacman -S imagemagick xdotool
```
*(Note: If you are using Wayland, ensure you have `grim` installed for screenshot capture. `xdotool` requires XWayland for input simulation).*

### Setup
```bash
# Clone the repository
git clone https://github.com/your-username/aria.git
cd aria

# Install dependencies and build
pnpm install
pnpm run build

# Initialize your configuration
pnpm run aria init-config
```

## Usage

You can control ARIA via the CLI or run it as a background service listening to Telegram.

### Direct Run
```bash
# Give ARIA a natural language goal
pnpm run aria run "Open YouTube, search for trending music, and take a screenshot"
```

### Resume a Job
```bash
# Resume a job that was paused or halted
pnpm run aria resume <jobId>
```

### Telegram Daemon
```bash
# Start the background service to listen for Telegram messages
pnpm run aria serve
```

## Configuration

ARIA stores its configuration in `aria.config.json` in your workspace root.
Make sure to configure your LLM provider. By default, it expects Anthropic or a local Ollama model.

```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "enabled": true,
      "model": "claude-3-5-sonnet-latest"
    }
  }
}
```

## Community & Contributing
Please see `CONTRIBUTING.md` if you would like to help build the future of autonomous computer-use agents.

## License
MIT License
