import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { MockApp, MockElement } from './mocks/obsidian';

// Reproduce the exact SaveNoteModal logic for testing
enum QAPairState {
  NEW = 'new',
  IGNORED = 'ignored', 
  SAVED = 'saved'
}

class TestSaveNoteModal {
  app: MockApp;
  plugin: any;
  conversation: any;
  message: any; 
  userMessage: any;
  pairId: string;

  // Mock DOM elements
  contentEl: MockElement = new MockElement();
  
  constructor(app: MockApp, plugin: any, conversation: any, message: any, userMessage?: any, pairId?: string) {
    this.app = app;
    this.plugin = plugin;
    this.conversation = conversation;
    this.message = message;
    this.userMessage = userMessage;
    this.pairId = pairId || '';
  }

  // Simulate the modal's save process
  async simulateSave(title: string, folder: string, tags: string): Promise<void> {
    const content = this.generateNoteContent(title, tags);
    
    // Ensure folder exists
    const folderPath = folder.trim();
    if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
      await this.app.vault.createFolder(folderPath);
    }
    
    // Generate safe filename
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-');
    const filePath = folderPath ? `${folderPath}/${safeTitle}.md` : `${safeTitle}.md`;
    
    // Check if file already exists and make unique
    let finalPath = filePath;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(finalPath)) {
      // Extract directory, filename (without extension), and extension
      const lastSlashIndex = filePath.lastIndexOf('/');
      const dir = lastSlashIndex >= 0 ? filePath.substring(0, lastSlashIndex + 1) : '';
      const nameWithExt = lastSlashIndex >= 0 ? filePath.substring(lastSlashIndex + 1) : filePath;
      const lastDotIndex = nameWithExt.lastIndexOf('.');
      const name = lastDotIndex >= 0 ? nameWithExt.substring(0, lastDotIndex) : nameWithExt;
      const ext = lastDotIndex >= 0 ? nameWithExt.substring(lastDotIndex) : '';
      
      // Create new filename with counter
      finalPath = `${dir}${name} (${counter})${ext}`;
      counter++;
    }
    
    // Create the note - THIS IS WHERE THE BUG MIGHT BE
    await this.app.vault.create(finalPath, content);
    
    // Mark the Q&A pair as saved if we have the pairId - THIS MIGHT TRIGGER A SECOND SAVE
    if (this.pairId) {
      const userPrompt = this.userMessage ? this.userMessage.content : "";
      await this.plugin.updateQAPairState(this.pairId, QAPairState.SAVED, this.conversation.id, userPrompt, this.message.content);
    }
  }

  generateNoteContent(title: string, tags: string): string {
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
    const timestamp = new Date(this.message.timestamp * 1000).toISOString().split('T')[0];
    
    let content = '';
    
    // YAML frontmatter
    content += '---\\n';
    content += `title: "${title}"\\n`;
    if (tagArray.length > 0) {
      content += `tags: [${tagArray.map(t => `"${t}"`).join(', ')}]\\n`;
    }
    content += `created: ${timestamp}\\n`;
    content += `source: ChatGPT\\n`;
    content += `conversation: "${this.conversation.title}"\\n`;
    content += '---\\n\\n';
    
    // Content
    if (this.userMessage) {
      content += '## User Prompt\\n\\n';
      content += this.userMessage.content + '\\n\\n';
    }
    
    content += '## Response\\n\\n';
    content += this.message.content;
    
    return content;
  }

  // Simulate button clicks and modal interactions
  simulateButtonClick() {
    // This simulates the actual save button click with potential for double-clicking
    const savePromise1 = this.simulateSave('Test Note', '', 'test, chatgpt');
    
    // Simulate rapid second click (race condition)
    const savePromise2 = this.simulateSave('Test Note', '', 'test, chatgpt');
    
    return Promise.all([savePromise1, savePromise2]);
  }
}

// Mock plugin with state tracking
class TestPlugin {
  app: MockApp;
  private qaPairStates: { [key: string]: QAPairState } = {};
  private stateUpdateCount: { [key: string]: number } = {};

  constructor(app: MockApp) {
    this.app = app;
  }

  async updateQAPairState(pairId: string, state: QAPairState, conversationId: string, userPrompt: string, response: string): Promise<void> {
    // Track how many times each pair is updated
    this.stateUpdateCount[pairId] = (this.stateUpdateCount[pairId] || 0) + 1;
    this.qaPairStates[pairId] = state;
    
    // Simulate metadata save (which could trigger additional saves)
    await this.saveMetadata();
  }

