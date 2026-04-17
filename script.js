document.addEventListener('DOMContentLoaded', () => {
    const scanBtn = document.getElementById('scan-btn');
    const fileInput = document.getElementById('file-input');
    
    // Views
    const vScanner = document.getElementById('view-scanner');
    const vLoading = document.getElementById('view-loading');
    const vResult = document.getElementById('view-result');

    // Modals & Header Actions
    const historyModal = document.getElementById('history-modal');
    const authModal = document.getElementById('auth-modal');
    const pricingModal = document.getElementById('pricing-modal');
    const profileBtn = document.getElementById('profile-btn');
    const buyScansBtn = document.getElementById('buy-scans-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const closeAuthBtn = document.getElementById('close-auth-btn');
    const closePricingBtn = document.getElementById('close-pricing-btn');
    const logoutBtn = document.getElementById('logout-btn');

    let pendingFiles = [];
    let currentUser = null;

    // --- INIT APP ---

    // Check for an existing session on page load
    (async () => {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                currentUser = await res.json();
            }
        } catch(e) {}
    })();

    // Profile icon: show auth modal if not logged in, history if logged in
    profileBtn.addEventListener('click', () => {
        if (currentUser) {
            document.getElementById('history-username').textContent = currentUser.username;
            document.getElementById('history-avatar').textContent = currentUser.username[0].toUpperCase();
            historyModal.classList.remove('hidden');
            loadHistory();
        } else {
            authModal.classList.remove('hidden');
        }
    });

    closeHistoryBtn.addEventListener('click', () => {
        historyModal.classList.add('hidden');
    });

    // Close modals on overlay click
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) historyModal.classList.add('hidden');
    });
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) authModal.classList.add('hidden');
    });
    pricingModal.addEventListener('click', (e) => {
        if (e.target === pricingModal) pricingModal.classList.add('hidden');
    });

    // --- PRICING LOGIC ---

    buyScansBtn.addEventListener('click', () => {
        initPricing();
        pricingModal.classList.remove('hidden');
    });

    closePricingBtn.addEventListener('click', () => {
        pricingModal.classList.add('hidden');
    });

    function initPricing() {
        const grid = document.getElementById('pricing-grid');
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        const offset = new Date().getTimezoneOffset(); // in minutes
        
        // Detect India (+5:30)
        const isIndia = timezone.includes('Kolkata') || 
                        timezone.includes('Calcutta') || 
                        offset === -330;

        const plans = isIndia ? [
            { scans: 30, price: '₹100', popular: false, badge: '' },
            { scans: 85, price: '₹250', popular: true, badge: 'Best Value' },
            { scans: 180, price: '₹500', popular: false, badge: 'Pro' },
            { scans: 400, price: '₹1000', popular: false, badge: 'Power User' }
        ] : [
            { scans: 30, price: '$1.25', popular: false, badge: '' },
            { scans: 85, price: '$2.99', popular: true, badge: 'Best Value' },
            { scans: 180, price: '$5.99', popular: false, badge: 'Pro' },
            { scans: 400, price: '$11.99', popular: false, badge: 'Power User' }
        ];

        grid.innerHTML = plans.map(plan => `
            <div class="pricing-card ${plan.popular ? 'popular' : ''}" onclick="purchaseClick()">
                ${plan.badge ? `<div class="popular-badge">${plan.badge}</div>` : ''}
                <div class="card-scans">${plan.scans}</div>
                <div class="card-label">Scans</div>
                <div class="card-price">${plan.price}</div>
            </div>
        `).join('');
    }

    window.purchaseClick = () => {
        alert("Payments will be added shortly");
    };

    // --- AUTH MODAL LOGIC ---

    closeAuthBtn.addEventListener('click', () => authModal.classList.add('hidden'));

    // Tab switching
    document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchAuthTab('register'));

    function switchAuthTab(tab) {
        document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
        document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
        document.getElementById('tab-login').classList.toggle('active', tab === 'login');
        document.getElementById('tab-register').classList.toggle('active', tab === 'register');
        document.getElementById('login-error').classList.add('hidden');
        document.getElementById('reg-error').classList.add('hidden');
    }

    // Login form
    document.getElementById('login-submit-btn').addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.classList.add('hidden');

        if (!username || !password) {
            errorEl.textContent = 'Please fill in all fields.';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                errorEl.textContent = data.error || 'Login failed.';
                errorEl.classList.remove('hidden');
            } else {
                currentUser = { username };
                document.getElementById('login-username').value = '';
                document.getElementById('login-password').value = '';
                authModal.classList.add('hidden');
                document.getElementById('history-username').textContent = username;
                document.getElementById('history-avatar').textContent = username[0].toUpperCase();
                historyModal.classList.remove('hidden');
                loadHistory();
            }
        } catch(e) {
            errorEl.textContent = 'Network error. Please try again.';
            errorEl.classList.remove('hidden');
        }
    });

    // Register form
    document.getElementById('reg-submit-btn').addEventListener('click', async () => {
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const errorEl = document.getElementById('reg-error');
        errorEl.classList.add('hidden');

        if (!username || !password) {
            errorEl.textContent = 'Please fill in all fields.';
            errorEl.classList.remove('hidden');
            return;
        }
        if (password.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters.';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                errorEl.textContent = data.error || 'Registration failed.';
                errorEl.classList.remove('hidden');
            } else {
                currentUser = { username };
                document.getElementById('reg-username').value = '';
                document.getElementById('reg-password').value = '';
                authModal.classList.add('hidden');
                document.getElementById('history-username').textContent = username;
                document.getElementById('history-avatar').textContent = username[0].toUpperCase();
                historyModal.classList.remove('hidden');
                loadHistory();
            }
        } catch(e) {
            errorEl.textContent = 'Network error. Please try again.';
            errorEl.classList.remove('hidden');
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        try { await fetch('/api/logout'); } catch(e) {}
        currentUser = null;
        historyModal.classList.add('hidden');
    });

    // --- SCANNING LOGIC ---

    // Trigger file input
    scanBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            for(let i=0; i < this.files.length; i++) {
                pendingFiles.push(this.files[i]);
                renderThumbnail(this.files[i]);
            }
            document.getElementById('staging-area').classList.remove('hidden');
        }
        // clear input so same file can be selected again if needed
        this.value = '';
    });

    function renderThumbnail(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'thumb-preview';
            document.getElementById('thumbnails-container').appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('analyze-btn').addEventListener('click', async () => {
        if(pendingFiles.length > 0) {
            await processImages(pendingFiles);
        }
    });

    // Converts **bold** markdown to <strong> tags
    function parseBold(text) {
        return (text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    async function processImages(fileList) {
        // Show preview of the first image in loading screen
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('preview-img').src = e.target.result;
            document.getElementById('res-img').src = e.target.result;
        };
        reader.readAsDataURL(fileList[0]);

        // Switch to Loading View
        changeView(vLoading);

        // Fake stage text rotation during actual network request
        const stages = ["Identifying brand markers", "Analyzing wear & tear", "Querying market archives", "Calculating value"];
        let stageIdx = 0;
        const stageEl = document.getElementById('loading-stage');
        const stageInterval = setInterval(() => {
            stageIdx = (stageIdx + 1) % stages.length;
            stageEl.textContent = stages[stageIdx];
        }, 1500);

        try {
            // Send actual request
            const formData = new FormData();
            for (let i = 0; i < fileList.length; i++) {
                formData.append('images', fileList[i]);
            }
            // Append timezone so backend knows the location
            formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);

            const res = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'API Error');
            
            // Render data
            document.getElementById('res-brand').textContent = data.brand || 'Unknown';
            document.getElementById('res-type').textContent = data.type || 'Item';
            document.getElementById('res-og-value').textContent = data.originalPrice || 'N/A';
            document.getElementById('res-value').textContent = data.thriftPrice || 'N/A';
            document.getElementById('res-era').textContent = data.era || 'Unknown';
            document.getElementById('res-history').textContent = data.history || 'No history available.';
            document.getElementById('res-auth').textContent = `${data.authScore || '--'}% Authentic`;

            // Handle Rarity Stars
            const starsContainer = document.getElementById('res-stars');
            starsContainer.innerHTML = '';
            const starsCount = data.rarityStars || 0;
            for(let i = 1; i <= 5; i++) {
                const star = document.createElement('i');
                star.className = i <= starsCount ? 'ph-fill ph-star' : 'ph ph-star empty';
                starsContainer.appendChild(star);
            }

            // Handle Market Links Details Block
            const linkWrapper = document.getElementById('res-link-wrapper');
            const linksContainer = document.getElementById('links-container');
            // reset options
            linksContainer.innerHTML = '';
            
            if (data.marketLinks && Array.isArray(data.marketLinks) && data.marketLinks.length > 0) {
                data.marketLinks.forEach((link, idx) => {
                    if(link && link.startsWith('http')) {
                        const a = document.createElement('a');
                        a.href = link;
                        a.target = '_blank';
                        a.className = 'market-link';
                        
                        try {
                            const domain = new URL(link).hostname.replace('www.', '');
                            a.innerHTML = `<i class="ph ph-link"></i> Listing on ${domain}`;
                        } catch(e) {
                            a.innerHTML = `<i class="ph ph-link"></i> Market Link ${idx + 1}`;
                        }
                        linksContainer.appendChild(a);
                    }
                });
                linkWrapper.classList.remove('hidden');
                document.getElementById('res-links-dropdown').removeAttribute('open');
            } else {
                linkWrapper.classList.add('hidden');
            }

            // Handle Authentication Tips — parse **bold** markdown
            document.getElementById('res-auth-tips').innerHTML = parseBold(data.authTips || 'No specific authentication information available for this item.');

            // Clear interval & Switch to Result View
            clearInterval(stageInterval);
            changeView(vResult);

        } catch (error) {
            clearInterval(stageInterval);
            if (error.message.includes('limit reached')) {
                alert("Scan Limit Reached: " + error.message);
            } else {
                alert("Error analyzing item: " + error.message);
            }
            resetApp();
        }
    }

    function changeView(viewElement) {
        document.querySelectorAll('.view-scanner, .view-loading, .view-result').forEach(el => el.classList.remove('active'));
        viewElement.classList.add('active');
    }

    window.resetApp = function() {
        pendingFiles = [];
        document.getElementById('thumbnails-container').innerHTML = '';
        document.getElementById('staging-area').classList.add('hidden');
        fileInput.value = '';
        changeView(vScanner);
    }

    // --- HISTORY LOGIC ---
    async function loadHistory() {
        const list = document.getElementById('history-list');
        const statDone = document.getElementById('stat-scans-done');
        list.innerHTML = `<p class="hint-text" style="text-align:center; margin-top:1rem; grid-column:1/-1;">Loading...</p>`;

        try {
            const res = await fetch('/api/history');
            if (res.ok) {
                const scans = await res.json();

                // Update stats
                statDone.textContent = scans.length;
                
                // Update Available Scans from currentUser or fresh fetch
                const userRes = await fetch('/api/me');
                if (userRes.ok) {
                    const userData = await userRes.json();
                    const scansLeftEl = document.querySelector('.stat-box-muted .stat-value');
                    if (scansLeftEl) {
                        scansLeftEl.textContent = '∞';
                        scansLeftEl.style.fontSize = '2.2rem';
                    }
                }

                list.innerHTML = '';

                if (scans.length === 0) {
                    list.innerHTML = `<p class="hint-text" style="text-align:center; margin-top:1rem; grid-column:1/-1;">No scans yet. Start scanning!</p>`;
                    return;
                }

                scans.forEach(scan => {
                    const card = document.createElement('div');
                    card.className = 'scan-grid-card';
                    const initialOrImage = scan.image_path 
                        ? `<div class="scan-grid-img" style="background-image: url('${scan.image_path}')"></div>`
                        : `<div class="scan-grid-initial">${(scan.brand || '?')[0].toUpperCase()}</div>`;
                    
                    const d = new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    card.innerHTML = `
                        ${initialOrImage}
                        <div class="scan-grid-info">
                            <span class="scan-grid-brand">${scan.brand || 'Unknown'}</span>
                            <span class="scan-grid-type">${scan.type || 'Item'}</span>
                            <div class="scan-grid-footer">
                                <span class="scan-grid-price">${scan.thriftPrice || '--'}</span>
                                <span class="scan-grid-auth">${scan.authScore || '--'}%</span>
                            </div>
                            <span class="scan-grid-date">${d}</span>
                        </div>
                    `;
                    list.appendChild(card);
                });
            } else {
                list.innerHTML = `<p class="hint-text" style="text-align:center; margin-top:1rem; grid-column:1/-1;">Could not load history.</p>`;
            }
        } catch(e) {
            console.error(e);
            list.innerHTML = `<p class="hint-text" style="text-align:center; margin-top:1rem; grid-column:1/-1;">Could not load history.</p>`;
        }
    }

});
