# AI Documentation for ChatGPT to Obsidian Plugin

This folder contains documentation designed to help AI systems understand and work with this project effectively.

## Contents

- `data-format-assumptions.md` - Critical assumptions about ChatGPT export data structure
- `architecture-decisions.md` - Key architectural choices and rationale
- `development-context.md` - Development environment and toolchain requirements
- `testing-strategy.md` - Testing approach and validation methods
- `common-issues.md` - Known issues and their solutions
- `extension-points.md` - Areas for future enhancement

## Quick Start for AI Systems

1. **Read `data-format-assumptions.md` first** - Contains critical information about ChatGPT export data structure
2. **Review `architecture-decisions.md`** - Understand key design choices that shape the codebase
3. **Check `development-context.md`** - Understand development environment requirements
4. **Consult `common-issues.md`** - Known problems and solutions

## Project Purpose

Obsidian plugin that imports ChatGPT conversation exports and saves individual responses as markdown notes with YAML frontmatter.

## Key Technologies

- **TypeScript** - Main language
- **Obsidian Plugin API** - Plugin framework
- **esbuild** - Build tool
- **Node.js 18+** - Runtime environment

## Core Functionality

1. Parse ChatGPT `conversations.json` export files
2. Display conversations in navigable UI (table of contents + single view)
3. Allow selection of individual ChatGPT responses
4. Convert responses to markdown with YAML frontmatter
5. Save as Obsidian notes in user-specified folders
