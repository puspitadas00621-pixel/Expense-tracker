/**
 * RupeeTrack - Application Logic
 * Standard Vanilla JS implementation with LocalStorage persistence, full CRUD (Add/Edit/Delete),
 * CSV export, dynamic search/filters, sorting, and Chart.js integration.
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

// Initial Sample Demo Data (Loaded if user has no saved expenses)
const INITIAL_DEMO_EXPENSES = [
  { id: '1', amount: 450, category: 'Food', date: getRelativeDate(0), description: 'Lunch with team' },
  { id: '2', amount: 1200, category: 'Bills', date: getRelativeDate(-1), description: 'Broadband Internet Bill' },
  { id: '3', amount: 850, category: 'Shopping', date: getRelativeDate(-2), description: 'New Shoes & Apparel' },
  { id: '4', amount: 250, category: 'Travel', date: getRelativeDate(-3), description: 'Taxi fare to office' },
  { id: '5', amount: 1500, category: 'Education', date: getRelativeDate(-5), description: 'Online Course Certificate' },
  { id: '6', amount: 600, category: 'Entertainment', date: getRelativeDate(-7), description: 'Movie tickets & popcorn' },
  { id: '7', amount: 320, category: 'Food', date: getRelativeDate(-10), description: 'Weekly groceries' }
];

// App State Variables
let expenses = [];
let categoryChart = null;

// DOM Elements Reference Object
const elements = {
  // Dashboard & Banner Nodes
  todayTotal: document.getElementById('today-total'),
  todayCount: document.getElementById('today-count'),
  monthTotal: document.getElementById('month-total'),
  monthName: document.getElementById('month-name'),
  totalCount: document.getElementById('total-count'),
  monthlyBannerAmount: document.querySelector('#monthly-summary-banner .highlight-amount'),
  
  // Modal & Form Nodes
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
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

function initApp() {
  // Set default date input to Today
  if (elements.expenseDate) {
    elements.expenseDate.value = getTodayDateString();
  }

  // Load saved expenses from LocalStorage
  const savedExpenses = localStorage.getItem('rupee_track_expenses');
  if (savedExpenses) {
    try {
      expenses = JSON.parse(savedExpenses);
    } catch (e) {
      console.error('Failed to parse localStorage data:', e);
      expenses = [...INITIAL_DEMO_EXPENSES];
    }
  } else {
    // Seed initial demo data for first time visitors
    expenses = [...INITIAL_DEMO_EXPENSES];
    saveExpensesToLocalStorage();
  }

  // Render initial UI components
  renderApp();
}

function setupEventListeners() {
  // Modal Trigger Buttons
  elements.addExpenseBtn.addEventListener('click', () => openModal('add'));
  elements.emptyAddBtn.addEventListener('click', () => openModal('add'));
  elements.closeModalBtn.addEventListener('click', closeModal);
  elements.cancelModalBtn.addEventListener('click', closeModal);
  
  // Close modal when clicking outside modal-card on backdrop
  elements.expenseModal.addEventListener('click', (e) => {
    if (e.target === elements.expenseModal) closeModal();
  });

  // ESC Key listener to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.expenseModal.classList.contains('active')) {
      closeModal();
    }
  });

  // Submit Add/Edit Expense Form
  elements.expenseForm.addEventListener('submit', handleAddOrUpdateExpense);

  // Search & Filters
  elements.searchInput.addEventListener('input', renderExpenseHistory);
  elements.filterCategory.addEventListener('change', renderExpenseHistory);
  elements.sortBy.addEventListener('change', renderExpenseHistory);

  // Additional Feature Actions
  elements.resetDataBtn.addEventListener('click', handleResetDemoData);
  elements.exportCsvBtn.addEventListener('click', exportExpensesToCSV);
}

// ==========================================
// Core Calculation & Render Functions
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
    
    // Total Today Calculation
    if (exp.date === todayStr) {
      todaySum += amount;
      todayTxCount++;
    }

    // Total This Month Calculation
    if (isDateInCurrentMonth(exp.date)) {
      monthSum += amount;
    }
  });

  const formattedToday = formatCurrency(todaySum);
  const formattedMonth = formatCurrency(monthSum);
  const totalTxCount = expenses.length;

  // DOM Updates
  elements.todayTotal.textContent = formattedToday;
  elements.todayCount.textContent = `${todayTxCount} transaction${todayTxCount === 1 ? '' : 's'} today`;
  
  elements.monthTotal.textContent = formattedMonth;
  elements.monthName.textContent = getMonthNameHeader();
  
  elements.totalCount.textContent = totalTxCount;
  
  // Requirement 7: Monthly Summary Banner Text
  elements.monthlyBannerAmount.textContent = formattedMonth;
}

function renderExpenseHistory() {
  const searchTerm = elements.searchInput.value.toLowerCase().trim();
  const selectedCategory = elements.filterCategory.value;
  const sortOption = elements.sortBy ? elements.sortBy.value : 'date-desc';

  // Search & Category Filtering
  let filtered = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm);
    const matchesCategory = (selectedCategory === 'All' || exp.category === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  // Sorting Logic
  filtered.sort((a, b) => {
    if (sortOption === 'date-asc') {
      return new Date(a.date) - new Date(b.date);
    } else if (sortOption === 'amount-desc') {
      return Number(b.amount) - Number(a.amount);
    } else if (sortOption === 'amount-asc') {
      return Number(a.amount) - Number(b.amount);
    } else {
      return new Date(b.date) - new Date(a.date); // Default: Newest first
    }
  });

  // Filter count badge
  elements.filteredCountBadge.textContent = `${filtered.length} Item${filtered.length === 1 ? '' : 's'}`;

  // Clear existing table contents
  elements.expenseListBody.innerHTML = '';

  if (filtered.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.expenseListBody.parentElement.classList.add('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.expenseListBody.parentElement.classList.remove('hidden');

  // Build rows dynamically
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
// CRUD Actions & Event Handlers
// ==========================================

function handleAddOrUpdateExpense(e) {
  e.preventDefault();

  const idVal = elements.expenseId ? elements.expenseId.value : '';
  const amountVal = parseFloat(elements.expenseAmount.value);
  const categoryVal = elements.expenseCategory.value;
  const dateVal = elements.expenseDate.value;
  const descriptionVal = elements.expenseDescription.value.trim();

  // Input Validation
  if (isNaN(amountVal) || amountVal <= 0) {
    showToast('Please enter a valid amount greater than 0.', 'danger');
    return;
  }
  if (!categoryVal) {
    showToast('Please select a valid expense category.', 'danger');
    return;
  }
  if (!dateVal) {
    showToast('Please select a valid date.', 'danger');
    return;
  }
  if (!descriptionVal) {
    showToast('Please enter a description for the expense.', 'danger');
    return;
  }

  if (idVal) {
    // EDIT MODE: Update existing expense
    const index = expenses.findIndex(exp => exp.id === idVal);
    if (index !== -1) {
      expenses[index] = {
        id: idVal,
        amount: amountVal,
        category: categoryVal,
        date: dateVal,
        description: descriptionVal
      };
      showToast('Expense updated successfully!', 'success');
    }
  } else {
    // ADD MODE: Create new expense object
    const newExpense = {
      id: Date.now().toString(),
      amount: amountVal,
      category: categoryVal,
      date: dateVal,
      description: descriptionVal
    };
    expenses.push(newExpense);
    showToast('Expense saved successfully!', 'success');
  }

  saveExpensesToLocalStorage();
  closeModal();
  renderApp();
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

function handleDeleteExpense(id) {
  const index = expenses.findIndex(exp => exp.id === id);
  if (index !== -1) {
    const deletedExp = expenses[index];
    expenses.splice(index, 1);
    saveExpensesToLocalStorage();
    renderApp();
    showToast(`Deleted "${deletedExp.description}" (₹${deletedExp.amount})`, 'danger');
  }
}

function handleResetDemoData() {
  if (confirm('Are you sure you want to reset expenses to initial sample data?')) {
    expenses = [...INITIAL_DEMO_EXPENSES];
    saveExpensesToLocalStorage();
    renderApp();
    showToast('Demo dataset restored successfully.', 'success');
  }
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
// Utility Helper Functions
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

function saveExpensesToLocalStorage() {
  localStorage.setItem('rupee_track_expenses', JSON.stringify(expenses));
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
  }, 3000);
}
