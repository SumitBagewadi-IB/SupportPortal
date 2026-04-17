'use client';

import { useState } from 'react';

type Persona = 'general' | 'technical' | 'billing';

interface Message {
  role: 'bot' | 'user';
  text: string;
}

const FLOWS: Record<Persona, { intro: string; options: { label: string; answer: string }[] }> = {
  general: {
    intro: "Hi! I'm your General Support assistant. How can I help you today?",
    options: [
      { label: 'How do I open an account?', answer: 'You can open an account online at indiabulls.com. The process takes about 10 minutes and requires PAN, Aadhaar, and bank details.' },
      { label: 'How do I reset my password?', answer: 'Go to the login page and click "Forgot Password". Enter your Client ID or registered email to receive a reset link.' },
      { label: 'What are trading hours?', answer: 'Equity markets trade from 9:15 AM to 3:30 PM, Monday to Friday (except market holidays). F&O has the same hours.' },
    ],
  },
  technical: {
    intro: "Hi! I'm your Technical Support assistant. What technical issue are you facing?",
    options: [
      { label: 'What is GTT?', answer: 'GTT (Good Till Triggered) lets you place orders that execute automatically when a stock hits your target price. Go to the stock details page and click "Set Alert / GTT".' },
      { label: 'App not loading / crashing', answer: 'Try clearing your app cache, ensure you have the latest version installed, and check your internet connection. If issues persist, reinstall the app.' },
      { label: 'Order not executing', answer: 'Check your available margin, ensure the stock is not in the F&O ban list, and verify the order type and price. Also check if the market is open.' },
    ],
  },
  billing: {
    intro: "Hi! I'm your Billing Support assistant. What would you like to know about charges?",
    options: [
      { label: 'How do I add funds?', answer: 'Go to Funds > Add Funds in the app. You can use UPI, NEFT, IMPS, or Net Banking. Funds are credited instantly via UPI.' },
      { label: 'What are the brokerage charges?', answer: 'Equity delivery: 0%, Intraday: 0.05% or Rs 20 per order (whichever is lower). F&O: Rs 20 per order flat.' },
      { label: 'How do I withdraw funds?', answer: 'Go to Funds > Withdraw. Withdrawals are processed within 1 working day to your registered bank account.' },
    ],
  },
};

export default function FloatingChatbot() {
  const [open, setOpen] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const selectPersona = (p: Persona) => {
    setPersona(p);
    setMessages([{ role: 'bot', text: FLOWS[p].intro }]);
  };

  const handleOption = (option: { label: string; answer: string }) => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: option.label },
      { role: 'bot', text: option.answer },
    ]);
  };

  const reset = () => {
    setPersona(null);
    setMessages([]);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        style={{ backgroundColor: '#00AB4E' }}
        aria-label="Open chat"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#00AB4E' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">IB Support</p>
                <p className="text-green-100 text-xs">Online</p>
              </div>
            </div>
            {persona && (
              <button onClick={reset} className="text-white/80 hover:text-white text-xs underline">
                Back
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
            {!persona ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                  Choose a support category:
                </p>
                {(['general', 'technical', 'billing'] as Persona[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => selectPersona(p)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors capitalize"
                  >
                    {p === 'general' ? 'General Support' : p === 'technical' ? 'Technical Support' : 'Billing & Charges'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                        msg.role === 'user'
                          ? 'text-white rounded-br-none'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-bl-none'
                      }`}
                      style={msg.role === 'user' ? { backgroundColor: '#00AB4E' } : {}}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Quick reply options */}
                {persona && messages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Quick questions:</p>
                    {FLOWS[persona].options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleOption(opt)}
                        className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <a
              href="/contact"
              className="block text-center text-xs font-medium py-2 rounded-lg text-white transition-colors"
              style={{ backgroundColor: '#00AB4E' }}
            >
              Raise a Support Ticket
            </a>
          </div>
        </div>
      )}
    </>
  );
}
