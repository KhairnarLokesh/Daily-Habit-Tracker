document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('addHabitForm');
    const input = document.getElementById('habitNameInput');
    const habitsList = document.getElementById('habitsList');
    const emptyState = document.getElementById('emptyState');
    const dateDisplay = document.getElementById('dateDisplay');
    const toastContainer = document.getElementById('toastContainer');
    const addBtn = document.getElementById('addBtn');

    // State
    const API_URL = '/api/habits';
    const USER_API_URL = '/api/user';
    let habits = [];
    let userStats = { xp: 0, level: 1 };
    let userId = '';
    let currentFilter = 'all';

    // Initialize User ID
    function initUser() {
        // 1. Check if URL contains ?userId= (from a shared link)
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');

        if (urlUserId) {
            // Overwrite local storage with the synced ID
            localStorage.setItem('habitUserId', urlUserId);
            // Clean up the URL so it looks nice
            window.history.replaceState({}, document.title, window.location.pathname);
            showToast('Device synced successfully!', 'success');
        }

        // 2. Get from local storage
        userId = localStorage.getItem('habitUserId');

        // 3. If still no ID, generate a new anonymous one
        if (!userId) {
            userId = 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('habitUserId', userId);
        }
    }

    initUser();

    // Sync Modal Elements
    const syncBtn = document.getElementById('syncBtn');
    const syncModal = document.getElementById('syncModal');
    const syncLinkInput = document.getElementById('syncLinkInput');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // Get today's string (YYYY-MM-DD local timezone)
    const getTodayString = () => {
        const today = new Date();
        const offset = today.getTimezoneOffset();
        today.setMinutes(today.getMinutes() - offset);
        return today.toISOString().split('T')[0];
    };

    const todayStr = getTodayString();

    // Display formatted date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = new Date().toLocaleDateString(undefined, options);

    // Initial Fetch
    fetchUserStats();
    fetchHabits();

    // Event Listeners
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const habitName = input.value.trim();
        const categoryInput = document.getElementById('habitCategoryInput');
        const category = categoryInput ? categoryInput.value : 'personal';

        if (!habitName) return;

        // UI Optimistic Update could go here, but let's just do a simple wait for MVP
        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId
                },
                body: JSON.stringify({ habitName, category })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to create habit');
            }

            input.value = '';
            showToast('Habit added successfully!', 'success');
            await fetchHabits();
            await fetchUserStats();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Habit';
        }
    });

    // Filter Buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderHabits();
        });
    });

    // Fetch Habits helper
    async function fetchHabits() {
        try {
            const res = await fetch(API_URL, {
                headers: {
                    'x-user-id': userId
                }
            });
            habits = await res.json();
            renderHabits();
        } catch (error) {
            showToast('Failed to load habits', 'error');
        }
    }

    // Fetch User Stats helper
    async function fetchUserStats() {
        try {
            const res = await fetch(USER_API_URL);
            userStats = await res.json();
            updateUserUI();
        } catch (error) {
            console.error('Failed to load user stats', error);
        }
    }

    function updateUserUI() {
        const levelDisplay = document.getElementById('userLevelDisplay');
        const xpDisplay = document.getElementById('userXpDisplay');
        const xpFill = document.getElementById('xpFillBar');

        if (!levelDisplay || !xpDisplay || !xpFill) return;

        levelDisplay.textContent = `Level ${userStats.level}`;

        // Calculate progress to next level
        const currentLevelXpStart = (userStats.level - 1) * 100;
        const nextLevelXpStart = userStats.level * 100;
        const xpInCurrentLevel = userStats.xp - currentLevelXpStart;

        xpDisplay.textContent = `${xpInCurrentLevel} / 100 XP`;

        const percentage = Math.min(100, Math.max(0, (xpInCurrentLevel / 100) * 100));
        xpFill.style.width = `${percentage}%`;
    }

    // Render Habits
    function renderHabits() {
        habitsList.innerHTML = '';

        const filteredHabits = currentFilter === 'all'
            ? habits
            : habits.filter(h => h.category === currentFilter);

        if (filteredHabits.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');

            filteredHabits.forEach(habit => {
                const isCompletedToday = habit.records && habit.records[todayStr] === true;
                const categoryLabel = habit.category ? habit.category.charAt(0).toUpperCase() + habit.category.slice(1) : 'Personal';

                // Calculate last 7 days for the heatmap
                let heatmapHTML = '';
                const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                const today = new Date();

                for (let i = 6; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const dStr = d.toISOString().split('T')[0];
                    const isDone = habit.records && habit.records[dStr] === true;
                    const dayName = days[d.getDay()];
                    const isToday = i === 0;

                    heatmapHTML += `
                        <div class="history-day ${isDone ? 'active' : ''} ${isToday ? 'today' : ''}" title="${dStr}">
                            ${dayName}
                        </div>
                    `;
                }

                const card = document.createElement('div');
                card.className = `habit-card ${isCompletedToday ? 'completed-today' : ''}`;

                card.innerHTML = `
                    <div class="habit-main">
                        <button class="btn-check ${isCompletedToday ? 'completed' : ''}" data-id="${habit._id}" aria-label="Toggle completion">
                            <i class="fas fa-check"></i>
                        </button>
                        <div class="habit-info">
                            <span class="habit-category-tag tag-${habit.category || 'personal'}">${categoryLabel}</span>
                            <div class="habit-name">${escapeHTML(habit.habitName)}</div>
                            <div class="habit-streak">
                                <i class="fas fa-fire streak-icon"></i>
                                <span class="streak-count">${habit.streakCount} day streak</span>
                            </div>
                        </div>
                        <div class="habit-actions">
                            <button class="btn-icon delete-btn" data-id="${habit._id}" title="Delete Habit">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="habit-history">
                        <div class="history-label">Last 7 Days</div>
                        <div class="history-days">
                            ${heatmapHTML}
                        </div>
                    </div>
                `;

                habitsList.appendChild(card);
            });

            attachCardEventListeners();
        }
    }

    function attachCardEventListeners() {
        const checkBtns = document.querySelectorAll('.btn-check');
        const deleteBtns = document.querySelectorAll('.delete-btn');

        checkBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                const isCompleted = btn.classList.contains('completed');
                await toggleHabitStatus(id, isCompleted);
            });
        });

        deleteBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this habit?')) {
                    await deleteHabit(id);
                }
            });
        });
    }

    async function toggleHabitStatus(id, currentlyCompleted) {
        const action = currentlyCompleted ? 'unmark' : 'mark';

        try {
            const res = await fetch(`${API_URL}/${id}/${action}`, {
                method: 'POST',
                headers: {
                    'x-user-id': userId
                }
            });

            if (!res.ok) throw new Error('Failed to update status');

            // Check for fun completion animation
            if (!currentlyCompleted) {
                showToast('Nice work! Streak updated 🔥', 'success');
            }

            await fetchHabits();
            await fetchUserStats();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function deleteHabit(id) {
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-user-id': userId
                }
            });

            if (!res.ok) throw new Error('Failed to delete habit');

            showToast('Habit deleted', 'success');
            fetchHabits();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // Modal Events
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            const syncUrl = `${window.location.origin}${window.location.pathname}?userId=${userId}`;
            syncLinkInput.value = syncUrl;
            syncModal.classList.remove('hidden');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            syncModal.classList.add('hidden');
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            syncLinkInput.select();
            document.execCommand('copy');
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkBtn.textContent = 'Copy';
            }, 2000);
        });
    }

    // Close modal on outside click
    syncModal.addEventListener('click', (e) => {
        if (e.target === syncModal) {
            syncModal.classList.add('hidden');
        }
    });

    // UI Utilities
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3000);
    }

    function escapeHTML(str) {
        // Basic escaping to prevent XSS
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('SW registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('SW registration failed:', error);
                });
        });
    }
});
