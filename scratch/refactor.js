const fs = require('fs');
const file = 'frontend/src/pages/AICounselling.js';
let content = fs.readFileSync(file, 'utf8');

// Rename state
content = content.replace(/const \[messages, setMessages\]/g, 'const [chatHistory, setChatHistory]');
content = content.replace(/setMessages\(/g, 'setChatHistory(');
content = content.replace(/messagesRef\.current = messages/g, 'messagesRef.current = chatHistory');
content = content.replace(/\[messages, loading\]/g, '[chatHistory, loading]');
content = content.replace(/messages\.length/g, 'chatHistory.length');
content = content.replace(/messages\.map/g, 'chatHistory.map');
content = content.replace(/\.\.\.messages/g, '...chatHistory');
content = content.replace(/messagesRef\.current/g, 'chatHistoryRef.current');
content = content.replace(/const messagesRef\s*=\s*useRef\(messages\)/g, 'const chatHistoryRef = useRef(chatHistory)');

// Rename text to content in object properties
content = content.replace(/text: "Hey, still there\?"/g, 'content: "Hey, still there?"');
content = content.replace(/text: userText/g, 'content: userText');
content = content.replace(/text: replyText/g, 'content: replyText');
content = content.replace(/text: err\.message/g, 'content: err.message');
content = content.replace(/msg\.text/g, 'msg.content');

fs.writeFileSync(file, content);
console.log('AICounselling.js refactored');
