# ChatGPT Export Data Format Assumptions

## Critical Information

This document contains **CRITICAL** assumptions about the ChatGPT export data format. These assumptions are built into the parsing logic and must be understood when modifying the parser.

## File Structure

### Export Archive
- ChatGPT exports come as a ZIP file
- The conversations are in `conversations.json` at the root level
- Users must extract this file before using the plugin

### conversations.json Structure

The file contains an **array** of conversation objects:

```json
[
  {
    "title": "string",
    "create_time": 1234567890,
    "update_time": 1234567890,
    "mapping": { ... },
    "conversation_id": "uuid",
    "id": "uuid"
  }
]
```

## Message Tree Structure

Each conversation contains a `mapping` object that represents messages in a **parent-child tree structure**, NOT a simple array.

### Key Structure:
```json
{
  "mapping": {
    "message-uuid-1": {
      "id": "message-uuid-1",
      "message": {
        "id": "message-uuid-1",
        "author": {
          "role": "system|user|assistant|tool",
          "name": null,
          "metadata": {}
        },
        "create_time": 1234567890,
        "update_time": null,
        "content": {
          "content_type": "text",
          "parts": ["actual message content"]
        },
        "status": "finished_successfully",
        "end_turn": true,
        "weight": 1.0,
        "metadata": {}
      },
      "parent": "parent-message-uuid-or-null",
      "children": ["child-uuid-1", "child-uuid-2"]
    }
  }
}
```

## Critical Parsing Logic

### 1. Conversation Thread Extraction
The parser **walks the tree** to extract linear conversation threads:

1. **Find Root**: Look for the first user message whose parent is a system message
2. **Follow Chain**: Follow `children[0]` to walk the primary conversation path
3. **Skip System Messages**: System messages are ignored in the final output
4. **Extract Content**: Message content is in `message.content.parts[]` array

### 2. Message Content Structure
- Content is stored in `message.content.parts` as an **array of strings**
- The parser joins these with `\n` to create the full message content
- Empty or whitespace-only content is filtered out

### 3. Role Mapping
- `"user"` - Human input/prompts
- `"assistant"` - ChatGPT responses 
- `"system"` - System messages (ignored)
- `"tool"` - Tool usage messages (treated as content)

### 4. Timestamp Handling
- Timestamps are Unix timestamps (seconds since epoch)
- `create_time` is used for message ordering
- Some messages may have `null` timestamps

## Assumptions Made

### Data Structure Assumptions
1. **Array Format**: `conversations.json` is always an array of conversation objects
2. **Tree Structure**: Messages are organized in a parent-child tree, not a flat array
3. **Primary Path**: The main conversation follows `children[0]` at each level
4. **Content Array**: Message content is always in `parts[]` array format
5. **Role Consistency**: Message roles follow the documented values

### Parsing Assumptions  
1. **System Message Root**: Conversations start with a system message as the tree root
2. **User-Assistant Pairs**: User messages are typically followed by assistant responses
3. **Single Thread**: Only the primary conversation thread is extracted (ignores alternative responses)
4. **Non-Empty Content**: Empty messages are filtered out

### UI Assumptions
1. **Assistant Focus**: The UI primarily displays assistant messages for saving
2. **Context Pairing**: User prompts are shown as context for assistant responses
3. **Sequential Order**: Messages are displayed in chronological order

## Fragility Points

### High Risk Areas
1. **Tree Walking Logic**: Changes to ChatGPT's conversation tree structure would break parsing
2. **Content Structure**: Changes to `content.parts` format would break content extraction
3. **Role Names**: Changes to role string values would break filtering logic
4. **Root Finding**: Changes to system message structure would break conversation start detection

### Medium Risk Areas
1. **Timestamp Format**: Changes from Unix timestamps would affect date display
2. **Message IDs**: Changes to UUID format might affect message linking
3. **Metadata Structure**: Additional metadata fields are generally safe (ignored)

## Validation Strategy

To validate data format assumptions:
1. Test with sample `conversations.json` files from different ChatGPT export dates
2. Verify tree structure integrity
3. Check content extraction completeness
4. Validate role mapping accuracy

## Extension Considerations

If extending the parser:
1. **Preserve Tree Walking**: Don't convert to flat arrays unless necessary
2. **Handle Missing Data**: Always check for null/undefined values
3. **Validate Assumptions**: Test with multiple export file versions
4. **Log Parsing Issues**: Help users identify format problems
