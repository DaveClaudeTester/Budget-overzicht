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

const importFileInput = document.getElementById("import-file");
const importStatusEl = document.getElementById("import-status");

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

function excelDateToIso(value) {
  if (value instanceof Date && !isNaN(value)) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    const str = String(Math.trunc(value));
    if (str.length === 8) {
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
  }
  const str = String(value || "").trim();
  const isoLike = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (isoLike) {
    return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;
  }
  const dayFirst = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function cleanImportedDescription(raw) {
  const text = String(raw || "").trim();

  const nameMatch = text.match(/\/NAME\/([^/]+)/);
  if (nameMatch) {
    let name = nameMatch[1].trim();
    const remiMatch = text.match(/\/REMI\/([^/]+)/);
    if (remiMatch && remiMatch[1].trim()) {
      name += ` – ${remiMatch[1].trim().slice(0, 40)}`;
    }
    return name;
  }

  const beaMatch = text.match(/Betaalpas\s+(.+?)\s*,\s*PAS/i);
  if (beaMatch) {
    return beaMatch[1].replace(/\s+/g, " ").trim();
  }

  return text.replace(/\s+/g, " ").slice(0, 80);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function findColumnIndex(headerRow, names) {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = String(headerRow[i] || "").trim().toLowerCase();
    if (names.includes(cell)) return i;
  }
  return -1;
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

importFileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  importStatusEl.className = "import-status";
  importStatusEl.textContent = "Bestand wordt gelezen…";

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

    if (rows.length < 2) {
      throw new Error("geen transacties gevonden in dit bestand.");
    }

    const headerRow = rows[0];
    const dateCol = findColumnIndex(headerRow, ["transactiedatum", "datum"]);
    const amountCol = findColumnIndex(headerRow, ["transactiebedrag", "bedrag"]);
    const descCol = findColumnIndex(headerRow, ["omschrijving", "naam / omschrijving", "mededelingen"]);

    if (dateCol === -1 || amountCol === -1 || descCol === -1) {
      throw new Error("kolommen 'Transactiedatum', 'Transactiebedrag' en 'Omschrijving' niet gevonden.");
    }

    const existingIds = new Set(transactions.map((tx) => tx.id));
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const isoDate = excelDateToIso(row[dateCol]);
      const amountValue = parseAmount(row[amountCol]);
      const rawDescription = row[descCol];

      if (!isoDate || amountValue === null || amountValue === 0) {
        skipped++;
        continue;
      }

      const id = "imp_" + hashString(`${isoDate}|${amountValue}|${rawDescription}`);
      if (existingIds.has(id)) {
        skipped++;
        continue;
      }

      transactions.push({
        id,
        description: cleanImportedDescription(rawDescription),
        amount: Math.abs(amountValue),
        date: isoDate,
        type: amountValue >= 0 ? "income" : "expense",
      });
      existingIds.add(id);
      imported++;
    }

    persist();

    const skippedText = skipped > 0 ? `, ${skipped} overgeslagen (al aanwezig of onduidelijk)` : "";
    importStatusEl.textContent = `${imported} transactie(s) geïmporteerd${skippedText}.`;
    importStatusEl.className = imported > 0 ? "import-status success" : "import-status";
  } catch (error) {
    console.error("Import mislukt:", error);
    importStatusEl.textContent = `Import mislukt: ${error.message}`;
    importStatusEl.className = "import-status error";
  } finally {
    importFileInput.value = "";
  }
});

dateInput.value = new Date().toISOString().split("T")[0];
render();
listenToSync(syncCode);
