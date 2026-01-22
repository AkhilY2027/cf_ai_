export interface Env {
	AI: any;
	CHAT_MEMORY: DurableObjectNamespace;
}

// Durable Object for managing chat memory and conversation state
export class ChatMemory {
	private state: DurableObjectState;
	private messages: Array<{ role: string; content: string }>;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.messages = [];
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		
		if (url.pathname === '/messages' && request.method === 'GET') {
			// Retrieve conversation history
			const stored = await this.state.storage.get('messages');
			this.messages = (stored as any) || [];
			return new Response(JSON.stringify(this.messages), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (url.pathname === '/messages' && request.method === 'POST') {
			// Add a new message to conversation history
			const message = await request.json() as { role: string; content: string };
			this.messages = (await this.state.storage.get('messages') as any) || [];
			this.messages.push(message);
			
			// Keep only last 20 messages to manage memory
			if (this.messages.length > 20) {
				this.messages = this.messages.slice(-20);
			}
			
			await this.state.storage.put('messages', this.messages);
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (url.pathname === '/clear' && request.method === 'POST') {
			// Clear conversation history
			this.messages = [];
			await this.state.storage.put('messages', []);
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response('Not found', { status: 404 });
	}
}

// Main Worker handler
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers for frontend access
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// API endpoint for chat
		if (url.pathname === '/api/chat' && request.method === 'POST') {
			try {
				const { message, sessionId } = await request.json() as { message: string; sessionId: string };
				
				// Get Durable Object instance for this session
				const id = env.CHAT_MEMORY.idFromName(sessionId || 'default');
				const stub = env.CHAT_MEMORY.get(id);

				// Store user message
				await stub.fetch('http://do/messages', {
					method: 'POST',
					body: JSON.stringify({ role: 'user', content: message }),
					headers: { 'Content-Type': 'application/json' }
				});

				// Get conversation history
				const historyResponse = await stub.fetch('http://do/messages');
				const history = await historyResponse.json() as Array<{ role: string; content: string }>;

				// Prepare messages for AI (system prompt + history)
				const aiMessages = [
					{
						role: 'system',
						content: 'You are a helpful AI assistant. Provide clear, concise, and friendly responses.'
					},
					...history
				];

				// Call Workers AI with Llama 3.3
				const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
					messages: aiMessages,
					stream: false
				});

				const assistantMessage = response.response || 'Sorry, I could not generate a response.';

				// Store assistant response
				await stub.fetch('http://do/messages', {
					method: 'POST',
					body: JSON.stringify({ role: 'assistant', content: assistantMessage }),
					headers: { 'Content-Type': 'application/json' }
				});

				return new Response(JSON.stringify({
					message: assistantMessage,
					sessionId: sessionId || 'default'
				}), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error: any) {
				return new Response(JSON.stringify({ error: error.message }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// API endpoint to clear conversation
		if (url.pathname === '/api/clear' && request.method === 'POST') {
			try {
				const { sessionId } = await request.json() as { sessionId: string };
				const id = env.CHAT_MEMORY.idFromName(sessionId || 'default');
				const stub = env.CHAT_MEMORY.get(id);

				await stub.fetch('http://do/clear', { method: 'POST' });

				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error: any) {
				return new Response(JSON.stringify({ error: error.message }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// API endpoint to get conversation history
		if (url.pathname === '/api/history' && request.method === 'GET') {
			try {
				const sessionId = url.searchParams.get('sessionId') || 'default';
				const id = env.CHAT_MEMORY.idFromName(sessionId);
				const stub = env.CHAT_MEMORY.get(id);

				const historyResponse = await stub.fetch('http://do/messages');
				const history = await historyResponse.json();

				return new Response(JSON.stringify(history), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error: any) {
				return new Response(JSON.stringify({ error: error.message }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// Serve the frontend HTML page
		if (url.pathname === '/' || url.pathname === '/index.html') {
			return new Response(getHTML(), {
				headers: { 'Content-Type': 'text/html' }
			});
		}

		return new Response('Not Found', { status: 404 });
	}
};

// Frontend HTML with chat interface
function getHTML(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare AI Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 800px;
            height: 600px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header-title {
            flex: 1;
        }
        
        .clear-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        }
        
        .clear-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f8f9fa;
        }
        
        .message {
            margin-bottom: 16px;
            display: flex;
            animation: fadeIn 0.3s;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .message.user {
            justify-content: flex-end;
        }
        
        .message-content {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 12px;
            word-wrap: break-word;
        }
        
        .message.user .message-content {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-bottom-right-radius: 4px;
        }
        
        .message.assistant .message-content {
            background: white;
            color: #333;
            border: 1px solid #e0e0e0;
            border-bottom-left-radius: 4px;
        }
        
        .input-container {
            padding: 20px;
            background: white;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
        }
        
        #messageInput {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 24px;
            font-size: 16px;
            outline: none;
            transition: border-color 0.3s;
        }
        
        #messageInput:focus {
            border-color: #667eea;
        }
        
        #sendButton {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 24px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: transform 0.2s;
        }
        
        #sendButton:hover {
            transform: scale(1.05);
        }
        
        #sendButton:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: scale(1);
        }
        
        .loading {
            display: flex;
            gap: 4px;
            padding: 12px;
        }
        
        .loading span {
            width: 8px;
            height: 8px;
            background: #667eea;
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }
        
        .loading span:nth-child(1) {
            animation-delay: -0.32s;
        }
        
        .loading span:nth-child(2) {
            animation-delay: -0.16s;
        }
        
        @keyframes bounce {
            0%, 80%, 100% {
                transform: scale(0);
            }
            40% {
                transform: scale(1);
            }
        }
        
        .info-text {
            text-align: center;
            color: #666;
            padding: 20px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-title">🤖 Cloudflare AI Chat</div>
            <button class="clear-btn" onclick="clearChat()">Clear Chat</button>
        </div>
        <div class="chat-container" id="chatContainer">
            <div class="info-text">
                Welcome! This AI chat app is powered by Cloudflare Workers AI (Llama 3.3) with Durable Objects for memory management.
                <br><br>
                Start chatting to see the AI in action!
            </div>
        </div>
        <div class="input-container">
            <input 
                type="text" 
                id="messageInput" 
                placeholder="Type your message here..." 
                onkeypress="handleKeyPress(event)"
            />
            <button id="sendButton" onclick="sendMessage()">Send</button>
        </div>
    </div>

    <script>
        const sessionId = 'user-' + Math.random().toString(36).substring(7);
        
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message) return;
            
            // Add user message to chat
            addMessage('user', message);
            input.value = '';
            
            // Disable input while processing
            const sendButton = document.getElementById('sendButton');
            sendButton.disabled = true;
            input.disabled = true;
            
            // Add loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message assistant';
            loadingDiv.innerHTML = '<div class="message-content loading"><span></span><span></span><span></span></div>';
            document.getElementById('chatContainer').appendChild(loadingDiv);
            scrollToBottom();
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message, sessionId })
                });
                
                const data = await response.json();
                
                // Remove loading indicator
                loadingDiv.remove();
                
                if (data.error) {
                    addMessage('assistant', 'Error: ' + data.error);
                } else {
                    addMessage('assistant', data.message);
                }
            } catch (error) {
                loadingDiv.remove();
                addMessage('assistant', 'Error: Could not connect to server. ' + error.message);
            }
            
            // Re-enable input
            sendButton.disabled = false;
            input.disabled = false;
            input.focus();
        }
        
        function addMessage(role, content) {
            const chatContainer = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;
            
            messageDiv.appendChild(contentDiv);
            chatContainer.appendChild(messageDiv);
            
            scrollToBottom();
        }
        
        function scrollToBottom() {
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }
        
        async function clearChat() {
            if (!confirm('Are you sure you want to clear the chat history?')) {
                return;
            }
            
            try {
                await fetch('/api/clear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId })
                });
                
                // Clear UI
                const chatContainer = document.getElementById('chatContainer');
                chatContainer.innerHTML = '<div class="info-text">Chat cleared! Start a new conversation.</div>';
            } catch (error) {
                alert('Error clearing chat: ' + error.message);
            }
        }
        
        // Load conversation history on page load
        async function loadHistory() {
            try {
                const response = await fetch(\`/api/history?sessionId=\${sessionId}\`);
                const history = await response.json();
                
                if (history.length > 0) {
                    const chatContainer = document.getElementById('chatContainer');
                    chatContainer.innerHTML = '';
                    
                    history.forEach(msg => {
                        addMessage(msg.role, msg.content);
                    });
                }
            } catch (error) {
                console.error('Error loading history:', error);
            }
        }
        
        // Load history when page loads
        window.addEventListener('load', loadHistory);
    </script>
</body>
</html>`;
}
