
# Quickshell Studio

A Visual Studio Code extension providing enhanced QML development support for Quickshell.

## Features

- Quickshell component autocompletion
- API documentation in IntelliSense
- Hover documentation for components and properties
- QML language server integration
- Improved diagnostics for Quickshell components
- Automatic QML metadata caching

## Requirements

- Linux
- Qt 6
- Quickshell
- `qmlls`

Currently developed and tested on Arch Linux with Quickshell 0.3.2.

## Development

Install dependencies:

```bash
pnpm install
```

Compile the extension:

```bash
pnpm run compile
```

Press F5 in VS Code to launch the Extension Development Host.

## Status

Early development. The extension currently uses system-specific Qt and Quickshell paths.
