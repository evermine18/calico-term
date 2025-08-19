# Calico Term

[![Release](https://img.shields.io/github/v/release/<your-username>/calico-term?style=flat-square)](https://github.com/evermine18/calico-term/releases)
[![License](https://img.shields.io/github/license/evermine18/calico-term?style=flat-square)](LICENSE)

A modern cross-platform terminal emulator powered by Electron, Vite, React, and xterm.js, featuring an AI assistant for generating safe and reproducible shell commands.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [Building](#building)
- [Technologies](#technologies)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Features

- **Multi-tab terminal** sessions with persistent shell processes (bash/zsh on Unix, PowerShell on Windows)
- **Real-time error detection** and notification in terminal output based on common error patterns
- **Embedded AI assistant** sidebar (OpenAI GPT-4) for generating safe and clear shell command suggestions
- **Syntax highlighting** for code snippets via highlight.js
- Intuitive UI with custom window controls, draggable regions, and theming built on React, TypeScript, and Tailwind CSS
- Cross-platform support: Windows, macOS, and Linux
- Automated packaging and auto-update support via electron-builder

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (or yarn)

```bash
git clone https://github.com/evermine18/calico-term.git
cd calico-term
npm install
```

## Configuration

To enable the AI assistant functionality, create a `.env` file in the project root and add your OpenAI API key:

```bash
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
```

## Usage

Start the development environment with hot-reload:

```bash
npm run dev
```

Launch the Electron application:

```bash
npm run start
```

## Development

- Format code: `npm run format`
- Lint code: `npm run lint`
- Type-check: `npm run typecheck`

## Building

Perform a production build and package the application:

```bash
npm run build
```

Platform-specific builds:

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Technologies

- [Electron](https://www.electronjs.org/) & [Vite](https://vitejs.dev/) (electron-vite)
- [React](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/)
- [xterm.js](https://xtermjs.org/) & [node-pty](https://github.com/microsoft/node-pty)
- [Tailwind CSS](https://tailwindcss.com/) & [highlight.js](https://highlightjs.org/)
- [OpenAI GPT-4](https://openai.com/) for AI assistant integration
- [electron-builder](https://www.electron.build/) for packaging and auto-updates

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgements

- Based on the [electron-vite](https://github.com/electron-vite/electron-vite) template
- Inspired by [xterm.js](https://xtermjs.org/) and community contributions
