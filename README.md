# Calico Term

[![Release](https://img.shields.io/github/v/release/evermine18/calico-term?style=flat-square)](https://github.com/evermine18/calico-term/releases)
[![License](https://img.shields.io/github/license/evermine18/calico-term?style=flat-square)](LICENSE)

Calico Term is a cross-platform terminal emulator built with Electron + React, featuring an AI assistant, SSH connection management, SFTP, and an encrypted credential vault.

## Table of Contents

- [Core Features](#core-features)
- [Technical Stack](#technical-stack)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Available Scripts](#available-scripts)
- [Build and Distribution](#build-and-distribution)
- [Project Validation](#project-validation)
- [Contributing](#contributing)
- [License](#license)

## Core Features

- Multi-tab terminal with persistent PTY processes (`node-pty`)
- Error pattern detection in terminal output with renderer notifications
- Built-in AI chat panel with real-time streaming
- Supported AI providers:
  - OpenAI
  - Anthropic
  - Ollama
  - Endpoints OpenAI-compatible
- Terminal context injection into AI chat for more grounded responses
- Saved SSH connection management (host, port, username, key file, tags)
- Encrypted credential vault storage (API keys and passwords)
- Automatic password injection in SSH sessions when authentication prompts are detected
- Built-in SFTP browser:
  - directory listing
  - upload and download
  - delete
  - rename
  - directory creation
  - transfer progress tracking
- Command history with configurable retention and sensitive-command filtering
- Customizable keyboard shortcuts
- Theme system using CSS variables with `localStorage` persistence
- Windows, macOS, and Linux support

## Technical Stack

- Electron + electron-vite
- React 19 + TypeScript
- xterm.js + addons (fit, search, unicode11, web-links)
- node-pty
- ssh2
- Tailwind CSS 4 + Radix UI + shadcn/ui
- electron-updater + electron-builder

## Requirements

- Node.js 18+
- npm

## Installation

```bash
git clone https://github.com/evermine18/calico-term.git
cd calico-term
npm install
```

## Usage

Development environment (Electron + Vite with HMR):

```bash
npm run dev
```

Run the built app in preview mode:

```bash
npm run start
```

## Configuration

User settings are managed from the in-app settings dialog.

### AI

- Provider base URL
- API key (encrypted at the system level using `safeStorage`)
- Default model
- Provider (`openai`, `anthropic`, `ollama`, `openai-compatible`)
- Custom system prompt
- Temperature
- Maximum tokens

### Terminal

- Font family and size
- Line height
- Cursor style and blink behavior
- Scrollback
- Default shell
- Default startup directory

### Productivity

- Keyboard shortcuts
- Command history retention
- Tag management
- SSH connection management
- Credential vault (username/password)

## Architecture

### Main Process (`src/main`)

- `index.ts`: Electron lifecycle and IPC handler registration
- `terminal.ts`: PTY lifecycle, error detection, encrypted storage, and SSH password injection
- `chat-api.ts`: chat provider integration and SSE streaming
- `sftp.ts`: SFTP sessions and transfer operations
- `updater.ts`: auto-update flow

### Preload (`src/preload`)

Secure bridge between renderer and main through APIs exposed on `window`.

### Renderer (`src/renderer/src`)

- React UI
- global state via contexts (`app-context`, `terminal-context`)
- terminal tabs + AI sidebar + SSH home + SFTP panel

## Available Scripts

```bash
npm run dev            # Development (Electron + Vite HMR)
npm run start          # Runs the generated build
npm run build          # Type-check + build
npm run lint           # ESLint
npm run format         # Prettier
npm run typecheck      # Full type-check
npm run typecheck:node # Main process type-check
npm run typecheck:web  # Renderer type-check
```

## Build and Distribution

Platform-specific builds:

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

Optional unpacked build:

```bash
npm run build:unpack
```

## Project Validation

There is currently no automated test suite. The main validation step is:

```bash
npm run typecheck
```

It is also recommended to run:

```bash
npm run lint
```

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Run `npm run typecheck` and `npm run lint`.
5. Open a Pull Request.

## License

MIT. See [LICENSE](LICENSE).
