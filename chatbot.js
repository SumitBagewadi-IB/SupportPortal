/**
 * Indiabulls Securities Support Bot
 * Simulated AI logic and UI management
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. CHATBOT TEMPLATE
    const chatbotHTML = `
    <div id="indiabullsChatbot" class="chatbot-container">
        <!-- Chat Bubble -->
        <button id="chatbotTrigger" class="chatbot-bubble" aria-label="Open support chat">
            <i class="fas fa-comment-dots"></i>
            <span class="bubble-ping"></span>
        </button>

        <!-- Chat Window -->
        <div id="chatbotWindow" class="chat-window">
            <div class="chat-header">
                <div class="header-info">
                    <div class="bot-avatar" id="botAvatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div>
                        <h4 id="botName">Indiabulls Securities Assistant</h4>
                        <span class="online-status">Online · Returns in 2h</span>
                    </div>
                </div>
                <button id="closeChatbot" class="chat-close"><i class="fas fa-times"></i></button>
            </div>

            <div id="chatMessages" class="chat-body">
                <div class="message bot">
                    <div class="msg-content">
                        Hello! Please select a persona specialized for your query:
                    </div>
                </div>
                <!-- Persona Selection -->
                <div class="persona-selection">
                    <button class="persona-btn" data-persona="general">
                        <i class="fas fa-robot"></i>
                        <span>General Assistant</span>
                    </button>
                    <button class="persona-btn" data-persona="technical">
                        <i class="fas fa-microchip"></i>
                        <span>Technical Support</span>
                    </button>
                    <button class="persona-btn" data-persona="billing">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <span>Billing & Funds</span>
                    </button>
                </div>
            </div>

            <div class="chat-footer" style="display: none;">
                <input type="text" id="chatInput" placeholder="Type your question..." autocomplete="off">
                <button id="sendMessage"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    // 2. DOM ELEMENTS
    const container = document.getElementById('indiabullsChatbot');
    const trigger = document.getElementById('chatbotTrigger');
    const windowEl = document.getElementById('chatbotWindow');
    const closeBtn = document.getElementById('closeChatbot');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessage');
    const chatFooter = document.querySelector('.chat-footer');
    const botAvatar = document.getElementById('botAvatar');
    const botName = document.getElementById('botName');

    // 3. STATE & DATA
    let currentPersona = 'general';
    let currentFlow = null;
    let flowStep = 0;

    const personas = {
        general: { name: 'Indiabulls Securities Assistant', icon: 'fa-robot', color: '#3B82F6' },
        technical: { name: 'Tech Guru', icon: 'fa-microchip', color: '#00C805' },
        billing: { name: 'Finance Pro', icon: 'fa-file-invoice-dollar', color: '#A855F7' }
    };

    const kbArticles = [
        { id: 'open-account', title: 'How do I open an account with Indiabulls Securities?', cat: 'getting-started' },
        { id: 'gtt', title: 'How to place a GTT order?', cat: 'trading' },
        { id: 'basket', title: 'How to execute a Basket Order?', cat: 'trading' },
        { id: 'add-funds', title: 'How to add funds to my account?', cat: 'funds' },
        { id: 'withdraw', title: 'How long does fund withdrawal take?', cat: 'funds' },
        { id: 'algo', title: 'What is Indiabulls Algo and how to use it?', cat: 'advanced' },
        { id: 'ipo', title: 'How to apply for an IPO?', cat: 'advanced' },
        { id: 'segments', title: 'How to activate F&O segments?', cat: 'account' }
    ];

    const flows = {
        'gtt': [
            { text: "GTT (Good Till Trigger) is great for long-term targets. Are you trying to place a Buy or Sell GTT?", options: ['Buy GTT', 'Sell GTT'] },
            { text: "Got it. To place a GTT, search for the stock, click the 'GTT' icon (clock) near Buy/Sell. Do you see it?", options: ['Yes', 'No'] },
            { text: "Great! Enter your trigger price and limit price. It stays active for 1 year. Need a video demo?", options: ['Watch Demo', "I'm good"] }
        ],
        'funds': [
            { text: "Adding funds is instant via UPI. Have you tried the 'Add Funds' button yet?", options: ['Yes', 'Where is it?'] },
            { text: "It's in the top navigation under 'Funds'. What's the issue you're facing?", options: ['Payment Failed', 'Limit Error'] },
            { text: "If the payment failed but money was deducted, it usually reconciles in 2 hours. Should I check your ledger?", options: ['Yes, please', "No, I'll wait"] }
        ]
    };

    // 4. LOGIC
    function toggleChat() {
        windowEl.classList.toggle('active');
        container.classList.toggle('expanded');
    }

    function addMessage(text, sender = 'user', options = []) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.innerHTML = `<div class="msg-content">${text}</div>`;
        chatMessages.appendChild(msgDiv);

        if (options.length > 0) {
            const optDiv = document.createElement('div');
            optDiv.className = 'quick-actions';
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'action-chip';
                btn.textContent = opt;
                btn.onclick = () => handleFlowSelection(opt);
                optDiv.appendChild(btn);
            });
            chatMessages.appendChild(optDiv);
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `<div class="msg-content"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTyping() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    function handlePersonaSelect(personaKey) {
        currentPersona = personaKey;
        const p = personas[personaKey];
        botAvatar.innerHTML = `<i class="fas ${p.icon}"></i>`;
        botAvatar.style.background = p.color;
        botName.textContent = p.name;

        // Hide persona selection and show input
        const selectionEl = document.querySelector('.persona-selection');
        if (selectionEl) selectionEl.style.display = 'none';
        chatFooter.style.display = 'flex';

        addMessage(`Switched to **${p.name}**. I'm ready to help with your ${personaKey} queries!`, 'bot', ['GTT Issues', 'Funds Help', 'Open Account']);
    }

    function handleFlowSelection(option) {
        addMessage(option, 'user');
        showTyping();
        setTimeout(() => {
            removeTyping();
            if (currentFlow && flows[currentFlow][flowStep]) {
                flowStep++;
                const step = flows[currentFlow][flowStep];
                if (step) {
                    addMessage(step.text, 'bot', step.options);
                } else {
                    addMessage("Glad I could help! Is there anything else?", 'bot', ['Back to FAQ', 'Main Menu']);
                    currentFlow = null;
                    flowStep = 0;
                }
            } else {
                handleResponse(option);
            }
        }, 1000);
    }

    function handleResponse(text) {
        const lowerText = text.toLowerCase();

        // Trigger Flows
        if (lowerText.includes('gtt')) {
            currentFlow = 'gtt';
            flowStep = 0;
            addMessage(flows.gtt[0].text, 'bot', flows.gtt[0].options);
            return;
        }
        if (lowerText.includes('fund')) {
            currentFlow = 'funds';
            flowStep = 0;
            addMessage(flows.funds[0].text, 'bot', flows.funds[0].options);
            return;
        }

        // Knowledge Base Search
        const matches = kbArticles.filter(art =>
            art.title.toLowerCase().includes(lowerText) ||
            art.id.toLowerCase().includes(lowerText)
        );

        if (matches.length > 0) {
            let searchResp = "Here's what I found in our Knowledge Base:<br><br>";
            matches.forEach(art => {
                searchResp += `<a href="faq.html?cat=${art.cat}#" style="color:var(--green); font-weight:600; text-decoration:underline; display:block; margin-bottom:5px;">${art.title}</a>`;
            });
            addMessage(searchResp, 'bot');
        } else {
            addMessage("I'm not sure about that. Try asking about 'GTT' or 'Funds', or type 'Main Menu' to restart.", 'bot');
        }
    }

    function handleInput() {
        const text = chatInput.value.trim();
        if (!text) return;
        addMessage(text, 'user');
        chatInput.value = '';
        showTyping();
        setTimeout(() => {
            removeTyping();
            handleResponse(text);
        }, 1200);
    }

    // EVENT LISTENERS
    document.addEventListener('click', (e) => {
        const personaBtn = e.target.closest('.persona-btn');
        if (personaBtn) {
            handlePersonaSelect(personaBtn.dataset.persona);
        }

        if (e.target.classList.contains('action-chip') && !currentFlow) {
            handleResponse(e.target.textContent);
        }
    });

    if (trigger) trigger.addEventListener('click', toggleChat);
    if (closeBtn) closeBtn.addEventListener('click', toggleChat);
    if (sendBtn) sendBtn.addEventListener('click', handleInput);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleInput();
        });
    }

    // Auto-open on some pages or after delay (optional)
    // setTimeout(() => { if(!windowEl.classList.contains('active')) trigger.click(); }, 5000);
});
