import { SPREADSHEET_ID } from "./config.js";
import { getSheetsToken } from "./auth.js";

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

async function authedFetch(url, options = {}) {
  const token = await getSheetsToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401) {
    // try once to refresh token
    const retryToken = await getSheetsToken();
    const res2 = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${retryToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res2.ok) throw new Error(await res2.text());
    return res2;
  }
  if (!res.ok) throw new Error(await res.text());
  return res;
}

export async function valuesGet(a1Range) {
  const url = `${BASE}/values/${encodeURIComponent(a1Range)}`;
  const res = await authedFetch(url);
  const data = await res.json();
  return data.values || [];
}

export async function valuesAppend(a1Range, rows) {
  const url = `${BASE}/values/${encodeURIComponent(a1Range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await authedFetch(url, {
    method: "POST",
    body: JSON.stringify({ values: rows }),
  });
  return res.json();
}

export async function valuesUpdate(a1Range, rows) {
  const url = `${BASE}/values/${encodeURIComponent(a1Range)}?valueInputOption=USER_ENTERED`;
  const res = await authedFetch(url, {
    method: "PUT",
    body: JSON.stringify({ values: rows }),
  });
  return res.json();
}

// Utilities for delete row via batchUpdate
let _sheetMeta = null;
async function getSheetMeta() {
  if (_sheetMeta) return _sheetMeta;
  const url = `${BASE}?fields=sheets.properties`;
  const res = await authedFetch(url);
  const data = await res.json();
  _sheetMeta = data.sheets.map((s) => s.properties); // {sheetId, title, ...}
  return _sheetMeta;
}

async function sheetIdByTitle(title) {
  const meta = await getSheetMeta();
  const found = meta.find((p) => p.title === title);
  if (!found) throw new Error(`Sheet not found: ${title}`);
  return found.sheetId;
}

export async function deleteRow(sheetTitle, rowIndex1) {
  const id = await sheetIdByTitle(sheetTitle);
  const url = `${BASE}:batchUpdate`;
  const body = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: id,
            dimension: "ROWS",
            startIndex: rowIndex1 - 1,
            endIndex: rowIndex1,
          },
        },
      },
    ],
  };
  const res = await authedFetch(url, { method: "POST", body: JSON.stringify(body) });
  return res.json();
}

// Expose globally to ease migration of old code (optional)
window.Sheets = { valuesGet, valuesAppend, valuesUpdate, deleteRow };
