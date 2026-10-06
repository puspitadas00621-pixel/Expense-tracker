/**
 * RupeeTrack - Application Engine with Supabase Cloud Database Integration & Local Storage Fallback
 * Features: Full CRUD (Create, Read, Update, Delete) in Supabase PostgreSQL, Realtime Multi-Device Sync,
 * LocalStorage fallback mode, CSV Export, Interactive Chart.js charts, and category breakdown.
 */

// Category Config with Icons, Colors, and Badges
const CATEGORY_CONFIG = {
  Food: { icon: 'fa-utensils', color: '#f59e0b', bgClass: 'badge-food', label: 'Food' },
  Travel: { icon: 'fa-car', color: '#3b82f6', bgClass: 'badge-travel', label: 'Travel' },
  Shopping: { icon: 'fa-bag-shopping', color: '#ec4899', bgClass: 'badge-shopping', label: 'Shopping' },
  Education: { icon: 'fa-graduation-cap', color: '#8b5cf6', bgClass: 'badge-education', label: 'Education' },
  Entertainment: { icon: 'fa-film', color: '#ef4444', bgClass: 'badge-entertainment', label: 'Entertainment' },
  Bills: { icon: 'fa-lightbulb', color: '#10b981', bgClass: 'badge-bills', label: 'Bills' },
  Other: { icon: 'fa-box', color: '#64748b', bgClass: 'badge-other', label: 'Other' }
};

// Initial Sample Demo Data (Loaded when using LocalStorage without saved entries)
const INITIAL_DEMO_EXPENSES = [
  { id: '1', amount: 450, category: 'Food', date: getRelativeDate(0), description: 'Lunch with team' },
  { id: '2', amount: 1200, category: 'Bills', date: getRelativeDate(-1), description: 'Broadband Internet Bill' },
  { id: '3', amount: 850, category: 'Shopping', date: getRelativeDate(-2), description: 'New Running Shoes' },
  { id: '4', amount: 250, category: 'Travel', date: getRelativeDate(-3), description: 'Taxi fare to office' },
  { id: '5', amount: 1500, category: 'Education', date: getRelativeDate(-5), description: 'Online Course Certificate' },
  { id: '6', amount: 600, category: 'Entertainment', date: getRelativeDate(-7), description: 'Movie tickets & popcorn' },
  { id: '7', amount: 320, category: 'Food', date: getRelativeDate(-10), description: 'Weekly groceries' }
];

// App State Variables
let expenses = [];
let categoryChart = null;

// Supabase State Variables
let supabaseClient = null;
let isSupabaseConnected = false;
let supabaseChannel = null;

// DOM Elements Reference Object
const elements = {
  // Dashboard & Banner Nodes
  todayTotal: document.getElementById('today-total'),
  todayCount: document.getElementById('today-count'),
  monthTotal: document.getElementById('month-total'),
  monthName: document.getElementById('month-name'),
  totalCount: document.getElementById('total-count'),
  storageModeSubtext: document.getElementById('storage-mode-subtext'),
  monthlyBannerAmount: document.querySelector('#monthly-summary-banner .highlight-amount'),
  
  // Expense Modal & Form Nodes
  modalTitle: document.getElementById('modal-title'),
  addExpenseBtn: document.getElementById('add-expense-btn'),
  exportCsvBtn: document.getElementById('export-csv-btn'),
  resetDataBtn: document.getElementById('reset-data-btn'),
  expenseModal: document.getElementById('expense-modal'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelModalBtn: document.getElementById('cancel-modal-btn'),
  expenseForm: document.getElementById('expense-form'),
  expenseId: document.getElementById('expense-id'),
  expenseAmount: document.getElementById('expense-amount'),
  expenseCategory: document.getElementById('expense-category'),
  expenseDate: document.getElementById('expense-date'),
  expenseDescription: document.getElementById('expense-description'),

  // Supabase Config Modal & Form Nodes
  supabaseConfigBtn: document.getElementById('supabase-config-btn'),
  supabaseStatusText: document.getElementById('supabase-status-text'),
  supabaseModal: document.getElementById('supabase-modal'),
  closeSupabaseModalBtn: document.getElementById('close-supabase-modal-btn'),
  supabaseForm: document.getElementById('supabase-form'),
  supabaseUrlInput: document.getElementById('supabase-url'),
  supabaseKeyInput: document.getElementById('supabase-key'),
  supabaseStatusBox: document.getElementById('supabase-status-box'),
  supabaseConnectionMsg: document.getElementById('supabase-connection-msg'),
  connectSupabaseBtn: document.getElementById('connect-supabase-btn'),
  disconnectSupabaseBtn: document.getElementById('disconnect-supabase-btn'),
  copySqlBtn: document.getElementById('copy-sql-btn'),
  sqlSchemaCode: document.getElementById('sql-schema-code'),
  
  // History Table & Controls
  expenseListBody: document.getElementById('expense-list-body'),
  emptyState: document.getElementById('empty-state'),
  emptyAddBtn: document.getElementById('empty-add-btn'),
  searchInput: document.getElementById('search-input'),
  filterCategory: document.getElementById('filter-category'),
  sortBy: document.getElementById('sort-by'),
  filteredCountBadge: document.getElementById('filtered-count-badge'),
  
  // Chart & Breakdown Nodes
  categoryChartCanvas: document.getElementById('categoryChart'),
  noChartData: document.getElementById('no-chart-data'),
  categoryProgressList: document.getElementById('category-progress-list'),
  toastContainer: document.getElementById('toast-container')
};

// ==========================================
// Initialization & Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await initSupabaseClient();
  await loadAndRenderExpenses();
});

