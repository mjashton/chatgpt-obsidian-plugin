import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { MockApp, MockTFile } from './mocks/obsidian';

// Import the types we need from main.ts
enum QAPairState {
  NEW = 'new',
  IGNORED = 'ignored',
  SAVED = 'saved'
}

enum ConversationProcessingStatus {
  UNPROCESSED = 'unprocessed',
  PARTIAL = 'partial', 
  PROCESSED = 'processed'
}

interface QAPairMetadata {
  pairId: string;
  pairHash: string;
  conversationId: string;
  state: QAPairState;
  timestamp: number;
  userPrompt: string;
  responsePreview: string;
}

interface QAPairMetadataStore {
  qaPairs: { [key: string]: QAPairMetadata };
  lastUpdated: number;
}

// Test implementation of the plugin's Q&A pair management
class TestChatGPTPlugin {
  app: MockApp;
  private metadataStore: QAPairMetadataStore = { qaPairs: {}, lastUpdated: Date.now() };
  private readonly METADATA_FILE_NAME = '.chatgpt-plugin-metadata.json';

  constructor(app: MockApp) {
    this.app = app;
  }

  private generateQAPairHash(userPrompt: string, response: string): string {
    const content = JSON.stringify({
      userPrompt: userPrompt.substring(0, 200),
      response: response.substring(0, 200)
    });
    
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  generateQAPairId(conversationId: string, userMsgId: string, assistantMsgId: string): string {
    return `${conversationId}_${userMsgId}_${assistantMsgId}`;
  }

  getQAPairState(pairId: string): QAPairState {
    const metadata = this.metadataStore.qaPairs[pairId];
    return metadata ? metadata.state : QAPairState.NEW;
  }

  async updateQAPairState(pairId: string, state: QAPairState, conversationId: string, userPrompt: string, response: string): Promise<void> {
    const hash = this.generateQAPairHash(userPrompt, response);
    
    this.metadataStore.qaPairs[pairId] = {
      pairId,
      pairHash: hash,
      conversationId,
      state,
      timestamp: Date.now(),
      userPrompt: userPrompt.substring(0, 100),
      responsePreview: response.substring(0, 100)
    };
    
    await this.saveConversationMetadata();
  }

  getConversationProcessingStatus(conversationId: string, totalAssistantMessages?: number): ConversationProcessingStatus {
    const pairs = Object.values(this.metadataStore.qaPairs)
      .filter(pair => pair.conversationId === conversationId);
    
    if (totalAssistantMessages === undefined) {
      if (pairs.length === 0) {
        return ConversationProcessingStatus.UNPROCESSED;
      }
      const newCount = pairs.filter(p => p.state === QAPairState.NEW).length;
      return newCount === 0 ? ConversationProcessingStatus.PROCESSED : ConversationProcessingStatus.PARTIAL;
    }
    
    const processedPairs = pairs.filter(p => p.state !== QAPairState.NEW).length;
    const newPairs = pairs.filter(p => p.state === QAPairState.NEW).length;
    const unprocessedPairs = totalAssistantMessages - pairs.length;
    
    const totalNewPairs = newPairs + unprocessedPairs;
    
    if (totalNewPairs === 0) {
      return ConversationProcessingStatus.PROCESSED;
    } else if (processedPairs > 0) {
      return ConversationProcessingStatus.PARTIAL;
    } else {
      return ConversationProcessingStatus.UNPROCESSED;
    }
  }

  private async saveConversationMetadata(): Promise<void> {
    this.metadataStore.lastUpdated = Date.now();
    const content = JSON.stringify(this.metadataStore, null, 2);
    
    const existingFile = this.app.vault.getAbstractFileByPath(this.METADATA_FILE_NAME) as MockTFile;
    if (existingFile) {
      await this.app.vault.modify(existingFile, content);
    } else {
      await this.app.vault.create(this.METADATA_FILE_NAME, content);
    }
  }

  async loadConversationMetadata(): Promise<void> {
    const metadataFile = this.app.vault.getAbstractFileByPath(this.METADATA_FILE_NAME) as MockTFile;
    if (metadataFile) {
      const content = await this.app.vault.read(metadataFile);
      const data = JSON.parse(content);
      
      if (data.qaPairs) {
        this.metadataStore = data;
      } else {
        this.metadataStore = { qaPairs: {}, lastUpdated: Date.now() };
      }
    } else {
      this.metadataStore = { qaPairs: {}, lastUpdated: Date.now() };
    }
  }

  getQAPairMetadata(): QAPairMetadataStore {
    return this.metadataStore;
  }

  // Test helper methods
  _getMetadataStore() {
    return this.metadataStore;
  }

  _clearMetadata() {
    this.metadataStore = { qaPairs: {}, lastUpdated: Date.now() };
  }
}

describe('Q&A Pair State Management', () => {
  let app: MockApp;
  let plugin: TestChatGPTPlugin;

  beforeEach(() => {
    app = new MockApp();
    plugin = new TestChatGPTPlugin(app);
  });

  describe('generateQAPairId', () => {
    test('should generate consistent IDs', () => {
      const id1 = plugin.generateQAPairId('conv1', 'user1', 'assistant1');
      const id2 = plugin.generateQAPairId('conv1', 'user1', 'assistant1');
      
      expect(id1).toBe('conv1_user1_assistant1');
      expect(id1).toBe(id2);
    });

    test('should generate unique IDs for different inputs', () => {
      const id1 = plugin.generateQAPairId('conv1', 'user1', 'assistant1');
      const id2 = plugin.generateQAPairId('conv1', 'user1', 'assistant2');
      const id3 = plugin.generateQAPairId('conv2', 'user1', 'assistant1');
      
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });
  });

  describe('getQAPairState', () => {
    test('should return NEW for unknown pair', () => {
      const state = plugin.getQAPairState('unknown_pair');
      expect(state).toBe(QAPairState.NEW);
    });

    test('should return correct state for known pair', async () => {
      const pairId = 'test_conv_user_assistant';
      await plugin.updateQAPairState(pairId, QAPairState.SAVED, 'test_conv', 'test prompt', 'test response');
      
      const state = plugin.getQAPairState(pairId);
      expect(state).toBe(QAPairState.SAVED);
    });
  });

  describe('updateQAPairState', () => {
    test('should create new metadata entry', async () => {
      const pairId = 'conv1_user1_assistant1';
      const userPrompt = 'What is TypeScript?';
      const response = 'TypeScript is a strongly typed programming language that builds on JavaScript.';
      
      await plugin.updateQAPairState(pairId, QAPairState.SAVED, 'conv1', userPrompt, response);
      
      const metadata = plugin._getMetadataStore();
      expect(metadata.qaPairs[pairId]).toBeDefined();
      expect(metadata.qaPairs[pairId].state).toBe(QAPairState.SAVED);
      expect(metadata.qaPairs[pairId].conversationId).toBe('conv1');
      expect(metadata.qaPairs[pairId].userPrompt).toBe(userPrompt.substring(0, 100));
      expect(metadata.qaPairs[pairId].responsePreview).toBe(response.substring(0, 100));
    });

    test('should update existing metadata entry', async () => {
      const pairId = 'conv1_user1_assistant1';
      
      // First update
      await plugin.updateQAPairState(pairId, QAPairState.NEW, 'conv1', 'prompt', 'response');
      expect(plugin.getQAPairState(pairId)).toBe(QAPairState.NEW);
      
      // Second update
      await plugin.updateQAPairState(pairId, QAPairState.IGNORED, 'conv1', 'prompt', 'response');
      expect(plugin.getQAPairState(pairId)).toBe(QAPairState.IGNORED);
    });

    test('should truncate long prompts and responses', async () => {
      const pairId = 'conv1_user1_assistant1';
      const longPrompt = 'a'.repeat(200);
      const longResponse = 'b'.repeat(200);
      
      await plugin.updateQAPairState(pairId, QAPairState.SAVED, 'conv1', longPrompt, longResponse);
      
      const metadata = plugin._getMetadataStore();
      expect(metadata.qaPairs[pairId].userPrompt).toBe('a'.repeat(100));
      expect(metadata.qaPairs[pairId].responsePreview).toBe('b'.repeat(100));
    });

    test('should save metadata to vault', async () => {
      const pairId = 'conv1_user1_assistant1';
      
      await plugin.updateQAPairState(pairId, QAPairState.SAVED, 'conv1', 'prompt', 'response');
      
      expect(app.vault.create).toHaveBeenCalledWith(
        '.chatgpt-plugin-metadata.json', 
        expect.stringContaining('conv1_user1_assistant1')
      );
    });

    test('should handle multiple pairs for same conversation', async () => {
      const conv = 'conversation1';
      
      await plugin.updateQAPairState('pair1', QAPairState.NEW, conv, 'prompt1', 'response1');
      await plugin.updateQAPairState('pair2', QAPairState.SAVED, conv, 'prompt2', 'response2');
      await plugin.updateQAPairState('pair3', QAPairState.IGNORED, conv, 'prompt3', 'response3');
      
      const metadata = plugin._getMetadataStore();
      expect(Object.keys(metadata.qaPairs)).toHaveLength(3);
      expect(metadata.qaPairs.pair1.state).toBe(QAPairState.NEW);
      expect(metadata.qaPairs.pair2.state).toBe(QAPairState.SAVED);
      expect(metadata.qaPairs.pair3.state).toBe(QAPairState.IGNORED);
    });
  });

  describe('getConversationProcessingStatus', () => {
    test('should return UNPROCESSED for conversation with no metadata', () => {
      const status = plugin.getConversationProcessingStatus('unknown_conv');
      expect(status).toBe(ConversationProcessingStatus.UNPROCESSED);
    });

    test('should return PROCESSED when all pairs are processed', async () => {
      const conv = 'conv1';
      
      await plugin.updateQAPairState('pair1', QAPairState.SAVED, conv, 'p1', 'r1');
      await plugin.updateQAPairState('pair2', QAPairState.IGNORED, conv, 'p2', 'r2');
      
      const status = plugin.getConversationProcessingStatus(conv);
      expect(status).toBe(ConversationProcessingStatus.PROCESSED);
    });

    test('should return PARTIAL when some pairs are processed', async () => {
      const conv = 'conv1';
      
      await plugin.updateQAPairState('pair1', QAPairState.SAVED, conv, 'p1', 'r1');
      await plugin.updateQAPairState('pair2', QAPairState.NEW, conv, 'p2', 'r2');
      
      const status = plugin.getConversationProcessingStatus(conv);
      expect(status).toBe(ConversationProcessingStatus.PARTIAL);
    });

    test('should handle totalAssistantMessages parameter correctly', async () => {
      const conv = 'conv1';
      
      // 1 processed pair out of 3 total messages
      await plugin.updateQAPairState('pair1', QAPairState.SAVED, conv, 'p1', 'r1');
      
      const status = plugin.getConversationProcessingStatus(conv, 3);
      expect(status).toBe(ConversationProcessingStatus.PARTIAL);
    });

    test('should return PROCESSED when all messages are accounted for and processed', async () => {
      const conv = 'conv1';
      
      await plugin.updateQAPairState('pair1', QAPairState.SAVED, conv, 'p1', 'r1');
      await plugin.updateQAPairState('pair2', QAPairState.IGNORED, conv, 'p2', 'r2');
      
      const status = plugin.getConversationProcessingStatus(conv, 2);
      expect(status).toBe(ConversationProcessingStatus.PROCESSED);
    });

    test('should return UNPROCESSED when no pairs are processed', async () => {
      const conv = 'conv1';
      
      await plugin.updateQAPairState('pair1', QAPairState.NEW, conv, 'p1', 'r1');
      await plugin.updateQAPairState('pair2', QAPairState.NEW, conv, 'p2', 'r2');
      
      const status = plugin.getConversationProcessingStatus(conv, 3);
      expect(status).toBe(ConversationProcessingStatus.UNPROCESSED);
    });
  });

  describe('Metadata Persistence', () => {
    test('should save and load metadata correctly', async () => {
      const pairId = 'test_pair';
      
      // Save some metadata
      await plugin.updateQAPairState(pairId, QAPairState.SAVED, 'conv1', 'prompt', 'response');
      
      // Create new plugin instance to test loading
      const plugin2 = new TestChatGPTPlugin(app);
      await plugin2.loadConversationMetadata();
      
      expect(plugin2.getQAPairState(pairId)).toBe(QAPairState.SAVED);
    });

    test('should handle missing metadata file gracefully', async () => {
      const plugin2 = new TestChatGPTPlugin(app);
      await plugin2.loadConversationMetadata();
      
      expect(plugin2.getQAPairState('any_pair')).toBe(QAPairState.NEW);
    });

    test('should handle corrupted metadata file', async () => {
      // Add corrupted metadata file
      app.vault._addFile('.chatgpt-plugin-metadata.json', 'invalid json{');
      
      const plugin2 = new TestChatGPTPlugin(app);
      await expect(plugin2.loadConversationMetadata()).rejects.toThrow();
    });

    test('should migrate from old format gracefully', async () => {
      // Add old format metadata
      const oldFormat = {
        conversations: { 'conv1': { processed: true } },
        lastUpdated: Date.now()
      };
      app.vault._addFile('.chatgpt-plugin-metadata.json', JSON.stringify(oldFormat));
      
      const plugin2 = new TestChatGPTPlugin(app);
      await plugin2.loadConversationMetadata();
      
      // Should start with empty qaPairs after migration
      expect(Object.keys(plugin2.getQAPairMetadata().qaPairs)).toHaveLength(0);
    });
  });

  describe('Race Conditions and Edge Cases', () => {
    test('should handle rapid state updates correctly', async () => {
      const pairId = 'rapid_update_pair';
      
      // Simulate rapid updates
      const updates = [
        plugin.updateQAPairState(pairId, QAPairState.NEW, 'conv1', 'p1', 'r1'),
        plugin.updateQAPairState(pairId, QAPairState.IGNORED, 'conv1', 'p2', 'r2'),
        plugin.updateQAPairState(pairId, QAPairState.SAVED, 'conv1', 'p3', 'r3')
      ];
      
      await Promise.all(updates);
      
      // Final state should be the last one
      expect(plugin.getQAPairState(pairId)).toBe(QAPairState.SAVED);
      expect(plugin._getMetadataStore().qaPairs[pairId].userPrompt).toBe('p3');
    });

    test('should handle file save errors gracefully', async () => {
      // Mock vault.create to throw error
      (app.vault.create as jest.MockedFunction<typeof app.vault.create>).mockRejectedValueOnce(new Error('Disk full'));
      
      await expect(
        plugin.updateQAPairState('error_pair', QAPairState.SAVED, 'conv1', 'prompt', 'response')
      ).rejects.toThrow('Disk full');
    });

    test('should maintain data consistency after errors', async () => {
      const pairId = 'consistency_test';
      
      // First successful update
      await plugin.updateQAPairState(pairId, QAPairState.NEW, 'conv1', 'prompt1', 'response1');
      
      // Mock error on second update
      (app.vault.create as jest.MockedFunction<typeof app.vault.create>).mockRejectedValueOnce(new Error('Save failed'));
      (app.vault.modify as jest.MockedFunction<typeof app.vault.modify>).mockRejectedValueOnce(new Error('Save failed'));
      
      try {
        await plugin.updateQAPairState(pairId, QAPairState.SAVED, 'conv1', 'prompt2', 'response2');
      } catch (error) {
        // Error expected
      }
      
      // State should be updated in memory even if save failed
      expect(plugin.getQAPairState(pairId)).toBe(QAPairState.SAVED);
    });
  });
});
