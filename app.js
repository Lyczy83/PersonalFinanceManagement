(() => {
  'use strict';

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_UNCOMPRESSED_FILE_SIZE = 50 * 1024 * 1024;
  const MAX_IMPORT_ROWS = 50000;
  const COLORS = ['#4b9b70', '#e3a34f', '#718bd0', '#db7865', '#9c78bf', '#49a9a3', '#d080a0', '#91a34f', '#db8a4c', '#78909b'];
  const DEFAULT_CATEGORIES = ['Food & dining', 'Transport', 'Shopping', 'Home', 'Health', 'Bills', 'Travel', 'Income', 'Entertainment', 'Other', 'Uncategorized'];
  const BUDGET_IDS = ['erste', 'bnp'];
  const BNP_SPENDING_GROUPS = [
    { id: 'fixed', name: 'Stałe koszty + Nala' },
    { id: 'ike', name: 'IKE' },
    { id: 'rehab', name: 'Rehabilitacja + basen' },
    { id: 'therapy', name: 'Terapia' },
    { id: 'variable', name: 'Bieżące wydatki' },
    { id: 'mother', name: 'Przelew do mamy' }
  ];
  const DEFAULT_BNP_GROUP_TARGETS = {
    fixed: 6000,
    ike: 500,
    rehab: 1000,
    therapy: 1400,
    variable: 3000,
    mother: null
  };
  const DEFAULT_BNP_CATEGORY_GROUPS = {
    'Nala': 'fixed',
    'Rachunki': 'fixed',
    'Spłata kredytu': 'fixed',
    'Sprzątanie': 'fixed',
    'Ubezpieczenia': 'fixed',
    'Zlecenie stałe': 'ike',
    'Rehabilitacja': 'rehab',
    'Terapia': 'therapy',
    'Zakupy domowe': 'variable',
    'Przelew wychodzący': 'mother'
  };
  const currency = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

  const el = {
    storageStatus: document.querySelector('#storage-status'),
    storageError: document.querySelector('#storage-error'),
    file: document.querySelector('#file-input'),
    budgetErste: document.querySelector('#budget-erste'),
    budgetBnp: document.querySelector('#budget-bnp'),
    previous: document.querySelector('#previous-month'),
    next: document.querySelector('#next-month'),
    month: document.querySelector('#month-label'),
    periodEyebrow: document.querySelector('#period-eyebrow'),
    periodSelect: document.querySelector('#period-select'),
    customRange: document.querySelector('#custom-range'),
    rangeStart: document.querySelector('#range-start'),
    rangeEnd: document.querySelector('#range-end'),
    categoryInput: document.querySelector('#new-category'),
    addCategory: document.querySelector('#add-category'),
    manageCategories: document.querySelector('#manage-categories'),
    categoryDialog: document.querySelector('#category-dialog'),
    categoryList: document.querySelector('#category-list'),
    closeCategories: document.querySelector('#close-categories'),
    cancelCategories: document.querySelector('#cancel-categories'),
    saveCategories: document.querySelector('#save-categories'),
    categoryError: document.querySelector('#category-error'),
    importReviewDialog: document.querySelector('#import-review-dialog'),
    importReviewTitle: document.querySelector('#import-review-title'),
    importReviewList: document.querySelector('#import-review-list'),
    importReviewError: document.querySelector('#import-review-error'),
    closeImportReview: document.querySelector('#close-import-review'),
    skipImportReview: document.querySelector('#skip-import-review'),
    saveImportReview: document.querySelector('#save-import-review'),
    net: document.querySelector('#net-total'),
    income: document.querySelector('#income-total'),
    incomeCaption: document.querySelector('#income-caption'),
    expense: document.querySelector('#expense-total'),
    expenseCaption: document.querySelector('#expense-caption'),
    chartPeriod: document.querySelector('#chart-period'),
    segments: document.querySelector('#donut-segments'),
    donutTotal: document.querySelector('#donut-total'),
    legend: document.querySelector('#category-legend'),
    categoryTooltip: document.querySelector('#category-tooltip'),
    categoryTransactionsDialog: document.querySelector('#category-transactions-dialog'),
    categoryTransactionsTitle: document.querySelector('#category-transactions-title'),
    categoryTransactionsSummary: document.querySelector('#category-transactions-summary'),
    categoryTransactionsList: document.querySelector('#category-transactions-list'),
    closeCategoryTransactions: document.querySelector('#close-category-transactions'),
    cashflowChart: document.querySelector('#cashflow-chart'),
    cashflowEmpty: document.querySelector('#cashflow-empty'),
    cashflowGranularity: document.querySelector('#cashflow-granularity'),
    cashflowNote: document.querySelector('#cashflow-note'),
    list: document.querySelector('#transaction-list'),
    transactionSummary: document.querySelector('#transaction-summary'),
    count: document.querySelector('#transaction-count'),
    transactionSort: document.querySelector('#transaction-sort'),
    categoryFilter: document.querySelector('#category-filter'),
    categoryFilterSummary: document.querySelector('#category-filter-summary'),
    categoryFilterSearch: document.querySelector('#category-filter-search'),
    categoryFilterOptions: document.querySelector('#category-filter-options'),
    categoryFilterEmpty: document.querySelector('#category-filter-empty'),
    clearCategoryFilter: document.querySelector('#clear-category-filter'),
    hideExcluded: document.querySelector('#hide-excluded'),
    spendingGroups: document.querySelector('#spending-groups'),
    spendingGroupList: document.querySelector('#spending-group-list'),
    reviewDuplicates: document.querySelector('#review-duplicates'),
    duplicateCount: document.querySelector('#duplicate-count'),
    duplicateDialog: document.querySelector('#duplicate-dialog'),
    duplicateList: document.querySelector('#duplicate-list'),
    duplicateHelp: document.querySelector('#duplicate-help'),
    closeDuplicates: document.querySelector('#close-duplicates'),
    dialog: document.querySelector('#split-dialog'),
    splitForm: document.querySelector('#split-form'),
    splitDescription: document.querySelector('#split-description'),
    splitRows: document.querySelector('#split-rows'),
    splitTotal: document.querySelector('#split-total'),
    splitError: document.querySelector('#split-error'),
    addSplit: document.querySelector('#add-split-row'),
    closeSplit: document.querySelector('#close-split'),
    cancelSplit: document.querySelector('#cancel-split'),
    toast: document.querySelector('#toast')
  };

  const today = new Date();
  let selectedMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  let selectedPeriod = 'month';
  let customStart = `${selectedMonth}-01`;
  let customEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let selectedSort = 'date-desc';
  let selectedCategoryFilters = new Set();
  let categoryFilterQuery = '';
  let activeSplitId = null;
  let toastTimer = 0;
  let dataRevision = 0;
  let pendingImportReview = [];
  let budgets = { erste: emptyBudgetData(), bnp: emptyBudgetData('bnp') };
  let selectedBudgetId = 'erste';
  let transactions = budgets[selectedBudgetId].transactions;
  let categories = budgets[selectedBudgetId].categories;
  let duplicateCandidates = budgets[selectedBudgetId].duplicates;
  let dismissedDuplicates = budgets[selectedBudgetId].dismissedDuplicates;
  let hideExcluded = false;

  function isValidTransaction(item) {
    return item && typeof item.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      typeof item.description === 'string' && Number.isFinite(item.amount) && typeof item.category === 'string' &&
      (item.importIdentity === undefined || typeof item.importIdentity === 'string') &&
      (item.categoryMatch === undefined || typeof item.categoryMatch === 'string') &&
      (item.categorySource === undefined || typeof item.categorySource === 'string') &&
      (item.sourceFile === undefined || typeof item.sourceFile === 'string') &&
      (item.sourceRow === undefined || Number.isInteger(item.sourceRow)) &&
      (item.excludedFromAnalysis === undefined || typeof item.excludedFromAnalysis === 'boolean') &&
      (item.unnecessary === undefined || typeof item.unnecessary === 'boolean') &&
      (!item.splits || (Array.isArray(item.splits) && item.splits.every(part =>
        part && typeof part.category === 'string' && Number.isFinite(part.amount))));
  }

  function normalizeBudgetData(saved, budgetId) {
    const categories = [...new Set([
      ...(Array.isArray(saved.categories) ? saved.categories.filter(value => typeof value === 'string') : DEFAULT_CATEGORIES),
      'Uncategorized'
    ])];
    const groupIds = new Set(BNP_SPENDING_GROUPS.map(group => group.id));
    const groupTargets = {};
    const categoryGroups = {};
    if (budgetId === 'bnp') {
      Object.entries(DEFAULT_BNP_GROUP_TARGETS).forEach(([groupId, target]) => {
        const savedTarget = saved.groupTargets && saved.groupTargets[groupId];
        groupTargets[groupId] = savedTarget === null || (typeof savedTarget === 'number' &&
          Number.isFinite(savedTarget) && savedTarget >= 0) ? savedTarget : target;
      });
      const savedCategoryGroups = saved.categoryGroups &&
        typeof saved.categoryGroups === 'object' && !Array.isArray(saved.categoryGroups)
        ? saved.categoryGroups : DEFAULT_BNP_CATEGORY_GROUPS;
      Object.entries(savedCategoryGroups).forEach(([category, groupId]) => {
        if (typeof category === 'string' && (groupId === null || groupIds.has(groupId))) {
          categoryGroups[category] = groupId;
        }
      });
    }
    return {
      transactions: Array.isArray(saved.transactions) ? saved.transactions.filter(isValidTransaction) : [],
      categories,
      duplicates: Array.isArray(saved.duplicates) ? saved.duplicates.filter(isValidTransaction) : [],
      dismissedDuplicates: Array.isArray(saved.dismissedDuplicates)
        ? saved.dismissedDuplicates.filter(value => typeof value === 'string') : [],
      groupTargets,
      categoryGroups
    };
  }

  function repairMisassignedLegacyBudget(nextBudgets) {
    const erste = nextBudgets.erste;
    const bnp = nextBudgets.bnp;
    const misplaced = bnp.transactions.filter(item =>
      !item.importIdentity && !item.sourceFile && !item.categoryMatch);
    if (!misplaced.length) return false;

    const ersteByKey = new Map();
    erste.transactions.forEach((item, index) => {
      const key = transactionKey(item);
      if (!ersteByKey.has(key)) ersteByKey.set(key, []);
      ersteByKey.get(key).push(index);
    });
    const matchedErsteIndexes = new Set();
    misplaced.forEach(item => {
      const matches = ersteByKey.get(transactionKey(item)) || [];
      const matchIndex = matches.find(index => !matchedErsteIndexes.has(index));
      if (matchIndex === undefined) {
        erste.transactions.push(item);
        ersteByKey.set(transactionKey(item), [...matches, erste.transactions.length - 1]);
        return;
      }

      matchedErsteIndexes.add(matchIndex);
      const existing = erste.transactions[matchIndex];
      erste.transactions[matchIndex] = {
        ...item,
        ...existing,
        category: existing.category === 'Uncategorized' && item.category !== 'Uncategorized'
          ? item.category : existing.category,
        splits: existing.splits?.length ? existing.splits : item.splits,
        excludedFromAnalysis: existing.excludedFromAnalysis ?? item.excludedFromAnalysis,
        unnecessary: existing.unnecessary ?? item.unnecessary
      };
    });

    const misplacedIds = new Set(misplaced.map(item => item.id));
    bnp.transactions = bnp.transactions.filter(item => !misplacedIds.has(item.id));
    erste.categories = [...new Set([...erste.categories, ...bnp.categories, 'Uncategorized'])];
    return true;
  }

  function emptyBudgetData(budgetId = 'erste') {
    return {
      transactions: [],
      categories: [...DEFAULT_CATEGORIES],
      duplicates: [],
      dismissedDuplicates: [],
      groupTargets: budgetId === 'bnp' ? { ...DEFAULT_BNP_GROUP_TARGETS } : {},
      categoryGroups: budgetId === 'bnp' ? { ...DEFAULT_BNP_CATEGORY_GROUPS } : {}
    };
  }

  async function loadData() {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Local database returned HTTP ${response.status}.`);
    const envelope = await response.json();
    if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 0 || !envelope.state) {
      throw new Error('The local database returned an unexpected response.');
    }
    dataRevision = envelope.revision;
    const parsed = envelope.state;
    if (parsed && parsed.budgets && typeof parsed.budgets === 'object') {
      const nextBudgets = Object.fromEntries(BUDGET_IDS.map(budgetId => [
        budgetId,
        normalizeBudgetData(parsed.budgets[budgetId] || emptyBudgetData(budgetId), budgetId)
      ]));
      const requiresMigration = !Number.isFinite(parsed.version) || parsed.version < 3;
      const repaired = requiresMigration && repairMisassignedLegacyBudget(nextBudgets);
      return {
        budgets: nextBudgets,
        activeBudgetId: repaired ? 'erste'
          : BUDGET_IDS.includes(parsed.activeBudgetId) ? parsed.activeBudgetId : 'erste',
        migrated: requiresMigration || repaired
      };
    }
    if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.categories)) {
      throw new Error('Saved data has an unexpected format.');
    }
    return {
      budgets: { erste: normalizeBudgetData(parsed, 'erste'), bnp: emptyBudgetData('bnp') },
      activeBudgetId: 'erste',
      migrated: true
    };
  }

  async function writeData(nextBudgets, activeBudgetId) {
    const response = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        expectedRevision: dataRevision,
        state: { version: 3, activeBudgetId, budgets: nextBudgets }
      })
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Local database returned HTTP ${response.status}.`);
    }
    if (response.status === 409) {
      throw new Error('Data changed in another browser. Reload this page before saving.');
    }
    if (!response.ok) throw new Error(result.error || `Local database returned HTTP ${response.status}.`);
    if (!Number.isSafeInteger(result.revision)) throw new Error('The local database did not confirm the save.');
    dataRevision = result.revision;
  }

  async function saveData(
    nextTransactions,
    nextCategories,
    nextDuplicates = duplicateCandidates,
    nextDismissedDuplicates = dismissedDuplicates,
    nextCategoryGroups = budgets[selectedBudgetId].categoryGroups
  ) {
    const nextBudgets = {
      ...budgets,
      [selectedBudgetId]: {
        ...budgets[selectedBudgetId],
        transactions: nextTransactions,
        categories: nextCategories,
        duplicates: nextDuplicates,
        dismissedDuplicates: nextDismissedDuplicates,
        categoryGroups: nextCategoryGroups
      }
    };
    try {
      await writeData(nextBudgets, selectedBudgetId);
      budgets = nextBudgets;
      transactions = nextTransactions;
      categories = nextCategories;
      duplicateCandidates = nextDuplicates;
      dismissedDuplicates = nextDismissedDuplicates;
      return true;
    } catch (error) {
      showToast(`Could not save your changes to the local database: ${error.message}`, true);
      return false;
    }
  }

  async function saveSpendingGroupTarget(groupId, value) {
    if (selectedBudgetId !== 'bnp' ||
      !Object.prototype.hasOwnProperty.call(DEFAULT_BNP_GROUP_TARGETS, groupId)) return;
    const rawValue = value.trim();
    const target = rawValue === '' ? null : Number(rawValue);
    if (target !== null && (!Number.isFinite(target) || target < 0)) {
      showToast('Enter a non-negative monthly target.', true);
      render();
      return;
    }
    const nextBudgets = {
      ...budgets,
      bnp: {
        ...budgets.bnp,
        groupTargets: { ...budgets.bnp.groupTargets, [groupId]: target }
      }
    };
    try {
      await writeData(nextBudgets, selectedBudgetId);
      budgets = nextBudgets;
      render();
      showToast('Monthly group target saved.');
    } catch (error) {
      showToast(`Could not save your group target: ${error.message}`, true);
      render();
    }
  }

  async function switchBudget(budgetId) {
    if (!BUDGET_IDS.includes(budgetId) || budgetId === selectedBudgetId) return true;
    try {
      await writeData(budgets, budgetId);
    } catch (error) {
      showToast(`Could not save your selected budget: ${error.message}`, true);
      return false;
    }
    selectedBudgetId = budgetId;
    const budget = budgets[budgetId];
    transactions = budget.transactions;
    categories = budget.categories;
    duplicateCandidates = budget.duplicates;
    dismissedDuplicates = budget.dismissedDuplicates;
    selectedCategoryFilters.clear();
    categoryFilterQuery = '';
    el.categoryFilterSearch.value = '';
    const newest = transactions.reduce((latest, item) => item.date > latest ? item.date : latest, '');
    if (newest) selectedMonth = newest.slice(0, 7);
    render();
    return true;
  }

  function renderBudgetSwitcher() {
    [
      [el.budgetErste, 'erste'],
      [el.budgetBnp, 'bnp']
    ].forEach(([button, budgetId]) => {
      const active = selectedBudgetId === budgetId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  async function moveMatchedTransactionsToBudget(items, budgetId) {
    const identities = new Set(items.map(item => item.importIdentity).filter(Boolean));
    if (!identities.size) return 0;
    const nextBudgets = Object.fromEntries(BUDGET_IDS.map(id => [id, {
      ...budgets[id],
      transactions: [...budgets[id].transactions],
      categories: [...budgets[id].categories],
      duplicates: [...budgets[id].duplicates],
      dismissedDuplicates: [...budgets[id].dismissedDuplicates]
    }]));
    const target = nextBudgets[budgetId];
    let moved = 0;
    BUDGET_IDS.filter(id => id !== budgetId).forEach(sourceBudgetId => {
      const source = nextBudgets[sourceBudgetId];
      source.transactions = source.transactions.filter(transaction => {
        if (!identities.has(transaction.importIdentity) ||
          target.transactions.some(existing => existing.importIdentity === transaction.importIdentity)) return true;
        target.transactions.push(transaction);
        target.categories.push(...partsOf(transaction).map(part => part.category));
        moved += 1;
        return false;
      });
      source.duplicates = source.duplicates.filter(candidate => {
        if (!identities.has(candidate.importIdentity) ||
          target.duplicates.some(existing => existing.importIdentity === candidate.importIdentity)) return true;
        target.duplicates.push(candidate);
        return false;
      });
      source.dismissedDuplicates = source.dismissedDuplicates.filter(occurrence => {
        const shouldMove = [...identities].some(identity =>
          occurrence.endsWith(`\u0000${identity}`));
        if (shouldMove && !target.dismissedDuplicates.includes(occurrence)) {
          target.dismissedDuplicates.push(occurrence);
          return false;
        }
        return true;
      });
    });
    if (!moved && BUDGET_IDS.every(id =>
      nextBudgets[id].duplicates.length === budgets[id].duplicates.length &&
      nextBudgets[id].dismissedDuplicates.length === budgets[id].dismissedDuplicates.length)) return 0;
    nextBudgets[budgetId].categories = [...new Set(nextBudgets[budgetId].categories)];
    await writeData(nextBudgets, selectedBudgetId);
    budgets = nextBudgets;
    const current = budgets[selectedBudgetId];
    transactions = current.transactions;
    categories = current.categories;
    duplicateCandidates = current.duplicates;
    dismissedDuplicates = current.dismissedDuplicates;
    return moved;
  }

  function showToast(message, isError = false) {
    el.toast.textContent = message;
    el.toast.classList.toggle('error', isError);
    el.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.toast.classList.remove('visible'), 4200);
  }

  function money(amount) { return currency.format(amount); }
  function periodRange() {
    if (selectedPeriod === 'custom') return { start: customStart, end: customEnd };
    if (selectedPeriod === 'all') {
      const dates = transactions.map(item => item.date).sort();
      return { start: dates[0] || `${selectedMonth}-01`, end: dates[dates.length - 1] || `${selectedMonth}-31` };
    }
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    const firstMonth = selectedPeriod === 'year' ? 0
      : selectedPeriod === 'quarter' ? Math.floor(date.getMonth() / 3) * 3 : date.getMonth();
    const monthCount = selectedPeriod === 'year' ? 12 : selectedPeriod === 'quarter' ? 3 : 1;
    const start = new Date(date.getFullYear(), firstMonth, 1, 12);
    const end = new Date(date.getFullYear(), firstMonth + monthCount, 0, 12);
    const isoDate = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    return { start: isoDate(start), end: isoDate(end) };
  }
  function visibleTransactions() {
    const { start, end } = periodRange();
    return transactions.filter(item => item.date >= start && item.date <= end);
  }
  function displayTransactions(items) {
    return hideExcluded ? items.filter(item => !item.excludedFromAnalysis) : items;
  }
  function partsOf(transaction) {
    return Array.isArray(transaction.splits) && transaction.splits.length
      ? transaction.splits : [{ category: transaction.category, amount: transaction.amount }];
  }
  function filteredTransactions(items) {
    if (!selectedCategoryFilters.size) return items;
    return items.filter(item => partsOf(item).some(part => selectedCategoryFilters.has(part.category)));
  }
  function sortedTransactions(items) {
    const [field, direction] = selectedSort.split('-');
    const multiplier = direction === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      let comparison = 0;
      if (field === 'date') comparison = a.date.localeCompare(b.date);
      else if (field === 'description') comparison = a.description.localeCompare(b.description, 'pl', { sensitivity: 'base' });
      else if (field === 'category') {
        const categoryA = partsOf(a).map(part => part.category).sort().join(', ');
        const categoryB = partsOf(b).map(part => part.category).sort().join(', ');
        comparison = categoryA.localeCompare(categoryB, 'pl', { sensitivity: 'base' });
      } else if (field === 'amount') comparison = a.amount - b.amount;
      return comparison ? comparison * multiplier
        : b.date.localeCompare(a.date) || a.description.localeCompare(b.description, 'pl', { sensitivity: 'base' });
    });
  }
  function id() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function renderChart(items) {
    const totals = new Map();
    items.forEach(item => partsOf(item).forEach(part => {
      if (part.amount < 0) totals.set(part.category, (totals.get(part.category) || 0) + Math.abs(part.amount));
    }));
    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const sum = entries.reduce((result, [, amount]) => result + amount, 0);
    el.segments.replaceChildren();
    el.legend.replaceChildren();
    el.donutTotal.textContent = sum >= 10000
      ? `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(sum / 1000)} tys. zł`
      : currency.format(sum);
    if (!sum) {
      el.categoryTooltip.hidden = true;
      const empty = document.createElement('p');
      empty.className = 'chart-empty';
      empty.textContent = 'Spending categories will appear here once you import transactions.';
      el.legend.append(empty);
      return;
    }
    const circumference = 2 * Math.PI * 78;
    let offset = 0;
    entries.forEach(([category, amount], index) => {
      const length = circumference * amount / sum;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'donut-segment');
      circle.setAttribute('cx', '100');
      circle.setAttribute('cy', '100');
      circle.setAttribute('r', '78');
      circle.setAttribute('stroke', COLORS[index % COLORS.length]);
      circle.setAttribute('stroke-dasharray', `${length} ${circumference - length}`);
      circle.setAttribute('stroke-dashoffset', String(-offset));
      circle.setAttribute('tabindex', '0');
      circle.setAttribute('role', 'button');
      circle.setAttribute('aria-haspopup', 'dialog');
      circle.setAttribute('aria-label', `${category}: ${money(amount)}, ${(amount / sum * 100).toFixed(1)}%`);
      circle.dataset.category = category;
      circle.append(document.createElementNS('http://www.w3.org/2000/svg', 'title'));
      circle.lastElementChild.textContent = `${category}: ${money(amount)} (${(amount / sum * 100).toFixed(1)}%)`;
      circle.addEventListener('pointerenter', event => showCategoryTooltip(category, amount, sum, circle, event));
      circle.addEventListener('pointerleave', () => clearCategoryTooltip());
      circle.addEventListener('focus', () => showCategoryTooltip(category, amount, sum, circle));
      circle.addEventListener('blur', () => clearCategoryTooltip());
      circle.addEventListener('click', () => openCategoryTransactions(category));
      circle.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openCategoryTransactions(category);
      });
      el.segments.append(circle);
      offset += length;

      const row = document.createElement('div');
      row.className = 'legend-row';
      row.dataset.category = category;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-haspopup', 'dialog');
      row.setAttribute('aria-label', `${category}: ${money(amount)}, ${(amount / sum * 100).toFixed(1)}%`);
      row.addEventListener('pointerenter', event => showCategoryTooltip(category, amount, sum, row, event));
      row.addEventListener('pointerleave', () => clearCategoryTooltip());
      row.addEventListener('focus', () => showCategoryTooltip(category, amount, sum, row));
      row.addEventListener('blur', () => clearCategoryTooltip());
      row.addEventListener('click', () => openCategoryTransactions(category));
      row.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openCategoryTransactions(category);
      });
      const dot = document.createElement('span');
      dot.className = 'legend-dot';
      dot.style.backgroundColor = COLORS[index % COLORS.length];
      const name = document.createElement('span');
      name.className = 'legend-name';
      name.textContent = category;
      const value = document.createElement('span');
      value.className = 'legend-amount';
      value.textContent = `${money(amount)} · ${(amount / sum * 100).toFixed(1)}%`;
      row.append(dot, name, value);
      el.legend.append(row);
    });
  }

  function openCategoryTransactions(category) {
    const matches = visibleTransactions()
      .filter(item => !item.excludedFromAnalysis)
      .map(item => ({
        item,
        amount: partsOf(item)
          .filter(part => part.category === category && part.amount < 0)
          .reduce((total, part) => total + Math.abs(part.amount), 0)
      }))
      .filter(match => match.amount > 0)
      .sort((a, b) => b.item.date.localeCompare(a.item.date));

    el.categoryTransactionsTitle.textContent = category;
    el.categoryTransactionsList.replaceChildren();
    const total = matches.reduce((sum, match) => sum + match.amount, 0);
    el.categoryTransactionsSummary.textContent =
      `${matches.length} ${matches.length === 1 ? 'transaction' : 'transactions'} · ${money(total)}`;
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'chart-empty';
      empty.textContent = 'No included transactions for this category in the selected period.';
      el.categoryTransactionsList.append(empty);
    } else {
      matches.forEach(({ item, amount }) => {
        const row = document.createElement('article');
        row.className = 'category-transaction';
        const details = document.createElement('div');
        details.className = 'category-transaction-details';
        const description = document.createElement('strong');
        description.textContent = item.description;
        const date = document.createElement('span');
        date.textContent = new Intl.DateTimeFormat('pl-PL', {
          year: 'numeric', month: 'short', day: 'numeric'
        }).format(new Date(`${item.date}T12:00:00`));
        details.append(description, date);
        const value = document.createElement('strong');
        value.className = 'category-transaction-amount';
        value.textContent = `−${money(amount)}`;
        row.append(details, value);
        el.categoryTransactionsList.append(row);
      });
    }
    el.categoryTransactionsDialog.showModal();
  }

  function showCategoryTooltip(category, amount, total, target, event) {
    const percentage = (amount / total * 100).toFixed(1);
    el.categoryTooltip.textContent = `${category} · ${money(amount)} · ${percentage}%`;
    el.categoryTooltip.hidden = false;
    const host = el.categoryTooltip.parentElement.getBoundingClientRect();
    const anchor = target.getBoundingClientRect();
    const pointerX = event ? event.clientX - host.left + 12 : anchor.left - host.left + anchor.width / 2;
    const pointerY = event ? event.clientY - host.top + 12 : anchor.top - host.top;
    el.categoryTooltip.style.left = `${Math.max(4, Math.min(pointerX, host.width - el.categoryTooltip.offsetWidth - 4))}px`;
    el.categoryTooltip.style.top = `${Math.max(4, Math.min(pointerY, host.height - el.categoryTooltip.offsetHeight - 4))}px`;
    [...el.segments.querySelectorAll('.donut-segment')].forEach(segment => {
      segment.classList.toggle('active', segment.dataset.category === category);
      segment.classList.toggle('dimmed', segment.dataset.category !== category);
    });
    [...el.legend.querySelectorAll('.legend-row')].forEach(row => {
      row.classList.toggle('active', row.dataset.category === category);
      row.classList.toggle('dimmed', row.dataset.category !== category);
    });
  }

  function clearCategoryTooltip() {
    el.categoryTooltip.hidden = true;
    [...el.segments.querySelectorAll('.donut-segment')].forEach(segment =>
      segment.classList.remove('active', 'dimmed'));
    [...el.legend.querySelectorAll('.legend-row')].forEach(row =>
      row.classList.remove('active', 'dimmed'));
  }

  function renderCashflowChart(items) {
    const range = periodRange();
    let start = new Date(`${range.start}T12:00:00`);
    const end = new Date(`${range.end}T12:00:00`);
    let dayCount = Math.max(1, Math.floor((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1);
    const monthCount = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
    const requestedGranularity = el.cashflowGranularity.value;
    const granularity = requestedGranularity === 'auto'
      ? dayCount <= 45 ? 'day'
        : dayCount <= 140 ? 'week'
          : monthCount <= 18 ? 'month'
            : monthCount <= 60 ? 'quarter' : 'year'
      : requestedGranularity;
    const maximumDays = granularity === 'day' ? 366 : granularity === 'week' ? 1820 : Infinity;
    el.cashflowNote.hidden = true;
    if (dayCount > maximumDays) {
      start = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate() - maximumDays + 1, 12));
      dayCount = maximumDays;
      el.cashflowNote.textContent = `Showing the most recent ${maximumDays} days of the selected period.`;
      el.cashflowNote.hidden = false;
    }
    const buckets = new Map();
    const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const shortDate = date => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(date);
    const keyForDate = date => {
      if (granularity === 'day') {
        return { key: isoDate(date), label: shortDate(date) };
      }
      if (granularity === 'week') {
        const dayOffset = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
          Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
        const index = Math.floor(dayOffset / 7);
        const bucketStart = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate() + index * 7, 12));
        const bucketEnd = new Date(Date.UTC(start.getFullYear(), start.getMonth(),
          Math.min(start.getDate() + (index + 1) * 7 - 1, start.getDate() + dayCount - 1), 12));
        return { key: String(index), label: `${shortDate(bucketStart)}–${shortDate(bucketEnd)}` };
      }
      if (granularity === 'month') {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = new Intl.DateTimeFormat('pl-PL', {
          month: 'short',
          ...(start.getFullYear() !== end.getFullYear() ? { year: '2-digit' } : {})
        }).format(date);
        return { key, label };
      }
      if (granularity === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return { key: `${date.getFullYear()}-Q${quarter}`, label: `${quarter}. kw. ${String(date.getFullYear()).slice(-2)}` };
      }
      return { key: String(date.getFullYear()), label: String(date.getFullYear()) };
    };

    if (granularity === 'day') {
      const cursor = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 12));
      for (let index = 0; index < dayCount; index += 1) {
        const bucket = keyForDate(cursor);
        buckets.set(bucket.key, { label: bucket.label, income: 0, expense: 0, date: isoDate(cursor) });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    } else if (granularity === 'week') {
      for (let index = 0; index < Math.ceil(dayCount / 7); index += 1) {
        const cursor = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate() + index * 7, 12));
        const bucket = keyForDate(cursor);
        buckets.set(bucket.key, { label: bucket.label, income: 0, expense: 0 });
      }
    } else {
      const monthStep = granularity === 'month' ? 1 : granularity === 'quarter' ? 3 : 12;
      const startMonth = granularity === 'month' ? start.getMonth()
        : granularity === 'quarter' ? Math.floor(start.getMonth() / 3) * 3 : 0;
      const cursor = new Date(start.getFullYear(), startMonth, 1, 12);
      const endMonth = granularity === 'month' ? end.getMonth()
        : granularity === 'quarter' ? Math.floor(end.getMonth() / 3) * 3 : 0;
      const last = new Date(end.getFullYear(), endMonth, 1, 12);
      while (cursor <= last) {
        const bucket = keyForDate(cursor);
        buckets.set(bucket.key, { label: bucket.label, income: 0, expense: 0 });
        cursor.setMonth(cursor.getMonth() + monthStep);
      }
    }

    items.forEach(item => {
      const bucketKey = keyForDate(new Date(`${item.date}T12:00:00`)).key;
      const bucket = buckets.get(bucketKey);
      if (!bucket) return;
      if (item.amount > 0) bucket.income += item.amount;
      else bucket.expense += Math.abs(item.amount);
    });

    const entries = [...buckets.values()];
    const maximum = Math.max(0, ...entries.flatMap(bucket => [bucket.income, bucket.expense]));
    el.cashflowChart.replaceChildren();
    el.cashflowChart.setAttribute('aria-label',
      `Income and spending by ${granularity} for ${el.month.textContent}`);
    const chartWidth = Math.max(760, entries.length * (granularity === 'day' ? 25 : 28) + 76);
    el.cashflowChart.setAttribute('viewBox', `0 0 ${chartWidth} 240`);
    el.cashflowChart.style.width = `${chartWidth}px`;
    el.cashflowEmpty.hidden = maximum > 0;
    el.cashflowChart.hidden = maximum === 0;
    if (maximum === 0) return;

    const left = 58;
    const right = chartWidth - 16;
    const top = 18;
    const bottom = 188;
    const plotHeight = bottom - top;
    const groupWidth = (right - left) / entries.length;
    const barWidth = Math.max(2, Math.min(granularity === 'day' ? 12 : 20, groupWidth * 0.28));
    const yForAmount = amount => bottom - amount / maximum * plotHeight;
    const svgElement = (name, attributes, text = '') => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
      if (text) node.textContent = text;
      return node;
    };
    for (let tick = 0; tick <= 3; tick += 1) {
      const y = bottom - tick * plotHeight / 3;
      const amount = maximum * tick / 3;
      const axisLabel = amount >= 1000000
        ? `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(amount / 1000000)} mln`
        : amount >= 10000
          ? `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(amount / 1000)} tys.`
          : amount >= 1000
            ? `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(amount / 1000)} tys.`
            : new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(amount);
      el.cashflowChart.append(
        svgElement('line', { x1: left, x2: right, y1: y, y2: y, class: 'cashflow-gridline' }),
        svgElement('text', { x: left - 9, y: y + 3, 'text-anchor': 'end', class: 'cashflow-axis-label' }, axisLabel)
      );
    }

    const labelStride = Math.max(1, Math.ceil(entries.length / 24));
    entries.forEach((bucket, index) => {
      const center = left + groupWidth * (index + 0.5);
      [
        { name: 'Income', amount: bucket.income, x: center - barWidth - 1, className: 'cashflow-income-bar' },
        { name: 'Spending', amount: bucket.expense, x: center + 1, className: 'cashflow-expense-bar' }
      ].forEach(series => {
        if (!series.amount) return;
        const y = yForAmount(series.amount);
        const bar = svgElement('rect', {
          x: series.x,
          y,
          width: barWidth,
          height: Math.max(1, bottom - y),
          rx: Math.min(4, barWidth / 4),
          class: series.className,
          tabindex: 0,
          role: 'img',
          'aria-label': `${series.name} · ${bucket.label}: ${money(series.amount)}`
        });
        bar.append(svgElement('title', {}, `${series.name} · ${bucket.label}: ${money(series.amount)}`));
        el.cashflowChart.append(bar);
      });
      if (index % labelStride === 0 || index === entries.length - 1) {
        const label = svgElement('text', {
          x: center,
          y: 216,
          'text-anchor': 'middle',
          class: 'cashflow-axis-label'
        }, granularity === 'day' ? bucket.date.slice(5) : bucket.label);
        if (bucket.date) label.append(svgElement('title', {}, bucket.date));
        el.cashflowChart.append(label);
      }
    });
  }

  function categorySelect(value, className = '') {
    const select = document.createElement('select');
    if (className) select.className = className;
    select.setAttribute('aria-label', 'Transaction category');
    const options = categories.includes(value) ? categories : [value, ...categories];
    options.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      option.selected = category === value;
      select.append(option);
    });
    return select;
  }

  function renderTransactions(items) {
    el.list.replaceChildren();
    const hasDisplayFilters = selectedCategoryFilters.size > 0 || hideExcluded;
    const displayedIncome = items.reduce((total, item) => total + Math.max(item.amount, 0), 0);
    const displayedSpending = items.reduce((total, item) => total + Math.max(-item.amount, 0), 0);
    const displayedBalance = displayedIncome - displayedSpending;
    el.transactionSummary.replaceChildren();
    [
      ['Visible balance', money(displayedBalance), displayedBalance < 0 ? 'negative' : 'positive'],
      ['Income', money(displayedIncome), ''],
      ['Spending', money(displayedSpending), '']
    ].forEach(([label, amount, tone]) => {
      const metric = document.createElement('div');
      metric.className = 'transaction-summary-metric';
      const name = document.createElement('span');
      name.textContent = label;
      const value = document.createElement('strong');
      value.className = tone;
      value.textContent = amount;
      metric.append(name, value);
      el.transactionSummary.append(metric);
    });
    el.count.textContent = hasDisplayFilters
      ? `${items.length}/${visibleTransactions().length}` : String(items.length);
    el.count.title = hasDisplayFilters
      ? 'Shown transactions / transactions in this period' : 'Transactions in this period';
    if (!items.length) {
      const periodItems = visibleTransactions();
      const allHidden = hideExcluded && periodItems.length > 0 &&
        periodItems.every(item => item.excludedFromAnalysis);
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const icon = document.createElement('span');
      icon.className = 'empty-state-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = selectedCategoryFilters.size || allHidden ? '⌕' : '↗';
      const title = document.createElement('strong');
      title.textContent = allHidden
        ? 'All excluded transactions are hidden.'
        : selectedCategoryFilters.size
        ? 'No transactions match these categories.'
        : 'Your story starts with a file.';
      const copy = document.createElement('p');
      if (allHidden) {
        copy.textContent = 'Show excluded transactions to see them in the list again.';
        const button = document.createElement('button');
        button.className = 'button button-secondary';
        button.type = 'button';
        button.textContent = 'Show excluded';
        button.addEventListener('click', () => {
          hideExcluded = false;
          el.hideExcluded.checked = false;
          render();
        });
        empty.append(icon, title, copy, button);
      } else if (selectedCategoryFilters.size) {
        copy.textContent = 'Choose different categories or clear the category filter.';
        const button = document.createElement('button');
        button.className = 'button button-secondary';
        button.type = 'button';
        button.textContent = 'Clear category filter';
        button.addEventListener('click', clearCategoryFilters);
        empty.append(icon, title, copy, button);
      } else {
        copy.textContent = 'Import a CSV, TSV, or Excel statement from your bank. Your file is processed right here in your browser.';
        const button = document.createElement('label');
        button.className = 'button button-primary';
        button.htmlFor = 'file-input';
        button.textContent = 'Import bank file';
        empty.append(icon, title, copy, button);
      }
      el.list.append(empty);
      return;
    }
    const header = document.createElement('div');
    header.className = 'transaction-header';
    ['DATE', 'DESCRIPTION', 'CATEGORY', 'AMOUNT', 'ACTIONS'].forEach(label => {
      const cell = document.createElement('span');
      cell.textContent = label;
      header.append(cell);
    });
    el.list.append(header);
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = `transaction-row${item.excludedFromAnalysis ? ' excluded-from-analysis' : ''}${item.unnecessary ? ' unnecessary-transaction' : ''}`;
      const date = document.createElement('span');
      date.className = 'transaction-date';
      date.textContent = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
        .format(new Date(`${item.date}T12:00:00`));
      const description = document.createElement('span');
      description.className = 'transaction-description';
      description.title = item.description;
      description.textContent = item.description;
      const category = document.createElement('div');
      category.className = 'transaction-category';
      if (item.splits && item.splits.length) {
        const label = document.createElement('span');
        label.className = 'split-button';
        label.textContent = `${item.splits.length} categories`;
        category.append(label);
      } else {
        const select = categorySelect(item.category);
        select.addEventListener('change', () => updateTransaction(item.id, current => ({
          ...current, category: select.value, categorySource: 'manual'
        })));
        category.append(select);
      }
      const amount = document.createElement('span');
      amount.className = `transaction-amount ${item.amount < 0 ? 'negative' : 'positive'}`;
      amount.textContent = `${item.amount < 0 ? '−' : '+'}${money(Math.abs(item.amount))}`;
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      const split = document.createElement('button');
      split.className = 'split-button';
      split.type = 'button';
      split.textContent = item.splits && item.splits.length ? 'Edit split' : 'Split';
      split.addEventListener('click', () => openSplit(item));
      const analysis = document.createElement('button');
      analysis.className = 'analysis-toggle';
      analysis.type = 'button';
      analysis.textContent = item.excludedFromAnalysis ? 'Include' : 'Exclude';
      analysis.setAttribute('aria-pressed', String(Boolean(item.excludedFromAnalysis)));
      analysis.setAttribute('aria-label', item.excludedFromAnalysis
        ? `Include ${item.description} in analysis` : `Exclude ${item.description} from analysis`);
      analysis.addEventListener('click', () => updateTransaction(item.id, current => ({
        ...current, excludedFromAnalysis: !current.excludedFromAnalysis
      })));
      const unnecessary = document.createElement('button');
      unnecessary.className = `unnecessary-toggle${item.unnecessary ? ' active' : ''}`;
      unnecessary.type = 'button';
      unnecessary.textContent = 'Zbędne';
      unnecessary.setAttribute('aria-pressed', String(Boolean(item.unnecessary)));
      unnecessary.setAttribute('aria-label', item.unnecessary
        ? `Remove unnecessary mark from ${item.description}` : `Mark ${item.description} as unnecessary`);
      unnecessary.addEventListener('click', () => updateTransaction(item.id, current => ({
        ...current, unnecessary: !current.unnecessary
      })));
      actions.append(split, analysis, unnecessary);
      row.append(date, description, category, amount, actions);
      el.list.append(row);
    });
  }

  function renderCategoryFilterOptions() {
    el.categoryFilterOptions.replaceChildren();
    const query = categoryFilterQuery.trim().toLocaleLowerCase('pl-PL');
    const matchingCategories = categories.filter(category =>
      category.toLocaleLowerCase('pl-PL').includes(query));
    matchingCategories.forEach(category => {
      const label = document.createElement('label');
      label.className = 'category-filter-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = category;
      checkbox.checked = selectedCategoryFilters.has(category);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedCategoryFilters.add(category);
        else selectedCategoryFilters.delete(category);
        updateCategoryFilterSummary();
        renderTransactions(sortedTransactions(displayTransactions(filteredTransactions(visibleTransactions()))));
        el.categoryFilter.open = false;
        el.categoryFilterSummary.focus();
      });
      const name = document.createElement('span');
      name.textContent = category;
      label.append(checkbox, name);
      el.categoryFilterOptions.append(label);
    });
    el.categoryFilterEmpty.hidden = matchingCategories.length > 0;
    updateCategoryFilterSummary();
  }

  function updateCategoryFilterSummary() {
    const count = selectedCategoryFilters.size;
    el.categoryFilterSummary.textContent = count
      ? `Categories (${count})` : 'All categories';
    el.clearCategoryFilter.hidden = !count;
  }

  function clearCategoryFilters() {
    selectedCategoryFilters.clear();
    [...el.categoryFilterOptions.querySelectorAll('input[type="checkbox"]')]
      .forEach(checkbox => { checkbox.checked = false; });
    updateCategoryFilterSummary();
    renderTransactions(sortedTransactions(displayTransactions(visibleTransactions())));
  }

  function selectVisibleCategoryFilters() {
    const visibleOptions = [...el.categoryFilterOptions.querySelectorAll('input[type="checkbox"]')];
    if (!visibleOptions.length) return;
    visibleOptions.forEach(checkbox => {
      checkbox.checked = true;
      selectedCategoryFilters.add(checkbox.value);
    });
    updateCategoryFilterSummary();
    renderTransactions(sortedTransactions(displayTransactions(filteredTransactions(visibleTransactions()))));
    el.categoryFilter.open = false;
    el.categoryFilterSummary.focus();
  }

  function renderPeriod() {
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    const range = periodRange();
    const labels = {
      month: 'MONTHLY OVERVIEW',
      quarter: 'QUARTERLY OVERVIEW',
      year: 'YEARLY OVERVIEW',
      all: 'ALL-TIME OVERVIEW',
      custom: 'CUSTOM DATE RANGE'
    };
    el.periodEyebrow.textContent = labels[selectedPeriod];
    el.chartPeriod.textContent = labels[selectedPeriod].replace(' OVERVIEW', '');
    el.incomeCaption.textContent = `Income ${selectedPeriod === 'month' ? 'this month' : 'in period'}`;
    el.expenseCaption.textContent = `Spending ${selectedPeriod === 'month' ? 'this month' : 'in period'}`;
    el.customRange.hidden = selectedPeriod !== 'custom';
    const canNavigate = selectedPeriod === 'month' || selectedPeriod === 'quarter' || selectedPeriod === 'year';
    el.previous.hidden = !canNavigate;
    el.next.hidden = !canNavigate;
    if (selectedPeriod === 'month') {
      el.month.textContent = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(date);
    } else if (selectedPeriod === 'quarter') {
      el.month.textContent = `${Math.floor(date.getMonth() / 3) + 1}. kwartał ${date.getFullYear()}`;
    } else if (selectedPeriod === 'year') {
      el.month.textContent = String(date.getFullYear());
    } else if (selectedPeriod === 'all') {
      el.month.textContent = 'All transactions';
    } else {
      const formatDate = value => new Intl.DateTimeFormat('pl-PL').format(new Date(`${value}T12:00:00`));
      el.month.textContent = `${formatDate(range.start)} – ${formatDate(range.end)}`;
    }
  }

  function targetPeriodMultiplier() {
    const { start, end } = periodRange();
    const startParts = start.split('-').map(Number);
    const endParts = end.split('-').map(Number);
    if (startParts.length !== 3 || endParts.length !== 3 ||
      [...startParts, ...endParts].some(value => !Number.isInteger(value))) return 0;
    const startTime = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
    const endTime = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
    if (endTime < startTime) return 0;
    let monthIndex = startParts[0] * 12 + startParts[1] - 1;
    const lastMonthIndex = endParts[0] * 12 + endParts[1] - 1;
    let multiplier = 0;
    while (monthIndex <= lastMonthIndex) {
      const year = Math.floor(monthIndex / 12);
      const month = monthIndex % 12;
      const monthStart = Date.UTC(year, month, 1);
      const monthEnd = Date.UTC(year, month + 1, 0);
      const overlapStart = Math.max(startTime, monthStart);
      const overlapEnd = Math.min(endTime, monthEnd);
      const daysInMonth = (monthEnd - monthStart) / 86400000 + 1;
      multiplier += ((overlapEnd - overlapStart) / 86400000 + 1) / daysInMonth;
      monthIndex += 1;
    }
    return multiplier;
  }

  function renderSpendingGroups(items) {
    el.spendingGroups.hidden = selectedBudgetId !== 'bnp';
    if (selectedBudgetId !== 'bnp') return;

    const budget = budgets.bnp;
    const groupTotals = new Map(BNP_SPENDING_GROUPS.map(group => [group.id, 0]));
    const unassignedTotals = new Map();
    items.forEach(item => {
      if (item.excludedFromAnalysis) return;
      partsOf(item).forEach(part => {
        if (part.amount >= 0) return;
        const amount = Math.abs(part.amount);
        const groupId = budget.categoryGroups[part.category];
        if (groupTotals.has(groupId)) {
          groupTotals.set(groupId, groupTotals.get(groupId) + amount);
        } else {
          unassignedTotals.set(part.category, (unassignedTotals.get(part.category) || 0) + amount);
        }
      });
    });

    const targetMultiplier = targetPeriodMultiplier();
    el.spendingGroupList.replaceChildren();
    BNP_SPENDING_GROUPS.forEach(group => {
      const card = document.createElement('article');
      card.className = 'spending-group-card';
      const heading = document.createElement('h3');
      heading.textContent = group.name;

      const actualLabel = document.createElement('span');
      actualLabel.className = 'spending-group-caption';
      actualLabel.textContent = 'Wydatki w wybranym okresie';
      const actual = document.createElement('strong');
      actual.className = 'spending-group-actual';
      actual.textContent = money(groupTotals.get(group.id));

      const monthlyTarget = budget.groupTargets[group.id];
      const targetLabel = document.createElement('label');
      targetLabel.className = 'spending-group-target';
      targetLabel.textContent = 'Cel miesięczny';
      const targetInput = document.createElement('input');
      targetInput.type = 'number';
      targetInput.min = '0';
      targetInput.step = '1';
      targetInput.inputMode = 'decimal';
      targetInput.value = monthlyTarget === null ? '' : String(monthlyTarget);
      targetInput.placeholder = 'Brak limitu';
      targetInput.dataset.groupId = group.id;
      targetInput.setAttribute('aria-label', `Miesięczny cel: ${group.name}`);
      targetInput.addEventListener('change', event => {
        saveSpendingGroupTarget(group.id, event.currentTarget.value);
      });
      targetLabel.append(targetInput);

      const targetSummary = document.createElement('p');
      targetSummary.className = 'spending-group-target-summary';
      const progress = document.createElement('div');
      progress.className = 'spending-group-progress';
      progress.setAttribute('role', 'progressbar');
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', '100');
      const progressFill = document.createElement('span');
      progress.append(progressFill);
      const status = document.createElement('p');
      status.className = 'spending-group-status';

      if (monthlyTarget === null) {
        targetSummary.textContent = 'Brak celu dla tego okresu';
        progress.hidden = true;
        status.textContent = 'Ustaw cel miesięczny, jeśli chcesz porównywać tę grupę.';
      } else {
        const periodTarget = monthlyTarget * targetMultiplier;
        const percent = periodTarget > 0
          ? Math.min(100, groupTotals.get(group.id) / periodTarget * 100)
          : groupTotals.get(group.id) > 0 ? 100 : 0;
        targetSummary.textContent = `Cel w wybranym okresie: ${money(periodTarget)}`;
        progress.setAttribute('aria-valuenow', String(Math.round(percent)));
        progress.setAttribute('aria-label', `Wykorzystano ${Math.round(percent)}% celu`);
        progressFill.style.width = `${percent}%`;
        const difference = periodTarget - groupTotals.get(group.id);
        status.classList.toggle('over-target', difference < 0);
        status.textContent = difference < 0
          ? `Powyżej celu o ${money(Math.abs(difference))}`
          : `Pozostało ${money(difference)}`;
      }

      card.append(heading, actualLabel, actual, targetLabel, targetSummary, progress, status);
      el.spendingGroupList.append(card);
    });

    const unassignedCard = document.createElement('article');
    unassignedCard.className = 'spending-group-card unassigned-spending-card';
    const unassignedHeading = document.createElement('h3');
    unassignedHeading.textContent = 'Bez przypisania';
    const unassignedTotal = [...unassignedTotals.values()].reduce((total, amount) => total + amount, 0);
    const unassignedActual = document.createElement('strong');
    unassignedActual.className = 'spending-group-actual';
    unassignedActual.textContent = money(unassignedTotal);
    const unassignedCaption = document.createElement('span');
    unassignedCaption.className = 'spending-group-caption';
    unassignedCaption.textContent = 'Kategorie bez grupy w wybranym okresie';
    const unassignedList = document.createElement('ul');
    unassignedList.className = 'unassigned-category-list';
    [...unassignedTotals.entries()].sort((a, b) => b[1] - a[1]).forEach(([category, amount]) => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = category;
      const value = document.createElement('strong');
      value.textContent = money(amount);
      row.append(name, value);
      unassignedList.append(row);
    });
    if (!unassignedTotals.size) {
      const empty = document.createElement('p');
      empty.className = 'spending-group-status';
      empty.textContent = 'Brak nieprzypisanych wydatków w tym okresie.';
      unassignedList.append(empty);
    }
    unassignedCard.append(unassignedHeading, unassignedCaption, unassignedActual, unassignedList);
    el.spendingGroupList.append(unassignedCard);
  }

  function render() {
    renderPeriod();
    const items = visibleTransactions();
    const analyzedItems = items.filter(item => !item.excludedFromAnalysis);
    const income = analyzedItems.reduce((total, item) => total + Math.max(item.amount, 0), 0);
    const expense = analyzedItems.reduce((total, item) => total + Math.max(-item.amount, 0), 0);
    el.income.textContent = money(income);
    el.expense.textContent = money(expense);
    el.net.textContent = money(income - expense);
    el.net.classList.toggle('positive', income >= expense);
    el.net.classList.toggle('negative', income < expense);
    renderSpendingGroups(items);
    renderChart(analyzedItems);
    renderCashflowChart(analyzedItems);
    renderCategoryFilterOptions();
    renderTransactions(sortedTransactions(displayTransactions(filteredTransactions(items))));
    renderBudgetSwitcher();
    renderDuplicateCandidates();
  }

  function renderDuplicateCandidates() {
    el.duplicateCount.textContent = String(duplicateCandidates.length);
    el.reviewDuplicates.hidden = false;
    el.duplicateList.replaceChildren();
    el.duplicateHelp.textContent = duplicateCandidates.length
      ? 'These rows were not added because they matched an existing transaction. Review them and restore any that are separate real transactions.'
      : 'No skipped duplicates are saved in this budget yet. Import the original bank statement again to detect skipped rows; existing transactions will not be added twice.';
    if (!duplicateCandidates.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state duplicate-empty-state';
      const title = document.createElement('strong');
      title.textContent = 'No duplicates to review.';
      const copy = document.createElement('p');
      copy.textContent = 'Skipped rows from earlier imports cannot be recovered unless they were saved for review. Import the statement again to check for them.';
      const importButton = document.createElement('label');
      importButton.className = 'button button-primary';
      importButton.htmlFor = 'file-input';
      importButton.textContent = 'Import bank file';
      importButton.addEventListener('click', () => el.duplicateDialog.close());
      empty.append(title, copy, importButton);
      el.duplicateList.append(empty);
      return;
    }
    duplicateCandidates.forEach(candidate => {
      const row = document.createElement('article');
      row.className = 'duplicate-item';
      const details = document.createElement('div');
      details.className = 'duplicate-details';
      const description = document.createElement('strong');
      description.textContent = candidate.description;
      const metadata = document.createElement('p');
      const date = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        .format(new Date(`${candidate.date}T12:00:00`));
      metadata.textContent = `${date} · ${money(candidate.amount)}`;
      const source = document.createElement('small');
      source.textContent = candidate.sourceRow
        ? `${candidate.sourceFile || 'Imported file'}, row ${candidate.sourceRow}`
        : (candidate.sourceFile || 'Imported file');
      details.append(description, metadata, source);

      const actions = document.createElement('div');
      actions.className = 'duplicate-actions';
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'button button-secondary';
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', () => resolveDuplicate(candidate.id, false));
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'button button-primary';
      restore.textContent = 'Restore';
      restore.addEventListener('click', () => resolveDuplicate(candidate.id, true));
      actions.append(dismiss, restore);
      row.append(details, actions);
      el.duplicateList.append(row);
    });
  }

  async function resolveDuplicate(candidateId, restore) {
    const candidate = duplicateCandidates.find(item => item.id === candidateId);
    if (!candidate) return;
    const nextDuplicates = duplicateCandidates.filter(item => item.id !== candidateId);
    let nextTransactions = transactions;
    let nextCategories = categories;
    let nextDismissedDuplicates = dismissedDuplicates;
    if (restore) {
      const restored = { ...candidate };
      delete restored.sourceFile;
      delete restored.sourceRow;
      nextTransactions = [...transactions, restored];
      nextCategories = [...new Set([...categories, restored.category, 'Uncategorized'])];
    } else {
      nextDismissedDuplicates = [...dismissedDuplicates, duplicateOccurrenceKey(candidate)];
    }
    if (!await saveData(nextTransactions, nextCategories, nextDuplicates, nextDismissedDuplicates)) return;
    if (restore) selectedMonth = candidate.date.slice(0, 7);
    if (!nextDuplicates.length) el.duplicateDialog.close();
    render();
    showToast(restore ? 'Transaction restored to your list.' : 'Duplicate entry dismissed.');
  }

  async function updateTransaction(transactionId, updater) {
    const next = transactions.map(item => item.id === transactionId ? updater(item) : item);
    if (await saveData(next, categories)) render();
  }

  function changeMonth(delta) {
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    date.setMonth(date.getMonth() + delta * (selectedPeriod === 'year' ? 12 : selectedPeriod === 'quarter' ? 3 : 1));
    selectedMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    render();
  }

  function normalizeHeader(header) {
    return header.toLowerCase().replace(/^\uFEFF/, '').replace(/[^a-z0-9]/g, '');
  }

  function findColumn(headers, candidates) {
    return headers.findIndex(header => candidates.includes(normalizeHeader(header)));
  }

  function chooseDelimiter(text) {
    const line = text.split(/\r?\n/).find(value => value.trim()) || '';
    let commas = 0;
    let semicolons = 0;
    let tabs = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] === '"') {
        if (quoted && line[i + 1] === '"') i += 1;
        else quoted = !quoted;
      } else if (!quoted) {
        if (line[i] === ',') commas += 1;
        if (line[i] === ';') semicolons += 1;
        if (line[i] === '\t') tabs += 1;
      }
    }
    return tabs > commas && tabs >= semicolons ? '\t' : semicolons > commas ? ';' : ',';
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const character = text[i];
      if (character === '"') {
        if (quoted && text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && character === delimiter) {
        row.push(field);
        field = '';
      } else if (!quoted && (character === '\n' || character === '\r')) {
        if (character === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field);
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
        field = '';
      } else {
        field += character;
      }
    }
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    if (quoted) throw new Error('The file has an unfinished quoted field.');
    return rows;
  }

  async function extractZipEntries(buffer) {
    const view = new DataView(buffer);
    const decoder = new TextDecoder();
    const minOffset = Math.max(0, buffer.byteLength - 65557);
    let endOffset = -1;
    for (let offset = buffer.byteLength - 22; offset >= minOffset; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endOffset = offset;
        break;
      }
    }
    if (endOffset < 0) throw new Error('This is not a valid .xlsx workbook.');
    const entryCount = view.getUint16(endOffset + 10, true);
    const directorySize = view.getUint32(endOffset + 12, true);
    let directoryOffset = view.getUint32(endOffset + 16, true);
    if (entryCount > 10000 || directoryOffset + directorySize > endOffset) {
      throw new Error('The workbook archive is invalid or too large to read.');
    }
    const entries = new Map();
    let uncompressedSize = 0;
    for (let index = 0; index < entryCount; index += 1) {
      if (directoryOffset + 46 > buffer.byteLength || view.getUint32(directoryOffset, true) !== 0x02014b50) {
        throw new Error('The workbook archive has an invalid directory.');
      }
      const method = view.getUint16(directoryOffset + 10, true);
      const compressedSize = view.getUint32(directoryOffset + 20, true);
      const originalSize = view.getUint32(directoryOffset + 24, true);
      const nameLength = view.getUint16(directoryOffset + 28, true);
      const extraLength = view.getUint16(directoryOffset + 30, true);
      const commentLength = view.getUint16(directoryOffset + 32, true);
      const localOffset = view.getUint32(directoryOffset + 42, true);
      const nameStart = directoryOffset + 46;
      const name = decoder.decode(new Uint8Array(buffer, nameStart, nameLength));
      directoryOffset = nameStart + nameLength + extraLength + commentLength;
      if (compressedSize === 0xffffffff || originalSize === 0xffffffff || localOffset === 0xffffffff) {
        throw new Error('Excel files larger than 4 GB are not supported.');
      }
      uncompressedSize += originalSize;
      if (uncompressedSize > MAX_UNCOMPRESSED_FILE_SIZE) {
        throw new Error('The uncompressed workbook is larger than 50 MB.');
      }
      if (method !== 0 && method !== 8) throw new Error('This workbook uses an unsupported compression method.');
      if (localOffset + 30 > buffer.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error('The workbook archive contains an invalid entry.');
      }
      const dataOffset = localOffset + 30 + view.getUint16(localOffset + 26, true) +
        view.getUint16(localOffset + 28, true);
      if (dataOffset + compressedSize > buffer.byteLength) throw new Error('The workbook archive is incomplete.');
      const compressed = new Uint8Array(buffer, dataOffset, compressedSize);
      let contents;
      if (method === 0) {
        contents = compressed.slice();
      } else {
        if (typeof DecompressionStream === 'undefined') {
          throw new Error('This browser cannot read .xlsx files. Please use a recent version of Chrome, Edge, or Firefox.');
        }
        try {
          const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          const reader = stream.getReader();
          const chunks = [];
          let size = 0;
          while (true) {
            const result = await reader.read();
            if (result.done) break;
            size += result.value.byteLength;
            if (size > originalSize || size > MAX_UNCOMPRESSED_FILE_SIZE) {
              await reader.cancel();
              throw new Error('A workbook entry exceeds its declared size.');
            }
            chunks.push(result.value);
          }
          contents = new Uint8Array(size);
          let position = 0;
          chunks.forEach(chunk => {
            contents.set(chunk, position);
            position += chunk.byteLength;
          });
        } catch (error) {
          throw new Error(`Could not decompress the workbook: ${error.message}`);
        }
      }
      if (contents.byteLength !== originalSize) throw new Error('A workbook entry has an unexpected size.');
      entries.set(name, contents);
    }
    return entries;
  }

  function parseWorkbookXml(bytes) {
    const document = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
    if (document.getElementsByTagName('parsererror').length) throw new Error('The workbook contains invalid XML.');
    return document;
  }

  function columnIndex(reference) {
    const letters = reference.match(/^[A-Z]+/i);
    if (!letters) throw new Error('The workbook contains an invalid cell reference.');
    return [...letters[0].toUpperCase()].reduce((index, letter) =>
      index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  }

  function workbookSheetPath(workbook, relationships) {
    const mainNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const relationNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const packageNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const sheet = [...workbook.getElementsByTagNameNS(mainNs, 'sheet')]
      .find(item => !item.getAttribute('state') || item.getAttribute('state') === 'visible');
    if (!sheet) throw new Error('The workbook does not contain a visible worksheet.');
    const relationId = sheet.getAttributeNS(relationNs, 'id');
    const relation = [...relationships.getElementsByTagNameNS(packageNs, 'Relationship')]
      .find(item => item.getAttribute('Id') === relationId);
    if (!relation) throw new Error('Could not find the workbook worksheet.');
    const target = relation.getAttribute('Target');
    const parts = target.startsWith('/') ? [] : ['xl'];
    target.replace(/^\/+/, '').split('/').forEach(part => {
      if (!part || part === '.') return;
      if (part === '..') {
        if (!parts.length) throw new Error('The workbook contains an invalid worksheet path.');
        parts.pop();
      } else {
        parts.push(part);
      }
    });
    return parts.join('/');
  }

  function workbookRows(sheet, sharedStrings) {
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const sheetRows = [...sheet.getElementsByTagNameNS(ns, 'row')];
    if (sheetRows.length - 1 > MAX_IMPORT_ROWS) {
      throw new Error(`This file has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows.`);
    }
    return sheetRows.map(row => {
      const values = [];
      [...row.getElementsByTagNameNS(ns, 'c')].forEach(cell => {
        const type = cell.getAttribute('t');
        let value = '';
        if (type === 'inlineStr') {
          value = [...cell.getElementsByTagNameNS(ns, 't')].map(text => text.textContent).join('');
        } else {
          const node = cell.getElementsByTagNameNS(ns, 'v')[0];
          value = node ? node.textContent : '';
          if (type === 's') {
            const shared = sharedStrings[Number(value)];
            if (shared === undefined) throw new Error('The workbook contains an invalid shared string reference.');
            value = shared;
          }
        }
        values[columnIndex(cell.getAttribute('r'))] = value;
      });
      return values.map(value => value === undefined ? '' : String(value));
    }).filter(row => row.some(value => value.trim()));
  }

  async function parseWorkbook(buffer) {
    const entries = await extractZipEntries(buffer);
    const workbookBytes = entries.get('xl/workbook.xml');
    const relationshipBytes = entries.get('xl/_rels/workbook.xml.rels');
    if (!workbookBytes || !relationshipBytes) throw new Error('This file is not a supported Excel workbook.');
    const workbook = parseWorkbookXml(workbookBytes);
    const relationships = parseWorkbookXml(relationshipBytes);
    const sheetBytes = entries.get(workbookSheetPath(workbook, relationships));
    if (!sheetBytes) throw new Error('Could not read the first worksheet in this workbook.');
    const sharedStringBytes = entries.get('xl/sharedStrings.xml');
    const sharedStrings = sharedStringBytes
      ? [...parseWorkbookXml(sharedStringBytes).getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'si')]
        .map(item => [...item.getElementsByTagNameNS(
          'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 't')]
          .map(text => text.textContent).join(''))
      : [];
    const rows = workbookRows(parseWorkbookXml(sheetBytes), sharedStrings);
    const result = parseTransactionRows(rows, parseSpreadsheetDate);
    if (isBnpStatement(rows)) result.budgetId = 'bnp';
    return result;
  }

  function isBnpStatement(rows) {
    if (!rows.length) return false;
    const headers = rows[0].map(normalizeHeader);
    return headers.includes('datatransakcji') &&
      headers.includes('typtransakcji') &&
      headers.includes('kwota');
  }

  function parseDate(value) {
    const input = value.trim();
    let match = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
    match = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
    match = input.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return null;
    return validDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  function parseSpreadsheetDate(value) {
    const input = String(value).trim();
    if (/^\d+(?:\.\d+)?$/.test(input)) {
      const serial = Number(input);
      if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    return parseDate(input);
  }

  function validDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function parseAmount(value) {
    let input = value.trim().replace(/[\s\u00a0]/g, '');
    if (!input) return null;
    let negative = false;
    if (/^\(.*\)$/.test(input)) {
      negative = true;
      input = input.slice(1, -1);
    }
    if (input.endsWith('-')) {
      negative = true;
      input = input.slice(0, -1);
    }
    if (input.startsWith('-')) {
      negative = true;
      input = input.slice(1);
    } else if (input.startsWith('+')) {
      input = input.slice(1);
    }
    input = input.replace(/[^\d.,]/g, '');
    const comma = input.lastIndexOf(',');
    const dot = input.lastIndexOf('.');
    if (comma !== -1 && dot !== -1) {
      const decimal = comma > dot ? ',' : '.';
      const grouping = decimal === ',' ? /\./g : /,/g;
      input = input.replace(grouping, '').replace(decimal, '.');
    } else if (comma !== -1) {
      const decimals = input.length - comma - 1;
      input = decimals > 0 && decimals <= 2 ? input.replace(/\./g, '').replace(',', '.') : input.replace(/,/g, '');
    } else if ((input.match(/\./g) || []).length > 1) {
      const parts = input.split('.');
      input = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
    }
    const amount = Number(input);
    if (!Number.isFinite(amount)) return null;
    return Math.round((negative ? -amount : amount) * 100) / 100;
  }

  function mapCategory(value) {
    const normalized = value.trim().toLowerCase();
    return categories.find(category => category.toLowerCase() === normalized) ||
      (value.trim() ? value.trim().slice(0, 32) : 'Uncategorized');
  }

  function parseTransactions(text) {
    const rows = parseDelimited(text.replace(/^\uFEFF/, ''), chooseDelimiter(text));
    if (isErsteStatement(rows)) return { ...parseErsteStatement(rows), budgetId: 'erste' };
    return parseTransactionRows(rows, parseDate);
  }

  function isErsteStatement(rows) {
    if (rows.length < 2 || rows[0].length < 8) return false;
    const [statementDate, periodStart, account, , currencyCode, , , count] = rows[0];
    const transaction = rows[1];
    return /^\d{4}-\d{2}-\d{2}$/.test(statementDate.trim()) &&
      /^\d{2}-\d{2}-\d{4}$/.test(periodStart.trim()) &&
      /^'\d{2}(?:\s|$)/.test(account.trim()) &&
      /^[A-Z]{3}$/.test(currencyCode.trim()) &&
      /^\d+$/.test(count.trim()) &&
      transaction.length >= 8 && Boolean(parseDate(transaction[0] || '')) &&
      Boolean(parseDate(transaction[1] || '')) && parseAmount(transaction[5] || '') !== null;
  }

  function parseErsteStatement(rows) {
    const currencyCode = rows[0][4].trim().toUpperCase();
    if (currencyCode !== 'PLN') {
      return {
        imported: [],
        skipped: rows.length - 1,
        unsupportedCurrencies: [currencyCode]
      };
    }
    const headers = [
      'Data transakcji', 'Data księgowania', 'Opis', 'Odbiorca',
      'Rachunek odbiorcy', 'Kwota', 'Saldo', 'Numer operacji'
    ];
    return parseTransactionRows([headers, ...rows.slice(1)], parseDate);
  }

  function parseTransactionRows(rows, dateParser) {
    if (rows.length < 2) throw new Error('Add a header row and at least one transaction row to your file.');
    const headers = rows[0];
    const dateIndex = findColumn(headers, ['date', 'transactiondate', 'bookingdate', 'bookeddate', 'valuedate', 'postingdate', 'datatransakcji', 'dataksiegowania']);
    const descriptionIndex = findColumn(headers, ['description', 'name', 'details', 'memo', 'payee', 'narrative', 'transaction', 'opis']);
    const amountIndex = findColumn(headers, ['amount', 'transactionamount', 'value', 'sum', 'kwota']);
    const debitIndex = findColumn(headers, ['debit', 'withdrawal', 'withdrawals', 'moneyout']);
    const creditIndex = findColumn(headers, ['credit', 'deposit', 'deposits', 'moneyin']);
    const categoryIndex = findColumn(headers, ['category', 'type', 'typtransakcji']);
    const currencyIndex = findColumn(headers, ['currency', 'waluta']);
    let counterpartyIndex = findColumn(headers, ['recipient', 'counterparty', 'beneficiary', 'payee', 'odbiorca']);
    if (counterpartyIndex < 0) counterpartyIndex = findColumn(headers, ['nadawca']);
    const referenceIndex = findColumn(headers, ['transactionid', 'operationid', 'transactionreference', 'reference', 'numeroperacji']);
    if (dateIndex < 0) throw new Error('Could not find a date column. Use a header such as Date or Booking Date.');
    if (descriptionIndex < 0) throw new Error('Could not find a description column. Use Description, Name, or Details.');
    if (amountIndex < 0 && debitIndex < 0 && creditIndex < 0) throw new Error('Could not find an amount, debit, or credit column.');
    if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error(`This file has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows.`);
    const imported = [];
    const unsupportedCurrencies = new Set();
    let skipped = 0;
    rows.slice(1).forEach((row, rowIndex) => {
      const sourceCurrency = currencyIndex >= 0 ? (row[currencyIndex] || '').trim().toUpperCase() : '';
      if (sourceCurrency && sourceCurrency !== 'PLN') {
        unsupportedCurrencies.add(sourceCurrency);
        skipped += 1;
        return;
      }
      const date = dateParser(row[dateIndex] || '');
      const description = (row[descriptionIndex] || '').trim().slice(0, 220);
      let amount = amountIndex >= 0 ? parseAmount(row[amountIndex] || '') : null;
      if (amount === null && (debitIndex >= 0 || creditIndex >= 0)) {
        const debit = debitIndex >= 0 ? parseAmount(row[debitIndex] || '') : null;
        const credit = creditIndex >= 0 ? parseAmount(row[creditIndex] || '') : null;
        amount = debit !== null && debit !== 0 ? -Math.abs(debit) : credit !== null ? Math.abs(credit) : null;
      }
      if (!date || !description || amount === null) {
        skipped += 1;
        return;
      }
      const item = {
        id: id(), date, description, amount,
        category: mapCategory(categoryIndex >= 0 ? row[categoryIndex] || '' : ''),
        categorySource: 'import',
        categoryMatch: categoryMatchFor(
          description,
          counterpartyIndex >= 0 ? row[counterpartyIndex] || '' : ''
        ),
        excludedFromAnalysis: false,
        unnecessary: false,
        sourceRow: rowIndex + 2
      };
      const context = [
        counterpartyIndex >= 0 ? row[counterpartyIndex] || '' : '',
        categoryIndex >= 0 ? row[categoryIndex] || '' : '',
        referenceIndex >= 0 ? row[referenceIndex] || '' : ''
      ].map(value => value.trim().normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ')).join('\u0000');
      item.importIdentity = `${transactionKey(item)}\u0000${hashImportContext(context)}`;
      imported.push(item);
    });
    return { imported, skipped, unsupportedCurrencies: [...unsupportedCurrencies] };
  }

  function hashImportContext(value) {
    let hash = 14695981039346656037n;
    for (const character of value) {
      hash = BigInt.asUintN(64, (hash ^ BigInt(character.codePointAt(0))) * 1099511628211n);
    }
    return hash.toString(16);
  }

  function transactionKey(item) {
    return `${item.date}\u0000${item.description.toLocaleLowerCase()}\u0000${item.amount.toFixed(2)}`;
  }

  function normalizedCategoryText(value) {
    return value.trim().normalize('NFKC').toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ');
  }

  function categoryMatchFor(description, counterparty = '') {
    return `${normalizedCategoryText(description)}\u0000${normalizedCategoryText(counterparty)}`;
  }

  function inferSavedCategory(item, examples) {
    const eligibleExamples = examples.filter(example =>
      !example.splits?.length &&
      example.category &&
      example.category !== 'Uncategorized' &&
      example.categorySource !== 'import' &&
      example.categorySource !== 'learned');
    const exactMatches = item.categoryMatch
      ? eligibleExamples.filter(example => example.categoryMatch === item.categoryMatch)
      : [];
    const matches = exactMatches.length ? exactMatches : eligibleExamples.filter(example =>
      normalizedCategoryText(example.description) === normalizedCategoryText(item.description));
    const matchedCategories = new Set(matches.map(example => example.category));
    return matchedCategories.size === 1 ? [...matchedCategories][0] : null;
  }

  function openImportReview(items) {
    const groups = new Map();
    items.filter(item => item.category === 'Uncategorized').forEach(item => {
      const key = item.categoryMatch || normalizedCategoryText(item.description);
      if (!groups.has(key)) groups.set(key, { items: [] });
      groups.get(key).items.push(item);
    });
    pendingImportReview = [...groups.values()];
    if (!pendingImportReview.length) return;

    const itemCount = pendingImportReview.reduce((total, group) => total + group.items.length, 0);
    el.importReviewTitle.textContent = `Review ${itemCount} uncategorized transaction${itemCount === 1 ? '' : 's'}`;
    el.importReviewList.replaceChildren();
    pendingImportReview.forEach((group, index) => {
      const row = document.createElement('article');
      row.className = 'import-review-row';
      row.dataset.reviewIndex = String(index);

      const details = document.createElement('div');
      const description = document.createElement('div');
      description.className = 'import-review-description';
      description.title = group.items[0].description;
      description.textContent = group.items[0].description;
      const metadata = document.createElement('p');
      metadata.className = 'import-review-meta';
      const amounts = [...new Set(group.items.map(item => money(item.amount)))];
      metadata.textContent = `${group.items.length} transaction${group.items.length === 1 ? '' : 's'} · ${amounts.join(', ')}`;
      details.append(description, metadata);

      const select = categorySelect('Uncategorized', 'import-review-category');
      select.setAttribute('aria-label', `Category for ${group.items[0].description}`);

      const rememberLabel = document.createElement('label');
      rememberLabel.className = 'import-review-remember';
      const remember = document.createElement('input');
      remember.type = 'checkbox';
      remember.checked = true;
      const rememberText = document.createElement('span');
      rememberText.textContent = 'Remember for matching future imports';
      rememberLabel.append(remember, rememberText);

      row.append(details, select, rememberLabel);
      el.importReviewList.append(row);
    });
    el.importReviewError.textContent = '';
    el.importReviewDialog.showModal();
  }

  async function saveImportReview() {
    const choices = [...el.importReviewList.querySelectorAll('.import-review-row')]
      .map(row => {
        const group = pendingImportReview[Number(row.dataset.reviewIndex)];
        return {
          ids: new Set(group.items.map(item => item.id)),
          category: row.querySelector('.import-review-category').value,
          remember: row.querySelector('.import-review-remember input').checked
        };
      });
    const selected = choices.filter(choice => choice.category !== 'Uncategorized');
    const selectedById = new Map();
    selected.forEach(choice => choice.ids.forEach(id => selectedById.set(id, choice)));
    const nextTransactions = transactions.map(item => {
      const choice = selectedById.get(item.id);
      return choice ? {
        ...item,
        category: choice.category,
        categorySource: choice.remember ? 'manual' : 'import'
      } : item;
    });
    if (selected.length && !await saveData(nextTransactions, categories)) {
      el.importReviewError.textContent = 'Could not save your category choices. Please try again.';
      return;
    }

    const remembered = selected.filter(choice => choice.remember).length;
    el.importReviewDialog.close();
    pendingImportReview = [];
    render();
    showToast(selected.length
      ? `${selected.length} category choice${selected.length === 1 ? '' : 's'} saved${remembered ? ` · ${remembered} will be remembered` : ''}.`
      : 'Uncategorized transactions kept as they are.');
  }

  function duplicateOccurrenceKey(item, sourceFile) {
    return `${sourceFile || item.sourceFile || ''}\u0000${item.sourceRow || ''}\u0000${item.importIdentity}`;
  }

  function mergeImportedRows(items, sourceFile) {
    const nextTransactions = [...transactions];
    const nextDuplicates = [...duplicateCandidates];
    const imported = [];
    const addedDuplicates = [];
    const existingIdentities = new Set(transactions.map(item => item.importIdentity).filter(Boolean));
    const pendingOccurrences = new Set(duplicateCandidates.map(item => duplicateOccurrenceKey(item, item.sourceFile || '')));
    const dismissedOccurrences = new Set(dismissedDuplicates);
    const seenIdentities = new Set();
    const categoryExamples = [...transactions];
    let learnedCategories = 0;
    const legacyByKey = new Map();
    const matchedLegacyIds = new Set();

    transactions.filter(item => !item.importIdentity).forEach(item => {
      const key = transactionKey(item);
      if (!legacyByKey.has(key)) legacyByKey.set(key, []);
      legacyByKey.get(key).push(item);
    });

    items.forEach(item => {
      const identity = item.importIdentity || transactionKey(item);
      const occurrenceKey = duplicateOccurrenceKey(item, sourceFile);
      if (pendingOccurrences.has(occurrenceKey)) {
        seenIdentities.add(identity);
        return;
      }
      if (dismissedOccurrences.has(occurrenceKey)) {
        seenIdentities.add(identity);
        return;
      }
      if (seenIdentities.has(identity)) {
        const candidate = { ...item, sourceFile };
        addedDuplicates.push(candidate);
        pendingOccurrences.add(occurrenceKey);
        return;
      }
      seenIdentities.add(identity);
      if (existingIdentities.has(identity)) return;

      const legacyMatches = legacyByKey.get(transactionKey(item)) || [];
      const legacyMatch = legacyMatches.find(existing => !matchedLegacyIds.has(existing.id));
      if (legacyMatch) {
        matchedLegacyIds.add(legacyMatch.id);
        const index = nextTransactions.findIndex(existing => existing.id === legacyMatch.id);
        nextTransactions[index] = { ...legacyMatch, importIdentity: identity };
        existingIdentities.add(identity);
        return;
      }
      if (legacyMatches.length) {
        const candidate = { ...item, sourceFile };
        addedDuplicates.push(candidate);
        pendingOccurrences.add(occurrenceKey);
        return;
      }

      const learnedCategory = inferSavedCategory(item, categoryExamples);
      if (learnedCategory) {
        item.category = learnedCategory;
        item.categorySource = 'learned';
        learnedCategories += 1;
      }
      imported.push(item);
      categoryExamples.push(item);
      existingIdentities.add(identity);
    });

    nextDuplicates.push(...addedDuplicates);
    return { nextTransactions, nextDuplicates, imported, addedDuplicates, learnedCategories };
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      showToast('Choose a file smaller than 10 MB.', true);
      return;
    }
    try {
      const result = file.name.toLowerCase().endsWith('.xlsx')
        ? await parseWorkbook(await file.arrayBuffer())
        : parseTransactions(await file.text());
      if (!result.imported.length) {
        const currencies = result.unsupportedCurrencies.length
          ? ` Only PLN transactions are supported; found: ${result.unsupportedCurrencies.join(', ')}.` : '';
        throw new Error(`No valid transactions were found. Check the dates, descriptions, and amounts in your file.${currencies}`);
      }
      if (result.budgetId && !await switchBudget(result.budgetId)) return;
      const moved = result.budgetId
        ? await moveMatchedTransactionsToBudget(result.imported, result.budgetId) : 0;
      const merged = mergeImportedRows(result.imported, file.name);
      const next = [...merged.nextTransactions, ...merged.imported];
      const nextCategories = [...new Set([...categories, ...merged.imported.map(item => item.category)])];
      if (!await saveData(next, nextCategories, merged.nextDuplicates)) return;
      if (merged.imported.length) {
        const newest = merged.imported.reduce((latest, item) => item.date > latest ? item.date : latest, merged.imported[0].date);
        selectedMonth = newest.slice(0, 7);
      }
      render();
      const duplicates = result.imported.length - merged.imported.length;
      showToast([
        `${merged.imported.length} transaction${merged.imported.length === 1 ? '' : 's'} imported`,
        duplicates ? `${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : '',
        merged.addedDuplicates.length ? `${merged.addedDuplicates.length} ready to review` : '',
        merged.learnedCategories ? `${merged.learnedCategories} categorized from your saved choices` : '',
        moved ? `${moved} existing transaction${moved === 1 ? '' : 's'} moved to this budget` : '',
        result.skipped ? `${result.skipped} invalid or non-PLN row${result.skipped === 1 ? '' : 's'} skipped` : ''
      ].filter(Boolean).join(' · '));
      openImportReview(merged.imported);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      el.file.value = '';
    }
  }

  function renderSplitRow(category, amount) {
    const row = document.createElement('div');
    row.className = 'split-row';
    const select = categorySelect(category, 'split-category');
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.inputMode = 'decimal';
    input.value = Number(amount).toFixed(2);
    input.setAttribute('aria-label', 'Split amount');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-split';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remove split part');
    remove.addEventListener('click', () => {
      row.remove();
      updateSplitTotal();
    });
    input.addEventListener('input', updateSplitTotal);
    row.append(select, input, remove);
    el.splitRows.append(row);
  }

  function updateSplitTotal() {
    const total = [...el.splitRows.querySelectorAll('input[type="number"]')]
      .reduce((sum, input) => sum + (Number.parseFloat(input.value) || 0), 0);
    el.splitTotal.textContent = money(total);
  }

  function openSplit(transaction) {
    activeSplitId = transaction.id;
    el.splitDescription.textContent = `${transaction.description} · ${money(transaction.amount)}`;
    el.splitRows.replaceChildren();
    partsOf(transaction).forEach(part => renderSplitRow(part.category, part.amount));
    el.splitError.textContent = '';
    updateSplitTotal();
    el.dialog.showModal();
  }

  async function saveSplit(event) {
    event.preventDefault();
    const transaction = transactions.find(item => item.id === activeSplitId);
    if (!transaction) return;
    const rows = [...el.splitRows.querySelectorAll('.split-row')];
    const splits = rows.map(row => ({
      category: row.querySelector('select').value,
      amount: Math.round(Number.parseFloat(row.querySelector('input').value) * 100) / 100
    }));
    if (splits.length < 2) {
      el.splitError.textContent = 'Add at least two parts to split this transaction.';
      return;
    }
    if (splits.some(part => !Number.isFinite(part.amount) || part.amount === 0 ||
      Math.sign(part.amount) !== Math.sign(transaction.amount))) {
      el.splitError.textContent = 'Each part must have a non-zero amount with the same sign as the original.';
      return;
    }
    if (Math.abs(splits.reduce((sum, part) => sum + part.amount, 0) - transaction.amount) > 0.01) {
      el.splitError.textContent = `Parts must add up to ${money(transaction.amount)}.`;
      return;
    }
    const next = transactions.map(item => item.id === activeSplitId
      ? { ...item, splits, category: splits[0].category } : item);
    if (await saveData(next, categories)) {
      el.dialog.close();
      render();
      showToast('Transaction split saved.');
    }
  }

  async function addCategory() {
    const value = el.categoryInput.value.trim().slice(0, 32);
    if (!value) {
      showToast('Enter a category name first.', true);
      return;
    }
    if (categories.some(category => category.toLowerCase() === value.toLowerCase())) {
      showToast('That category already exists.', true);
      return;
    }
    if (await saveData(transactions, [...categories, value])) {
      el.categoryInput.value = '';
      render();
      showToast(`“${value}” added to your categories.`);
    }
  }

  function renderCategoryManager() {
    el.categoryList.replaceChildren();
    categories.forEach(category => {
      const row = document.createElement('div');
      row.className = selectedBudgetId === 'bnp'
        ? 'category-manager-row with-group-select' : 'category-manager-row';
      row.dataset.originalCategory = category;
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 32;
      input.value = category;
      input.setAttribute('aria-label', `Category name: ${category}`);
      let groupSelect = null;
      if (selectedBudgetId === 'bnp') {
        groupSelect = document.createElement('select');
        groupSelect.className = 'category-group-select';
        groupSelect.setAttribute('aria-label', `Spending group for ${category}`);
        const unassignedOption = document.createElement('option');
        unassignedOption.value = '';
        unassignedOption.textContent = 'No group';
        groupSelect.append(unassignedOption);
        BNP_SPENDING_GROUPS.forEach(group => {
          const option = document.createElement('option');
          option.value = group.id;
          option.textContent = group.name;
          groupSelect.append(option);
        });
        groupSelect.value = budgets.bnp.categoryGroups[category] || '';
        groupSelect.dataset.originalGroup = groupSelect.value;
        groupSelect.addEventListener('change', () => {
          el.categoryError.textContent = '';
          updateCategorySaveButton();
        });
      }
      const remove = document.createElement('button');
      remove.className = 'category-remove';
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.disabled = category === 'Uncategorized';
      remove.setAttribute('aria-label', `Delete category ${category}`);
      remove.addEventListener('click', () => {
        row.remove();
        el.categoryError.textContent = '';
        updateCategorySaveButton();
      });
      input.addEventListener('input', () => {
        el.categoryError.textContent = '';
        updateCategorySaveButton();
      });
      if (groupSelect) row.append(input, groupSelect, remove);
      else row.append(input, remove);
      el.categoryList.append(row);
    });
    el.categoryError.textContent = '';
    updateCategorySaveButton();
  }

  function hasUnsavedCategoryChanges() {
    const rows = [...el.categoryList.querySelectorAll('.category-manager-row')];
    return rows.length !== categories.length || rows.some(row => {
      const groupSelect = row.querySelector('.category-group-select');
      return row.querySelector('input').value.trim() !== row.dataset.originalCategory ||
        (groupSelect && groupSelect.value !== groupSelect.dataset.originalGroup);
    });
  }

  function updateCategorySaveButton() {
    el.saveCategories.disabled = !hasUnsavedCategoryChanges();
  }

  function closeCategoryManager() {
    if (hasUnsavedCategoryChanges() &&
      !window.confirm('Discard your unsaved category changes?')) return;
    el.categoryDialog.close();
  }

  async function saveCategoryChanges() {
    const rows = [...el.categoryList.querySelectorAll('.category-manager-row')];
    const changes = rows.map(row => ({
      original: row.dataset.originalCategory,
      value: row.querySelector('input').value.trim().slice(0, 32),
      group: row.querySelector('.category-group-select')?.value || ''
    }));
    if (changes.some(change => !change.value)) {
      el.categoryError.textContent = 'Category names cannot be empty.';
      return;
    }
    const finalNames = changes.map(change => change.value);
    if (new Set(finalNames.map(value => value.toLocaleLowerCase())).size !== finalNames.length) {
      el.categoryError.textContent = 'Category names must be unique.';
      return;
    }
    const categoryChanges = new Map(changes.map(change => [
      change.original,
      change.value
    ]));
    categories.forEach(category => {
      if (!categoryChanges.has(category)) categoryChanges.set(category, 'Uncategorized');
    });
    const nextCategories = changes.map(change => change.value);
    const nextCategoryGroups = selectedBudgetId === 'bnp'
      ? Object.fromEntries(changes.filter(change => change.group)
        .map(change => [change.value, change.group]))
      : budgets[selectedBudgetId].categoryGroups;
    const nextTransactions = transactions.map(item => ({
      ...item,
      category: categoryChanges.get(item.category) || item.category,
      splits: item.splits && item.splits.map(part => ({
        ...part, category: categoryChanges.get(part.category) || part.category
      }))
    }));
    const nextCategoryFilters = new Set([...selectedCategoryFilters]
      .map(category => categoryChanges.get(category) || category)
      .filter(category => nextCategories.includes(category)));
    if (!hasUnsavedCategoryChanges()) {
      el.categoryDialog.close();
      return;
    }
    if (await saveData(nextTransactions, nextCategories, undefined, undefined, nextCategoryGroups)) {
      selectedCategoryFilters = nextCategoryFilters;
      el.categoryDialog.close();
      render();
      showToast(selectedBudgetId === 'bnp'
        ? 'Category names and group assignments saved.'
        : 'Category changes saved.');
    }
  }

  function applyCustomRange() {
    const start = el.rangeStart.value;
    const end = el.rangeEnd.value;
    if (!start || !end) return;
    if (start > end) {
      showToast('The start date must be on or before the end date.', true);
      return;
    }
    customStart = start;
    customEnd = end;
    render();
  }

  el.file.addEventListener('change', event => importFile(event.target.files[0]));
  el.budgetErste.addEventListener('click', () => switchBudget('erste'));
  el.budgetBnp.addEventListener('click', () => switchBudget('bnp'));
  el.previous.addEventListener('click', () => changeMonth(-1));
  el.next.addEventListener('click', () => changeMonth(1));
  el.periodSelect.addEventListener('change', () => {
    selectedPeriod = el.periodSelect.value;
    render();
  });
  el.cashflowGranularity.addEventListener('change', render);
  el.rangeStart.value = customStart;
  el.rangeEnd.value = customEnd;
  el.rangeStart.addEventListener('change', applyCustomRange);
  el.rangeEnd.addEventListener('change', applyCustomRange);
  el.transactionSort.addEventListener('change', () => {
    selectedSort = el.transactionSort.value;
    renderTransactions(sortedTransactions(displayTransactions(filteredTransactions(visibleTransactions()))));
  });
  el.hideExcluded.addEventListener('change', () => {
    hideExcluded = el.hideExcluded.checked;
    renderTransactions(sortedTransactions(displayTransactions(filteredTransactions(visibleTransactions()))));
  });
  el.categoryFilterSearch.addEventListener('input', () => {
    categoryFilterQuery = el.categoryFilterSearch.value;
    renderCategoryFilterOptions();
  });
  el.categoryFilterSearch.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    selectVisibleCategoryFilters();
  });
  el.clearCategoryFilter.addEventListener('click', clearCategoryFilters);
  el.categoryFilter.addEventListener('toggle', () => {
    if (el.categoryFilter.open) el.categoryFilterSearch.focus();
  });
  el.closeCategoryTransactions.addEventListener('click', () => el.categoryTransactionsDialog.close());
  el.closeImportReview.addEventListener('click', () => el.importReviewDialog.close());
  el.skipImportReview.addEventListener('click', () => {
    pendingImportReview = [];
    el.importReviewDialog.close();
    showToast('Uncategorized transactions kept as they are.');
  });
  el.saveImportReview.addEventListener('click', saveImportReview);
  el.reviewDuplicates.addEventListener('click', () => el.duplicateDialog.showModal());
  el.closeDuplicates.addEventListener('click', () => el.duplicateDialog.close());
  el.addCategory.addEventListener('click', addCategory);
  el.manageCategories.addEventListener('click', () => {
    renderCategoryManager();
    el.categoryDialog.showModal();
  });
  el.closeCategories.addEventListener('click', closeCategoryManager);
  el.cancelCategories.addEventListener('click', closeCategoryManager);
  el.saveCategories.addEventListener('click', saveCategoryChanges);
  el.categoryDialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeCategoryManager();
  });
  el.categoryInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCategory();
    }
  });
  el.addSplit.addEventListener('click', () => {
    renderSplitRow(categories[0], 0);
    updateSplitTotal();
  });
  el.splitForm.addEventListener('submit', saveSplit);
  el.closeSplit.addEventListener('click', () => el.dialog.close());
  el.cancelSplit.addEventListener('click', () => el.dialog.close());
  async function initialize() {
    try {
      const saved = await loadData();
      budgets = saved.budgets;
      selectedBudgetId = saved.activeBudgetId;
      transactions = budgets[selectedBudgetId].transactions;
      categories = budgets[selectedBudgetId].categories;
      duplicateCandidates = budgets[selectedBudgetId].duplicates;
      dismissedDuplicates = budgets[selectedBudgetId].dismissedDuplicates;
      const newest = transactions.reduce((latest, item) => item.date > latest ? item.date : latest, '');
      if (newest) selectedMonth = newest.slice(0, 7);
      if (saved.migrated) {
        await writeData(budgets, selectedBudgetId);
        showToast('Saved transactions were migrated to the local database.');
      }
      el.storageStatus.hidden = true;
      document.body.classList.add('app-ready');
      render();
    } catch (error) {
      el.storageStatus.hidden = true;
      el.storageError.textContent = `Could not connect to the local database: ${error.message} Run start-server.cmd and open http://127.0.0.1:5187/ in your browser.`;
      el.storageError.hidden = false;
    }
  }

  initialize();
})();
