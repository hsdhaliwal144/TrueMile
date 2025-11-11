import { useState, useRef, useEffect } from 'react';
import { Send, Calculator, Trash2 } from 'lucide-react';
import { API_URL } from '../config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'dispatch-engine-messages';

export default function DispatchEngine() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Only use saved messages if they're not empty
      if (parsed && parsed.length > 0) {
        setMessages(parsed);
        return;
      }
    } catch (e) {
      console.error('Failed to parse saved messages:', e);
    }
  }
  
  // Always set initial message if nothing saved or empty
  const initialMessage = { 
    role: 'assistant' as const, 
    content: "Hi! I'm your dispatch planning assistant. Which driver are we planning routes for today?" 
  };
  setMessages([initialMessage]);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([initialMessage]));
}, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/dispatch/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    const initialMessage: Message = {
      role: 'assistant',
      content: "Hi! I'm your dispatch planning assistant. Which driver are we planning routes for today?"
    };
    setMessages([initialMessage]);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([initialMessage]));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', backgroundColor: '#f9fafb', padding: '32px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calculator size={32} color="#2563eb" />
              Dispatch Engine
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              AI-powered route planning to maximize driver profitability
            </p>
          </div>
          <button
            onClick={clearConversation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#6b7280',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={14} />
            Clear Chat
          </button>
        </div>

        <div style={{
          flex: 1,
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          overflowY: 'auto',
          marginBottom: '16px'
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '16px',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: msg.role === 'user' ? '#2563eb' : '#f3f4f6',
                color: msg.role === 'user' ? 'white' : '#111827',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: '4px', padding: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: loading || !input.trim() ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Send size={16} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
