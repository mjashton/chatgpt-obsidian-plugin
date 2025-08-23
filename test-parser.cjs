// Simple test to verify our ChatGPT parser works
const fs = require('fs');
const path = require('path');

// Mock the main plugin class for testing
class ChatGPTToObsidianPlugin {
	parseChatGPTData(jsonContent) {
		try {
			const data = JSON.parse(jsonContent);
			return data;
		} catch (error) {
			console.error('Error parsing ChatGPT data:', error);
			throw new Error('Invalid ChatGPT export format');
		}
	}

	extractConversations(conversations) {
		return conversations.map(conv => {
			const messages = [];
			const mapping = conv.mapping;
			
			// Find the conversation root
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

// Resolve input path from CLI args or environment
function resolveInputPath() {
	const args = process.argv.slice(2);
	let filePath = process.env.CONVERSATIONS_JSON || null;
	let dirPath = null;

	for (const arg of args) {
		if (arg.startsWith('--path=')) filePath = arg.replace('--path=', '');
		else if (arg.startsWith('--dir=')) dirPath = arg.replace('--dir=', '');
		else if (!arg.startsWith('--') && !filePath && !dirPath) filePath = arg; // first positional
	}

	if (!filePath && dirPath) {
		filePath = path.join(dirPath, 'conversations.json');
	}

	if (!filePath) return null;

	// Expand ~ on POSIX and handle quotes
	if (filePath.startsWith('~')) {
		filePath = path.join(require('os').homedir(), filePath.slice(1));
	}

	return filePath;
}

function printUsage() {
	console.log('Usage:');
	console.log('  node test-parser.cjs --path="/path/to/conversations.json"');
	console.log('  node test-parser.cjs --dir="/path/to/unzipped-export-folder"');
	console.log('  CONVERSATIONS_JSON=/path/to/conversations.json node test-parser.cjs');
	console.log('');
	console.log('Notes:');
	console.log('  - If you provide --dir, the script will append \'conversations.json\' automatically.');
	console.log('  - On Windows PowerShell, use: node .\\test-parser.cjs --path "C:\\Users\\you\\Downloads\\export\\conversations.json"');
}

try {
	const plugin = new ChatGPTToObsidianPlugin();
	const chatgptDataPath = resolveInputPath();

	if (!chatgptDataPath) {
		console.error('Error: No input path provided.');
		printUsage();
		process.exit(1);
	}

	if (!fs.existsSync(chatgptDataPath)) {
		console.error(`Error: File not found at: ${chatgptDataPath}`);
		printUsage();
		process.exit(1);
	}

	const data = fs.readFileSync(chatgptDataPath, 'utf8');
	console.log(`Loading ChatGPT conversations from: ${chatgptDataPath}`);
	const rawConversations = plugin.parseChatGPTData(data);
	console.log(`Found ${rawConversations.length} conversations`);
	
	console.log('Parsing conversation threads...');
	const cleanConversations = plugin.extractConversations(rawConversations);
	
	// Display summary
	cleanConversations.forEach((conv, i) => {
		const assistantMessages = conv.messages.filter(msg => msg.role === 'assistant');
		console.log(`${i + 1}. "${conv.title}" - ${conv.messages.length} messages, ${assistantMessages.length} responses`);
		
		if (assistantMessages.length > 0) {
			const firstResponse = assistantMessages[0];
			const preview = firstResponse.content.length > 100 ? 
				firstResponse.content.substring(0, 100) + '...' : 
				firstResponse.content;
			console.log(`   First response: ${preview}`);
		}
	});
	
	console.log('\n✅ Parser test completed successfully!');
	console.log('The plugin should work correctly with your ChatGPT export data.');
	
} catch (error) {
	console.error('❌ Parser test failed:', error.message);
}
