const STORAGE_KEY = "budget-overzicht-transactions";

const form = document.getElementById("transaction-form");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const typeInput = document.getElementById("type");
const list = document.getElementById("transaction-list");
const emptyMessage = document.getElementById("empty-message");
const clearAllButton = document.getElementById("clear-all");

const totalIncomeEl = document.getElementById("total-income");
const totalExpenseEl = document.getElementById("total-expense");
const totalBalanceEl = document.getElementById("total-balance");

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

let transactions = loadTransactions();

function render() {
  list.innerHTML = "";

  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach((tx) => {
    const li = document.createElement("li");

    const info = document.createElement("div");
    info.className = "tx-info";

    const description = document.createElement("span");
    description.className = "tx-description";
    description.textContent = tx.description;

    const date = document.createElement("span");
    date.className = "tx-date";
    date.textContent = formatDate(tx.date);

    info.appendChild(description);
    info.appendChild(date);

    const right = document.createElement("div");
    right.className = "tx-right";

    const amount = document.createElement("span");
    amount.className = `tx-amount ${tx.type}`;
    const sign = tx.type === "income" ? "+" : "-";
    amount.textContent = `${sign} ${formatCurrency(tx.amount)}`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Verwijderen";
    deleteBtn.addEventListener("click", () => deleteTransaction(tx.id));

    right.appendChild(amount);
    right.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(right);
    list.appendChild(li);
  });

  emptyMessage.classList.toggle("hidden", transactions.length > 0);

  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  totalIncomeEl.textContent = formatCurrency(totalIncome);
  totalExpenseEl.textContent = formatCurrency(totalExpense);
  totalBalanceEl.textContent = formatCurrency(totalIncome - totalExpense);
}

function addTransaction(description, amount, date, type) {
  transactions.push({
    id: Date.now().toString(),
    description,
    amount,
    date,
    type,
  });
  saveTransactions(transactions);
  render();
}

function deleteTransaction(id) {
  transactions = transactions.filter((tx) => tx.id !== id);
  saveTransactions(transactions);
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const date = dateInput.value;
  const type = typeInput.value;

  if (!description || !amount || amount <= 0 || !date) {
    return;
  }

  addTransaction(description, amount, date, type);
  form.reset();
  dateInput.value = new Date().toISOString().split("T")[0];
  descriptionInput.focus();
});

clearAllButton.addEventListener("click", () => {
  if (transactions.length === 0) return;
  if (confirm("Weet je zeker dat je alle transacties wilt verwijderen?")) {
    transactions = [];
    saveTransactions(transactions);
    render();
  }
});

dateInput.value = new Date().toISOString().split("T")[0];
render();