/**
 * Attempt to initialize Supabase client using stored credentials
 */
async function initSupabaseClient() {
  const savedConfig = localStorage.getItem('rupee_track_supabase_config');
  if (!savedConfig) {
    updateSupabaseUIStatus(false, 'Local Storage Mode (Click to configure Supabase Cloud)');
    return;
  }

  try {
    const { url, key } = JSON.parse(savedConfig);
    if (!url || !key) {
      updateSupabaseUIStatus(false, 'Local Storage Mode');
      return;
    }

    if (window.supabase) {
      supabaseClient = window.supabase.createClient(url, key);
      
      // Test table connection
      const { error } = await supabaseClient.from('expenses').select('id').limit(1);
      
      if (error) {
        console.warn('Supabase connection query warning:', error.message);
        // Table might not exist yet or RLS policy needs setup
        if (error.message.includes('relation "expenses" does not exist') || error.code === '42P01') {
          updateSupabaseUIStatus(false, 'Supabase Connected - Table "expenses" missing. Run SQL Setup!');
          showToast('Supabase connected, but "expenses" table was not found. Please run the SQL setup script.', 'danger');
          return;
        }
      }

      isSupabaseConnected = true;
      updateSupabaseUIStatus(true, 'Supabase Connected & Syncing');
      
      // Setup Realtime Sync Listener across tabs/devices
      subscribeToRealtimeSync();
    }
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
    isSupabaseConnected = false;
    updateSupabaseUIStatus(false, 'Supabase Error: ' + err.message);
  }
}

/**
 * Setup Realtime Database Subscription for instant cross-device updates
 */
function subscribeToRealtimeSync() {
  if (!supabaseClient) return;

  if (supabaseChannel) {
    supabaseClient.removeChannel(supabaseChannel);
  }

  supabaseChannel = supabaseClient
    .channel('public:expenses')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, async (payload) => {
      console.log('Realtime Postgres Change Received:', payload);
      await loadAndRenderExpenses(false);
    })
    .subscribe();
}

/**
 * Setup all DOM Event Listeners
 */
function setupEventListeners() {
  // Expense Modal Controls
  elements.addExpenseBtn.addEventListener('click', () => openModal('add'));
  elements.emptyAddBtn.addEventListener('click', () => openModal('add'));
  elements.closeModalBtn.addEventListener('click', closeModal);
  elements.cancelModalBtn.addEventListener('click', closeModal);
  
  elements.expenseModal.addEventListener('click', (e) => {
    if (e.target === elements.expenseModal) closeModal();
  });

  // Supabase Modal Controls
  elements.supabaseConfigBtn.addEventListener('click', openSupabaseModal);
  elements.closeSupabaseModalBtn.addEventListener('click', closeSupabaseModal);
  elements.supabaseModal.addEventListener('click', (e) => {
    if (e.target === elements.supabaseModal) closeSupabaseModal();
  });

  elements.supabaseForm.addEventListener('submit', handleConnectSupabase);
  elements.disconnectSupabaseBtn.addEventListener('click', handleDisconnectSupabase);
  elements.copySqlBtn.addEventListener('click', handleCopySql);

  // Global ESC Key Handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.expenseModal.classList.contains('active')) closeModal();
      if (elements.supabaseModal.classList.contains('active')) closeSupabaseModal();
    }
  });

  // Submit Add/Edit Expense Form
  elements.expenseForm.addEventListener('submit', handleAddOrUpdateExpense);

  // Search & Filters
  elements.searchInput.addEventListener('input', renderExpenseHistory);
  elements.filterCategory.addEventListener('change', renderExpenseHistory);
  elements.sortBy.addEventListener('change', renderExpenseHistory);

  // Action Buttons
  elements.resetDataBtn.addEventListener('click', handleResetDemoData);
  elements.exportCsvBtn.addEventListener('click', exportExpensesToCSV);
}

