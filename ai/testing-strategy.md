# Testing Strategy

## Testing Philosophy

This plugin prioritizes **integration testing** with real ChatGPT export data over unit testing, since the primary risk is data format compatibility and user workflow issues.

## Current Testing Infrastructure

### 1. Parser Testing Script
**File**: `test-parser.cjs`

**Purpose**: Standalone testing of the ChatGPT data parser without Obsidian dependencies.

**Usage**:
```bash
node test-parser.cjs --path="/path/to/conversations.json"
node test-parser.cjs --dir="/path/to/export-folder"
```

**What it tests**:
- JSON parsing of conversations.json
- Tree structure navigation
- Message extraction and filtering
- Content formatting

**Sample Output**:
```
Testing ChatGPT parser...
Found 15 conversations
Conversation: "Help with React components"
  - 8 total messages
  - 4 assistant responses
  Assistant Response 1: "I'd be happy to help you with React components..."
```

### 2. Manual Integration Testing
**Environment**: Real Obsidian installation
**Process**: Manual testing workflow with actual ChatGPT export files

## Test Data Requirements

### Essential Test Cases
1. **Small Export** (1-5 conversations)
   - Basic functionality verification
   - UI responsiveness testing
   
2. **Medium Export** (20-50 conversations)  
   - Navigation pattern validation
   - Performance baseline
   
3. **Large Export** (100+ conversations)
   - Scalability testing  
   - Memory usage validation
   - UI responsiveness under load

### Data Variations to Test
1. **Conversation Types**:
   - Simple Q&A pairs
   - Multi-turn conversations
   - Conversations with code blocks
   - Conversations with lists and formatting
   - Empty or very short conversations

2. **Content Types**:
   - Plain text responses
   - Code-heavy responses  
   - Mathematical content
   - Multi-language content
   - Responses with special characters

3. **Edge Cases**:
   - Malformed JSON files
   - Empty conversations.json
   - Conversations with missing messages
   - Null or undefined content fields

## Testing Workflow

### 1. Parser Validation
```bash
# Test parser with sample data
node test-parser.cjs

# Expected: No errors, reasonable output structure
```

### 2. Build Verification
```bash  
# Build the plugin
npm run build
# Or manually:
node_modules/.bin/esbuild main.ts --bundle --external:obsidian --outfile=main.js --format=cjs --target=es2016

# Verify output
node -c main.js  # Should not error
ls -la main.js   # Should be ~20KB
```

### 3. Obsidian Integration Testing
1. Copy built files to test vault plugin directory
2. Enable plugin in Obsidian settings
3. Test complete workflow:
   - Load conversations.json file
   - Navigate table of contents
   - View individual conversations
   - Save sample responses as notes
   - Verify note format and content

### 4. Cross-Platform Testing
- Test on Windows (primary development platform)
- Test on macOS (if available)
- Test on Linux (if available)

## Validation Criteria

### Parser Validation
- [ ] Successfully parses valid conversations.json files
- [ ] Handles malformed JSON gracefully
- [ ] Extracts correct message count
- [ ] Preserves message content and formatting  
- [ ] Maintains conversation chronological order
- [ ] Filters out system messages correctly

### UI Validation
- [ ] Table of contents displays all conversations
- [ ] Navigation between conversations works
- [ ] Single conversation view shows correct content
- [ ] Save functionality creates proper notes
- [ ] Error states provide helpful feedback
- [ ] UI remains responsive with large datasets

### Note Output Validation
- [ ] YAML frontmatter is valid
- [ ] Markdown content renders correctly in Obsidian
- [ ] File naming avoids conflicts
- [ ] Folder creation works as expected
- [ ] Unicode content is preserved

### Performance Validation
- [ ] Loads 100+ conversations without freezing
- [ ] Memory usage remains reasonable
- [ ] File operations complete within reasonable time
- [ ] UI interactions remain responsive

## Automated Testing Opportunities

### Potential Unit Tests
```typescript
// Parser functions that could be unit tested:
describe('ChatGPT Parser', () => {
  test('parseChatGPTData handles valid JSON', () => {
    // Test JSON parsing
  });
  
  test('extractConversations walks tree correctly', () => {
    // Test tree traversal
  });
  
  test('formatMessageContent converts markdown', () => {
    // Test content formatting
  });
});
```

### Integration Test Scripts
```javascript
// Potential automated integration tests:
const testWorkflow = async () => {
  // 1. Load test data
  // 2. Parse conversations  
  // 3. Validate structure
  // 4. Test UI components
  // 5. Verify note generation
};
```

## Test Data Management

### Creating Test Data
1. **Export from ChatGPT**: Use actual export functionality
2. **Anonymize Content**: Remove sensitive information
3. **Create Variations**: Manually create edge case files
4. **Version Control**: Store test data in separate repository

### Test File Naming Convention
```
test-data/
  ├── small-export.json      (1-5 conversations)
  ├── medium-export.json     (20-50 conversations) 
  ├── large-export.json      (100+ conversations)
  ├── malformed.json         (Invalid JSON)
  ├── empty-conversations.json (Empty array)
  └── edge-cases/
      ├── unicode-content.json
      ├── code-heavy.json
      └── missing-fields.json
```

## Regression Testing

### Critical Paths to Verify
1. **Data Loading**: File selection and JSON parsing
2. **Navigation**: Table of contents and conversation switching  
3. **Content Display**: Formatting and rendering
4. **Note Saving**: File creation and content generation

### Version Compatibility Testing
- Test with different ChatGPT export versions
- Verify compatibility with different Obsidian versions
- Test on different operating systems

## Error Testing

### Expected Error Scenarios
1. **Invalid File Selection**: Non-JSON files
2. **Malformed Data**: Broken JSON structure
3. **Missing Fields**: Incomplete conversation objects
4. **File System Errors**: Permission issues, disk full
5. **Obsidian API Errors**: Plugin API changes

### Error Handling Validation
- [ ] Errors display user-friendly messages
- [ ] Plugin doesn't crash on invalid input
- [ ] Recovery from errors is possible
- [ ] Debug information is logged to console

## Performance Benchmarks

### Target Metrics
- **Parse Time**: < 1 second for 100 conversations
- **UI Render**: < 500ms to display table of contents  
- **Memory Usage**: < 50MB for large exports
- **File Operations**: < 100ms per note creation

### Performance Testing Commands
```javascript
// Example performance measurement
console.time('Parse conversations');
const conversations = plugin.extractConversations(data);
console.timeEnd('Parse conversations');
```
