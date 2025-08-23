# Common Issues and Solutions

## Build and Development Issues

### 1. Node.js Version Compatibility
**Problem**: Build failures with old Node.js versions
```
Error: esbuild requires Node.js version 14 or higher
```

**Solution**: Upgrade Node.js to version 18 or higher (LTS recommended)
```bash
# Check current version
node --version

# Download and install latest LTS from https://nodejs.org/
```

**Root Cause**: Modern tooling requires recent Node.js versions

### 2. npm Installation Issues  
**Problem**: npm commands fail or produce errors
```
npm ERR! cb() never called!
npm ERR! This is an error with npm itself.
```

**Solution**: Use direct esbuild execution
```bash
# Instead of: npm run build
# Use: 
node_modules/.bin/esbuild main.ts --bundle --external:obsidian --outfile=main.js --format=cjs --target=es2016
```

**Alternative**: Clear npm cache and reinstall
```bash
npm cache clean --force
npm install
```

### 3. Module Format Errors
**Problem**: ES module vs CommonJS conflicts
```
ReferenceError: require is not defined
```

**Solution**: Ensure build outputs CommonJS format
```bash
esbuild main.ts --format=cjs --target=es2016
```

**Note**: Obsidian requires CommonJS modules, not ES modules

### 4. TypeScript Compilation Errors
**Problem**: Type errors during build
```
error TS2307: Cannot find module 'obsidian'
```

**Solution**: Install Obsidian types and check tsconfig.json
```bash
npm install @types/node
```

Verify tsconfig.json includes:
```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true
  }
}
```

## Data Parsing Issues

### 5. Invalid JSON Format
**Problem**: conversations.json file won't parse
```
Error loading ChatGPT data: Unexpected token in JSON
```

**Solutions**:
1. **Verify file integrity**: Re-export from ChatGPT
2. **Check file encoding**: Ensure UTF-8 encoding
3. **Validate JSON**: Use online JSON validator
4. **Check file size**: Ensure complete download

**Debug Steps**:
```javascript
// Add to parser for debugging
try {
  const data = JSON.parse(jsonContent);
  console.log('Parsed successfully:', data.length, 'conversations');
} catch (error) {
  console.error('JSON parse error:', error.message);
  console.log('First 200 characters:', jsonContent.substring(0, 200));
}
```

### 6. Missing Message Content
**Problem**: Conversations appear empty or with missing responses

**Root Cause**: ChatGPT's export format has changed or conversation tree structure is different

**Debug Solution**:
```javascript
// Add debugging to extractConversations method
const mapping = conv.mapping;
console.log('Mapping keys:', Object.keys(mapping));
console.log('Sample message:', Object.values(mapping)[0]);
```

**Fix**: Update parser logic based on new structure

### 7. Tree Traversal Errors
**Problem**: Parser can't find conversation start or gets stuck in loops

**Symptoms**: 
- Empty conversation lists
- Plugin hangs during parsing
- Missing messages

**Solution**: Review tree walking logic in `extractConversations()`
```javascript
// Add safety checks
let visited = new Set();
while (current && !visited.has(current.id)) {
  visited.add(current.id);
  // ... existing logic
  current = current.children.length > 0 ? mapping[current.children[0]] : null;
}
```

## UI and Display Issues  

### 8. Modal Not Displaying Correctly
**Problem**: Modal appears but content is empty or malformed

**Solutions**:
1. **Check console for errors**: Look for JavaScript errors
2. **Verify CSS loading**: Ensure styles.css is loaded
3. **Test with small dataset**: Use minimal conversations.json

**Debug**: Add logging to modal display methods
```typescript
displayConversations(container: HTMLElement) {
  console.log('Displaying conversations:', this.conversations.length);
  container.empty();
  // ... rest of method
}
```

### 9. Styling Issues
**Problem**: UI looks broken or hard to read

**Solutions**:
1. **Update styles.css**: Ensure CSS variables are correct
2. **Test in different themes**: Verify dark/light theme compatibility  
3. **Check Obsidian version**: Ensure compatibility

**CSS Debug**:
```css
/* Add temporary debugging styles */
.conversation-item {
  border: 2px solid red !important;
}
```

### 10. Performance Issues with Large Files
**Problem**: UI becomes unresponsive with 100+ conversations

