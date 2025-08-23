var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ChatGPTToObsidianPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  defaultFolder: "ChatGPT",
  includeUserPrompts: true,
  includeTimestamps: true,
  includeTags: true,
  defaultTags: "chatgpt, ai"
};
function convertToMarkdown(content) {
  return content.replace(/\*\*(.*?)\*\*/g, "**$1**").replace(/\*(.*?)\*/g, "*$1*").replace(/`([^`]+)`/g, "`$1`").replace(/```([\s\S]*?)```/g, "```$1```");
}
var ChatGPTToObsidianPlugin = class extends import_obsidian.Plugin {
  onload() {
    return __async(this, null, function* () {
      yield this.loadSettings();
      const ribbonIconEl = this.addRibbonIcon("message-square", "ChatGPT to Obsidian", (evt) => {
        new ChatGPTImportModal(this.app, this).open();
      });
      this.addCommand({
        id: "open-chatgpt-importer",
        name: "Import ChatGPT conversations",
        callback: () => {
          new ChatGPTImportModal(this.app, this).open();
        }
      });
      this.addSettingTab(new ChatGPTSettingTab(this.app, this));
    });
  }
  onunload() {
  }
  loadSettings() {
    return __async(this, null, function* () {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
    });
  }
  saveSettings() {
    return __async(this, null, function* () {
      yield this.saveData(this.settings);
    });
  }
  // Parse ChatGPT conversations.json
  parseChatGPTData(jsonContent) {
    try {
      const data = JSON.parse(jsonContent);
      return data;
    } catch (error) {
      console.error("Error parsing ChatGPT data:", error);
      throw new Error("Invalid ChatGPT export format");
    }
  }
  // Extract clean conversation threads
  extractConversations(conversations) {
    return conversations.map((conv) => {
      var _a;
      const messages = [];
      const mapping = conv.mapping;
      let current = Object.values(mapping).find(
        (msg) => {
          var _a2, _b;
          return msg.message && msg.message.author.role === "user" && msg.parent && ((_b = (_a2 = mapping[msg.parent]) == null ? void 0 : _a2.message) == null ? void 0 : _b.author.role) === "system";
        }
      );
      while (current) {
        if (current.message && current.message.author.role !== "system") {
          const content = ((_a = current.message.content.parts) == null ? void 0 : _a.join("\n")) || "";
          if (content.trim()) {
            messages.push({
              role: current.message.author.role,
              content,
              timestamp: current.message.create_time || 0,
              id: current.id
            });
          }
        }
        current = current.children.length > 0 ? mapping[current.children[0]] : null;
      }
      return {
        title: conv.title,
        id: conv.id,
        create_time: conv.create_time,
        update_time: conv.update_time,
        messages
      };
    });
  }
};
var ChatGPTImportModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.conversations = [];
    this.currentConversationIndex = 0;
    this.viewMode = "toc";
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h1", { text: "Import ChatGPT Conversations" });
    const fileSection = contentEl.createDiv("file-section");
    fileSection.createEl("h3", { text: "Select conversations.json file" });
    const fileInput = fileSection.createEl("input", {
      type: "file",
      attr: { accept: ".json" }
    });
    const loadButton = fileSection.createEl("button", {
      text: "Load Conversations",
      cls: "mod-cta"
    });
    const conversationsDiv = contentEl.createDiv("conversations-section");
    conversationsDiv.style.display = "none";
    loadButton.onclick = () => {
      var _a;
      const file = (_a = fileInput.files) == null ? void 0 : _a[0];
      if (!file) {
        new import_obsidian.Notice("Please select a conversations.json file");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        var _a2;
        try {
          const content = (_a2 = e.target) == null ? void 0 : _a2.result;
          const rawConversations = this.plugin.parseChatGPTData(content);
          this.conversations = this.plugin.extractConversations(rawConversations);
          this.displayConversations(conversationsDiv);
          conversationsDiv.style.display = "block";
          new import_obsidian.Notice(`Loaded ${this.conversations.length} conversations`);
        } catch (error) {
          new import_obsidian.Notice("Error loading ChatGPT data: " + error.message);
        }
      };
      reader.readAsText(file);
    };
  }
  displayConversations(container) {
    container.empty();
    if (this.viewMode === "toc") {
      this.displayTableOfContents(container);
    } else {
      this.displaySingleConversation(container);
    }
  }
  displayTableOfContents(container) {
    container.createEl("h3", { text: "Select a conversation to view" });
    const tocList = container.createDiv("toc-list");
    tocList.style.cssText = "max-height: 500px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 8px;";
    this.conversations.forEach((conv, index) => {
      const tocItem = tocList.createDiv("toc-item");
      tocItem.style.cssText = "padding: 15px; border-bottom: 1px solid var(--background-modifier-border); cursor: pointer; transition: background-color 0.2s; display: flex; justify-content: space-between; align-items: center;";
      tocItem.addEventListener("mouseenter", () => {
        tocItem.style.backgroundColor = "var(--background-secondary)";
      });
      tocItem.addEventListener("mouseleave", () => {
        tocItem.style.backgroundColor = "";
      });
      const leftDiv = tocItem.createDiv();
      const titleEl = leftDiv.createEl("div");
      titleEl.textContent = conv.title;
      titleEl.style.cssText = "font-weight: 500; margin-bottom: 5px; font-size: 1.05em;";
      const statsEl = leftDiv.createEl("div");
      const assistantMessages = conv.messages.filter((msg) => msg.role === "assistant");
      statsEl.textContent = `${assistantMessages.length} responses \u2022 ${new Date(conv.create_time * 1e3).toLocaleDateString()}`;
      statsEl.style.cssText = "color: var(--text-muted); font-size: 0.9em;";
      const rightDiv = tocItem.createDiv();
      rightDiv.createEl("span", { text: "\u{1F441}\uFE0F View" });
      rightDiv.style.cssText = "color: var(--interactive-accent); font-size: 0.9em;";
      tocItem.onclick = () => {
        this.currentConversationIndex = index;
        this.viewMode = "conversation";
        this.displayConversations(container);
      };
    });
  }
  displaySingleConversation(container) {
    if (this.conversations.length === 0)
      return;
    const conv = this.conversations[this.currentConversationIndex];
    if (!conv)
      return;
    const header = container.createDiv("conversation-nav-header");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 15px; background: var(--background-secondary); border-radius: 8px;";
    const leftNav = header.createDiv();
    const backButton = leftNav.createEl("button", {
      text: "\u{1F4CB} Table of Contents",
      cls: "mod-muted"
    });
    backButton.onclick = () => {
      this.viewMode = "toc";
      this.displayConversations(container);
    };
    const centerInfo = header.createDiv();
    centerInfo.style.textAlign = "center";
    const titleEl = centerInfo.createEl("div");
    titleEl.textContent = conv.title;
    titleEl.style.cssText = "font-weight: 500; font-size: 1.1em; margin-bottom: 5px;";
    const indexEl = centerInfo.createEl("div");
    indexEl.textContent = `Conversation ${this.currentConversationIndex + 1} of ${this.conversations.length}`;
    indexEl.style.cssText = "color: var(--text-muted); font-size: 0.9em;";
    const rightNav = header.createDiv();
    rightNav.style.cssText = "display: flex; gap: 10px;";
    const prevButton = rightNav.createEl("button", {
      text: "\u2B05\uFE0F Previous",
      disabled: this.currentConversationIndex === 0
    });
    prevButton.onclick = () => {
      if (this.currentConversationIndex > 0) {
        this.currentConversationIndex--;
        this.displayConversations(container);
      }
    };
    const nextButton = rightNav.createEl("button", {
      text: "Next \u27A1\uFE0F",
      disabled: this.currentConversationIndex === this.conversations.length - 1
    });
    nextButton.onclick = () => {
      if (this.currentConversationIndex < this.conversations.length - 1) {
        this.currentConversationIndex++;
        this.displayConversations(container);
      }
    };
    const contentDiv = container.createDiv("single-conversation-content");
    contentDiv.style.cssText = "max-height: 600px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 15px;";
    const stats = contentDiv.createDiv("conversation-stats");
    const assistantMessages = conv.messages.filter((msg) => msg.role === "assistant");
    stats.createEl("p", { text: `${conv.messages.length} total messages \u2022 ${assistantMessages.length} assistant responses \u2022 ${new Date(conv.create_time * 1e3).toLocaleDateString()}` });
    stats.style.cssText = "margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em; text-align: center; padding-bottom: 15px; border-bottom: 1px solid var(--background-modifier-border);";
    assistantMessages.forEach((assistantMsg, msgIndex) => {
      const messageIndex = conv.messages.findIndex((msg) => msg.id === assistantMsg.id);
      const userMsg = messageIndex > 0 ? conv.messages[messageIndex - 1] : null;
      const qaDiv = contentDiv.createDiv("qa-pair");
      qaDiv.style.cssText = "margin: 20px 0; padding: 20px; background: var(--background-secondary); border-radius: 8px; border-left: 4px solid var(--interactive-accent);";
      if (userMsg && userMsg.role === "user") {
        const promptHeader = qaDiv.createEl("div");
        promptHeader.style.cssText = "margin-bottom: 12px;";
        const promptLabel = promptHeader.createEl("strong", { text: "\u2753 User Prompt:" });
        promptLabel.style.cssText = "color: var(--text-accent); font-size: 0.95em; margin-bottom: 8px; display: block;";
        const promptDiv = qaDiv.createEl("div");
        promptDiv.style.cssText = "padding: 12px; background: var(--background-primary); border-radius: 6px; margin-bottom: 18px; border-left: 3px solid var(--text-accent);";
        promptDiv.innerHTML = this.formatMessageContent(userMsg.content);
      }
      const responseHeader = qaDiv.createEl("div");
      responseHeader.style.cssText = "margin-bottom: 12px;";
      const responseLabel = responseHeader.createEl("strong", { text: "\u{1F916} ChatGPT Response:" });
      responseLabel.style.cssText = "color: var(--interactive-accent); font-size: 0.95em; margin-bottom: 8px; display: block;";
      const responseDiv = qaDiv.createEl("div");
      responseDiv.style.cssText = "padding: 15px; background: var(--background-primary); border-radius: 6px; margin-bottom: 15px; line-height: 1.6; border: 1px solid var(--background-modifier-border);";
      responseDiv.innerHTML = this.formatMessageContent(assistantMsg.content);
      const saveButton = qaDiv.createEl("button", {
        text: "\u{1F4BE} Save as Note",
        cls: "mod-cta"
      });
      saveButton.style.cssText = "margin-top: 12px; width: 130px;";
      saveButton.onclick = () => {
        new SaveNoteModal(this.app, this.plugin, conv, assistantMsg).open();
      };
    });
  }
  // Format message content for better display
  formatMessageContent(content) {
    let formatted = content.replace(/```([\s\S]*?)```/g, '<pre style="background: var(--background-secondary); padding: 8px; border-radius: 4px; overflow-x: auto; margin: 8px 0; border: 1px solid var(--background-modifier-border);"><code>$1</code></pre>').replace(/`([^`]+)`/g, '<code style="background: var(--background-secondary); padding: 2px 4px; border-radius: 3px; font-family: var(--font-monospace);">$1</code>').replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/\n/g, "<br>").replace(/^- (.+)/gm, '<li style="margin-left: 20px;">$1</li>').replace(/^\d+\. (.+)/gm, '<li style="margin-left: 20px; list-style-type: decimal;">$1</li>');
    formatted = formatted.replace(/(<li[^>]*>.*?<\/li>(?:<br>)?)+/g, (match) => {
      return '<ul style="margin: 8px 0; padding-left: 0;">' + match.replace(/<br>/g, "") + "</ul>";
    });
    return formatted;
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var SaveNoteModal = class extends import_obsidian.Modal {
  constructor(app, plugin, conversation, message) {
    super(app);
    this.plugin = plugin;
    this.conversation = conversation;
    this.message = message;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Save ChatGPT Response as Note" });
    const titleDiv = contentEl.createDiv();
    titleDiv.createEl("label", { text: "Note Title:" });
    const titleInput = titleDiv.createEl("input", {
      type: "text",
      value: `${this.conversation.title} - Response`,
      attr: { style: "width: 100%; margin: 5px 0;" }
    });
    const folderDiv = contentEl.createDiv();
    folderDiv.createEl("label", { text: "Save to folder:" });
    const folderInput = folderDiv.createEl("input", {
      type: "text",
      value: this.plugin.settings.defaultFolder,
      attr: { style: "width: 100%; margin: 5px 0;" }
    });
    const tagsDiv = contentEl.createDiv();
    tagsDiv.createEl("label", { text: "Tags (comma-separated):" });
    const tagsInput = tagsDiv.createEl("input", {
      type: "text",
      value: this.plugin.settings.defaultTags,
      attr: { style: "width: 100%; margin: 5px 0;" }
    });
    const previewDiv = contentEl.createDiv();
    previewDiv.createEl("h4", { text: "Preview:" });
    const previewEl = previewDiv.createEl("pre");
    previewEl.style.cssText = "background: var(--background-secondary); padding: 10px; border-radius: 5px; white-space: pre-wrap; max-height: 300px; overflow-y: auto;";
    const updatePreview = () => {
      const content = this.generateNoteContent(
        titleInput.value,
        tagsInput.value
      );
      previewEl.textContent = content;
    };
    titleInput.oninput = updatePreview;
    tagsInput.oninput = updatePreview;
    updatePreview();
    const buttonDiv = contentEl.createDiv();
    buttonDiv.style.cssText = "display: flex; gap: 10px; margin-top: 20px;";
    const saveButton = buttonDiv.createEl("button", {
      text: "Save Note",
      cls: "mod-cta"
    });
    const cancelButton = buttonDiv.createEl("button", {
      text: "Cancel"
    });
    saveButton.onclick = () => __async(this, null, function* () {
      try {
        yield this.saveNote(
          titleInput.value,
          folderInput.value,
          tagsInput.value
        );
        new import_obsidian.Notice("Note saved successfully!");
        this.close();
      } catch (error) {
        new import_obsidian.Notice("Error saving note: " + error.message);
      }
    });
    cancelButton.onclick = () => {
      this.close();
    };
  }
  generateNoteContent(title, tags) {
    const tagArray = tags.split(",").map((t) => t.trim()).filter((t) => t);
    const timestamp = new Date(this.message.timestamp * 1e3).toISOString().split("T")[0];
    let content = "";
    content += "---\n";
    content += `title: "${title}"
`;
    if (tagArray.length > 0) {
      content += `tags: [${tagArray.map((t) => `"${t}"`).join(", ")}]
`;
    }
    if (this.plugin.settings.includeTimestamps) {
      content += `created: ${timestamp}
`;
      content += `source: ChatGPT
`;
      content += `conversation: "${this.conversation.title}"
`;
    }
    content += "---\n\n";
    if (this.plugin.settings.includeUserPrompts) {
      const messageIndex = this.conversation.messages.findIndex((msg) => msg.id === this.message.id);
      if (messageIndex > 0) {
        const userMessage = this.conversation.messages[messageIndex - 1];
        if (userMessage.role === "user") {
          content += "## User Prompt\n\n";
          content += convertToMarkdown(userMessage.content) + "\n\n";
        }
      }
    }
    content += "## Response\n\n";
    content += convertToMarkdown(this.message.content);
    return content;
  }
  saveNote(title, folder, tags) {
    return __async(this, null, function* () {
      const content = this.generateNoteContent(title, tags);
      const folderPath = folder.trim();
      if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
        yield this.app.vault.createFolder(folderPath);
      }
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-");
      const filePath = folderPath ? `${folderPath}/${safeTitle}.md` : `${safeTitle}.md`;
      let finalPath = filePath;
      let counter = 1;
      while (this.app.vault.getAbstractFileByPath(finalPath)) {
        const pathParts = filePath.split(".");
        pathParts[pathParts.length - 2] += ` (${counter})`;
        finalPath = pathParts.join(".");
        counter++;
      }
      yield this.app.vault.create(finalPath, content);
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var ChatGPTSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "ChatGPT to Obsidian Settings" });
    new import_obsidian.Setting(containerEl).setName("Default folder").setDesc("Default folder to save ChatGPT notes").addText((text) => text.setPlaceholder("ChatGPT").setValue(this.plugin.settings.defaultFolder).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.defaultFolder = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Include user prompts").setDesc("Include the user prompt that generated the response").addToggle((toggle) => toggle.setValue(this.plugin.settings.includeUserPrompts).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.includeUserPrompts = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Include timestamps").setDesc("Include creation timestamps in note metadata").addToggle((toggle) => toggle.setValue(this.plugin.settings.includeTimestamps).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.includeTimestamps = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Default tags").setDesc("Default tags to add to ChatGPT notes (comma-separated)").addText((text) => text.setPlaceholder("chatgpt, ai").setValue(this.plugin.settings.defaultTags).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.defaultTags = value;
      yield this.plugin.saveSettings();
    })));
  }
};
