import { jest } from '@jest/globals';

export interface MockTFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
}

export interface MockTFolder {
  path: string;
  name: string;
  children: (MockTFile | MockTFolder)[];
}

export class MockVault {
  private files: Map<string, MockTFile | MockTFolder> = new Map();
  private fileContents: Map<string, string> = new Map();
  
  create = jest.fn(async (path: string, data: string): Promise<MockTFile> => {
    if (this.files.has(path)) {
      throw new Error(`File already exists: ${path}`);
    }
    
    const file: MockTFile = {
      path,
      name: path.split('/').pop() || path,
      basename: path.split('/').pop()?.replace(/\.[^.]+$/, '') || '',
      extension: path.split('.').pop() || '',
    };
    
    this.files.set(path, file);
    this.fileContents.set(path, data);
    return file;
  });

  modify = jest.fn(async (file: MockTFile, data: string): Promise<void> => {
    this.fileContents.set(file.path, data);
  });

  read = jest.fn(async (file: MockTFile): Promise<string> => {
    return this.fileContents.get(file.path) || '';
  });

  getAbstractFileByPath = jest.fn((path: string): MockTFile | MockTFolder | null => {
    return this.files.get(path) || null;
  });

  createFolder = jest.fn(async (path: string): Promise<MockTFolder> => {
    const folder: MockTFolder = {
      path,
      name: path.split('/').pop() || path,
      children: [],
    };
    this.files.set(path, folder);
    return folder;
  });

  getAllLoadedFiles = jest.fn((): (MockTFile | MockTFolder)[] => {
    return Array.from(this.files.values());
  });

  // Test helper methods
  _clearFiles() {
    this.files.clear();
    this.fileContents.clear();
  }

  _addFile(path: string, content: string = '') {
    const file: MockTFile = {
      path,
      name: path.split('/').pop() || path,
      basename: path.split('/').pop()?.replace(/\.[^.]+$/, '') || '',
      extension: path.split('.').pop() || '',
    };
    this.files.set(path, file);
    this.fileContents.set(path, content);
    return file;
  }

  _addFolder(path: string) {
    const folder: MockTFolder = {
      path,
      name: path.split('/').pop() || path,
      children: [],
    };
    this.files.set(path, folder);
    return folder;
  }
}

export class MockApp {
  vault: MockVault = new MockVault();
}

export class MockPlugin {
  app: MockApp = new MockApp();
  settings: any = {};
  
  loadData = jest.fn(async () => ({}));
  saveData = jest.fn(async (data: any) => {});
  addRibbonIcon = jest.fn();
  addCommand = jest.fn();
  addSettingTab = jest.fn();
}

export class MockModal {
  app: MockApp;
  contentEl: MockElement = new MockElement();

  constructor(app: MockApp) {
    this.app = app;
  }

  open = jest.fn();
  close = jest.fn();
  onOpen = jest.fn();
  onClose = jest.fn();
}

export class MockElement {
  style: { [key: string]: string } = {};
  textContent: string = '';
  innerHTML: string = '';
  disabled: boolean = false;
  checked: boolean = false;
  value: string = '';
  files: File[] | null = null;

  createEl = jest.fn((tag: string, options?: any): MockElement => {
    const element = new MockElement();
    if (options?.text) element.textContent = options.text;
    if (options?.cls) element.className = options.cls;
    if (options?.attr) {
      Object.assign(element, options.attr);
    }
    return element;
  });

  createDiv = jest.fn((className?: string): MockElement => {
    const div = new MockElement();
    if (className) div.className = className;
    return div;
  });

  empty = jest.fn();
  onclick: (() => void) | null = null;
  onchange: (() => void) | null = null;
  oninput: (() => void) | null = null;
  onfocus: (() => void) | null = null;
  onkeydown: ((e: KeyboardEvent) => void) | null = null;
  addEventListener = jest.fn();
  className: string = '';

  // Test helper
  _triggerClick() {
    if (this.onclick) this.onclick();
  }
  
  _triggerChange() {
    if (this.onchange) this.onchange();
  }
}
