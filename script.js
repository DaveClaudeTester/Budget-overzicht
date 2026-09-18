import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeU9BVl5uutfqn4Pyz8xwTHFvm4OX6hog",
  authDomain: "budget-overzicht.firebaseapp.com",
  projectId: "budget-overzicht",
  storageBucket: "budget-overzicht.firebasestorage.app",
  messagingSenderId: "134827123638",
  appId: "1:134827123638:web:bbef1ee02f7c96d28e5717",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STORAGE_KEY = "budget-overzicht-transactions";
const SYNC_CODE_KEY = "budget-overzicht-sync-code";

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

const syncCodeValueEl = document.getElementById("sync-code-value");
const copySyncCodeButton = document.getElementById("copy-sync-code");
const toggleJoinButton = document.getElementById("toggle-join");
const syncJoinPanel = document.getElementById("sync-join");
const joinCodeInput = document.getElementById("join-code-input");
const joinCodeButton = document.getElementById("join-code-button");
const syncStatusEl = document.getElementById("sync-status");

function loadLocalTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTransactions(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function generateSyncCode() {
  if (crypto.randomUUID) {
    return crypto.randomUUID().split("-").slice(0, 2).join("-");
  }
  return Math.random().toString(36).slice(2, 10);
}

let transactions = loadLocalTransactions();
let syncCode = localStorage.getItem(SYNC_CODE_KEY) || generateSyncCode();
localStorage.setItem(SYNC_CODE_KEY, syncCode);

let unsubscribeSync = null;

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

function syncToCloud() {
  const ref = doc(db, "budgets", syncCode);
  syncStatusEl.textContent = "Bezig met synchroniseren…";
  setDoc(ref, { transactions, updatedAt: Date.now() })
    .then(() => {
      syncStatusEl.textContent = "Gesynchroniseerd";
    })
    .catch((error) => {
      console.error("Synchroniseren mislukt:", error);
      syncStatusEl.textContent = "Synchroniseren mislukt (offline?) — lokaal wel opgeslagen";
    });
}

function persist() {
  saveLocalTransactions(transactions);
  render();
  syncToCloud();
}

function listenToSync(code) {
  if (unsubscribeSync) {
    unsubscribeSync();
  }
  syncCodeValueEl.textContent = code;
  const ref = doc(db, "budgets", code);
  unsubscribeSync = onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        transactions = snapshot.data().transactions || [];
        saveLocalTransactions(transactions);
        render();
      } else if (transactions.length > 0) {
        syncToCloud();
      }
      syncStatusEl.textContent = "Gesynchroniseerd";
    },
    (error) => {
      console.error("Synchroniseren mislukt:", error);
      syncStatusEl.textContent = "Synchroniseren mislukt (offline?) — lokaal wel opgeslagen";
    }
  );
}

function addTransaction(description, amount, date, type) {
  transactions.push({
    id: Date.now().toString(),
    description,
    amount,
    date,
    type,
  });
  persist();
}

function deleteTransaction(id) {
  transactions = transactions.filter((tx) => tx.id !== id);
  persist();
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
    persist();
  }
});

copySyncCodeButton.addEventListener("click", () => {
  navigator.clipboard
    .writeText(syncCode)
    .then(() => {
      const original = copySyncCodeButton.textContent;
      copySyncCodeButton.textContent = "✓";
      setTimeout(() => {
        copySyncCodeButton.textContent = original;
      }, 1500);
    })
    .catch(() => {});
});

toggleJoinButton.addEventListener("click", () => {
  syncJoinPanel.classList.toggle("hidden");
});

joinCodeButton.addEventListener("click", () => {
  const newCode = joinCodeInput.value.trim();
  if (!newCode) return;

  syncCode = newCode;
  localStorage.setItem(SYNC_CODE_KEY, syncCode);
  joinCodeInput.value = "";
  syncJoinPanel.classList.add("hidden");
  listenToSync(syncCode);
});

dateInput.value = new Date().toISOString().split("T")[0];
render();
listenToSync(syncCode);
