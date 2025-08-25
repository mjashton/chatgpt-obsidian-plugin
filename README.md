# ChatGPT to Obsidian Plugin

An Obsidian plugin that allows you to import ChatGPT conversation exports and save individual responses as properly formatted Obsidian notes with YAML frontmatter.

## Features

- 🔄 **Import ChatGPT Conversations**: Load your `conversations.json` export file
- 📋 **Table of Contents View**: Browse all conversations with quick navigation
- 👁️ **Single Conversation View**: Focus on one conversation at a time
- 💾 **Save Individual Responses**: Convert ChatGPT responses to Obsidian notes
- 📝 **Rich Formatting**: Preserves markdown, code blocks, lists, and emphasis
- 🏷️ **YAML Frontmatter**: Includes metadata like tags, timestamps, and conversation context
- ⚙️ **Customizable Settings**: Configure default folders, tags, and note formatting
- 🚀 **Scalable UI**: Handles large conversation exports efficiently
- 🧠 **Smart State Tracking**: Tracks which Q&A pairs have been processed (New/Saved/Ignored)
- 🎯 **Conversation-Level Filtering**: Filter conversations by processing status (New/Partially Processed/Fully Processed)
- 📊 **Processing Status Indicators**: Visual indicators show conversation and Q&A pair states
- 🔍 **Q&A Pair Filtering**: Filter individual Q&A pairs within conversations by their status

## Installation

### Manual Installation

1. Download the latest release from the [releases page](../../releases)
2. Extract the files to your vault's plugins directory: `<vault>/.obsidian/plugins/chatgpt-obsidian-plugin/`
3. The plugin folder should contain:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Enable the plugin in Obsidian Settings → Community Plugins

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/mjashton/chatgpt-obsidian-plugin.git
   cd chatgpt-obsidian-plugin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   
   # If npm is having issues, use the esbuild config directly:
   node esbuild.config.mjs production
   
   # Or use the direct esbuild command:
   node_modules\\.bin\\esbuild.cmd main.ts --bundle --external:obsidian --outfile=main.js --format=cjs --target=es2016
   ```

4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins directory

## Usage

### Getting Your ChatGPT Data

1. Go to [ChatGPT Settings → Data Export](https://chatgpt.com/settings/data-export)
2. Request an export of your data
3. Download and extract the ZIP file
4. Locate the `conversations.json` file

### Using the Plugin

1. Click the ChatGPT icon in the ribbon or use the command palette (Ctrl/Cmd+P) and search for "Import ChatGPT conversations"
2. Select your `conversations.json` file
3. Browse conversations in the table of contents
4. Click "👁️ View" to open a specific conversation
5. Navigate between conversations using Previous/Next buttons
6. Click "💾 Save as Note" on any ChatGPT response you want to keep
7. Customize the note title, folder, and tags before saving

### Settings

Configure the plugin in Settings → Plugin Options → ChatGPT to Obsidian:

- **Default folder**: Where to save ChatGPT notes
- **Include user prompts**: Show the user's question along with ChatGPT's response
- **Include timestamps**: Add creation dates to note metadata
- **Default tags**: Tags to automatically add to all imported notes

## Note Format

Saved notes use this structure:

```yaml
---
title: "Your Custom Title"
tags: ["chatgpt", "ai", "custom-tag"]
created: 2024-01-01
source: ChatGPT
conversation: "Original Conversation Title"
---

## User Prompt

Your original question or prompt

## Response

ChatGPT's response with preserved formatting including:
- **Bold text**
- *Italic text*
- `Inline code`
- Code blocks with syntax highlighting
- Lists and bullet points
- Line breaks and paragraphs
```

## Development

### Requirements

- Node.js 18+ 
- TypeScript
- Obsidian (for testing)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/mjashton/chatgpt-obsidian-plugin.git
cd chatgpt-obsidian-plugin

# Install dependencies
npm install

# Start development build
npm run dev

# Or build manually
npm run build

# If npm is having issues:
node esbuild.config.mjs production  # Production build
node esbuild.config.mjs             # Development build with watch
```

### Testing

```bash
# Test the parser independently with your ChatGPT export
node test-parser.cjs --path="/path/to/your/conversations.json"

# Or use the directory containing your export
node test-parser.cjs --dir="/path/to/your/export-folder"

# On Windows:
node test-parser.cjs --path="C:\Users\YourName\Downloads\export\conversations.json"

# For full testing, copy built files to an Obsidian vault and test manually
```

### Project Structure

```
├── main.ts              # Main plugin source code
├── manifest.json        # Plugin metadata
├── styles.css           # Plugin styling
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── esbuild.config.mjs   # Build configuration
├── test-parser.cjs      # Standalone parser testing
└── ai/                  # AI-specific documentation
    ├── README.md
    ├── data-format-assumptions.md  # Critical ChatGPT format info
    ├── architecture-decisions.md
    ├── development-context.md
    ├── testing-strategy.md
    ├── common-issues.md
    └── extension-points.md
```

## Architecture

The plugin uses a simple, focused architecture:

- **Single-file structure**: All logic in `main.ts` for simplicity
- **Modal-based UI**: Uses Obsidian's native modal system
- **Tree-walking parser**: Handles ChatGPT's complex conversation structure
- **Table of contents pattern**: Scalable navigation for large conversation sets

For detailed architectural decisions and rationale, see [`ai/architecture-decisions.md`](ai/architecture-decisions.md).

## Data Format

The plugin expects ChatGPT export data in the standard `conversations.json` format. For detailed information about assumptions and data structure, see [`ai/data-format-assumptions.md`](ai/data-format-assumptions.md).

## Contributing

Contributions are welcome! Please read the development documentation in the `ai/` folder for context about the project structure and design decisions.

### Areas for Contribution

- **Performance improvements** for large conversation sets
- **Search and filtering** functionality
- **Bulk operations** for saving multiple responses
- **Template system** for customizable note formats
- **Additional export format support** (Claude, Bard, etc.)

## Troubleshooting

Common issues and solutions are documented in [`ai/common-issues.md`](ai/common-issues.md).

### Quick Fixes

- **Build errors**: Ensure Node.js 18+ is installed
- **Plugin not loading**: Check that all required files are in the plugin directory
- **Parse errors**: Verify your `conversations.json` file is valid and complete
- **Performance issues**: Try with smaller conversation exports first

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v2.0.0
- **NEW**: Smart Q&A pair state tracking (New/Saved/Ignored)
- **NEW**: Conversation-level filtering by processing status
- **NEW**: Visual status indicators throughout the UI
- **NEW**: Q&A pair filtering within conversations
- **IMPROVED**: Enhanced table of contents with processing status
- **IMPROVED**: Better organization of conversations by completion state
- **IMPROVED**: Persistent state tracking across plugin sessions

### v1.0.0
- Initial release
- ChatGPT conversation import
- Table of contents navigation
- Individual response saving
- YAML frontmatter support
- Configurable settings

## Acknowledgments

- Built for the [Obsidian](https://obsidian.md) knowledge management platform
- Designed to work with [ChatGPT](https://chat.openai.com) export data
- Developed with extensive AI assistance and documentation
