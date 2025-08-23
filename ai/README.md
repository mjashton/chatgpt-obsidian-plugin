# AI Documentation for ChatGPT to Obsidian Plugin

This folder contains documentation specifically designed to help AI systems understand and work with this project effectively.

## Contents

- `data-format-assumptions.md` - Critical assumptions about ChatGPT export data structure
- `architecture-decisions.md` - Key architectural choices and rationale
- `development-context.md` - Historical context and development environment details
- `testing-strategy.md` - Testing approach and validation methods
- `common-issues.md` - Known issues and their solutions
- `extension-points.md` - Areas for future enhancement

## Quick Start for AI Systems

1. **Read `data-format-assumptions.md` first** - This contains the most critical information about how the plugin expects ChatGPT export data to be structured.

2. **Review `architecture-decisions.md`** - Understand the key design choices that shape the codebase.

3. **Check `development-context.md`** - Understand the development environment and toolchain.

4. **Consult `common-issues.md`** if encountering problems during development or testing.

## Project Purpose

This is an Obsidian plugin that allows users to import ChatGPT conversation exports and save individual ChatGPT responses as Obsidian notes with proper markdown formatting and YAML frontmatter.

## Key Technologies

- **TypeScript** - Main language
- **Obsidian Plugin API** - Plugin framework
- **esbuild** - Build tool
- **Node.js 24.6.0+** - Runtime environment

## Core Functionality

1. Parse ChatGPT `conversations.json` export files
2. Display conversations in a navigable UI
3. Allow selection of individual ChatGPT responses
4. Convert responses to markdown with YAML frontmatter
5. Save as Obsidian notes in user-specified vault folders