**Symptoms**:
- Modal takes long time to open
- Scrolling is laggy
- Browser may become unresponsive

**Solutions**:
1. **Implement pagination**: Show conversations in batches
2. **Add loading indicators**: Show progress during parsing
3. **Use virtual scrolling**: Only render visible items

**Immediate Workaround**: Test with smaller export files

## File System and Note Creation Issues

### 11. File Permission Errors
**Problem**: Can't create notes in vault
```
Error saving note: EACCES: permission denied
```

**Solutions**:
1. **Check vault permissions**: Ensure Obsidian can write to folder
2. **Try different folder**: Test with root vault folder
3. **Check file name**: Ensure filename doesn't contain invalid characters

**Debug**: Test file creation manually in Obsidian

### 12. Filename Conflicts
**Problem**: Notes aren't saving due to filename collisions

**Root Cause**: Multiple responses with same conversation title

**Solution**: Already implemented in code with counter suffix
```typescript
// This should handle it automatically
while (this.app.vault.getAbstractFileByPath(finalPath)) {
  const pathParts = filePath.split('.');
  pathParts[pathParts.length - 2] += ` (${counter})`;
  finalPath = pathParts.join('.');
  counter++;
}
```

### 13. YAML Frontmatter Errors
**Problem**: Created notes have malformed frontmatter

**Solution**: Escape special characters in YAML values
```typescript
// Ensure proper YAML escaping
title: "${title.replace(/"/g, '\\"')}"
conversation: "${this.conversation.title.replace(/"/g, '\\"')}"
```

## Plugin Integration Issues

### 14. Plugin Not Loading in Obsidian
**Problem**: Plugin doesn't appear in Obsidian settings

**Checklist**:
- [ ] Files copied to correct plugin directory: `<vault>/.obsidian/plugins/chatgpt-obsidian-plugin/`
- [ ] Required files present: `main.js`, `manifest.json`, `styles.css`
- [ ] manifest.json is valid JSON
- [ ] Plugin enabled in Obsidian settings

**Debug**: Check Obsidian console for errors (Ctrl+Shift+I)

### 15. Ribbon Icon Not Appearing
**Problem**: Plugin loads but ribbon icon is missing

**Solution**: Check icon name in manifest.json and main.ts
```typescript
// Ensure icon name is valid
this.addRibbonIcon('message-square', 'ChatGPT to Obsidian', ...);
```

### 16. Settings Not Persisting
**Problem**: Plugin settings reset after restart

**Solution**: Verify settings save/load implementation
```typescript
async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

async saveSettings() {
  await this.saveData(this.settings);
}
```

## Data Format Evolution Issues

### 17. ChatGPT Export Format Changes
**Problem**: Plugin stops working with newer ChatGPT exports

**Symptoms**:
- Parsing errors with valid JSON
- Missing conversations or messages
- Different message structure

**Solution Strategy**:
1. **Compare formats**: Analyze old vs new export structure
2. **Update parser logic**: Modify `extractConversations()` method
3. **Add version detection**: Handle multiple format versions

**Example Version Detection**:
```typescript
function detectExportVersion(data: any): string {
  if (Array.isArray(data)) return 'v1';
  if (data.conversations && Array.isArray(data.conversations)) return 'v2';
  return 'unknown';
}
```

## Troubleshooting Workflow

### General Debugging Steps
1. **Check console**: Look for JavaScript errors
2. **Test with minimal data**: Use small conversations.json file
3. **Verify build**: Ensure main.js is recent and correct size
4. **Test parser standalone**: Use test-parser.cjs
5. **Check file permissions**: Ensure vault is writable
6. **Try different vault**: Test with fresh vault

### Getting Help
1. **Collect information**: Plugin version, Obsidian version, OS, error messages
2. **Create minimal reproduction**: Small test file that reproduces issue
3. **Document steps**: Exact sequence of actions that causes problem
4. **Include logs**: Console errors and relevant log messages

### Emergency Recovery
If plugin breaks Obsidian:
1. **Disable plugin**: In Obsidian settings, turn off the plugin
2. **Remove files**: Delete plugin folder if necessary
3. **Restart Obsidian**: Fresh start without plugin
4. **Re-install**: Copy known-good version of plugin files
