'use client';

import { useState, useRef, useEffect } from 'react';

type Persona = 'general' | 'technical' | 'billing';

interface Message {
  role: 'bot' | 'user';
  text: string;
  options?: string[];
  isTyping?: boolean;
}

const personas: Record<Persona, { name: string; icon: string; color: string }> = {
  general:   { name: 'Indiabulls Securities Assistant', icon: 'fa-robot',              color: '#3B82F6' },
  technical: { name: 'Tech Guru',                       icon: 'fa-microchip',           color: '#00AB4E' },
  billing:   { name: 'Finance Pro',                     icon: 'fa-file-invoice-dollar', color: '#A855F7' },
};

const flows: Record<string, { text: string; options: string[] }[]> = {
  gtt: [
    { text: "GTT (Good Till Trigger) is great for long-term targets. Are you trying to place a Buy or Sell GTT?", options: ['Buy GTT', 'Sell GTT'] },
    { text: "Got it. Search for the stock, click the GTT icon (clock) near Buy/Sell. Do you see it?", options: ['Yes', 'No'] },
    { text: "Great! Enter your trigger price and limit price. It stays active for 1 year. Need more help?", options: ['Yes please', "I'm good"] },
  ],
  funds: [
    { text: "Adding funds is instant via UPI. Have you tried the 'Add Funds' button yet?", options: ['Yes', 'Where is it?'] },
    { text: "It's in the top navigation under 'Funds'. What issue are you facing?", options: ['Payment Failed', 'Limit Error'] },
    { text: "If payment failed but money was deducted, it reconciles in 2 hours. Should I check your ledger?", options: ['Yes, please', "No, I'll wait"] },
  ],
};

const kbArticles = [
  { id: 'open-account', title: 'How do I open an account?',          cat: 'getting-started' },
  { id: 'gtt',          title: 'How to place a GTT order?',           cat: 'trading' },
  { id: 'basket',       title: 'How to execute a Basket Order?',      cat: 'trading' },
  { id: 'add-funds',    title: 'How to add funds to my account?',     cat: 'funds' },
  { id: 'withdraw',     title: 'How long does fund withdrawal take?', cat: 'funds' },
  { id: 'ipo',          title: 'How to apply for an IPO?',            cat: 'ipo' },
  { id: 'segments',     title: 'How to activate F&O segments?',       cat: 'account' },
];

