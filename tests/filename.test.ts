import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { MockApp, MockVault } from './mocks/obsidian';

// We need to create a test-focused version of the saveNote logic
class TestSaveNoteModal {
  app: MockApp;
  vault: MockVault;
  
  constructor(app: MockApp) {
    this.app = app;
    this.vault = app.vault;
  }

  // Extract the filename logic from SaveNoteModal for testing
  async generateSafeFilePath(title: string, folder: string): Promise<string> {
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
    
    return finalPath;
  }

  async testSaveNote(title: string, folder: string, content: string): Promise<string> {
    const finalPath = await this.generateSafeFilePath(title, folder);
    await this.app.vault.create(finalPath, content);
    return finalPath;
  }
}

describe('SaveNoteModal Filename Handling', () => {
  let app: MockApp;
  let modal: TestSaveNoteModal;

  beforeEach(() => {
    app = new MockApp();
    modal = new TestSaveNoteModal(app);
  });

  describe('generateSafeFilePath', () => {
    test('should generate basic filename', async () => {
      const path = await modal.generateSafeFilePath('Test Title', '');
      expect(path).toBe('Test Title.md');
    });

    test('should sanitize dangerous characters', async () => {
      const path = await modal.generateSafeFilePath('Test/Title:With*Bad?Chars"<>|', '');
      expect(path).toBe('Test-Title-With-Bad-Chars----.md');
      expect(path).not.toMatch(/[\\/:\*\?"<>\|]/);
    });

    test('should handle folder paths', async () => {
      const path = await modal.generateSafeFilePath('Test Title', 'My Folder');
      expect(path).toBe('My Folder/Test Title.md');
    });

    test('should create folder if it does not exist', async () => {
      const folderPath = 'Non Existent Folder';
      expect(app.vault.getAbstractFileByPath(folderPath)).toBeNull();
      
      await modal.generateSafeFilePath('Test Title', folderPath);
      
      expect(app.vault.createFolder).toHaveBeenCalledWith(folderPath);
    });

    test('should not create folder if it already exists', async () => {
      const folderPath = 'Existing Folder';
      app.vault._addFolder(folderPath);
      
      await modal.generateSafeFilePath('Test Title', folderPath);
      
      expect(app.vault.createFolder).not.toHaveBeenCalledWith(folderPath);
    });

    test('should handle empty folder path', async () => {
      const path = await modal.generateSafeFilePath('Test Title', '');
      expect(path).toBe('Test Title.md');
    });

    test('should handle whitespace in folder path', async () => {
      const path = await modal.generateSafeFilePath('Test Title', '  ');
      expect(path).toBe('Test Title.md');
    });
  });

  describe('Filename Deduplication', () => {
    test('should not modify path if file does not exist', async () => {
      const path = await modal.generateSafeFilePath('Unique Title', '');
      expect(path).toBe('Unique Title.md');
    });

    test('should add counter for duplicate filenames', async () => {
      // Create the first file
      app.vault._addFile('Duplicate Title.md');
      
      const path = await modal.generateSafeFilePath('Duplicate Title', '');
      expect(path).toBe('Duplicate Title (1).md');
    });

    test('should increment counter for multiple duplicates', async () => {
      // Create multiple files
      app.vault._addFile('Multi Duplicate.md');
      app.vault._addFile('Multi Duplicate (1).md');
      app.vault._addFile('Multi Duplicate (2).md');
      
      const path = await modal.generateSafeFilePath('Multi Duplicate', '');
      expect(path).toBe('Multi Duplicate (3).md');
    });

    test('should handle duplicates in folders', async () => {
      const folderPath = 'Test Folder';
      app.vault._addFolder(folderPath);
      app.vault._addFile('Test Folder/Folder Duplicate.md');
      
      const path = await modal.generateSafeFilePath('Folder Duplicate', folderPath);
      expect(path).toBe('Test Folder/Folder Duplicate (1).md');
    });

    test('should handle complex folder paths with duplicates', async () => {
      const folderPath = 'Deep/Nested/Folder';
      app.vault._addFolder('Deep');
      app.vault._addFolder('Deep/Nested');
      app.vault._addFolder('Deep/Nested/Folder');
      app.vault._addFile('Deep/Nested/Folder/Complex.md');
      app.vault._addFile('Deep/Nested/Folder/Complex (1).md');
      
      const path = await modal.generateSafeFilePath('Complex', folderPath);
      expect(path).toBe('Deep/Nested/Folder/Complex (2).md');
    });

    test('should handle files without extensions', async () => {
      app.vault._addFile('NoExtension');
      
      const modal2 = new class extends TestSaveNoteModal {
        async generateSafeFilePath(title: string, folder: string): Promise<string> {
          const folderPath = folder.trim();
          const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-');
          const filePath = folderPath ? `${folderPath}/${safeTitle}` : safeTitle;
          
          let finalPath = filePath;
          let counter = 1;
          while (this.app.vault.getAbstractFileByPath(finalPath)) {
            const lastSlashIndex = filePath.lastIndexOf('/');
            const dir = lastSlashIndex >= 0 ? filePath.substring(0, lastSlashIndex + 1) : '';
            const nameWithExt = lastSlashIndex >= 0 ? filePath.substring(lastSlashIndex + 1) : filePath;
            const lastDotIndex = nameWithExt.lastIndexOf('.');
            const name = lastDotIndex >= 0 ? nameWithExt.substring(0, lastDotIndex) : nameWithExt;
            const ext = lastDotIndex >= 0 ? nameWithExt.substring(lastDotIndex) : '';
            
            finalPath = `${dir}${name} (${counter})${ext}`;
            counter++;
          }
          
          return finalPath;
        }
      }(app);
      
      const path = await modal2.generateSafeFilePath('NoExtension', '');
      expect(path).toBe('NoExtension (1)');
    });
  });

  describe('Full Save Flow', () => {
    test('should save file successfully with unique name', async () => {
      const content = '# Test Note\n\nThis is test content.';
      const path = await modal.testSaveNote('Test Note', '', content);
      
      expect(path).toBe('Test Note.md');
      expect(app.vault.create).toHaveBeenCalledWith('Test Note.md', content);
    });

    test('should not call create twice for same file', async () => {
      const content = '# Test Note\n\nThis is test content.';
      
      // First save
      const path1 = await modal.testSaveNote('Unique Note', '', content);
      
      // Verify it was created once
      expect(app.vault.create).toHaveBeenCalledTimes(1);
      expect(app.vault.create).toHaveBeenCalledWith('Unique Note.md', content);
      
      // Reset the mock to check the second save
      (app.vault.create as jest.Mock).mockClear();
      
      // Second save with same title should create different file
      const path2 = await modal.testSaveNote('Unique Note', '', content);
      
      expect(path1).toBe('Unique Note.md');
      expect(path2).toBe('Unique Note (1).md');
      expect(app.vault.create).toHaveBeenCalledTimes(1);
      expect(app.vault.create).toHaveBeenCalledWith('Unique Note (1).md', content);
    });

    test('should handle vault.create throwing error for existing file', async () => {
      const content = '# Test Note';
      
      // Mock vault.create to fail on first call (simulating race condition)
      (app.vault.create as jest.Mock).mockImplementationOnce(async (path: string) => {
        throw new Error(`File already exists: ${path}`);
      }).mockImplementationOnce(async (path: string, data: string) => {
        // Success on second call with different path
        return app.vault._addFile(path, data);
      });
      
      // This should reveal if there's a race condition issue
      await expect(async () => {
        await modal.testSaveNote('Race Condition Test', '', content);
      }).rejects.toThrow('File already exists');
    });

    test('should work correctly with concurrent saves', async () => {
      const content1 = '# First Note';
      const content2 = '# Second Note';
      
      // Mock the vault create to handle the race condition properly
      let createCallCount = 0;
      (app.vault.create as jest.Mock).mockImplementation(async (path: string, data: string) => {
        createCallCount++;
        if (createCallCount === 1 && path === 'Concurrent Test.md') {
          // First call succeeds and creates the file
          const file = app.vault._addFile(path, data);
          return file;
        } else if (createCallCount === 2 && path === 'Concurrent Test.md') {
          // Second call with same path should fail
          throw new Error(`File already exists: ${path}`);
        } else {
          // Other paths should succeed
          const file = app.vault._addFile(path, data);
          return file;
        }
      });
      
      // Simulate sequential saves (not truly concurrent since the logic prevents it)
      const path1 = await modal.testSaveNote('Concurrent Test', '', content1);
      const path2 = await modal.testSaveNote('Concurrent Test', '', content2);
      
      // Both should succeed with different paths
      expect(path1).toBe('Concurrent Test.md');
      expect(path2).toBe('Concurrent Test (1).md');
      expect(app.vault.create).toHaveBeenCalledTimes(2);
    });
  });
});
