(() => {
  'use strict';

  const STORAGE_KEY = 'ledgerly.transactions.v1';
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_IMPORT_ROWS = 50000;
  const COLORS = ['#4b9b70', '#e3a34f', '#718bd0', '#db7865', '#9c78bf', '#49a9a3', '#d080a0', '#91a34f', '#db8a4c', '#78909b'];
  const DEFAULT_CATEGORIES = ['Food & dining', 'Transport', 'Shopping', 'Home', 'Health', 'Bills', 'Travel', 'Income', 'Entertainment', 'Other', 'Uncategorized'];
  const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

  const el = {
    file: document.querySelector('#file-input'),
    previous: document.querySelector('#previous-month'),
    next: document.querySelector('#next-month'),
    month: document.querySelector('#month-label'),
    categoryInput: document.querySelector('#new-category'),
    addCategory: document.querySelector('#add-category'),
    net: document.querySelector('#net-total'),
    income: document.querySelector('#income-total'),
    expense: document.querySelector('#expense-total'),
    segments: document.querySelector('#donut-segments'),
    donutTotal: document.querySelector('#donut-total'),
    legend: document.querySelector('#category-legend'),
    insight: document.querySelector('#month-insight'),
    list: document.querySelector('#transaction-list'),
    count: document.querySelector('#transaction-count'),
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
  let activeSplitId = null;
  let toastTimer = 0;
  let data = loadData();
  let transactions = data.transactions;
  let categories = data.categories;

  function isValidTransaction(item) {
    return item && typeof item.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      typeof item.description === 'string' && Number.isFinite(item.amount) && typeof item.category === 'string' &&
      (!item.splits || (Array.isArray(item.splits) && item.splits.every(part =>
        part && typeof part.category === 'string' && Number.isFinite(part.amount))));
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return { transactions: [], categories: [...DEFAULT_CATEGORIES] };
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.categories)) {
        throw new Error('Saved data has an unexpected format.');
      }
      return {
        transactions: parsed.transactions.filter(isValidTransaction),
        categories: [...new Set([...DEFAULT_CATEGORIES, ...parsed.categories.filter(value => typeof value === 'string')])]
      };
    } catch (error) {
      showToast(`Could not read saved transactions: ${error.message}`, true);
      return { transactions: [], categories: [...DEFAULT_CATEGORIES] };
    }
  }

  function saveData(nextTransactions, nextCategories) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions: nextTransactions, categories: nextCategories }));
      transactions = nextTransactions;
      categories = nextCategories;
      return true;
    } catch (error) {
      showToast(`Could not save your changes on this device: ${error.message}`, true);
      return false;
    }
  }

  function showToast(message, isError = false) {
    el.toast.textContent = message;
    el.toast.classList.toggle('error', isError);
    el.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.toast.classList.remove('visible'), 4200);
  }

  function money(amount) { return currency.format(amount); }
  function visibleTransactions() {
    return transactions.filter(item => item.date.slice(0, 7) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date) || b.description.localeCompare(a.description));
  }
  function partsOf(transaction) {
    return Array.isArray(transaction.splits) && transaction.splits.length
      ? transaction.splits : [{ category: transaction.category, amount: transaction.amount }];
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
      ? `${currency.format(sum / 1000).replace(/\.00$/, '')}k`
      : currency.format(sum).replace(/\.00$/, '');
    if (!sum) {
      const empty = document.createElement('p');
      empty.className = 'chart-empty';
      empty.textContent = 'Spending categories will appear here once you import transactions.';
      el.legend.append(empty);
      return;
    }
    const circumference = 2 * Math.PI * 52;
    let offset = 0;
    entries.forEach(([category, amount], index) => {
      const length = circumference * amount / sum;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'donut-segment');
      circle.setAttribute('cx', '72');
      circle.setAttribute('cy', '72');
      circle.setAttribute('r', '52');
      circle.setAttribute('stroke', COLORS[index % COLORS.length]);
      circle.setAttribute('stroke-dasharray', `${length} ${circumference - length}`);
      circle.setAttribute('stroke-dashoffset', String(-offset));
      circle.setAttribute('aria-label', `${category}: ${money(amount)}`);
      el.segments.append(circle);
      offset += length;

      const row = document.createElement('div');
      row.className = 'legend-row';
      const dot = document.createElement('span');
      dot.className = 'legend-dot';
      dot.style.backgroundColor = COLORS[index % COLORS.length];
      const name = document.createElement('span');
      name.className = 'legend-name';
      name.textContent = category;
      const value = document.createElement('span');
      value.className = 'legend-amount';
      value.textContent = money(amount);
      row.append(dot, name, value);
      el.legend.append(row);
    });
  }

  function renderInsight(items, income, expense) {
    const title = document.createElement('strong');
    const copy = document.createElement('p');
    if (!items.length) {
      title.textContent = 'A fresh page for this month.';
      copy.textContent = 'Import a bank CSV or TSV file to see your monthly activity take shape.';
    } else if (expense === 0 && income > 0) {
      title.textContent = 'A month with no recorded spending.';
      copy.textContent = 'Only incoming money is recorded for this month so far.';
    } else if (income > 0 && income >= expense) {
      title.textContent = 'You brought in more than you spent.';
      copy.textContent = `Your money in exceeded your money out by ${money(income - expense)} this month.`;
    } else if (expense > income) {
      title.textContent = 'Spending is ahead of income.';
      copy.textContent = 'Review the categories below to spot where you may want a closer look.';
    } else {
      title.textContent = 'Every transaction tells a story.';
      copy.textContent = 'Add a category to make your spending picture more useful.';
    }
    el.insight.replaceChildren(title, copy);
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
    el.count.textContent = String(items.length);
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const icon = document.createElement('span');
      icon.className = 'empty-state-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '↗';
      const title = document.createElement('strong');
      title.textContent = 'Your story starts with a file.';
      const copy = document.createElement('p');
      copy.textContent = 'Import a CSV or TSV statement from your bank. Your file is processed right here in your browser.';
      const button = document.createElement('label');
      button.className = 'button button-primary';
      button.htmlFor = 'file-input';
      button.textContent = 'Import bank file';
      empty.append(icon, title, copy, button);
      el.list.append(empty);
      return;
    }
    const header = document.createElement('div');
    header.className = 'transaction-header';
    ['DATE', 'DESCRIPTION', 'CATEGORY', 'AMOUNT', ''].forEach(label => {
      const cell = document.createElement('span');
      cell.textContent = label;
      header.append(cell);
    });
    el.list.append(header);
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'transaction-row';
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
        select.addEventListener('change', () => updateTransaction(item.id, current => ({ ...current, category: select.value })));
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
      actions.append(split);
      row.append(date, description, category, amount, actions);
      el.list.append(row);
    });
  }

  function render() {
    const monthDate = new Date(`${selectedMonth}-01T12:00:00`);
    el.month.textContent = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthDate);
    const items = visibleTransactions();
    const income = items.reduce((total, item) => total + Math.max(item.amount, 0), 0);
    const expense = items.reduce((total, item) => total + Math.max(-item.amount, 0), 0);
    el.income.textContent = money(income);
    el.expense.textContent = money(expense);
    el.net.textContent = money(income - expense);
    el.net.classList.toggle('positive', income >= expense);
    el.net.classList.toggle('negative', income < expense);
    renderChart(items);
    renderInsight(items, income, expense);
    renderTransactions(items);
  }

  function updateTransaction(transactionId, updater) {
    const next = transactions.map(item => item.id === transactionId ? updater(item) : item);
    if (saveData(next, categories)) render();
  }

  function changeMonth(delta) {
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    date.setMonth(date.getMonth() + delta);
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
    if (rows.length < 2) throw new Error('Add a header row and at least one transaction row to your file.');
    const headers = rows[0];
    const dateIndex = findColumn(headers, ['date', 'transactiondate', 'bookingdate', 'bookeddate', 'valuedate', 'postingdate']);
    const descriptionIndex = findColumn(headers, ['description', 'name', 'details', 'memo', 'payee', 'narrative', 'transaction']);
    const amountIndex = findColumn(headers, ['amount', 'transactionamount', 'value', 'sum']);
    const debitIndex = findColumn(headers, ['debit', 'withdrawal', 'withdrawals', 'moneyout']);
    const creditIndex = findColumn(headers, ['credit', 'deposit', 'deposits', 'moneyin']);
    const categoryIndex = findColumn(headers, ['category', 'type']);
    if (dateIndex < 0) throw new Error('Could not find a date column. Use a header such as Date or Booking Date.');
    if (descriptionIndex < 0) throw new Error('Could not find a description column. Use Description, Name, or Details.');
    if (amountIndex < 0 && debitIndex < 0 && creditIndex < 0) throw new Error('Could not find an amount, debit, or credit column.');
    if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error(`This file has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows.`);
    const imported = [];
    let skipped = 0;
    rows.slice(1).forEach(row => {
      const date = parseDate(row[dateIndex] || '');
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
      imported.push({
        id: id(), date, description, amount,
        category: mapCategory(categoryIndex >= 0 ? row[categoryIndex] || '' : '')
      });
    });
    return { imported, skipped };
  }

  function transactionKey(item) {
    return `${item.date}\u0000${item.description.toLocaleLowerCase()}\u0000${item.amount.toFixed(2)}`;
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      showToast('Choose a file smaller than 10 MB.', true);
      return;
    }
    try {
      const result = parseTransactions(await file.text());
      if (!result.imported.length) throw new Error('No valid transactions were found. Check the dates, descriptions, and amounts in your file.');
      const existing = new Set(transactions.map(transactionKey));
      const imported = result.imported.filter(item => {
        const key = transactionKey(item);
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      const next = [...transactions, ...imported];
      const nextCategories = [...new Set([...categories, ...imported.map(item => item.category)])];
      if (!saveData(next, nextCategories)) return;
      if (imported.length) {
        const newest = imported.reduce((latest, item) => item.date > latest ? item.date : latest, imported[0].date);
        selectedMonth = newest.slice(0, 7);
      }
      render();
      const duplicates = result.imported.length - imported.length;
      showToast([
        `${imported.length} transaction${imported.length === 1 ? '' : 's'} imported`,
        duplicates ? `${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : '',
        result.skipped ? `${result.skipped} invalid row${result.skipped === 1 ? '' : 's'} skipped` : ''
      ].filter(Boolean).join(' · '));
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

  function saveSplit(event) {
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
    if (saveData(next, categories)) {
      el.dialog.close();
      render();
      showToast('Transaction split saved.');
    }
  }

  function addCategory() {
    const value = el.categoryInput.value.trim().slice(0, 32);
    if (!value) {
      showToast('Enter a category name first.', true);
      return;
    }
    if (categories.some(category => category.toLowerCase() === value.toLowerCase())) {
      showToast('That category already exists.', true);
      return;
    }
    if (saveData(transactions, [...categories, value])) {
      el.categoryInput.value = '';
      render();
      showToast(`“${value}” added to your categories.`);
    }
  }

  el.file.addEventListener('change', event => importFile(event.target.files[0]));
  el.previous.addEventListener('click', () => changeMonth(-1));
  el.next.addEventListener('click', () => changeMonth(1));
  el.addCategory.addEventListener('click', addCategory);
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
  render();
})();