export default function FloatingChatbot() {
  const [open, setOpen] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Hello! Please select a persona specialized for your query:' },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [showInput, setShowInput] = useState(false);
  const currentFlow = useRef<string | null>(null);
  const flowStep = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const addMessage = (text: string, role: 'bot' | 'user', options?: string[]) => {
    setMessages(prev => [...prev, { role, text, options }]);
  };

  const showTyping = () => {
    setMessages(prev => [...prev, { role: 'bot', text: '', isTyping: true }]);
  };

  const removeTypingThenAdd = (text: string, options?: string[]) => {
    setTimeout(() => {
      setMessages(prev => [...prev.filter(m => !m.isTyping), { role: 'bot', text, options }]);
    }, 1000);
  };

  const handleResponse = (text: string) => {
    const lower = text.toLowerCase();

    if (lower.includes('gtt')) {
      currentFlow.current = 'gtt';
      flowStep.current = 0;
      removeTypingThenAdd(flows.gtt[0].text, flows.gtt[0].options);
      return;
    }
    if (lower.includes('fund')) {
      currentFlow.current = 'funds';
      flowStep.current = 0;
      removeTypingThenAdd(flows.funds[0].text, flows.funds[0].options);
      return;
    }
    if (lower.includes('main menu') || lower.includes('back')) {
      currentFlow.current = null;
      flowStep.current = 0;
      removeTypingThenAdd("Sure! What else can I help you with?", ['GTT Issues', 'Funds Help', 'Open Account']);
      return;
    }

    const matches = kbArticles.filter(a =>
      a.title.toLowerCase().includes(lower) || a.id.toLowerCase().includes(lower)
    );
    if (matches.length > 0) {
      const links = matches.map(a =>
        `<a href="/faq?cat=${a.cat}" style="color:var(--green);font-weight:600;text-decoration:underline;display:block;margin-bottom:4px;">${a.title}</a>`
      ).join('');
      removeTypingThenAdd("Here's what I found in our Knowledge Base:<br><br>" + links);
    } else {
      removeTypingThenAdd("I'm not sure about that. Try asking about 'GTT' or 'Funds', or say 'Main Menu' to restart.");
    }
  };

  const handleFlowSelection = (option: string) => {
    addMessage(option, 'user');
    showTyping();
    const flow = currentFlow.current;
    if (flow && flows[flow]) {
      flowStep.current++;
      const step = flows[flow][flowStep.current];
      if (step) {
        removeTypingThenAdd(step.text, step.options);
      } else {
        currentFlow.current = null;
        flowStep.current = 0;
        removeTypingThenAdd("Glad I could help! Is there anything else?", ['Back to FAQ', 'Main Menu']);
      }
    } else {
      handleResponse(option);
    }
  };

  const handlePersonaSelect = (p: Persona) => {
    setPersona(p);
    setShowInput(true);
    const info = personas[p];
    addMessage(`Switched to ${info.name}. I'm ready to help with your ${p} queries!`, 'bot', ['GTT Issues', 'Funds Help', 'Open Account']);
  };

  const handleSend = () => {
    const text = inputVal.trim();
    if (!text) return;
    addMessage(text, 'user');
    setInputVal('');
    showTyping();
    setTimeout(() => handleResponse(text), 1200);
  };

  const currentPersonaInfo = persona ? personas[persona] : null;

  return (
    <div className="chatbot-container">
      {/* Floating bubble */}
      <button className="chatbot-bubble" onClick={() => setOpen(o => !o)} aria-label="Open support chat">
        <i className="fas fa-comment-dots"></i>
        <span className="bubble-ping"></span>
      </button>

      {/* Chat window */}
      <div className={`chat-window${open ? ' active' : ''}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="header-info">
            <div className="bot-avatar" style={currentPersonaInfo ? { background: currentPersonaInfo.color } : {}}>
              <i className={`fas ${currentPersonaInfo ? currentPersonaInfo.icon : 'fa-robot'}`}></i>
            </div>
            <div>
              <h4>{currentPersonaInfo ? currentPersonaInfo.name : 'Indiabulls Securities Assistant'}</h4>
              <span className="online-status">Online · Returns in 2h</span>
            </div>
          </div>
          <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Messages body */}
        <div className="chat-body" ref={bodyRef}>
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.isTyping ? (
                <div className="message bot typing">
                  <div className="msg-content">
                    <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                  </div>
                </div>
              ) : (
                <div className={`message ${msg.role}`}>
                  <div className="msg-content" dangerouslySetInnerHTML={{ __html: msg.text }} />
                </div>
              )}
              {msg.options && (
                <div className="quick-actions">
                  {msg.options.map((opt, j) => (
                    <button key={j} className="action-chip" onClick={() => handleFlowSelection(opt)}>{opt}</button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {!persona && (
            <div className="persona-selection">
              <button className="persona-btn" onClick={() => handlePersonaSelect('general')}>
                <i className="fas fa-robot"></i><span>General Assistant</span>
              </button>
              <button className="persona-btn" onClick={() => handlePersonaSelect('technical')}>
                <i className="fas fa-microchip"></i><span>Technical Support</span>
              </button>
              <button className="persona-btn" onClick={() => handlePersonaSelect('billing')}>
                <i className="fas fa-file-invoice-dollar"></i><span>Billing &amp; Funds</span>
              </button>
            </div>
          )}
        </div>

        {/* Input footer */}
        <div className="chat-footer" style={{ display: showInput ? 'flex' : 'none' }}>
          <input
            type="text"
            placeholder="Type your question..."
            autoComplete="off"
            value={inputVal}
            maxLength={300}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button onClick={handleSend} aria-label="Send message">
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
