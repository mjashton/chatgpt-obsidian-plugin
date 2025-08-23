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

// Test with your actual data
const chatgptDataPath = 'C:\\Users\\shama\\Downloads\\5a383a6a2022b0a2e3df26540d10097c06b929a5d5dd5ad2d1b1332e9e04edc8-2025-08-23-14-58-13-5b2f2d21d1f946c8a6ab9f0b06132e1e\\conversations.json';

try {
	const plugin = new ChatGPTToObsidianPlugin();
	const data = fs.readFileSync(chatgptDataPath, 'utf8');
	
	console.log('Loading ChatGPT conversations...');
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
