import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

// Types for ChatGPT export data
interface ChatGPTMessage {
	id: string;
	message: {
		id: string;
		author: {
			role: 'user' | 'assistant' | 'system' | 'tool';
			name: string | null;
			metadata: any;
		};
		create_time: number;
		update_time: number;
		content: {
			content_type: string;
			parts: string[];
		};
		status: string;
		end_turn: boolean | null;
		weight: number;
		metadata: any;
	} | null;
	parent: string | null;
	children: string[];
}

interface ChatGPTConversation {
	title: string;
	create_time: number;
	update_time: number;
	mapping: { [key: string]: ChatGPTMessage };
	conversation_id: string;
	id: string;
}

interface ChatGPTSettings {
	defaultFolder: string;
	includeUserPrompts: boolean;
	includeTimestamps: boolean;
	includeTags: boolean;
	defaultTags: string;
}

const DEFAULT_SETTINGS: ChatGPTSettings = {
	defaultFolder: 'ChatGPT',
	includeUserPrompts: true,
	includeTimestamps: true,
	includeTags: true,
	defaultTags: 'chatgpt, ai'
}

// Helper to convert content to markdown
function convertToMarkdown(content: string): string {
	// Basic conversion - you might want to enhance this
	return content
		.replace(/\*\*(.*?)\*\*/g, '**$1**') // Keep bold
		.replace(/\*(.*?)\*/g, '*$1*') // Keep italic
		.replace(/`([^`]+)`/g, '`$1`') // Keep inline code
		.replace(/```([\s\S]*?)```/g, '```$1```'); // Keep code blocks
}

export default class ChatGPTToObsidianPlugin extends Plugin {
	settings: ChatGPTSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon for opening the importer
		const ribbonIconEl = this.addRibbonIcon('message-square', 'ChatGPT to Obsidian', (evt: MouseEvent) => {
			new ChatGPTImportModal(this.app, this).open();
		});

		// Add command
		this.addCommand({
			id: 'open-chatgpt-importer',
			name: 'Import ChatGPT conversations',
			callback: () => {
				new ChatGPTImportModal(this.app, this).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new ChatGPTSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Parse ChatGPT conversations.json
	parseChatGPTData(jsonContent: string): ChatGPTConversation[] {
		try {
			const data = JSON.parse(jsonContent) as ChatGPTConversation[];
			return data;
		} catch (error) {
			console.error('Error parsing ChatGPT data:', error);
			throw new Error('Invalid ChatGPT export format');
		}
	}

	// Extract clean conversation threads
	extractConversations(conversations: ChatGPTConversation[]) {
		return conversations.map(conv => {
			const messages: Array<{
				role: string;
				content: string;
				timestamp: number;
				id: string;
			}> = [];

			// Find the conversation root
			const mapping = conv.mapping;
			let current = Object.values(mapping).find(msg => 
				msg.message && msg.message.author.role === 'user' && msg.parent && 
				mapping[msg.parent]?.message?.author.role === 'system'
			);

			// Walk the conversation thread
			while (current) {
				if (current.message && current.message.author.role !== 'system') {
					const content = current.message.content.parts?.join('\n') || '';
					if (content.trim()) {
						messages.push({
							role: current.message.author.role,
							content: content,
							timestamp: current.message.create_time || 0,
							id: current.id
						});
					}
				}

				// Find next message in chain
				current = current.children.length > 0 ? mapping[current.children[0]] : null;
			}

			return {
				title: conv.title,
				id: conv.id,
				create_time: conv.create_time,
				update_time: conv.update_time,
				messages: messages
			};
		});
	}
}

class ChatGPTImportModal extends Modal {
	plugin: ChatGPTToObsidianPlugin;
	conversations: any[] = [];
	currentConversationIndex: number = 0;
	viewMode: 'toc' | 'conversation' = 'toc';

	constructor(app: App, plugin: ChatGPTToObsidianPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;

		contentEl.createEl("h1", {text: "Import ChatGPT Conversations"});

		// File input section
		const fileSection = contentEl.createDiv("file-section");
		fileSection.createEl("h3", {text: "Select conversations.json file"});
		
		const fileInput = fileSection.createEl("input", {
			type: "file",
			attr: { accept: ".json" }
		});

		const loadButton = fileSection.createEl("button", {
			text: "Load Conversations",
			cls: "mod-cta"
		});

		// Conversations display section
		const conversationsDiv = contentEl.createDiv("conversations-section");
		conversationsDiv.style.display = "none";

		loadButton.onclick = () => {
			const file = fileInput.files?.[0];
			if (!file) {
				new Notice("Please select a conversations.json file");
				return;
			}

			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const content = e.target?.result as string;
					const rawConversations = this.plugin.parseChatGPTData(content);
					this.conversations = this.plugin.extractConversations(rawConversations);
					
					this.displayConversations(conversationsDiv);
					conversationsDiv.style.display = "block";
					
					new Notice(`Loaded ${this.conversations.length} conversations`);
				} catch (error) {
					new Notice("Error loading ChatGPT data: " + error.message);
				}
			};
			reader.readAsText(file);
		};
	}

	displayConversations(container: HTMLElement) {
		container.empty();
		
		if (this.viewMode === 'toc') {
			this.displayTableOfContents(container);
		} else {
			this.displaySingleConversation(container);
		}
	}

	displayTableOfContents(container: HTMLElement) {
		container.createEl("h3", {text: "Select a conversation to view"});
		
		const tocList = container.createDiv("toc-list");
		tocList.style.cssText = "max-height: 500px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 8px;";
		
		this.conversations.forEach((conv, index) => {
			const tocItem = tocList.createDiv("toc-item");
			tocItem.style.cssText = "padding: 15px; border-bottom: 1px solid var(--background-modifier-border); cursor: pointer; transition: background-color 0.2s; display: flex; justify-content: space-between; align-items: center;";
			
			// Hover effect
			tocItem.addEventListener('mouseenter', () => {
				tocItem.style.backgroundColor = "var(--background-secondary)";
			});
			tocItem.addEventListener('mouseleave', () => {
				tocItem.style.backgroundColor = "";
			});
			
			const leftDiv = tocItem.createDiv();
			
			const titleEl = leftDiv.createEl("div");
			titleEl.textContent = conv.title;
			titleEl.style.cssText = "font-weight: 500; margin-bottom: 5px; font-size: 1.05em;";
			
			const statsEl = leftDiv.createEl("div");
			const assistantMessages = conv.messages.filter((msg: any) => msg.role === 'assistant');
			statsEl.textContent = `${assistantMessages.length} responses • ${new Date(conv.create_time * 1000).toLocaleDateString()}`;
			statsEl.style.cssText = "color: var(--text-muted); font-size: 0.9em;";
			
			const rightDiv = tocItem.createDiv();
			rightDiv.createEl("span", {text: "👁️ View"});
			rightDiv.style.cssText = "color: var(--interactive-accent); font-size: 0.9em;";
			
			tocItem.onclick = () => {
				this.currentConversationIndex = index;
				this.viewMode = 'conversation';
				this.displayConversations(container);
			};
		});
	}

	displaySingleConversation(container: HTMLElement) {
		if (this.conversations.length === 0) return;
		
		const conv = this.conversations[this.currentConversationIndex];
		if (!conv) return;
		
		// Header with navigation
		const header = container.createDiv("conversation-nav-header");
		header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 15px; background: var(--background-secondary); border-radius: 8px;";
		
		// Left side: Back to TOC button
		const leftNav = header.createDiv();
		const backButton = leftNav.createEl("button", {
			text: "📋 Table of Contents",
			cls: "mod-muted"
		});
		backButton.onclick = () => {
			this.viewMode = 'toc';
			this.displayConversations(container);
		};
		
		// Center: Conversation info
		const centerInfo = header.createDiv();
		centerInfo.style.textAlign = "center";
		const titleEl = centerInfo.createEl("div");
		titleEl.textContent = conv.title;
		titleEl.style.cssText = "font-weight: 500; font-size: 1.1em; margin-bottom: 5px;";
		const indexEl = centerInfo.createEl("div");
		indexEl.textContent = `Conversation ${this.currentConversationIndex + 1} of ${this.conversations.length}`;
		indexEl.style.cssText = "color: var(--text-muted); font-size: 0.9em;";
		
		// Right side: Prev/Next buttons
		const rightNav = header.createDiv();
		rightNav.style.cssText = "display: flex; gap: 10px;";
		
		const prevButton = rightNav.createEl("button", {
			text: "⬅️ Previous",
			disabled: this.currentConversationIndex === 0
		});
		prevButton.onclick = () => {
			if (this.currentConversationIndex > 0) {
				this.currentConversationIndex--;
				this.displayConversations(container);
			}
		};
		
		const nextButton = rightNav.createEl("button", {
			text: "Next ➡️",
			disabled: this.currentConversationIndex === this.conversations.length - 1
		});
		nextButton.onclick = () => {
			if (this.currentConversationIndex < this.conversations.length - 1) {
				this.currentConversationIndex++;
				this.displayConversations(container);
			}
		};
		
		// Conversation content
		const contentDiv = container.createDiv("single-conversation-content");
		contentDiv.style.cssText = "max-height: 600px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 15px;";
		
		// Stats
		const stats = contentDiv.createDiv("conversation-stats");
		const assistantMessages = conv.messages.filter((msg: any) => msg.role === 'assistant');
		stats.createEl("p", {text: `${conv.messages.length} total messages • ${assistantMessages.length} assistant responses • ${new Date(conv.create_time * 1000).toLocaleDateString()}`});
		stats.style.cssText = "margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em; text-align: center; padding-bottom: 15px; border-bottom: 1px solid var(--background-modifier-border);";

		// Display each Q&A pair
		assistantMessages.forEach((assistantMsg: any, msgIndex: number) => {
			// Find the user message that prompted this response
			const messageIndex = conv.messages.findIndex((msg: any) => msg.id === assistantMsg.id);
			const userMsg = messageIndex > 0 ? conv.messages[messageIndex - 1] : null;
			
			const qaDiv = contentDiv.createDiv("qa-pair");
			qaDiv.style.cssText = "margin: 20px 0; padding: 20px; background: var(--background-secondary); border-radius: 8px; border-left: 4px solid var(--interactive-accent);";
			
			// Show user prompt
			if (userMsg && userMsg.role === 'user') {
				const promptHeader = qaDiv.createEl("div");
				promptHeader.style.cssText = "margin-bottom: 12px;";
				
				const promptLabel = promptHeader.createEl("strong", {text: "❓ User Prompt:"});
				promptLabel.style.cssText = "color: var(--text-accent); font-size: 0.95em; margin-bottom: 8px; display: block;";
				
				const promptDiv = qaDiv.createEl("div");
				promptDiv.style.cssText = "padding: 12px; background: var(--background-primary); border-radius: 6px; margin-bottom: 18px; border-left: 3px solid var(--text-accent);";
				promptDiv.innerHTML = this.formatMessageContent(userMsg.content);
			}
			
			// Show assistant response
			const responseHeader = qaDiv.createEl("div");
			responseHeader.style.cssText = "margin-bottom: 12px;";
			
			const responseLabel = responseHeader.createEl("strong", {text: "🤖 ChatGPT Response:"});
			responseLabel.style.cssText = "color: var(--interactive-accent); font-size: 0.95em; margin-bottom: 8px; display: block;";
			
			const responseDiv = qaDiv.createEl("div");
			responseDiv.style.cssText = "padding: 15px; background: var(--background-primary); border-radius: 6px; margin-bottom: 15px; line-height: 1.6; border: 1px solid var(--background-modifier-border);";
			responseDiv.innerHTML = this.formatMessageContent(assistantMsg.content);
			
			// Save button
			const saveButton = qaDiv.createEl("button", {
				text: "💾 Save as Note",
				cls: "mod-cta"
			});
			saveButton.style.cssText = "margin-top: 12px; width: 130px;";
			
			saveButton.onclick = () => {
				new SaveNoteModal(this.app, this.plugin, conv, assistantMsg).open();
			};
		});
	}

	// Format message content for better display
	formatMessageContent(content: string): string {
		// Convert basic markdown to HTML for display
		let formatted = content
			// Convert code blocks
			.replace(/```([\s\S]*?)```/g, '<pre style="background: var(--background-secondary); padding: 8px; border-radius: 4px; overflow-x: auto; margin: 8px 0; border: 1px solid var(--background-modifier-border);"><code>$1</code></pre>')
			// Convert inline code
			.replace(/`([^`]+)`/g, '<code style="background: var(--background-secondary); padding: 2px 4px; border-radius: 3px; font-family: var(--font-monospace);">$1</code>')
			// Convert bold text
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			// Convert italic text
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			// Convert line breaks
			.replace(/\n/g, '<br>')
			// Convert bullet points
			.replace(/^- (.+)/gm, '<li style="margin-left: 20px;">$1</li>')
			// Convert numbered lists
			.replace(/^\d+\. (.+)/gm, '<li style="margin-left: 20px; list-style-type: decimal;">$1</li>');
		
		// Wrap consecutive list items in ul tags
		formatted = formatted.replace(/(<li[^>]*>.*?<\/li>(?:<br>)?)+/g, (match) => {
			return '<ul style="margin: 8px 0; padding-left: 0;">' + match.replace(/<br>/g, '') + '</ul>';
		});
		
		return formatted;
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SaveNoteModal extends Modal {
	plugin: ChatGPTToObsidianPlugin;
	conversation: any;
	message: any;

	constructor(app: App, plugin: ChatGPTToObsidianPlugin, conversation: any, message: any) {
		super(app);
		this.plugin = plugin;
		this.conversation = conversation;
		this.message = message;
	}

	onOpen() {
		const {contentEl} = this;

		contentEl.createEl("h2", {text: "Save ChatGPT Response as Note"});

		// Note title input
		const titleDiv = contentEl.createDiv();
		titleDiv.createEl("label", {text: "Note Title:"});
		const titleInput = titleDiv.createEl("input", {
			type: "text",
			value: `${this.conversation.title} - Response`,
			attr: { style: "width: 100%; margin: 5px 0;" }
		});

		// Folder selection
		const folderDiv = contentEl.createDiv();
		folderDiv.createEl("label", {text: "Save to folder:"});
		const folderInput = folderDiv.createEl("input", {
			type: "text",
			value: this.plugin.settings.defaultFolder,
			attr: { style: "width: 100%; margin: 5px 0;" }
		});

		// Tags input
		const tagsDiv = contentEl.createDiv();
		tagsDiv.createEl("label", {text: "Tags (comma-separated):"});
		const tagsInput = tagsDiv.createEl("input", {
			type: "text",
			value: this.plugin.settings.defaultTags,
			attr: { style: "width: 100%; margin: 5px 0;" }
		});

		// Preview
		const previewDiv = contentEl.createDiv();
		previewDiv.createEl("h4", {text: "Preview:"});
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

		// Action buttons
		const buttonDiv = contentEl.createDiv();
		buttonDiv.style.cssText = "display: flex; gap: 10px; margin-top: 20px;";

		const saveButton = buttonDiv.createEl("button", {
			text: "Save Note",
			cls: "mod-cta"
		});

		const cancelButton = buttonDiv.createEl("button", {
			text: "Cancel"
		});

		saveButton.onclick = async () => {
			try {
				await this.saveNote(
					titleInput.value,
					folderInput.value,
					tagsInput.value
				);
				new Notice("Note saved successfully!");
				this.close();
			} catch (error) {
				new Notice("Error saving note: " + error.message);
			}
		};

		cancelButton.onclick = () => {
			this.close();
		};
	}

	generateNoteContent(title: string, tags: string): string {
		const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
		const timestamp = new Date(this.message.timestamp * 1000).toISOString().split('T')[0];
		
		let content = '';
		
		// YAML frontmatter
		content += '---\n';
		content += `title: "${title}"\n`;
		if (tagArray.length > 0) {
			content += `tags: [${tagArray.map(t => `"${t}"`).join(', ')}]\n`;
		}
		if (this.plugin.settings.includeTimestamps) {
			content += `created: ${timestamp}\n`;
			content += `source: ChatGPT\n`;
			content += `conversation: "${this.conversation.title}"\n`;
		}
		content += '---\n\n';
		
		// Content
		if (this.plugin.settings.includeUserPrompts) {
			// Find the user message that prompted this response
			const messageIndex = this.conversation.messages.findIndex((msg: any) => msg.id === this.message.id);
			if (messageIndex > 0) {
				const userMessage = this.conversation.messages[messageIndex - 1];
				if (userMessage.role === 'user') {
					content += '## User Prompt\n\n';
					content += convertToMarkdown(userMessage.content) + '\n\n';
				}
			}
		}
		
		content += '## Response\n\n';
		content += convertToMarkdown(this.message.content);
		
		return content;
	}

	async saveNote(title: string, folder: string, tags: string): Promise<void> {
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
			const pathParts = filePath.split('.');
			pathParts[pathParts.length - 2] += ` (${counter})`;
			finalPath = pathParts.join('.');
			counter++;
		}
		
		await this.app.vault.create(finalPath, content);
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class ChatGPTSettingTab extends PluginSettingTab {
	plugin: ChatGPTToObsidianPlugin;

	constructor(app: App, plugin: ChatGPTToObsidianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'ChatGPT to Obsidian Settings'});

		new Setting(containerEl)
			.setName('Default folder')
			.setDesc('Default folder to save ChatGPT notes')
			.addText(text => text
				.setPlaceholder('ChatGPT')
				.setValue(this.plugin.settings.defaultFolder)
				.onChange(async (value) => {
					this.plugin.settings.defaultFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Include user prompts')
			.setDesc('Include the user prompt that generated the response')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeUserPrompts)
				.onChange(async (value) => {
					this.plugin.settings.includeUserPrompts = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Include timestamps')
			.setDesc('Include creation timestamps in note metadata')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeTimestamps)
				.onChange(async (value) => {
					this.plugin.settings.includeTimestamps = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default tags')
			.setDesc('Default tags to add to ChatGPT notes (comma-separated)')
			.addText(text => text
				.setPlaceholder('chatgpt, ai')
				.setValue(this.plugin.settings.defaultTags)
				.onChange(async (value) => {
					this.plugin.settings.defaultTags = value;
					await this.plugin.saveSettings();
				}));
	}
}
