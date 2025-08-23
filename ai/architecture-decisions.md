# Architecture Decisions

## Core Architectural Choices

### 1. Plugin Structure - Single File Architecture
**Decision**: Keep all plugin logic in `main.ts` rather than splitting into multiple modules.

**Rationale**: 
- Simplicity for initial development
- Easier to understand for small plugin scope
- Obsidian plugin guidelines suggest this for simple plugins

**Trade-offs**:
- ✅ Easy to locate all functionality
- ✅ Minimal build complexity  
- ❌ Could become unwieldy if plugin grows significantly
- ❌ Harder to unit test individual components

### 2. UI Architecture - Modal-Based Interface
**Decision**: Use Obsidian's Modal system for the main UI rather than a sidebar or custom view.

**Rationale**:
- Matches Obsidian's UI patterns
- Import operations are typically one-time activities
- Modal provides focused, distraction-free experience
- Built-in escape key and backdrop click handling

**Implementation**:
- `ChatGPTImportModal` - Main import interface
- `SaveNoteModal` - Note creation interface  
- Modal chaining for workflow progression

### 3. Data Flow - Parse-Transform-Display Pattern
**Decision**: Three-stage data processing pipeline.

**Stages**:
1. **Parse**: `parseChatGPTData()` - JSON parsing with error handling
2. **Transform**: `extractConversations()` - Tree walking and linearization  
3. **Display**: Modal UI rendering with formatted content

**Benefits**:
- Clear separation of concerns
- Easy to debug parsing issues
- Transforms can be tested independently
- Display logic is isolated from data processing

### 4. Navigation Pattern - Table of Contents + Single View
**Decision**: Two-mode interface rather than all-conversations-at-once.

**Rationale**:
- Large conversation exports (100+ conversations) were overwhelming
- Scrolling through many conversations was poor UX
- Users typically want to browse then focus on specific conversations
- Reduces memory usage and DOM complexity

**Implementation**:
- `viewMode: 'toc' | 'conversation'` state management
- Separate rendering methods for each mode
- Navigation state preservation

### 5. Content Formatting - HTML for Display, Markdown for Export
**Decision**: Convert content to HTML for UI display but preserve markdown for note export.

**Rationale**:
- HTML allows rich formatting in modals (code blocks, lists, emphasis)
- Markdown preservation ensures notes remain editable in Obsidian
- Separation allows for different formatting needs

**Implementation**:
- `formatMessageContent()` - HTML conversion for display
- `convertToMarkdown()` - Markdown preservation for export
- CSS styling for HTML rendering

### 6. Settings Architecture - Plugin Settings Tab
**Decision**: Use Obsidian's native settings system rather than in-modal configuration.

**Benefits**:
- Consistent with Obsidian patterns  
- Persistent across plugin reloads
- Accessible via standard settings path
- Automatic save/load handling

**Settings Structure**:
```typescript
interface ChatGPTSettings {
  defaultFolder: string;
  includeUserPrompts: boolean;
  includeTimestamps: boolean;
  includeTags: boolean;
  defaultTags: string;
}
```

### 7. File Handling - Browser FileReader API
**Decision**: Use browser's FileReader rather than Node.js file system APIs.

**Rationale**:
- Works in Obsidian's Electron environment
- Provides user file selection interface
- No need to handle file permissions
- Cross-platform compatibility

**Implementation**:
- HTML file input element
- FileReader for async file processing
- Error handling for malformed files

### 8. Error Handling Strategy - User-Friendly Notices
**Decision**: Use Obsidian's Notice system for user feedback rather than console-only logging.

**Approach**:
- Parse errors → User notices with actionable messages
- Success operations → Confirmation notices  
- Debug info → Console logging
- Validation errors → Specific guidance

### 9. Note Creation - YAML Frontmatter + Markdown Body
**Decision**: Structure saved notes with metadata frontmatter and markdown content.

**Format**:
```yaml
---
title: "Note Title"
tags: ["chatgpt", "ai"]
created: 2024-01-01
source: ChatGPT
conversation: "Original Conversation Title"
---

## User Prompt
[User's question]

## Response  
[ChatGPT's response]
```

**Benefits**:
- Searchable metadata in Obsidian
- Consistent note structure
- Preserves conversation context
- Compatible with Obsidian plugins

### 10. Build System - esbuild with CommonJS Output
**Decision**: Use esbuild targeting CommonJS for Obsidian compatibility.

**Configuration**:
```javascript
require('esbuild').build({
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian'],
  outfile: 'main.js', 
  format: 'cjs',
  target: 'es2016'
})
```

**Rationale**:
- Fast builds during development
- Obsidian requires CommonJS modules
- ES2016 target ensures compatibility
- External 'obsidian' prevents bundling conflicts

## Design Patterns Used

### 1. Factory Pattern
- Modal creation: `new ChatGPTImportModal(app, plugin).open()`
- Consistent initialization across modals

### 2. Observer Pattern  
- Settings changes trigger UI updates
- Modal state changes trigger re-renders

### 3. Strategy Pattern
- Different view modes (TOC vs single conversation)
- Pluggable content formatting

### 4. Template Pattern
- Note generation follows consistent structure
- Frontmatter + content pattern

## Future Architecture Considerations

### Modularity
If the plugin grows, consider:
- Separate parser module
- UI component abstraction
- Service layer for file operations

### Performance
For large datasets:
- Virtual scrolling for conversation lists
- Lazy loading of conversation content
- Background parsing with progress indicators

### Extensibility
Potential extension points:
- Custom note templates
- Additional export formats
- Bulk operations
- Conversation filtering/search