// ==========================================
// Unified Data Fetch & Sync Layer
// ==========================================

/**
 * Load expenses from Supabase or LocalStorage and trigger full UI render
 */
async function loadAndRenderExpenses(showLoadingToast = false) {
  if (isSupabaseConnected && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Failed to fetch from Supabase:', error);
        showToast('Error loading from Supabase: ' + error.message, 'danger');
        // Fallback to local
        expenses = loadFromLocalStorage();
      } else {
        expenses = data.map(item => ({
          id: item.id,
          amount: Number(item.amount),
          category: item.category,
          date: item.date,
          description: item.description
        }));
        if (showLoadingToast) {
          showToast('Loaded latest expenses from Supabase!', 'success');
        }
      }
    } catch (err) {
      console.error('Supabase fetch exception:', err);
      expenses = loadFromLocalStorage();
    }
  } else {
    // Local Storage Mode
    expenses = loadFromLocalStorage();
  }

  renderApp();
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('rupee_track_expenses');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse localStorage data:', e);
      return [...INITIAL_DEMO_EXPENSES];
    }
  } else {
    // Seed initial demo data for first time visitors
    const initial = [...INITIAL_DEMO_EXPENSES];
    localStorage.setItem('rupee_track_expenses', JSON.stringify(initial));
    return initial;
  }
}

function saveToLocalStorage() {
  localStorage.setItem('rupee_track_expenses', JSON.stringify(expenses));
}

// ==========================================
// Core Render & Calculations
// ==========================================

function renderApp() {
  updateDashboardStats();
  renderExpenseHistory();
  renderCategoryChart();
  renderCategoryBreakdown();
}

function updateDashboardStats() {
  const todayStr = getTodayDateString();

  let todaySum = 0;
  let todayTxCount = 0;
  let monthSum = 0;

  expenses.forEach(exp => {
    const amount = Number(exp.amount) || 0;
    
    if (exp.date === todayStr) {
      todaySum += amount;
      todayTxCount++;
    }

    if (isDateInCurrentMonth(exp.date)) {
      monthSum += amount;
    }
  });

  const formattedToday = formatCurrency(todaySum);
  const formattedMonth = formatCurrency(monthSum);
  const totalTxCount = expenses.length;

  elements.todayTotal.textContent = formattedToday;
  elements.todayCount.textContent = `${todayTxCount} transaction${todayTxCount === 1 ? '' : 's'} today`;
  
  elements.monthTotal.textContent = formattedMonth;
  elements.monthName.textContent = getMonthNameHeader();
  
  elements.totalCount.textContent = totalTxCount;
  elements.storageModeSubtext.textContent = isSupabaseConnected 
    ? 'Synced with Supabase Cloud' 
    : 'Stored in Browser LocalStorage';
  
  // Requirement 7: Monthly Summary Banner Text
  elements.monthlyBannerAmount.textContent = formattedMonth;
}

