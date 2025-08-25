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

// Q&A pair state tracking
enum QAPairState {
	NEW = 'new',
	IGNORED = 'ignored',
	SAVED = 'saved'
}

// Individual Q&A pair metadata
interface QAPairMetadata {
	pairId: string; // Unique identifier for this Q&A pair
	pairHash: string; // Hash of Q&A content for deduplication
	conversationId: string; // Parent conversation ID
	state: QAPairState;
	timestamp: number; // When state was last updated
	userPrompt: string; // First 100 chars of user prompt for reference
	responsePreview: string; // First 100 chars of response for reference
}

// Conversation processing status (derived from Q&A pair states)
enum ConversationProcessingStatus {
	UNPROCESSED = 'unprocessed', // Has NEW Q&A pairs
	PARTIAL = 'partial', // Mix of processed and unprocessed pairs
	PROCESSED = 'processed' // All pairs are SAVED or IGNORED
}

interface QAPairMetadataStore {
	qaPairs: { [key: string]: QAPairMetadata }; // Key is pairId
	lastUpdated: number;
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
	private metadataStore: QAPairMetadataStore = { qaPairs: {}, lastUpdated: Date.now() };
	private readonly METADATA_FILE_NAME = '.chatgpt-plugin-metadata.json';

	async onload() {
		await this.loadSettings();
		await this.loadConversationMetadata();

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

	// Metadata management methods
	private async loadConversationMetadata(): Promise<void> {
		try {
			console.log('[METADATA DEBUG] Loading metadata from:', this.METADATA_FILE_NAME);
			
			// Use vault adapter directly to read hidden files reliably
			let content: string;
			try {
				content = await this.app.vault.adapter.read(this.METADATA_FILE_NAME);
				console.log('[METADATA DEBUG] Successfully read metadata file via adapter');
			} catch (readError) {
				console.log('[METADATA DEBUG] Metadata file does not exist or cannot be read:', readError.message);
				// File doesn't exist, create empty store
				this.metadataStore = { qaPairs: {}, lastUpdated: Date.now() };
				return;
			}
			
			const data = JSON.parse(content);
			console.log('[METADATA DEBUG] Parsed metadata JSON successfully');
			
			// Check if it's old format (conversations) or new format (qaPairs)
			if (data.conversations) {
				// Migrate from old conversation-level format to Q&A pair format
				console.log('[METADATA DEBUG] Migrating metadata from conversation-level to Q&A pair-level format');
				this.metadataStore = { qaPairs: {}, lastUpdated: Date.now() };
			} else if (data.qaPairs) {
				// New format
				this.metadataStore = data;
				console.log('[METADATA DEBUG] Loaded Q&A pair metadata:', Object.keys(this.metadataStore.qaPairs).length, 'pairs');
				console.log('[METADATA DEBUG] Sample pair IDs:', Object.keys(this.metadataStore.qaPairs).slice(0, 3));
			} else {
				// Unknown format, start fresh
				console.log('[METADATA DEBUG] Unknown metadata format, starting fresh');
				this.metadataStore = { qaPairs: {}, lastUpdated: Date.now() };
			}
		} catch (error) {
			console.error('[METADATA DEBUG] Error loading Q&A pair metadata:', error);
			// Reset to empty store on error
			this.metadataStore = { qaPairs: {}, lastUpdated: Date.now() };
		}
	}

	private async saveConversationMetadata(): Promise<void> {
		try {
			this.metadataStore.lastUpdated = Date.now();
			const content = JSON.stringify(this.metadataStore, null, 2);
			console.log('[METADATA DEBUG] Saving metadata:', { 
				fileName: this.METADATA_FILE_NAME, 
				pairCount: Object.keys(this.metadataStore.qaPairs).length,
				contentLength: content.length
			});
			
			// Try to read the existing file first to see if it exists
			let fileExists = false;
			try {
				await this.app.vault.adapter.read(this.METADATA_FILE_NAME);
				fileExists = true;
				console.log('[METADATA DEBUG] File exists (detected via read)');
			} catch (readError) {
				console.log('[METADATA DEBUG] File does not exist (read failed)');
			}
			
			if (fileExists) {
				// File exists, write directly using adapter
				console.log('[METADATA DEBUG] Writing to existing file via adapter');
				await this.app.vault.adapter.write(this.METADATA_FILE_NAME, content);
				console.log('[METADATA DEBUG] File written successfully via adapter');
			} else {
				// File doesn't exist, try to create it
				console.log('[METADATA DEBUG] Creating new file');
				try {
					await this.app.vault.create(this.METADATA_FILE_NAME, content);
					console.log('[METADATA DEBUG] File created successfully');
				} catch (createError) {
					console.log('[METADATA DEBUG] Create failed, trying direct write via adapter:', createError.message);
					// Fallback: write directly via adapter
					try {
						await this.app.vault.adapter.write(this.METADATA_FILE_NAME, content);
						console.log('[METADATA DEBUG] Fallback write via adapter successful');
					} catch (writeError) {
						console.error('[METADATA DEBUG] All write attempts failed');
						throw createError;
					}
				}
			}
		} catch (error) {
			console.error('[METADATA DEBUG] Error saving Q&A pair metadata:', error);
			throw error;
		}
	}

	// Q&A pair management methods
	private generateQAPairHash(userPrompt: string, response: string): string {
		// Create a simple hash from Q&A content for deduplication
		const content = JSON.stringify({
			userPrompt: userPrompt.substring(0, 200),
			response: response.substring(0, 200)
		});
		
		// Simple hash function (for basic deduplication)
		let hash = 0;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
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

	// Get conversation processing status based on its Q&A pairs
	getConversationProcessingStatus(conversationId: string, totalAssistantMessages?: number): ConversationProcessingStatus {
		const pairs = Object.values(this.metadataStore.qaPairs)
			.filter(pair => pair.conversationId === conversationId);
		
		// If we don't know the total, we can't determine the status accurately
		if (totalAssistantMessages === undefined) {
			if (pairs.length === 0) {
				return ConversationProcessingStatus.UNPROCESSED;
			}
			const newCount = pairs.filter(p => p.state === QAPairState.NEW).length;
			return newCount === 0 ? ConversationProcessingStatus.PROCESSED : ConversationProcessingStatus.PARTIAL;
		}
		
		// We know the total assistant messages, so we can be accurate
		const processedPairs = pairs.filter(p => p.state !== QAPairState.NEW).length;
		const newPairs = pairs.filter(p => p.state === QAPairState.NEW).length;
		const unprocessedPairs = totalAssistantMessages - pairs.length; // Pairs not in metadata yet are NEW
		
		const totalNewPairs = newPairs + unprocessedPairs;
		
		if (totalNewPairs === 0) {
			return ConversationProcessingStatus.PROCESSED;
		} else if (processedPairs > 0) {
			return ConversationProcessingStatus.PARTIAL;
		} else {
			return ConversationProcessingStatus.UNPROCESSED;
		}
	}

	getQAPairMetadata(): QAPairMetadataStore {
		return this.metadataStore;
	}
}

class ChatGPTImportModal extends Modal {
	plugin: ChatGPTToObsidianPlugin;
	conversations: any[] = [];
	currentConversationIndex: number = 0;
	viewMode: 'toc' | 'conversation' = 'toc';
	// Filter settings for TOC (conversation-level)
	showNew: boolean = true;
	showPartiallyProcessed: boolean = true;
	showFullyProcessed: boolean = false;
	// Filter settings for single conversation Q&A pairs
	showNewPairs: boolean = true;
	showIgnoredPairs: boolean = false;
	showSavedPairs: boolean = false;

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
		
		// Filter controls
		const filtersDiv = container.createDiv("filter-controls");
		filtersDiv.style.cssText = "margin-bottom: 15px; padding: 10px; background: var(--background-secondary); border-radius: 8px; display: flex; gap: 15px; align-items: center;";
		
		filtersDiv.createEl("span", {text: "Show:", attr: { style: "font-weight: 500; margin-right: 5px;" }});
		
		// New conversations toggle
		const newLabel = filtersDiv.createEl("label", {attr: { style: "display: flex; align-items: center; gap: 5px; cursor: pointer;" }});
		const newCheckbox = newLabel.createEl("input", {
			type: "checkbox"
		});
		newCheckbox.checked = this.showNew;
		newLabel.createEl("span", {text: "🆕 New"});
		
		// Partially processed conversations toggle
		const partialLabel = filtersDiv.createEl("label", {attr: { style: "display: flex; align-items: center; gap: 5px; cursor: pointer;" }});
		const partialCheckbox = partialLabel.createEl("input", {
			type: "checkbox"
		});
		partialCheckbox.checked = this.showPartiallyProcessed;
		partialLabel.createEl("span", {text: "🔄 Partially Processed"});
		
		// Fully processed conversations toggle
		const fullyProcessedLabel = filtersDiv.createEl("label", {attr: { style: "display: flex; align-items: center; gap: 5px; cursor: pointer;" }});
		const fullyProcessedCheckbox = fullyProcessedLabel.createEl("input", {
			type: "checkbox"
		});
		fullyProcessedCheckbox.checked = this.showFullyProcessed;
		fullyProcessedLabel.createEl("span", {text: "✅ Fully Processed"});
		
		// Update filters on change
		newCheckbox.onchange = () => {
			this.showNew = newCheckbox.checked;
			this.displayConversations(container);
		};
		partialCheckbox.onchange = () => {
			this.showPartiallyProcessed = partialCheckbox.checked;
			this.displayConversations(container);
		};
		fullyProcessedCheckbox.onchange = () => {
			this.showFullyProcessed = fullyProcessedCheckbox.checked;
			this.displayConversations(container);
		};
		
		// Filter conversations based on settings
		const filteredConversations = this.getFilteredConversations();
		
		const tocList = container.createDiv("toc-list");
		tocList.style.cssText = "max-height: 500px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 8px;";
		
		if (filteredConversations.length === 0) {
			const emptyMsg = tocList.createDiv("empty-message");
			emptyMsg.style.cssText = "padding: 20px; text-align: center; color: var(--text-muted);";
			emptyMsg.textContent = "No conversations match the current filter settings.";
			return;
		}
		
	filteredConversations.forEach((convWithIndex, filteredIndex) => {
			const conv = convWithIndex.conversation;
			const originalIndex = convWithIndex.originalIndex;
			const assistantMessagesCount = conv.messages.filter((msg: any) => msg.role === 'assistant').length;
			const processingStatus = this.plugin.getConversationProcessingStatus(conv.id, assistantMessagesCount);
			
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
			
			// State indicator + Title
			const titleRow = leftDiv.createEl("div");
			titleRow.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 5px;";
			
			// Add processing status emoji indicator
			let stateEmoji = "";
			let stateColor = "";
			switch (processingStatus) {
				case ConversationProcessingStatus.PROCESSED:
					stateEmoji = "✅";
					stateColor = "var(--color-green)";
					break;
				case ConversationProcessingStatus.PARTIAL:
					stateEmoji = "🔄";
					stateColor = "var(--color-orange)";
					break;
				default:
					stateEmoji = "🆕";
					stateColor = "var(--interactive-accent)";
			}
			
			const stateIndicator = titleRow.createEl("span", {text: stateEmoji});
			stateIndicator.style.cssText = `color: ${stateColor}; font-size: 1.1em;`;
			
			const titleEl = titleRow.createEl("div");
			titleEl.textContent = conv.title;
			titleEl.style.cssText = "font-weight: 500; font-size: 1.05em; flex: 1;";
			
			const statsEl = leftDiv.createEl("div");
			const assistantMessages = conv.messages.filter((msg: any) => msg.role === 'assistant');
			const statusText = processingStatus === ConversationProcessingStatus.PROCESSED ? 
				"All processed" : processingStatus === ConversationProcessingStatus.PARTIAL ? 
				"Partially processed" : "New";
			statsEl.textContent = `${assistantMessages.length} responses • ${statusText} • ${new Date(conv.create_time * 1000).toLocaleDateString()}`;
			statsEl.style.cssText = "color: var(--text-muted); font-size: 0.9em;";
			
			const rightDiv = tocItem.createDiv();
			rightDiv.createEl("span", {text: "👁️ View"});
			rightDiv.style.cssText = "color: var(--interactive-accent); font-size: 0.9em;";
			
			tocItem.onclick = () => {
				this.currentConversationIndex = originalIndex;
				this.viewMode = 'conversation';
				this.displayConversations(container);
			};
		});
		
		// Show summary
		const summaryDiv = container.createDiv("conversation-summary");
		summaryDiv.style.cssText = "margin-top: 10px; text-align: center; color: var(--text-muted); font-size: 0.9em;";
		const total = this.conversations.length;
		const showing = filteredConversations.length;
		summaryDiv.textContent = showing === total ? 
			`Showing all ${total} conversations` : 
			`Showing ${showing} of ${total} conversations`;
	}

	getFilteredConversations() {
		return this.conversations
			.map((conv, index) => ({ conversation: conv, originalIndex: index }))
			.filter(({ conversation }) => {
				const assistantMessagesCount = conversation.messages.filter((msg: any) => msg.role === 'assistant').length;
				const processingStatus = this.plugin.getConversationProcessingStatus(conversation.id, assistantMessagesCount);
				
				// Filter based on conversation processing status and filter settings
				switch (processingStatus) {
					case ConversationProcessingStatus.UNPROCESSED:
						return this.showNew;
					case ConversationProcessingStatus.PARTIAL:
						return this.showPartiallyProcessed;
					case ConversationProcessingStatus.PROCESSED:
						return this.showFullyProcessed;
					default:
						return this.showNew; // Default to showing as new if status is unclear
				}
			});
	}

	displaySingleConversation(container: HTMLElement) {
		if (this.conversations.length === 0) return;
		
		const conv = this.conversations[this.currentConversationIndex];
		if (!conv) return;
		
		// Get current conversation processing status
		const assistantMessages = conv.messages.filter((msg: any) => msg.role === 'assistant');
		const processingStatus = this.plugin.getConversationProcessingStatus(conv.id, assistantMessages.length);
		
		// Compact header with conversation info and navigation
		const header = container.createDiv("conversation-header");
		header.style.cssText = "margin-bottom: 15px; padding: 12px; background: var(--background-secondary); border-radius: 6px; border: 1px solid var(--background-modifier-border);";
		
		// Top row: Title and status
		const titleRow = header.createDiv();
		titleRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;";
		
		const titleInfo = titleRow.createDiv();
		titleInfo.style.cssText = "display: flex; align-items: center; gap: 10px;";
		
		// Processing status emoji
		let stateEmoji = "";
		let stateColor = "";
		let statusText = "";
		switch (processingStatus) {
			case ConversationProcessingStatus.PROCESSED:
				stateEmoji = "✅";
				stateColor = "var(--color-green)";
				statusText = "All processed";
				break;
			case ConversationProcessingStatus.PARTIAL:
				stateEmoji = "🔄";
				stateColor = "var(--color-orange)";
				statusText = "Partially processed";
				break;
			default:
				stateEmoji = "🆕";
				stateColor = "var(--interactive-accent)";
				statusText = "New";
		}
		
		const stateIndicator = titleInfo.createEl("span", {text: stateEmoji});
		stateIndicator.style.cssText = `color: ${stateColor}; font-size: 1.1em;`;
		
		const titleEl = titleInfo.createEl("div");
		titleEl.textContent = conv.title;
		titleEl.style.cssText = "font-weight: 500; font-size: 1.1em;";
		
		// Back to TOC button (compact)
		const backButton = titleRow.createEl("button", {
			text: "📋 Back",
			cls: "mod-muted"
		});
		backButton.style.cssText = "font-size: 0.9em;";
		backButton.onclick = () => {
			this.viewMode = 'toc';
			this.displayConversations(container);
		};
		
		// Bottom row: Stats and navigation
		const statsRow = header.createDiv();
		statsRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 0.9em;";
		
		const statsText = statsRow.createDiv();
		statsText.textContent = `Conversation ${this.currentConversationIndex + 1} of ${this.conversations.length} • ${assistantMessages.length} responses • ${statusText} • ${new Date(conv.create_time * 1000).toLocaleDateString()}`;
		
		// Compact prev/next navigation
		const nav = statsRow.createDiv();
		nav.style.cssText = "display: flex; gap: 5px;";
		
		const prevButton = nav.createEl("button", {
			text: "‹",
			attr: { title: "Previous conversation" }
		});
		prevButton.style.cssText = "width: 24px; height: 24px; padding: 0; font-size: 16px;";
		prevButton.disabled = this.currentConversationIndex === 0;
		prevButton.onclick = () => {
			if (this.currentConversationIndex > 0) {
				this.currentConversationIndex--;
				this.displayConversations(container);
			}
		};
		
		const nextButton = nav.createEl("button", {
			text: "›",
			attr: { title: "Next conversation" }
		});
		nextButton.style.cssText = "width: 24px; height: 24px; padding: 0; font-size: 16px;";
		nextButton.disabled = this.currentConversationIndex === this.conversations.length - 1;
		nextButton.onclick = () => {
			if (this.currentConversationIndex < this.conversations.length - 1) {
				this.currentConversationIndex++;
				this.displayConversations(container);
			}
		};
		
		// Compact filter controls
		const pairFiltersDiv = container.createDiv("pair-filter-controls");
		pairFiltersDiv.style.cssText = "margin-bottom: 10px; padding: 8px 12px; background: var(--background-secondary); border-radius: 6px; border: 1px solid var(--background-modifier-border);";
		
		const filterHeader = pairFiltersDiv.createEl("div");
		filterHeader.style.cssText = "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;";
		
		filterHeader.createEl("span", {text: "Show:", attr: { style: "font-weight: 500; color: var(--text-normal); font-size: 0.9em;" }});
		
		// New pairs toggle
		const newPairsLabel = filterHeader.createEl("label", {attr: { style: "display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.9em;" }});
	const newPairsCheckbox = newPairsLabel.createEl("input", {
		type: "checkbox"
	});
	newPairsCheckbox.checked = this.showNewPairs;
		newPairsLabel.createEl("span", {text: "🆕 New"});
		
		// Ignored pairs toggle
		const ignoredPairsLabel = filterHeader.createEl("label", {attr: { style: "display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.9em;" }});
	const ignoredPairsCheckbox = ignoredPairsLabel.createEl("input", {
		type: "checkbox"
	});
	ignoredPairsCheckbox.checked = this.showIgnoredPairs;
		ignoredPairsLabel.createEl("span", {text: "🚫 Ignored"});
		
		// Saved pairs toggle
		const savedPairsLabel = filterHeader.createEl("label", {attr: { style: "display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.9em;" }});
	const savedPairsCheckbox = savedPairsLabel.createEl("input", {
		type: "checkbox"
	});
	savedPairsCheckbox.checked = this.showSavedPairs;
		savedPairsLabel.createEl("span", {text: "✅ Saved"});
		
		// Update filters on change
		newPairsCheckbox.onchange = () => {
			this.showNewPairs = newPairsCheckbox.checked;
			this.displayConversations(container);
		};
		ignoredPairsCheckbox.onchange = () => {
			this.showIgnoredPairs = ignoredPairsCheckbox.checked;
			this.displayConversations(container);
		};
		savedPairsCheckbox.onchange = () => {
			this.showSavedPairs = savedPairsCheckbox.checked;
			this.displayConversations(container);
		};
		
		// Q&A pairs content (maximizing space)
		const contentDiv = container.createDiv("single-conversation-content");
		contentDiv.style.cssText = "border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 12px; max-height: calc(100vh - 280px); overflow-y: auto;";

		// Get filtered Q&A pairs
		const filteredPairs = this.getFilteredQAPairs(conv, assistantMessages);
		
		// Show compact filter status if some pairs are hidden
		if (filteredPairs.length < assistantMessages.length) {
			const filterStatus = contentDiv.createDiv("filter-status");
			filterStatus.style.cssText = "margin-bottom: 10px; padding: 6px 10px; background: var(--background-primary); border: 1px solid var(--color-orange); border-radius: 4px; text-align: center; color: var(--color-orange); font-size: 0.85em;";
			filterStatus.textContent = `Showing ${filteredPairs.length} of ${assistantMessages.length} pairs (${assistantMessages.length - filteredPairs.length} filtered)`;
		}
		
		// Show empty state if no pairs match filters
		if (filteredPairs.length === 0) {
			const emptyState = contentDiv.createDiv("empty-pairs");
			emptyState.style.cssText = "padding: 40px; text-align: center; color: var(--text-muted);";
			emptyState.innerHTML = `
				<div style="font-size: 1.2em; margin-bottom: 10px;">🔍</div>
				<div style="font-weight: 500; margin-bottom: 5px;">No Q&A pairs match your filters</div>
				<div style="font-size: 0.9em;">Adjust the filter settings above to see more pairs</div>
			`;
			return;
		}

		// Display filtered Q&A pairs
		filteredPairs.forEach((assistantMsg: any, msgIndex: number) => {
			// Find the user message that prompted this response
			const messageIndex = conv.messages.findIndex((msg: any) => msg.id === assistantMsg.id);
			const userMsg = messageIndex > 0 ? conv.messages[messageIndex - 1] : null;
			
			// Generate Q&A pair ID and get its current state
			const userMsgId = userMsg ? userMsg.id : 'no-user-msg';
			const pairId = this.plugin.generateQAPairId(conv.id, userMsgId, assistantMsg.id);
			const pairState = this.plugin.getQAPairState(pairId);
			
			// Debug logging for Q&A pair state lookup
			console.log(`[QA PAIR DEBUG] Pair ${msgIndex + 1}:`, {
				conversationId: conv.id,
				userMsgId,
				assistantMsgId: assistantMsg.id,
				generatedPairId: pairId,
				lookedUpState: pairState,
				metadataKeys: Object.keys(this.plugin.getQAPairMetadata().qaPairs)
			});
			
			// Set styling based on Q&A pair state
			let borderColor = "var(--interactive-accent)";
			let stateEmoji = "";
			let stateColor = "";
			let stateText = "";
			
			switch (pairState) {
				case QAPairState.SAVED:
					borderColor = "var(--color-green)";
					stateEmoji = "✅";
					stateColor = "var(--color-green)";
					stateText = "Saved";
					break;
				case QAPairState.IGNORED:
					borderColor = "var(--text-muted)";
					stateEmoji = "🚫";
					stateColor = "var(--text-muted)";
					stateText = "Ignored";
					break;
				default:
					borderColor = "var(--interactive-accent)";
					stateEmoji = "🆕";
					stateColor = "var(--interactive-accent)";
					stateText = "New";
			}
			
			const qaDiv = contentDiv.createDiv("qa-pair");
			qaDiv.style.cssText = `margin: 20px 0; padding: 20px; background: var(--background-secondary); border-radius: 8px; border-left: 4px solid ${borderColor};`;
			
			// Q&A pair header with state indicator
			const pairHeader = qaDiv.createEl("div");
			pairHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--background-modifier-border);";
			
			const pairTitle = pairHeader.createEl("div");
			pairTitle.style.cssText = "font-weight: 500; color: var(--text-normal);";
			pairTitle.textContent = `Q&A Pair ${msgIndex + 1}`;
			
			const stateIndicator = pairHeader.createEl("div");
			stateIndicator.style.cssText = `display: flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 12px; background: ${stateColor}20; color: ${stateColor}; font-size: 0.85em; font-weight: 500;`;
			stateIndicator.createEl("span", {text: stateEmoji});
			stateIndicator.createEl("span", {text: stateText});
			
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
			
			// Action buttons based on current state
			const buttonDiv = qaDiv.createEl("div");
			buttonDiv.style.cssText = "display: flex; gap: 10px; margin-top: 15px;";
			
			if (pairState === QAPairState.NEW) {
				// Show both Save and Ignore buttons for new pairs
				const saveButton = buttonDiv.createEl("button", {
					text: "💾 Save as Note",
					cls: "mod-cta"
				});
				saveButton.style.cssText = "flex: 1;";
				
				const ignoreButton = buttonDiv.createEl("button", {
					text: "🚫 Ignore"
				});
				ignoreButton.style.cssText = "flex: 1;";
				
		saveButton.onclick = () => {
			const modal = new SaveNoteModal(this.app, this.plugin, conv, assistantMsg, userMsg, pairId, () => {
				// Refresh the UI after successful save
				this.displayConversations(container);
			});
			modal.open();
		};
				
				ignoreButton.onclick = async () => {
					const confirmed = confirm("Mark this Q&A pair as ignored?");
					if (confirmed) {
						const userPrompt = userMsg ? userMsg.content : "";
						await this.plugin.updateQAPairState(pairId, QAPairState.IGNORED, conv.id, userPrompt, assistantMsg.content);
						this.displayConversations(container);
						new Notice("Q&A pair marked as ignored.");
					}
				};
			} else if (pairState === QAPairState.SAVED) {
				// Show status and option to save again
				const resaveButton = buttonDiv.createEl("button", {
					text: "💾 Save Again"
				});
				resaveButton.style.cssText = "flex: 1;";
				
				const resetButton = buttonDiv.createEl("button", {
					text: "↩️ Reset to New"
				});
				resetButton.style.cssText = "flex: 1;";
				
		resaveButton.onclick = () => {
			const modal = new SaveNoteModal(this.app, this.plugin, conv, assistantMsg, userMsg, pairId, () => {
				// Refresh the UI after successful save
				this.displayConversations(container);
			});
			modal.open();
		};
				
				resetButton.onclick = async () => {
					const confirmed = confirm("Reset this Q&A pair to new status?");
					if (confirmed) {
						const userPrompt = userMsg ? userMsg.content : "";
						await this.plugin.updateQAPairState(pairId, QAPairState.NEW, conv.id, userPrompt, assistantMsg.content);
						this.displayConversations(container);
						new Notice("Q&A pair reset to new status.");
					}
				};
			} else if (pairState === QAPairState.IGNORED) {
				// Show option to un-ignore or save
				const saveButton = buttonDiv.createEl("button", {
					text: "💾 Save as Note",
					cls: "mod-cta"
				});
				saveButton.style.cssText = "flex: 1;";
				
				const unignoreButton = buttonDiv.createEl("button", {
					text: "↩️ Un-ignore"
				});
				unignoreButton.style.cssText = "flex: 1;";
				
				saveButton.onclick = () => {
					const modal = new SaveNoteModal(this.app, this.plugin, conv, assistantMsg, userMsg, pairId, () => {
						// Refresh the UI after successful save
						this.displayConversations(container);
					});
					modal.open();
				};
				
				unignoreButton.onclick = async () => {
					const confirmed = confirm("Reset this Q&A pair to new status?");
					if (confirmed) {
						const userPrompt = userMsg ? userMsg.content : "";
						await this.plugin.updateQAPairState(pairId, QAPairState.NEW, conv.id, userPrompt, assistantMsg.content);
						this.displayConversations(container);
						new Notice("Q&A pair reset to new status.");
					}
				};
			}
		});
	}

