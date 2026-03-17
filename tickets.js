/**
 * Indiabulls Securities Support — tickets.js
 * Handles: Ticket submission, local storage persistence, 
 *          and ticket listing display.
 */

document.addEventListener('DOMContentLoaded', () => {
    const ticketForm = document.getElementById('ticket-form');
    const ticketsContainer = document.getElementById('tickets-container');
    const ticketModal = document.getElementById('ticket-modal');
    const closeModal = document.getElementById('close-modal');
    const modalContent = document.getElementById('modal-content');

    /* ─────────────────────────────────────────
       1. INITIALIZE TICKETS
    ───────────────────────────────────────── */
    let tickets = JSON.parse(localStorage.getItem('is_tickets')) || [];

    /* ─────────────────────────────────────────
       2. TICKET SUBMISSION (contact.html)
    ───────────────────────────────────────── */
    if (ticketForm) {
        ticketForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const newTicket = {
                id: `TIC-${Math.floor(10000 + Math.random() * 90000)}`,
                timestamp: new Date().toISOString(),
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                category: document.getElementById('category').value,
                subject: document.getElementById('subject').value,
                description: document.getElementById('description').value,
                status: 'Open',
                priority: 'Medium'
            };

            tickets.unshift(newTicket);
            localStorage.setItem('is_tickets', JSON.stringify(tickets));

            // Show success message
            const formContainer = ticketForm.parentElement;
            const successHTML = `
                <div class="success-message" style="text-align: center; padding: 4rem 2rem; background: var(--bg); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); animation: fadeIn 0.5s ease-out;">
                    <div class="success-icon" style="width: 80px; height: 80px; background: var(--green-light); color: var(--green); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 2rem;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-dark); margin-bottom: 1rem;">Ticket Submitted!</h2>
                    <p style="color: var(--text-muted); font-size: 1rem; margin-bottom: 2rem;">Your ticket ID is <strong style="color:var(--text-dark)">${newTicket.id}</strong>. A confirmation has been sent to your email.</p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <a href="my-tickets.html" class="btn-primary" style="text-decoration: none; padding: 0.875rem 1.5rem;">View Tickets</a>
                        <button onclick="location.reload()" class="btn-secondary" style="padding: 0.875rem 1.5rem; font-weight: 600;">Submit Another</button>
                    </div>
                </div>
            `;
            formContainer.innerHTML = successHTML;
        });

        // Suggest articles based on subject
        const subjectInput = document.getElementById('subject');
        const suggestionBox = document.getElementById('suggested-articles');
        const suggestionsList = document.getElementById('suggestions-list');

        if (subjectInput) {
            subjectInput.addEventListener('input', () => {
                const query = subjectInput.value.toLowerCase();
                if (query.length < 3) {
                    suggestionBox.style.display = 'none';
                    return;
                }

                // Use the articles from chatbot.js logic (mock)
                const articles = [
                    { title: 'How to place a GTT order?', id: 'gtt', cat: 'trading' },
                    { title: 'How to add funds to my account?', id: 'add-funds', cat: 'funds' },
                    { title: 'How long does fund withdrawal take?', id: 'withdraw', cat: 'funds' },
                    { title: 'How to apply for an IPO?', id: 'trade-ipo-apply', cat: 'advanced' },
                    { title: 'How to activate F&O segments?', id: 'acc-fo-docs', cat: 'account-opening' },
                    { title: 'How to open NRO account?', id: 'acc-nro-open', cat: 'nri' },
                    { title: 'What are the brokerage charges?', id: 'charge-brokerage', cat: 'charges' },
                    { title: 'How to invest in Mutual Funds?', id: 'mf-how-to', cat: 'mutual-funds' },
                    { title: 'Mismatch in name during KYC?', id: 'acc-name-mismatch', cat: 'account-opening' }
                ];

                const matches = articles.filter(a => a.title.toLowerCase().includes(query));

                if (matches.length > 0) {
                    suggestionBox.style.display = 'block';
                    suggestionsList.innerHTML = matches.map(m => `
                        <a href="faq.html?cat=${m.cat}#${m.id}" target="_blank" class="suggestion-link">
                            <i class="far fa-file-alt"></i> ${m.title}
                        </a>
                    `).join('');
                } else {
                    suggestionBox.style.display = 'none';
                }
            });
        }
    }

    /* ─────────────────────────────────────────
       3. TICKET LISTING (my-tickets.html)
    ───────────────────────────────────────── */
    function renderTickets() {
        if (!ticketsContainer) return;

        // Update Stats
        const statTotal = document.getElementById('stat-total');
        const statOpen = document.getElementById('stat-open');
        const statSolved = document.getElementById('stat-solved');

        if (statTotal) statTotal.textContent = tickets.length;
        if (statOpen) statOpen.textContent = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
        if (statSolved) statSolved.textContent = tickets.filter(t => t.status === 'Closed' || t.status === 'Resolved').length;

        if (tickets.length === 0) {
            ticketsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ticket-alt"></i>
                    <p>You haven't submitted any tickets yet.</p>
                    <a href="contact.html" class="btn-primary" style="display: inline-block; margin-top: 1.5rem; text-decoration: none;">Submit a Ticket</a>
                </div>
            `;
            return;
        }

        ticketsContainer.innerHTML = tickets.map(t => `
            <div class="ticket-card" data-id="${t.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <span class="ticket-id">${t.id}</span>
                        <h3 class="ticket-subject">${t.subject}</h3>
                    </div>
                    <span class="status-badge ${t.status.toLowerCase().replace(' ', '-')}">
                        ${t.status}
                    </span>
                </div>
                <div class="ticket-meta">
                    <span>${new Date(t.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>Category: ${t.category.charAt(0).toUpperCase() + t.category.slice(1)}</span>
                </div>
            </div>
        `).join('');

        // Add click events to cards
        document.querySelectorAll('.ticket-card').forEach(card => {
            card.addEventListener('click', () => {
                const ticket = tickets.find(t => t.id === card.dataset.id);
                if (ticket) openTicketModal(ticket);
            });
        });
    }

    function openTicketModal(t) {
        if (!ticketModal || !modalContent) return;

        // Apply dark mode compatible styles to modal content
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        modalContent.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <span class="ticket-id">${t.id}</span>
                <h2 style="font-size: 1.75rem; font-weight: 800; margin-top: 0.5rem; line-height: 1.2; color: var(--text-dark);">${t.subject}</h2>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; background: var(--bg-subtle); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                <div>
                    <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 700; text-transform: uppercase;">Status</label>
                    <span class="status-badge ${t.status.toLowerCase()}">${t.status}</span>
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 700; text-transform: uppercase;">Submitted On</label>
                    <span style="font-weight: 600; color: var(--text-dark);">${new Date(t.timestamp).toLocaleString()}</span>
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 700; text-transform: uppercase;">Category</label>
                    <span style="font-weight: 600; color: var(--text-dark);">${t.category.charAt(0).toUpperCase() + t.category.slice(1)}</span>
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 700; text-transform: uppercase;">Priority</label>
                    <span style="font-weight: 600; color: var(--text-dark);">${t.priority}</span>
                </div>
            </div>

            <div style="margin-bottom: 2rem;">
                <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700;">Description</label>
                <p style="line-height: 1.6; white-space: pre-line; color: var(--text-mid);">${t.description}</p>
            </div>

            <div style="border-top: 1px solid var(--border); padding-top: 1.5rem; text-align: right;">
                <button id="modal-close-btn-bottom" class="btn-primary" style="padding: 0.75rem 1.5rem;">Close Ticket</button>
            </div>
        `;

        // Adjust modal background for theme
        ticketModal.querySelector('div').style.background = 'var(--bg)';
        ticketModal.querySelector('div').style.border = '1px solid var(--border)';

        ticketModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const btn = document.getElementById('modal-close-btn-bottom');
        if (btn) btn.onclick = closeTicketModal;
    }

    function closeTicketModal() {
        if (ticketModal) {
            ticketModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    if (closeModal) closeModal.addEventListener('click', closeTicketModal);
    if (ticketModal) {
        ticketModal.addEventListener('click', (e) => {
            if (e.target === ticketModal) closeTicketModal();
        });
    }

    // Initial render
    renderTickets();
});