function renderExpenseHistory() {
  const searchTerm = elements.searchInput.value.toLowerCase().trim();
  const selectedCategory = elements.filterCategory.value;
  const sortOption = elements.sortBy ? elements.sortBy.value : 'date-desc';

  let filtered = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm);
    const matchesCategory = (selectedCategory === 'All' || exp.category === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  filtered.sort((a, b) => {
    if (sortOption === 'date-asc') {
      return new Date(a.date) - new Date(b.date);
    } else if (sortOption === 'amount-desc') {
      return Number(b.amount) - Number(a.amount);
    } else if (sortOption === 'amount-asc') {
      return Number(a.amount) - Number(b.amount);
    } else {
      return new Date(b.date) - new Date(a.date);
    }
  });

  elements.filteredCountBadge.textContent = `${filtered.length} Item${filtered.length === 1 ? '' : 's'}`;
  elements.expenseListBody.innerHTML = '';

  if (filtered.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.expenseListBody.parentElement.classList.add('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.expenseListBody.parentElement.classList.remove('hidden');

  filtered.forEach(exp => {
    const tr = document.createElement('tr');
    const catConfig = CATEGORY_CONFIG[exp.category] || CATEGORY_CONFIG.Other;

    tr.innerHTML = `
      <td class="font-medium">${formatDisplayDate(exp.date)}</td>
      <td>
        <span class="category-badge ${catConfig.bgClass}">
          <i class="fa-solid ${catConfig.icon}"></i> ${catConfig.label}
        </span>
      </td>
      <td>${escapeHtml(exp.description)}</td>
      <td class="text-right amount-text">${formatCurrency(exp.amount)}</td>
      <td class="text-center">
        <div class="action-buttons">
          <button class="btn-edit" onclick="handleEditExpense('${exp.id}')" title="Edit Expense">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-delete" onclick="handleDeleteExpense('${exp.id}')" title="Delete Expense">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;

    elements.expenseListBody.appendChild(tr);
  });
}

function renderCategoryChart() {
  const categoryTotals = calculateCategoryTotals();
  const activeCategories = Object.keys(categoryTotals).filter(cat => categoryTotals[cat] > 0);

  if (activeCategories.length === 0) {
    elements.noChartData.classList.remove('hidden');
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
    return;
  }

  elements.noChartData.classList.add('hidden');

  const labels = activeCategories;
  const dataValues = activeCategories.map(cat => categoryTotals[cat]);
  const backgroundColors = activeCategories.map(cat => CATEGORY_CONFIG[cat].color);

  if (categoryChart) {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = dataValues;
    categoryChart.data.datasets[0].backgroundColor = backgroundColors;
    categoryChart.update();
  } else {
    const ctx = elements.categoryChartCanvas.getContext('2d');
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 14,
              font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                return ` ${context.label}: ${formatCurrency(val)}`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }
}

function renderCategoryBreakdown() {
  const categoryTotals = calculateCategoryTotals();
  const grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  elements.categoryProgressList.innerHTML = '';

  const sortedCategories = Object.keys(categoryTotals)
    .filter(cat => categoryTotals[cat] > 0)
    .sort((a, b) => categoryTotals[b] - categoryTotals[a]);

  if (sortedCategories.length === 0) {
    elements.categoryProgressList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 20px 0;">
        No expense entries recorded yet.
      </div>
    `;
    return;
  }

  sortedCategories.forEach(cat => {
    const amount = categoryTotals[cat];
    const percentage = grandTotal > 0 ? ((amount / grandTotal) * 100).toFixed(1) : 0;
    const catConfig = CATEGORY_CONFIG[cat];

    const item = document.createElement('div');
    item.className = 'category-progress-item';
    item.innerHTML = `
      <div class="prog-info">
        <span class="prog-name">
          <i class="fa-solid ${catConfig.icon}" style="color: ${catConfig.color}"></i> ${catConfig.label}
        </span>
        <span class="prog-val">${formatCurrency(amount)} (${percentage}%)</span>
      </div>
      <div class="prog-bar-bg">
        <div class="prog-bar-fill" style="width: ${percentage}%; background-color: ${catConfig.color};"></div>
      </div>
    `;

    elements.categoryProgressList.appendChild(item);
  });
}

// ==========================================
// Expense CRUD Operations (Supabase & Local)
// ==========================================

async function handleAddOrUpdateExpense(e) {
  e.preventDefault();

  const idVal = elements.expenseId ? elements.expenseId.value : '';
  const amountVal = parseFloat(elements.expenseAmount.value);
  const categoryVal = elements.expenseCategory.value;
  const dateVal = elements.expenseDate.value;
  const descriptionVal = elements.expenseDescription.value.trim();

  // Validations
  if (isNaN(amountVal) || amountVal <= 0) {
    showToast('Please enter a valid amount greater than 0.', 'danger');
    return;
  }
  if (!categoryVal) {
    showToast('Please select a valid category.', 'danger');
    return;
  }
  if (!dateVal) {
    showToast('Please select a valid date.', 'danger');
    return;
  }
  if (!descriptionVal) {
    showToast('Please enter a description.', 'danger');
    return;
  }

  const expenseData = {
    amount: amountVal,
    category: categoryVal,
    date: dateVal,
    description: descriptionVal
  };

  closeModal();

  if (isSupabaseConnected && supabaseClient) {
    try {
      if (idVal) {
        // UPDATE in Supabase
        const { error } = await supabaseClient
          .from('expenses')
          .update(expenseData)
          .eq('id', idVal);

        if (error) throw error;
        showToast('Expense updated in Supabase cloud!', 'success');
      } else {
        // INSERT into Supabase
        const { error } = await supabaseClient
          .from('expenses')
          .insert([expenseData]);

        if (error) throw error;
        showToast('Expense saved to Supabase cloud!', 'success');
      }
      await loadAndRenderExpenses();
    } catch (err) {
      console.error('Supabase write error:', err);
      showToast('Supabase Error: ' + err.message, 'danger');
    }
  } else {
    // LOCAL STORAGE FALLBACK
    if (idVal) {
      const idx = expenses.findIndex(exp => exp.id === idVal);
      if (idx !== -1) {
        expenses[idx] = { id: idVal, ...expenseData };
        showToast('Expense updated locally!', 'success');
      }
    } else {
      const newExpense = { id: Date.now().toString(), ...expenseData };
      expenses.push(newExpense);
      showToast('Expense saved locally!', 'success');
    }
    saveToLocalStorage();
    renderApp();
  }
}

function handleEditExpense(id) {
  const expense = expenses.find(exp => exp.id === id);
  if (!expense) return;

  if (elements.expenseId) elements.expenseId.value = expense.id;
  elements.expenseAmount.value = expense.amount;
  elements.expenseCategory.value = expense.category;
  elements.expenseDate.value = expense.date;
  elements.expenseDescription.value = expense.description;

  elements.modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Expense`;
  elements.expenseModal.classList.add('active');
  elements.expenseAmount.focus();
}

async function handleDeleteExpense(id) {
  const deletedExp = expenses.find(exp => exp.id === id);
  if (!deletedExp) return;

  if (isSupabaseConnected && supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast(`Deleted "${deletedExp.description}" from Supabase!`, 'danger');
      await loadAndRenderExpenses();
    } catch (err) {
      console.error('Supabase delete error:', err);
      showToast('Supabase Delete Error: ' + err.message, 'danger');
    }
  } else {
    expenses = expenses.filter(exp => exp.id !== id);
    saveToLocalStorage();
    renderApp();
    showToast(`Deleted "${deletedExp.description}" locally`, 'danger');
  }
}

async function handleResetDemoData() {
  if (confirm('Are you sure you want to reset to initial sample demo expenses?')) {
    if (isSupabaseConnected && supabaseClient) {
      try {
        // Delete all rows in Supabase
        await supabaseClient.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        // Insert initial demo entries
        const demoInsert = INITIAL_DEMO_EXPENSES.map(item => ({
          amount: item.amount,
          category: item.category,
          date: item.date,
          description: item.description
        }));

        const { error } = await supabaseClient.from('expenses').insert(demoInsert);
        if (error) throw error;

        showToast('Supabase database reset to sample entries!', 'success');
        await loadAndRenderExpenses();
      } catch (err) {
        console.error('Supabase reset error:', err);
        showToast('Reset Error: ' + err.message, 'danger');
      }
    } else {
      expenses = [...INITIAL_DEMO_EXPENSES];
      saveToLocalStorage();
      renderApp();
      showToast('Demo dataset restored locally.', 'success');
    }
  }
}

// ==========================================
// Supabase Configuration Modal Logic
// ==========================================

function openSupabaseModal() {
  const savedConfig = localStorage.getItem('rupee_track_supabase_config');
  if (savedConfig) {
    try {
      const { url, key } = JSON.parse(savedConfig);
      elements.supabaseUrlInput.value = url || '';
      elements.supabaseKeyInput.value = key || '';
    } catch (e) {}
  }

  elements.supabaseModal.classList.add('active');
}

function closeSupabaseModal() {
  elements.supabaseModal.classList.remove('active');
}

async function handleConnectSupabase(e) {
  e.preventDefault();

  const url = elements.supabaseUrlInput.value.trim();
  const key = elements.supabaseKeyInput.value.trim();

  if (!url || !key) {
    showToast('Please enter both Supabase URL and Anon API Key.', 'danger');
    return;
  }

  elements.connectSupabaseBtn.disabled = true;
  elements.connectSupabaseBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Connecting...`;

  try {
    if (!window.supabase) {
      throw new Error('Supabase client library not loaded. Check internet connection.');
    }

    const testClient = window.supabase.createClient(url, key);
    
    // Test query on 'expenses' table
    const { error } = await testClient.from('expenses').select('id').limit(1);

    if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
      throw new Error('Connected to Supabase, but the "expenses" table does not exist. Please run the SQL setup script below!');
    } else if (error && error.status !== 200 && !error.message.includes('0 rows')) {
      throw new Error(error.message);
    }

    // Save configuration
    localStorage.setItem('rupee_track_supabase_config', JSON.stringify({ url, key }));
    supabaseClient = testClient;
    isSupabaseConnected = true;

    updateSupabaseUIStatus(true, 'Connected & Syncing with Supabase!');
    subscribeToRealtimeSync();

    closeSupabaseModal();
    showToast('Connected to Supabase! Syncing data across devices...', 'success');
    
    await loadAndRenderExpenses(true);
  } catch (err) {
    console.error('Supabase Connection Error:', err);
    updateSupabaseUIStatus(false, err.message);
    showToast(err.message, 'danger');
  } finally {
    elements.connectSupabaseBtn.disabled = false;
    elements.connectSupabaseBtn.innerHTML = `<i class="fa-solid fa-plug"></i> Connect & Sync`;
  }
}

function handleDisconnectSupabase() {
  localStorage.removeItem('rupee_track_supabase_config');
  supabaseClient = null;
  isSupabaseConnected = false;

  if (supabaseChannel) {
    supabaseClient?.removeChannel(supabaseChannel);
    supabaseChannel = null;
  }

  updateSupabaseUIStatus(false, 'Local Storage Mode');
  closeSupabaseModal();
  showToast('Switched to LocalStorage mode.', 'success');
  loadAndRenderExpenses();
}

function updateSupabaseUIStatus(connected, message) {
  if (connected) {
    elements.supabaseConfigBtn.className = 'btn btn-supabase connected';
    elements.supabaseStatusText.textContent = 'Supabase Sync 🟢';
    elements.supabaseStatusBox.className = 'supabase-status-box status-connected';
    elements.supabaseConnectionMsg.textContent = 'Status: ' + message;
  } else {
    elements.supabaseConfigBtn.className = 'btn btn-supabase';
    elements.supabaseStatusText.textContent = 'Supabase Sync';
    elements.supabaseStatusBox.className = 'supabase-status-box status-error';
    elements.supabaseConnectionMsg.textContent = 'Status: ' + message;
  }
}

function handleCopySql() {
  const codeText = elements.sqlSchemaCode.textContent;
  navigator.clipboard.writeText(codeText).then(() => {
    elements.copySqlBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
    showToast('SQL schema copied to clipboard!', 'success');
    setTimeout(() => {
      elements.copySqlBtn.innerHTML = `<i class="fa-solid fa-copy"></i> Copy SQL`;
    }, 2500);
  }).catch(err => {
    showToast('Failed to copy text: ' + err.message, 'danger');
  });
}

function exportExpensesToCSV() {
  if (expenses.length === 0) {
    showToast('No expenses available to export.', 'danger');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,ID,Date,Category,Description,Amount(INR)\n';
  expenses.forEach(exp => {
    const cleanDesc = `"${exp.description.replace(/"/g, '""')}"`;
    csvContent += `${exp.id},${exp.date},${exp.category},${cleanDesc},${exp.amount}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `rupeetrack_expenses_${getTodayDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Exported expenses to CSV file!', 'success');
}

// ==========================================
// Utility Helpers
// ==========================================

function openModal(mode = 'add') {
  if (mode === 'add') {
    elements.expenseForm.reset();
    if (elements.expenseId) elements.expenseId.value = '';
    elements.expenseDate.value = getTodayDateString();
    elements.modalTitle.innerHTML = `<i class="fa-solid fa-circle-plus"></i> Add New Expense`;
  }
  elements.expenseModal.classList.add('active');
  elements.expenseAmount.focus();
}

function closeModal() {
  elements.expenseModal.classList.remove('active');
  elements.expenseForm.reset();
  if (elements.expenseId) elements.expenseId.value = '';
}

function calculateCategoryTotals() {
  const totals = {
    Food: 0,
    Travel: 0,
    Shopping: 0,
    Education: 0,
    Entertainment: 0,
    Bills: 0,
    Other: 0
  };

  expenses.forEach(exp => {
    if (totals.hasOwnProperty(exp.category)) {
      totals[exp.category] += Number(exp.amount) || 0;
    } else {
      totals.Other += Number(exp.amount) || 0;
    }
  });

  return totals;
}

function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRelativeDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateInCurrentMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
}

function getMonthNameHeader() {
  const today = new Date();
  return today.toLocaleString('default', { month: 'long' });
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
    <span>${message}</span>
  `;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