  private async saveMetadata(): Promise<void> {
    const content = JSON.stringify({
      qaPairs: this.qaPairStates,
      lastUpdated: Date.now()
    });
    
    const metadataFile = this.app.vault.getAbstractFileByPath('.chatgpt-plugin-metadata.json');
    if (metadataFile) {
      await this.app.vault.modify(metadataFile as any, content);
    } else {
      await this.app.vault.create('.chatgpt-plugin-metadata.json', content);
    }
  }

  getQAPairState(pairId: string): QAPairState {
    return this.qaPairStates[pairId] || QAPairState.NEW;
  }

  // Test helpers
  getStateUpdateCount(pairId: string): number {
    return this.stateUpdateCount[pairId] || 0;
  }

  _reset() {
    this.qaPairStates = {};
    this.stateUpdateCount = {};
  }
}

describe('SaveNoteModal Integration Tests', () => {
  let app: MockApp;
  let plugin: TestPlugin;
  let modal: TestSaveNoteModal;
  
  const mockConversation = {
    id: 'conv_123',
    title: 'Test Conversation',
    messages: [] as any[]
  };
  
  const mockMessage = {
    id: 'msg_assistant_1',
    content: 'This is a test response from ChatGPT.',
    timestamp: 1640995200 // 2022-01-01
  };
  
  const mockUserMessage = {
    id: 'msg_user_1', 
    content: 'What is a test question?',
    timestamp: 1640995100
  };

  beforeEach(() => {
    app = new MockApp();
    plugin = new TestPlugin(app);
    modal = new TestSaveNoteModal(app, plugin, mockConversation, mockMessage, mockUserMessage, 'test_pair_id');
  });

  describe('Single Save Operation', () => {
    test('should save note successfully once', async () => {
      await modal.simulateSave('Test Note', '', 'test, chatgpt');
      
      // Should create both the note file and metadata file
      expect(app.vault.create).toHaveBeenCalledTimes(2);
      expect(app.vault.create).toHaveBeenCalledWith(
        'Test Note.md',
        expect.stringContaining('This is a test response from ChatGPT.')
      );
      expect(app.vault.create).toHaveBeenCalledWith(
        '.chatgpt-plugin-metadata.json',
        expect.stringContaining('test_pair_id')
      );
    });

    test('should update Q&A pair state once', async () => {
      await modal.simulateSave('Test Note', '', 'test, chatgpt');
      
      expect(plugin.getStateUpdateCount('test_pair_id')).toBe(1);
      expect(plugin.getQAPairState('test_pair_id')).toBe(QAPairState.SAVED);
    });

    test('should create metadata file if it does not exist', async () => {
      await modal.simulateSave('Test Note', '', 'test, chatgpt');
      
      // Should create both files
      expect(app.vault.create).toHaveBeenCalledTimes(2);
      expect(app.vault.create).toHaveBeenCalledWith(
        '.chatgpt-plugin-metadata.json',
        expect.stringContaining('test_pair_id')
      );
    });
  });

  describe('Duplicate Save Prevention', () => {
    test('should handle rapid button clicks without duplicating notes', async () => {
      // Mock the vault create to simulate real timing
      let createCount = 0;
      (app.vault.create as jest.Mock).mockImplementation(async (path: string, content: string) => {
        createCount++;
        
        // Simulate the first call succeeding immediately
        if (path.endsWith('Test Note.md')) {
          const file = app.vault._addFile(path, content);
          return file;
        }
        
        // Subsequent calls should see the file already exists and use different names
        const file = app.vault._addFile(path, content);
        return file;
      });

      // Simulate double-clicking the save button
      try {
        await modal.simulateButtonClick();
      } catch (error) {
        // Some errors may be expected due to race conditions
        console.log('Expected race condition error:', error);
      }

      // Should create more files (2 notes + metadata files)
      expect(app.vault.create).toHaveBeenCalledTimes(3);
      
      // Check that both calls used different filenames
      const calls = (app.vault.create as jest.Mock).mock.calls;
      const filenames = calls.map(call => call[0]);
      expect(new Set(filenames).size).toBe(3); // Should be 3 unique filenames (2 notes + metadata)
    });

    test('should detect if the same file is being created twice', async () => {
      // This test specifically looks for the bug where the same filename is used twice
      let attemptedFilenames: string[] = [];
      
      (app.vault.create as jest.Mock).mockImplementation(async (path: string, content: string) => {
        attemptedFilenames.push(path);
        
        if (attemptedFilenames.filter(f => f === path).length > 1) {
          throw new Error(`Attempted to create file twice: ${path}`);
        }
        
        return app.vault._addFile(path, content);
      });

      try {
        await modal.simulateButtonClick();
      } catch (error) {
        // If we get an error about creating the same file twice, that's the bug!
        if (error.message.includes('Attempted to create file twice')) {
          console.log('FOUND THE BUG:', error.message);
        }
      }

      // Check if any filename was attempted more than once
      const filenameCounts = attemptedFilenames.reduce((acc, filename) => {
        acc[filename] = (acc[filename] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
      
      const duplicates = Object.entries(filenameCounts).filter(([, count]) => count > 1);
      
      if (duplicates.length > 0) {
        console.log('DUPLICATE FILENAMES DETECTED:', duplicates);
        expect(duplicates).toHaveLength(0); // This will fail and show us the duplicates
      }
    });
  });

  describe('State Update Race Conditions', () => {
    test('should not update Q&A pair state multiple times for same save', async () => {
      await modal.simulateSave('Test Note', '', 'test, chatgpt');
      
      // Should only update the pair state once per save operation
      expect(plugin.getStateUpdateCount('test_pair_id')).toBe(1);
    });

    test('should handle concurrent saves of different pairs', async () => {
      const modal1 = new TestSaveNoteModal(app, plugin, mockConversation, mockMessage, mockUserMessage, 'pair_1');
      const modal2 = new TestSaveNoteModal(app, plugin, 
        { ...mockConversation, id: 'conv_456' }, 
        { ...mockMessage, id: 'msg_2' }, 
        { ...mockUserMessage, id: 'user_2' }, 
        'pair_2'
      );

      await Promise.all([
        modal1.simulateSave('Note 1', '', 'test'),
        modal2.simulateSave('Note 2', '', 'test')
      ]);

      expect(plugin.getStateUpdateCount('pair_1')).toBe(1);
      expect(plugin.getStateUpdateCount('pair_2')).toBe(1);
      expect(app.vault.create).toHaveBeenCalledTimes(3); // 2 notes + 1 metadata file
    });
  });

  describe('Error Conditions', () => {
    test('should handle vault.create failures gracefully', async () => {
      (app.vault.create as jest.MockedFunction<typeof app.vault.create>).mockRejectedValueOnce(new Error('Disk full'));

      await expect(modal.simulateSave('Test Note', '', 'test, chatgpt')).rejects.toThrow('Disk full');
      
      // Should not have updated the Q&A pair state if file creation failed
      expect(plugin.getQAPairState('test_pair_id')).toBe(QAPairState.NEW);
    });

    test('should handle metadata save failures without affecting note creation', async () => {
      // Mock metadata save to fail
      (app.vault.create as jest.Mock).mockImplementation(async (path: string, content: string) => {
        if (path.includes('metadata')) {
          throw new Error('Metadata save failed');
        }
        return app.vault._addFile(path, content);
      });

      await expect(modal.simulateSave('Test Note', '', 'test, chatgpt')).rejects.toThrow('Metadata save failed');
      
      // Note should still be created even if metadata save fails
      expect(app.vault.create).toHaveBeenCalledWith('Test Note.md', expect.any(String));
    });
  });

  describe('Button Disable Logic Simulation', () => {
    test('should prevent multiple saves with button disable pattern', async () => {
      let saveInProgress = false;
      const protectedSave = async () => {
        if (saveInProgress) {
          console.log('Save blocked - already in progress');
          return;
        }
        
        saveInProgress = true;
        try {
          await modal.simulateSave('Protected Note', '', 'test');
        } finally {
          saveInProgress = false;
        }
      };

      // Simulate rapid clicks
      await Promise.all([
        protectedSave(),
        protectedSave(),
        protectedSave()
      ]);

      // Should only create one file
      expect(app.vault.create).toHaveBeenCalledWith('Protected Note.md', expect.any(String));
      expect(plugin.getStateUpdateCount('test_pair_id')).toBe(1);
    });
  });

  describe('Obsidian API Edge Cases', () => {
    test('should handle getAbstractFileByPath returning inconsistent results', async () => {
      // Mock inconsistent file system state (race condition in Obsidian API)
      let callCount = 0;
      (app.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        callCount++;
        // First call says file doesn't exist, second call says it does
        if (path === 'Race Note.md') {
          return callCount === 1 ? null : { path, name: 'Race Note.md' };
        }
        return null;
      });

      try {
        await modal.simulateSave('Race Note', '', 'test');
      } catch (error) {
        console.log('Race condition in file check:', error.message);
      }

      // This might reveal timing-dependent bugs
      expect(app.vault.create).toHaveBeenCalled();
    });
  });
});
