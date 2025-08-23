# Development Context

## Development Environment

### System Environment
- **OS**: Windows 11
- **Shell**: PowerShell 5.1.26100.4768
- **Node.js**: 24.6.0 (upgraded from 12.16.3 during development)
- **npm**: Corrupted during development, bypassed with direct esbuild usage

### Development Tools
- **Primary Language**: TypeScript
- **Build Tool**: esbuild 0.24.0
- **Target Environment**: Obsidian Plugin (Electron app)
- **IDE Considerations**: Should work with VS Code TypeScript support

### Build Process Evolution
The build process had several iterations due to environmental issues:

1. **Initial Setup**: Standard npm-based build
2. **Node.js Compatibility Issue**: Upgraded from Node 12.16.3 to 24.6.0  
3. **npm Corruption**: npm became unreliable, switched to direct esbuild execution
4. **Final Build Command**:
   ```bash
   D:\dev\chatgpt-obsidian-plugin\node_modules\.bin\esbuild.cmd main.ts --bundle --external:obsidian --outfile=main.js --format=cjs --target=es2016
   ```

## Project Genesis Context

### Original Requirements
- **User Need**: Import ChatGPT conversation exports into Obsidian
- **Data Source**: ChatGPT export ZIP files containing `conversations.json`
- **Output**: Individual ChatGPT responses as Obsidian markdown notes
- **UI Preference**: Obsidian plugin (not standalone application)

### User Workflow Assumptions
1. User exports conversations from ChatGPT settings
2. User extracts the ZIP file locally  
3. User selects `conversations.json` through plugin UI
4. User browses conversations and selects specific responses
5. User saves selected responses as individual notes with metadata

### Technical Constraints
- **Obsidian Plugin API**: Must work within Obsidian's plugin system
- **File Access**: Browser-based file selection (no direct file system access)
- **Markdown Compatibility**: Output must be valid Obsidian markdown
- **Cross-Platform**: Must work on Windows, macOS, and Linux

## Development Challenges Encountered

### 1. Node.js Version Compatibility
**Problem**: Initial development used Node.js 12.16.3, which was too old for modern tooling.

**Solution**: Upgraded to Node.js 24.6.0 LTS.

**Learning**: Always verify Node.js version compatibility before starting plugin development.

### 2. npm Installation Corruption
**Problem**: npm became unreliable after Node.js upgrade, failing to run or install packages properly.

**Workaround**: Used direct esbuild.cmd execution instead of npm scripts.

**Learning**: Have backup build strategies ready when npm fails.

### 3. ChatGPT Data Structure Complexity
**Problem**: ChatGPT exports use a complex tree structure, not simple arrays.

**Solution**: Implemented tree-walking parser that follows parent-child relationships.

**Learning**: Always analyze sample data thoroughly before implementing parsers.

### 4. UI Scalability
**Problem**: Initial UI showed all conversations at once, becoming overwhelming with large exports.

**Solution**: Implemented table of contents + single conversation view pattern.

**Learning**: Consider scalability from the beginning, especially for data import tools.

### 5. Module System Compatibility
**Problem**: Mixed ES modules and CommonJS requirements between Node.js and Obsidian.

**Solution**: Used esbuild to bundle as CommonJS with ES2016 target.

**Learning**: Obsidian plugins must output CommonJS despite modern ES module preferences.

## Code Organization Evolution

### Initial Structure
```
main.ts - All functionality in one file
styles.css - Basic styling
manifest.json - Plugin metadata
package.json - Dependencies
```

### Testing Approach
```
test-parser.cjs - Standalone parser testing
```

### Documentation Addition
```
ai/ - AI-specific documentation
README.md - User documentation
```

## Key Development Decisions Made During Implementation

### 1. Single File vs Modular
**Decision**: Keep everything in main.ts initially
**Reason**: Simpler for initial development, can refactor later if needed

### 2. Direct File Input vs Drag-and-Drop
**Decision**: HTML file input element  
**Reason**: More reliable across different Obsidian versions and operating systems

### 3. HTML Rendering vs Plain Text
**Decision**: Convert to HTML for display
**Reason**: Better user experience showing formatted content with code blocks, lists, etc.

### 4. Table of Contents Pattern
**Decision**: Two-mode UI (list + single view)
**Reason**: Better scalability and user experience with large conversation sets

### 5. YAML Frontmatter Structure
**Decision**: Include conversation metadata in frontmatter
**Reason**: Makes notes searchable and provides context

## Plugin Distribution Considerations

### Manual Installation
The plugin is designed for manual installation:
1. Copy files to `<vault>/.obsidian/plugins/chatgpt-obsidian-plugin/`
2. Enable in Obsidian settings

### Files Required for Distribution
- `main.js` (built output)
- `manifest.json`
- `styles.css`

### Files Not Required for Distribution
- `main.ts` (source code)
- `package.json` (build dependencies)
- `tsconfig.json` (TypeScript config)
- `esbuild.config.mjs` (build config)
- `test-parser.cjs` (testing script)
- `ai/` (AI documentation)

## Future Development Environment Setup

### Recommended Setup Process
1. **Node.js**: Install Node.js 18+ LTS
2. **Dependencies**: Run `npm install` 
3. **Development**: Edit `main.ts`
4. **Build**: Run build command or `npm run build` if npm is functional
5. **Test**: Copy built files to Obsidian vault for testing

### Build Verification
```bash
# Verify the build outputs valid JavaScript
node -c main.js

# Check file size (should be ~20KB)
ls -la main.js
```

### Development Tips
- Use TypeScript for development but remember Obsidian needs CommonJS output
- Test with real ChatGPT export files, not synthetic data
- Test UI with both small and large conversation sets
- Verify cross-platform compatibility if possible