	// Get filtered Q&A pairs based on current filter settings
	getFilteredQAPairs(conv: any, assistantMessages: any[]): any[] {
		return assistantMessages.filter((assistantMsg: any) => {
			// Find the user message that prompted this response
			const messageIndex = conv.messages.findIndex((msg: any) => msg.id === assistantMsg.id);
			const userMsg = messageIndex > 0 ? conv.messages[messageIndex - 1] : null;
			
			// Generate Q&A pair ID and get its current state
			const userMsgId = userMsg ? userMsg.id : 'no-user-msg';
			const pairId = this.plugin.generateQAPairId(conv.id, userMsgId, assistantMsg.id);
			const pairState = this.plugin.getQAPairState(pairId);
			
			// Filter based on state and current filter settings
			switch (pairState) {
				case QAPairState.NEW:
					return this.showNewPairs;
				case QAPairState.IGNORED:
					return this.showIgnoredPairs;
				case QAPairState.SAVED:
					return this.showSavedPairs;
				default:
					return this.showNewPairs; // Default to NEW state
			}
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
	userMessage?: any;
	pairId?: string;
	private saveInProgress: boolean = false;
	private onSaveCallback?: () => void;

	constructor(app: App, plugin: ChatGPTToObsidianPlugin, conversation: any, message: any, userMessage?: any, pairId?: string, onSaveCallback?: () => void) {
		super(app);
		this.plugin = plugin;
		this.conversation = conversation;
		this.message = message;
		this.userMessage = userMessage;
		this.pairId = pairId;
		this.onSaveCallback = onSaveCallback;
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

		// Folder selection with dropdown and autocomplete
		const folderDiv = contentEl.createDiv();
		folderDiv.createEl("label", {text: "Save to folder:"});
		
		const folderSelectContainer = folderDiv.createDiv();
		folderSelectContainer.style.cssText = "position: relative; width: 100%; margin: 5px 0;";
		
		const folderInput = folderSelectContainer.createEl("input", {
			type: "text",
			value: this.plugin.settings.defaultFolder,
			attr: { 
				style: "width: 100%; padding: 8px; padding-right: 30px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary);",
				placeholder: "Type folder path or select from dropdown..."
			}
		});
		
		// Dropdown arrow button
		const dropdownButton = folderSelectContainer.createEl("button", {
			text: "▼",
			attr: {
				type: "button",
				style: "position: absolute; right: 5px; top: 50%; transform: translateY(-50%); border: none; background: none; cursor: pointer; color: var(--text-muted); font-size: 12px; padding: 2px 4px;"
			}
		});
		
		// Dropdown list (initially hidden)
		const dropdownList = folderSelectContainer.createEl("div");
		dropdownList.style.cssText = "position: absolute; top: 100%; left: 0; right: 0; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-top: none; border-radius: 0 0 4px 4px; max-height: 200px; overflow-y: auto; z-index: 1000; display: none;";
		
		// Get all folders in the vault
		const getAllFolders = (): string[] => {
			const folders: string[] = [''];
			const allFiles = this.app.vault.getAllLoadedFiles();
			
			allFiles.forEach(file => {
				if (file instanceof TFolder) {
					folders.push(file.path);
				}
			});
			
			return folders.sort();
		};
		
		// Populate dropdown with folders
		const populateDropdown = (filter: string = '') => {
			dropdownList.empty();
			const folders = getAllFolders();
			const filteredFolders = folders.filter(folder => 
				folder.toLowerCase().includes(filter.toLowerCase())
			);
			
			if (filteredFolders.length === 0) {
				const noResults = dropdownList.createEl("div");
				noResults.textContent = filter ? `No folders match "${filter}"` : "No folders found";
				noResults.style.cssText = "padding: 8px 12px; color: var(--text-muted); font-style: italic;";
				return;
			}
			
			filteredFolders.forEach(folder => {
				const option = dropdownList.createEl("div");
				option.textContent = folder || "(Root folder)";
				option.style.cssText = "padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--background-modifier-border-hover); transition: background-color 0.1s;";
				
				// Highlight matching text
				if (filter && folder.toLowerCase().includes(filter.toLowerCase())) {
					const regex = new RegExp(`(${filter})`, 'gi');
					const displayText = folder || "(Root folder)";
					option.innerHTML = displayText.replace(regex, '<mark style="background: var(--text-selection); padding: 0;">$1</mark>');
				}
				
				// Hover effect
				option.addEventListener('mouseenter', () => {
					option.style.backgroundColor = "var(--background-modifier-hover)";
				});
				option.addEventListener('mouseleave', () => {
					option.style.backgroundColor = "";
				});
				
				// Select folder on click
				option.onclick = () => {
					folderInput.value = folder;
					dropdownList.style.display = "none";
					updatePreview();
				};
			});
			
			// Add option to create new folder if typing something not in list
			if (filter && !filteredFolders.includes(filter) && filter.trim() !== '') {
				const createOption = dropdownList.createEl("div");
				createOption.innerHTML = `<span style="color: var(--interactive-accent);">📁 Create folder: "${filter}"</span>`;
				createOption.style.cssText = "padding: 8px 12px; cursor: pointer; border-top: 1px solid var(--background-modifier-border); background: var(--background-secondary); font-weight: 500;";
				
				createOption.addEventListener('mouseenter', () => {
					createOption.style.backgroundColor = "var(--background-modifier-hover)";
				});
				createOption.addEventListener('mouseleave', () => {
					createOption.style.backgroundColor = "var(--background-secondary)";
				});
				
				createOption.onclick = () => {
					folderInput.value = filter;
					dropdownList.style.display = "none";
					updatePreview();
				};
			}
		};
		
		// Show/hide dropdown
		const toggleDropdown = () => {
			if (dropdownList.style.display === "none" || !dropdownList.style.display) {
				populateDropdown(folderInput.value);
				dropdownList.style.display = "block";
			} else {
				dropdownList.style.display = "none";
			}
		};
		
		// Event listeners
		dropdownButton.onclick = (e) => {
			e.preventDefault();
			toggleDropdown();
		};
		
		folderInput.onfocus = () => {
			populateDropdown(folderInput.value);
			dropdownList.style.display = "block";
		};
		
		folderInput.oninput = () => {
			if (dropdownList.style.display === "block") {
				populateDropdown(folderInput.value);
			}
			updatePreview();
		};
		
		// Handle keyboard navigation
		folderInput.onkeydown = (e) => {
			const options = Array.from(dropdownList.children) as HTMLElement[];
			const visibleOptions = options.filter(opt => opt.style.display !== 'none');
			
			if (e.key === 'ArrowDown' && dropdownList.style.display === "block") {
				e.preventDefault();
				if (visibleOptions.length > 0) {
					visibleOptions[0].focus();
				}
			} else if (e.key === 'Escape') {
				dropdownList.style.display = "none";
			} else if (e.key === 'Enter' && dropdownList.style.display === "block") {
				e.preventDefault();
				dropdownList.style.display = "none";
			}
		};
		
		// Hide dropdown when clicking outside
		document.addEventListener('click', (e) => {
			if (!folderSelectContainer.contains(e.target as Node)) {
				dropdownList.style.display = "none";
			}
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
			// Prevent double-clicking by disabling the button
			if (saveButton.disabled) return;
			saveButton.disabled = true;
			saveButton.textContent = "Saving...";
			
			try {
				await this.saveNote(
					titleInput.value,
					folderInput.value,
					tagsInput.value
				);
				new Notice("Note saved successfully!");
				if (this.onSaveCallback) {
					this.onSaveCallback();
				}
				this.close();
			} catch (error) {
				new Notice("Error saving note: " + error.message);
				// Re-enable button on error
				saveButton.disabled = false;
				saveButton.textContent = "Save Note";
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
		console.log('[SAVE DEBUG] Starting save operation:', { title, folder, tags, pairId: this.pairId });
		
		// Prevent concurrent saves from the same modal
		if (this.saveInProgress) {
			console.log('[SAVE DEBUG] Save already in progress, throwing error');
			throw new Error('Save operation already in progress');
		}
		this.saveInProgress = true;
		console.log('[SAVE DEBUG] Set saveInProgress = true');
		
		let createdFilePath: string | null = null;
		
		try {
			const content = this.generateNoteContent(title, tags);
			
			// Ensure folder exists
			const folderPath = folder.trim();
			if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
				await this.app.vault.createFolder(folderPath);
			}
			
			// Use atomic file creation with retry logic
			const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-');
			let finalPath = folderPath ? `${folderPath}/${safeTitle}.md` : `${safeTitle}.md`;
			let counter = 1;
			const maxRetries = 100; // Prevent infinite loops
			let fileCreated = false;
			
			// First, pre-check for duplicate files and generate a unique filename
			const basePath = finalPath;
			while (this.app.vault.getAbstractFileByPath(finalPath)) {
				const lastSlashIndex = basePath.lastIndexOf('/');
				const dir = lastSlashIndex >= 0 ? basePath.substring(0, lastSlashIndex + 1) : '';
				const nameWithExt = lastSlashIndex >= 0 ? basePath.substring(lastSlashIndex + 1) : basePath;
				const lastDotIndex = nameWithExt.lastIndexOf('.');
				const name = lastDotIndex >= 0 ? nameWithExt.substring(0, lastDotIndex) : nameWithExt;
				const ext = lastDotIndex >= 0 ? nameWithExt.substring(lastDotIndex) : '';
				
				finalPath = `${dir}${name} (${counter})${ext}`;
				counter++;
				
				if (counter > maxRetries) {
					throw new Error(`Too many duplicate files. Unable to create unique filename after ${maxRetries} attempts.`);
				}
			}
			
			// Now attempt to create the file
			console.log('[SAVE DEBUG] Attempting to create file:', finalPath);
			try {
				await this.app.vault.create(finalPath, content);
				createdFilePath = finalPath;
				fileCreated = true;
				console.log('[SAVE DEBUG] File created successfully:', finalPath);
			} catch (error) {
				console.log('[SAVE DEBUG] File creation failed:', error.message);
				// If file creation still fails (possible race condition), try once more with a timestamp
				const timestampSuffix = Date.now().toString();
				const lastSlashIndex = basePath.lastIndexOf('/');
				const dir = lastSlashIndex >= 0 ? basePath.substring(0, lastSlashIndex + 1) : '';
				const nameWithExt = lastSlashIndex >= 0 ? basePath.substring(lastSlashIndex + 1) : basePath;
				const lastDotIndex = nameWithExt.lastIndexOf('.');
				const name = lastDotIndex >= 0 ? nameWithExt.substring(0, lastDotIndex) : nameWithExt;
				const ext = lastDotIndex >= 0 ? nameWithExt.substring(lastDotIndex) : '';
				
				const fallbackPath = `${dir}${name}-${timestampSuffix}${ext}`;
				
				try {
					await this.app.vault.create(fallbackPath, content);
					createdFilePath = fallbackPath;
					fileCreated = true;
				} catch (fallbackError) {
					// If even the timestamped version fails, throw the original error
					throw error;
				}
			}
			
			if (!fileCreated) {
				throw new Error('Failed to create file');
			}
			
			// Only update Q&A pair state after successful file creation
			if (this.pairId) {
				console.log('[SAVE DEBUG] Updating Q&A pair state for:', this.pairId);
				try {
					const userPrompt = this.userMessage ? this.userMessage.content : "";
					await this.plugin.updateQAPairState(this.pairId, QAPairState.SAVED, this.conversation.id, userPrompt, this.message.content);
					console.log('[SAVE DEBUG] Q&A pair state updated successfully');
				} catch (metadataError) {
					// If metadata update fails, log it but don't fail the entire operation
					console.error('[SAVE DEBUG] Failed to update Q&A pair metadata:', metadataError);
					// Still consider the save successful since the file was created
				}
			} else {
				console.log('[SAVE DEBUG] No pairId provided, skipping metadata update');
			}
		} finally {
			this.saveInProgress = false;
			console.log('[SAVE DEBUG] Save operation completed, set saveInProgress = false');
		}
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
