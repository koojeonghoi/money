import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Upload, X, Plus, RotateCcw, Loader2, ImagePlus, Trash2, PiggyBank,
  Home, Receipt, Wallet, Settings as SettingsIcon, GripVertical, RefreshCw, Cloud
} from "lucide-react";

const PALETTE = [
  "#4E8F72", "#5B8A72", "#6B8CAE", "#8C7853", "#7A8CA3",
  "#9C7EA8", "#C99A3E", "#B5533B", "#5F8FA6", "#8A93A3", "#C9A227"
];

const DEFAULT_CATEGORIES = [
  { id: "salary", name: "급여", emoji: "💵", color: "#C9A227", type: "income" },
  { id: "bonus", name: "상여금", emoji: "🎁", color: "#D9B23C", type: "income" },
  { id: "apptech", name: "앱테크", emoji: "📲", color: "#8FB339", type: "income" },
  { id: "saving", name: "저축", emoji: "💰", color: "#4E8F72", type: "saving" },
  { id: "installment", name: "적금", emoji: "🏦", color: "#5B8A72", type: "saving" },
  { id: "insurance", name: "보험", emoji: "🛡️", color: "#6B8CAE", type: "fixed" },
  { id: "housing", name: "주거/월세", emoji: "🏠", color: "#8C7853", type: "fixed" },
  { id: "telecom", name: "통신비", emoji: "📱", color: "#7A8CA3", type: "fixed" },
  { id: "subscription", name: "구독료", emoji: "📺", color: "#9C7EA8", type: "fixed" },
  { id: "lunch", name: "점심/식비", emoji: "🍚", color: "#C99A3E", type: "variable" },
  { id: "alcohol", name: "술/유흥", emoji: "🍺", color: "#B5533B", type: "variable" },
  { id: "transport", name: "교통비", emoji: "🚗", color: "#5F8FA6", type: "variable" },
  { id: "etc", name: "기타", emoji: "🧾", color: "#8A93A3", type: "variable" },
  { id: "uncategorized", name: "미분류", emoji: "❔", color: "#5A6478", type: "variable" }
];

const DEFAULT_PAYMENT_METHODS = [
  { id: "cash", name: "현금" },
  { id: "card1", name: "신한카드" },
  { id: "card2", name: "국민카드" },
  { id: "kakaopay", name: "카카오페이" },
  { id: "transfer", name: "계좌이체" },
  { id: "unassigned", name: "미지정" }
];

const DEFAULT_ASSET_TYPES = [
  { id: "deposit", name: "예금/저축", color: "#4E8F72" },
  { id: "stock", name: "주식/펀드", color: "#6B8CAE" },
  { id: "realestate", name: "부동산", color: "#8C7853" },
  { id: "pension", name: "연금", color: "#9C7EA8" },
  { id: "etc-asset", name: "기타자산", color: "#8A93A3" }
];

const TYPE_LABEL = { income: "수입", fixed: "고정지출", variable: "변동지출", saving: "저축/자산" };
const TYPE_ORDER = ["income", "fixed", "variable", "saving"];

const NAV_ITEMS = [
  { id: "home", label: "홈화면", icon: Home },
  { id: "expenses", label: "지출", icon: Receipt },
  { id: "assets", label: "자산", icon: Wallet },
  { id: "settings", label: "설정", icon: SettingsIcon }
];

function moveItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

// Press-and-hold-then-drag reordering for editable lists (categories, asset types, payment methods).
// The dragged row follows the pointer 1:1. Siblings only get a live *preview* shift (via CSS
// transform + transition) to open a gap — the underlying array isn't actually reordered until
// the pointer is released, which avoids the instant DOM-reflow "jump" that live-splicing caused.
function useDragReorder(items, setItems) {
  const containerRef = useRef(null);
  const dragInfo = useRef(null); // { id, startY, startCenter, originIndex, rowSpan }
  const [dragState, setDragState] = useState(null); // { id, y, targetIndex }

  const handlePointerDown = (id) => (e) => {
    e.preventDefault();
    // Without this, moving the pointer over row text during a drag triggers native text selection
    // (multi-line highlight), which fights with the reorder gesture.
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    const container = containerRef.current;
    const originIndex = items.findIndex((it) => it.id === id);
    const rows = container ? Array.from(container.children) : [];
    const rowEl = rows[originIndex];
    const rect = rowEl ? rowEl.getBoundingClientRect() : null;
    const startCenter = rect ? rect.top + rect.height / 2 : e.clientY;
    // rowSpan = distance between consecutive row tops (row height + gap), used to shift siblings by one slot
    const rowSpan = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : (rect?.height || 44);
    dragInfo.current = { id, startY: e.clientY, startCenter, originIndex, rowSpan };
    setDragState({ id, y: 0, targetIndex: originIndex });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e) => {
      const { id, startY, startCenter, originIndex } = dragInfo.current;
      const deltaY = e.clientY - startY;

      const container = containerRef.current;
      let targetIndex = originIndex;
      if (container) {
        const rows = Array.from(container.children);
        const draggedCenter = startCenter + deltaY;
        targetIndex = 0;
        rows.forEach((row, idx) => {
          if (idx === originIndex) return;
          const rect = row.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          if (center < draggedCenter) targetIndex++;
        });
      }
      setDragState({ id, y: deltaY, targetIndex });
    };

    const handleUp = () => {
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      const { originIndex } = dragInfo.current || {};
      setDragState((current) => {
        if (current && originIndex !== undefined && current.targetIndex !== originIndex) {
          setItems((prev) => moveItem(prev, originIndex, current.targetIndex));
        }
        return null;
      });
      dragInfo.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragState?.id, setItems]);

  const rowStyle = (id) => {
    if (!dragState) return { position: "relative" };
    if (dragState.id === id) {
      return { transform: `translateY(${dragState.y}px)`, position: "relative", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,0.4)" };
    }
    const { originIndex, rowSpan } = dragInfo.current || {};
    if (originIndex === undefined) return { position: "relative" };
    const idx = items.findIndex((it) => it.id === id);
    const { targetIndex } = dragState;
    let shift = 0;
    if (originIndex < targetIndex && idx > originIndex && idx <= targetIndex) shift = -rowSpan;
    else if (originIndex > targetIndex && idx >= targetIndex && idx < originIndex) shift = rowSpan;
    return { transform: `translateY(${shift}px)`, transition: "transform 150ms ease", position: "relative" };
  };

  return { containerRef, handlePointerDown, rowStyle };
}

function uid() {
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Korean public holidays (신정/설날/추석 연휴 등 포함, 대체공휴일 반영), 2024–2029.
// Kept as a small static list instead of a holiday library, since that pulled in every country's
// data and bloated the bundle ~4x for a feature that only ever needs KR.
const KR_HOLIDAYS = new Set([
  "2024-01-01", "2024-02-10", "2024-02-11", "2024-02-12", "2024-03-01", "2024-05-05", "2024-05-06",
  "2024-05-15", "2024-06-06", "2024-08-15", "2024-09-16", "2024-09-17", "2024-09-18", "2024-10-03",
  "2024-10-09", "2024-12-25",
  "2025-01-01", "2025-01-29", "2025-01-30", "2025-01-31", "2025-03-01", "2025-03-03", "2025-05-05",
  "2025-05-06", "2025-06-06", "2025-08-15", "2025-10-03", "2025-10-05", "2025-10-06", "2025-10-07",
  "2025-10-08", "2025-10-09", "2025-12-25",
  "2026-01-01", "2026-02-17", "2026-02-18", "2026-02-19", "2026-03-01", "2026-03-02", "2026-05-05",
  "2026-05-24", "2026-05-25", "2026-06-06", "2026-07-17", "2026-08-15", "2026-08-17", "2026-09-24",
  "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05", "2026-10-09", "2026-12-25",
  "2027-01-01", "2027-02-07", "2027-02-08", "2027-02-09", "2027-03-01", "2027-05-05", "2027-05-13",
  "2027-06-06", "2027-07-17", "2027-07-19", "2027-08-15", "2027-08-16", "2027-09-14", "2027-09-15",
  "2027-09-16", "2027-10-03", "2027-10-04", "2027-10-09", "2027-10-11", "2027-12-25", "2027-12-27",
  "2028-01-01", "2028-01-27", "2028-01-28", "2028-01-29", "2028-03-01", "2028-05-02", "2028-05-05",
  "2028-06-06", "2028-07-17", "2028-08-15", "2028-10-02", "2028-10-03", "2028-10-04", "2028-10-05",
  "2028-10-09", "2028-12-25",
  "2029-01-01", "2029-02-13", "2029-02-14", "2029-02-15", "2029-03-01", "2029-05-05", "2029-05-07",
  "2029-05-20", "2029-05-21", "2029-06-06", "2029-07-17", "2029-08-15", "2029-09-21", "2029-09-22",
  "2029-09-23", "2029-09-24", "2029-10-03", "2029-10-09", "2029-12-25"
]);

function dateToYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !KR_HOLIDAYS.has(dateToYmd(date));
}

// If the given date isn't a business day, step backward until one is found
// (matches "지급일이 휴일이면 그 앞 영업일에 지급" rule).
function adjustToPrecedingBusinessDay(date) {
  const d = new Date(date);
  while (!isBusinessDay(d)) d.setDate(d.getDate() - 1);
  return d;
}

function getPayday(year, month, paydayDom) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(paydayDom, lastDay);
  return adjustToPrecedingBusinessDay(new Date(year, month, day));
}

// The pay-period containing refDate: from this cycle's payday to the day before the next payday.
function getPayPeriodForDate(refDate, paydayDom) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const thisMonthPayday = getPayday(y, m, paydayDom);
  if (refDate >= thisMonthPayday) {
    const nextMonth = m === 11 ? 0 : m + 1;
    const nextYear = m === 11 ? y + 1 : y;
    const end = getPayday(nextYear, nextMonth, paydayDom);
    end.setDate(end.getDate() - 1);
    return { start: thisMonthPayday, end };
  }
  const prevMonth = m === 0 ? 11 : m - 1;
  const prevYear = m === 0 ? y - 1 : y;
  const start = getPayday(prevYear, prevMonth, paydayDom);
  const end = new Date(thisMonthPayday);
  end.setDate(end.getDate() - 1);
  return { start, end };
}

// offset 0 = the pay-period containing today, -1 = previous period, +1 = next, etc.
function getPayPeriodByOffset(paydayDom, offset) {
  const { start } = getPayPeriodForDate(new Date(), paydayDom);
  const refDate = new Date(start);
  refDate.setMonth(refDate.getMonth() + offset);
  refDate.setDate(refDate.getDate() + 5); // land solidly inside the shifted period
  return getPayPeriodForDate(refDate, paydayDom);
}

function formatPeriodDate(d) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// Best-effort parse of whatever date string OCR/manual entry produced. periodStart/periodEnd give
// context to disambiguate values with no year (or no month), since a pay-period spans two months.
function parseTxDate(raw, periodStart, periodEnd) {
  if (!raw) return null;
  const cleaned = String(raw).trim();

  let m = cleaned.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = cleaned.match(/(\d{1,2})[.\/월]\s*(\d{1,2})/);
  if (m) {
    const month = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (periodStart && periodStart.getMonth() === month) return new Date(periodStart.getFullYear(), month, day);
    if (periodEnd && periodEnd.getMonth() === month) return new Date(periodEnd.getFullYear(), month, day);
    return periodEnd ? new Date(periodEnd.getFullYear(), month, day) : new Date(new Date().getFullYear(), month, day);
  }

  m = cleaned.match(/^(\d{1,2})\s*일/);
  if (m) {
    const day = Number(m[1]);
    if (periodStart && day >= periodStart.getDate()) return new Date(periodStart.getFullYear(), periodStart.getMonth(), day);
    if (periodEnd) return new Date(periodEnd.getFullYear(), periodEnd.getMonth(), day);
  }

  return null;
}

function won(n) {
  const num = Number(n) || 0;
  return `${num.toLocaleString("ko-KR")}원`;
}

function labelWithEmoji(item) {
  return item?.emoji ? `${item.emoji} ${item.name}` : item?.name || "";
}

function loadImageEl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = URL.createObjectURL(file);
  });
}

// Long stitched screenshots (e.g. a whole month in one tall image) can be huge —
// downscale + re-encode as JPEG before upload so we stay under the server's request-size limit.
const MAX_IMAGE_DIMENSION = 3000;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

async function prepareImageForUpload(file) {
  const img = await loadImageEl(file);
  let { naturalWidth: width, naturalHeight: height } = img;
  const longestSide = Math.max(width, height);
  if (longestSide > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / longestSide;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(img.src);

  // JPEG compresses text-heavy screenshots far better than PNG while staying readable for analysis.
  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  let base64 = dataUrl.split(",")[1];

  // If still too large, step quality down a couple more times before giving up.
  while (base64.length * 0.75 > MAX_UPLOAD_BYTES && quality > 0.5) {
    quality -= 0.15;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    base64 = dataUrl.split(",")[1];
  }

  if (base64.length * 0.75 > MAX_UPLOAD_BYTES) {
    throw new Error("이미지 용량이 너무 커요. 한 달치를 한 장에 담지 말고 1~2주 단위로 나눠서 캡처해 주세요.");
  }

  return { base64, mediaType: "image/jpeg" };
}

async function extractTransactions(base64, mediaType, categoryNames, paymentMethodNames, merchantHints, assetNames) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mediaType, categories: categoryNames, paymentMethods: paymentMethodNames, merchantHints, assetNames })
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error(
      response.ok
        ? "서버 응답을 해석하지 못했습니다."
        : "이미지 용량이 너무 커서 서버가 요청을 처리하지 못했어요. 이미지를 더 작게 나눠서 다시 시도해 주세요."
    );
  }
  if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
  if (!Array.isArray(data.transactions)) throw new Error("예상한 응답 형식이 아닙니다.");
  return data.transactions;
}

async function extractAssetBalances(base64, mediaType, assetNames) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mediaType, mode: "balance", assetNames })
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error(
      response.ok
        ? "서버 응답을 해석하지 못했습니다."
        : "이미지 용량이 너무 커서 서버가 요청을 처리하지 못했어요. 이미지를 더 작게 나눠서 다시 시도해 주세요."
    );
  }
  if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
  if (!Array.isArray(data.balances)) throw new Error("예상한 응답 형식이 아닙니다.");
  return data.balances;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("home");

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [assetTypes, setAssetTypes] = useState(DEFAULT_ASSET_TYPES);
  const [categoryMemory, setCategoryMemory] = useState({}); // normalizedMerchant -> categoryId

  const [transactions, setTransactions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [income, setIncome] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAssetBreakdown, setShowAssetBreakdown] = useState(false);
  const [expandedTypeCard, setExpandedTypeCard] = useState(null); // "fixed" | "variable" | "saving" | null
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [assetSearch, setAssetSearch] = useState("");

  const [editingCatId, setEditingCatId] = useState(null);
  const [editingPmId, setEditingPmId] = useState(null);
  const [editingAssetTypeId, setEditingAssetTypeId] = useState(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]); // empty = all categories
  const [typeFilter, setTypeFilter] = useState("all"); // all | expense | income
  const [paydayDom, setPaydayDom] = useState(25);
  const [periodOffset, setPeriodOffset] = useState(0); // 0 = current pay-period, -1 = previous, +1 = next

  const [manualDate, setManualDate] = useState(todayStr());
  const [manualDesc, setManualDesc] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualIsIncome, setManualIsIncome] = useState(false);
  const [manualIsTransfer, setManualIsTransfer] = useState(false);
  const [manualTransferFromId, setManualTransferFromId] = useState("");
  const [manualTransferToId, setManualTransferToId] = useState("");
  const [manualCatId, setManualCatId] = useState("");
  const [manualPmId, setManualPmId] = useState("");
  const [manualAssetTypeId, setManualAssetTypeId] = useState("");
  const [manualAssetId, setManualAssetId] = useState("");
  const [expandedAssetHistoryId, setExpandedAssetHistoryId] = useState(null);

  const [transferDate, setTransferDate] = useState(todayStr());
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferMemo, setTransferMemo] = useState("");

  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState("");
  const [balanceNotice, setBalanceNotice] = useState("");

  const fileInputRef = useRef(null);
  const assetFileInputRef = useRef(null);
  const saveTimer = useRef(null);
  const [syncSecret, setSyncSecret] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error | no-secret
  const [syncSecretDraft, setSyncSecretDraft] = useState("");
  const [syncErrorMessage, setSyncErrorMessage] = useState("");

  const buildSnapshot = () => ({
    categories, paymentMethods, assetTypes, categoryMemory, transactions, assets, transfers, income, paydayDom
  });

  const applySnapshot = (parsed) => {
    if (!parsed) return;
    if (parsed.categories?.length) setCategories(parsed.categories);
    if (parsed.paymentMethods?.length) setPaymentMethods(parsed.paymentMethods);
    if (parsed.assetTypes?.length) setAssetTypes(parsed.assetTypes);
    if (parsed.categoryMemory) setCategoryMemory(parsed.categoryMemory);
    if (parsed.transactions) setTransactions(parsed.transactions);
    if (parsed.assets) setAssets(parsed.assets);
    if (parsed.transfers) setTransfers(parsed.transfers);
    if (parsed.income) setIncome(parsed.income);
    if (parsed.paydayDom) setPaydayDom(parsed.paydayDom);
  };

  // ---- load persisted data: localStorage first (instant/offline), then cloud if a sync passcode is set ----
  useEffect(() => {
    const storedSecret = localStorage.getItem("sync-secret") || "";
    setSyncSecret(storedSecret);
    setSyncSecretDraft(storedSecret);

    try {
      const raw = localStorage.getItem("ledger-data");
      if (raw) applySnapshot(JSON.parse(raw));
    } catch (e) {
      // no saved data yet — keep defaults
    }

    if (!storedSecret) {
      setLoaded(true);
      return;
    }

    (async () => {
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/sync", { headers: { "x-sync-secret": storedSecret } });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `요청 실패 (${res.status})`);
        if (json.data) applySnapshot(json.data);
        setSyncStatus("synced");
      } catch (e) {
        setSyncErrorMessage(e.message || "알 수 없는 오류");
        setSyncStatus("error");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ---- debounced save: always cache locally, and push to cloud if a sync passcode is set ----
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const snapshot = buildSnapshot();
      try {
        localStorage.setItem("ledger-data", JSON.stringify(snapshot));
      } catch (e) {
        console.error("로컬 저장 실패", e);
      }
      if (!syncSecret) return;
      setSyncStatus("syncing");
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: syncSecret, data: snapshot })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `요청 실패 (${res.status})`);
        setSyncStatus("synced");
      } catch (e) {
        setSyncErrorMessage(e.message || "알 수 없는 오류");
        setSyncStatus("error");
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [categories, paymentMethods, assetTypes, categoryMemory, transactions, assets, transfers, income, paydayDom, loaded, syncSecret]);

  const saveSyncSecret = async () => {
    const trimmed = syncSecretDraft.trim();
    if (!trimmed) {
      localStorage.setItem("sync-secret", "");
      setSyncSecret("");
      setSyncStatus("idle");
      return;
    }

    setSyncStatus("syncing");
    try {
      const res = await fetch("/api/sync", { headers: { "x-sync-secret": trimmed } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `요청 실패 (${res.status})`);

      // Consider *any* non-empty field meaningful, not just transactions/assets — otherwise a
      // cloud save that only had e.g. custom categories or income set would look "empty" here
      // and get silently overwritten by this (truly empty) device's defaults below.
      const isMeaningful = (d) =>
        !!d && (
          (d.transactions?.length || 0) > 0 ||
          (d.assets?.length || 0) > 0 ||
          (d.transfers?.length || 0) > 0 ||
          (d.categories?.length || 0) > 0 ||
          (d.paymentMethods?.length || 0) > 0 ||
          (d.assetTypes?.length || 0) > 0 ||
          !!d.income
        );
      const hasLocalData = isMeaningful({ transactions, assets, transfers, categories, paymentMethods, assetTypes, income });
      const hasCloudData = isMeaningful(json.data);

      if (hasCloudData) {
        if (hasLocalData) {
          const useCloud = window.confirm(
            "이미 클라우드에 저장된 데이터가 있어요.\n\n확인: 클라우드 데이터를 불러옵니다 (이 기기의 현재 데이터는 대체됩니다)\n취소: 이 기기 데이터를 클라우드에 저장합니다 (클라우드 데이터가 대체됩니다)"
          );
          if (useCloud) applySnapshot(json.data);
        } else {
          // this device has nothing of its own yet — always take the cloud's data, no prompt,
          // so opening the app on a fresh/second device can never erase what's already synced.
          applySnapshot(json.data);
        }
      }
      // if the cloud has no meaningful data yet, do nothing here — the normal debounced save
      // effect will push this device's current (local) data up once syncSecret is set below.

      localStorage.setItem("sync-secret", trimmed);
      setSyncSecret(trimmed);
      setSyncStatus("synced");
    } catch (e) {
      setSyncErrorMessage(e.message || "알 수 없는 오류");
      setSyncStatus("error");
    }
  };

  // set sensible defaults for the manual-add form once categories/payment methods are loaded
  useEffect(() => {
    if (!manualCatId && categories.length) setManualCatId(categories[0].id);
  }, [categories, manualCatId]);
  useEffect(() => {
    if (!manualPmId && paymentMethods.length) setManualPmId(paymentMethods.find((p) => p.id === "unassigned")?.id || paymentMethods[0].id);
  }, [paymentMethods, manualPmId]);

  const normalizeMerchant = (name) => (name || "").trim().toLowerCase().replace(/\s+/g, " ");

  const rememberCategory = useCallback((description, categoryId) => {
    const key = normalizeMerchant(description);
    if (!key) return;
    setCategoryMemory((prev) => ({ ...prev, [key]: categoryId }));
  }, []);

  const recallCategory = useCallback((description) => {
    const key = normalizeMerchant(description);
    if (!key) return null;
    if (categoryMemory[key]) return categoryMemory[key];
    const hit = Object.keys(categoryMemory).find((k) => key.includes(k) || k.includes(key));
    return hit ? categoryMemory[hit] : null;
  }, [categoryMemory]);

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const pmMap = useMemo(() => Object.fromEntries(paymentMethods.map((p) => [p.id, p])), [paymentMethods]);
  const assetTypeMap = useMemo(() => Object.fromEntries(assetTypes.map((a) => [a.id, a])), [assetTypes]);
  const assetMap = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const catDrag = useDragReorder(categories, setCategories);
  const pmDrag = useDragReorder(paymentMethods, setPaymentMethods);
  const assetTypeDrag = useDragReorder(assetTypes, setAssetTypes);

  const findCategoryByName = useCallback((name) => {
    const target = (name || "").trim().toLowerCase();
    return categories.find((c) => c.name.trim().toLowerCase() === target);
  }, [categories]);

  const findPaymentMethodByName = useCallback((name) => {
    const target = (name || "").trim().toLowerCase();
    return paymentMethods.find((p) => p.name.trim().toLowerCase() === target);
  }, [paymentMethods]);

  const findAssetByName = useCallback((name) => {
    const target = (name || "").trim().toLowerCase();
    if (!target) return null;
    const exact = assets.find((a) => a.name.trim().toLowerCase() === target);
    if (exact) return exact;
    return assets.find((a) => {
      const n = a.name.trim().toLowerCase();
      return n && (n.includes(target) || target.includes(n));
    }) || null;
  }, [assets]);

  const processImageFile = useCallback(async (file) => {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { base64, mediaType } = await prepareImageForUpload(file);
      const categoryNames = categories.map((c) => c.name);
      const paymentMethodNames = paymentMethods.map((p) => p.name);
      const assetNames = assets.map((a) => a.name);
      const merchantHints = Object.entries(categoryMemory)
        .slice(-40)
        .map(([merchant, categoryId]) => ({ merchant, category: catMap[categoryId]?.name }))
        .filter((h) => h.category);
      const rows = await extractTransactions(base64, mediaType, categoryNames, paymentMethodNames, merchantHints, assetNames);
      if (rows.length === 0) {
        setError("이미지에서 거래 내역을 찾지 못했어요. 더 선명한 캡처로 다시 시도해 주세요.");
      } else {
        const uncategorized = categories.find((c) => c.id === "uncategorized")?.id || categories[0].id;
        const unassignedPm = paymentMethods.find((p) => p.id === "unassigned")?.id || paymentMethods[0].id;
        const transferPm = paymentMethods.find((p) => p.id === "transfer")?.id || unassignedPm;
        const newTx = [];
        const newTransfers = [];
        const importedAt = Date.now();

        // 자산은 자동으로 새로 만들지 않는다 — 이름이 정확히 일치하는 기존 자산이 있을 때만 연결한다.
        const resolveAsset = (name) => findAssetByName(name) || null;

        // AI가 이미지에서 그대로 뽑아온 날짜 문자열("4일", "8/4" 등)은 <input type="date">가 인식하는
        // YYYY-MM-DD 형식이 아니라서 그대로 저장하면 목록에서 날짜가 빈 값으로 보인다.
        // 현재 정산 기간을 문맥으로 삼아 정규화된 형식으로 변환해 저장한다.
        const currentPeriod = getPayPeriodByOffset(paydayDom, periodOffset);
        const normalizeRowDate = (rawDate) => {
          const parsed = parseTxDate(rawDate, currentPeriod.start, currentPeriod.end);
          return parsed ? dateToYmd(parsed) : todayStr();
        };

        rows.forEach((r) => {
          const normalizedDate = normalizeRowDate(r.date);
          if (r.type === "transfer") {
            const fromAsset = resolveAsset(r.fromAsset);
            const toAsset = resolveAsset(r.toAsset);
            if (fromAsset && toAsset && fromAsset.id !== toAsset.id) {
              newTransfers.push({
                id: uid(),
                date: normalizedDate,
                fromAssetId: fromAsset.id,
                toAssetId: toAsset.id,
                amount: Math.abs(Number(r.amount) || 0),
                memo: r.description || "",
                createdAt: importedAt
              });
              return;
            }
            // 상대방 계좌를 자동으로 찾지 못한 경우 — 내 쪽 계좌를 찾았다면 최소한 그 자산 잔액에는
            // 반영되도록 일반 거래로 남기고, 나머지는 사용자가 직접 자산을 연결하도록 비워 둔다.
            const known = fromAsset || toAsset;
            newTx.push({
              id: uid(),
              date: normalizedDate,
              description: r.description || `이체${r.fromAsset ? ` (${r.fromAsset} → ${r.toAsset || "?"})` : ""}`,
              amount: Math.abs(Number(r.amount) || 0),
              categoryId: uncategorized,
              paymentMethodId: transferPm,
              assetId: known ? known.id : "",
              createdAt: importedAt
            });
            return;
          }
          const remembered = recallCategory(r.description);
          const matchedCat = remembered ? categories.find((c) => c.id === remembered) : findCategoryByName(r.category);
          const matchedPm = findPaymentMethodByName(r.payment);
          newTx.push({
            id: uid(),
            date: normalizedDate,
            description: r.description || "내역 없음",
            amount: Number(r.amount) || 0,
            categoryId: matchedCat ? matchedCat.id : uncategorized,
            paymentMethodId: matchedPm ? matchedPm.id : unassignedPm,
            assetId: "",
            createdAt: importedAt
          });
        });
        if (newTx.length) setTransactions((prev) => [...newTx, ...prev]);
        if (newTransfers.length) setTransfers((prev) => [...newTransfers, ...prev]);
      }
    } catch (e) {
      setError(e.message || "이미지를 분석하는 중 문제가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [categories, paymentMethods, assets, assetTypes, categoryMemory, catMap, findCategoryByName, findPaymentMethodByName, findAssetByName, recallCategory, paydayDom, periodOffset]);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) processImageFile(file);
        e.preventDefault();
        break;
      }
    }
  }, [processImageFile]);

  // 자산 잔액 업데이트: 거래 내역이 아니라 "이미 등록된 자산의 현재 금액"을 이미지에서 읽어
  // 이름이 일치하는 자산의 기준금액/기준일을 그대로 덮어쓴다. (주식/펀드처럼 매번 값이 바뀌는 자산용)
  const processAssetBalanceImage = useCallback(async (file) => {
    setBalanceError("");
    setBalanceNotice("");
    setBalanceLoading(true);
    try {
      const { base64, mediaType } = await prepareImageForUpload(file);
      const assetNames = assets.map((a) => a.name);
      const rows = await extractAssetBalances(base64, mediaType, assetNames);
      if (rows.length === 0) {
        setBalanceError("이미지에서 자산 금액을 찾지 못했어요. 더 선명한 캡처로 다시 시도해 주세요.");
      } else {
        const currentPeriod = getPayPeriodByOffset(paydayDom, periodOffset);
        const matchedNames = [];
        const unmatchedNames = [];
        rows.forEach((r) => {
          const matched = findAssetByName(r.assetName);
          const amount = Number(r.amount);
          if (!matched || !Number.isFinite(amount)) {
            if (r.assetName) unmatchedNames.push(r.assetName);
            return;
          }
          const parsedDate = parseTxDate(r.date, currentPeriod.start, currentPeriod.end);
          const patch = { amount };
          if (parsedDate) patch.date = dateToYmd(parsedDate);
          updateAsset(matched.id, patch);
          matchedNames.push(matched.name);
        });
        if (matchedNames.length) {
          setBalanceNotice(`${matchedNames.join(", ")} 금액을 업데이트했어요.${unmatchedNames.length ? ` (일치하는 자산을 찾지 못함: ${unmatchedNames.join(", ")})` : ""}`);
        } else {
          setBalanceError(`일치하는 자산을 찾지 못했어요: ${unmatchedNames.join(", ") || "알 수 없음"}. 자산 이름을 이미지 속 표기와 비슷하게 맞춰 주세요.`);
        }
      }
    } catch (e) {
      setBalanceError(e.message || "이미지를 분석하는 중 문제가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setBalanceLoading(false);
    }
  }, [assets, findAssetByName, paydayDom, periodOffset]);

  const handleAssetBalancePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) processAssetBalanceImage(file);
        e.preventDefault();
        break;
      }
    }
  }, [processAssetBalanceImage]);

  const handleAssetFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processAssetBalanceImage(file);
    e.target.value = "";
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
  };

  // ---- category CRUD ----
  const updateCategory = (id, patch) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const addCategory = () => {
    const newCat = { id: uid(), name: "새 카테고리", emoji: "", color: PALETTE[categories.length % PALETTE.length], type: "variable" };
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === "uncategorized");
      const next = [...prev];
      next.splice(idx === -1 ? prev.length : idx, 0, newCat);
      return next;
    });
    setEditingCatId(newCat.id);
  };
  const deleteCategory = (id) => {
    if (id === "uncategorized") return;
    setTransactions((prev) => prev.map((t) => (t.categoryId === id ? { ...t, categoryId: "uncategorized" } : t)));
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  // ---- payment method CRUD ----
  const updatePaymentMethod = (id, patch) => {
    setPaymentMethods((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const addPaymentMethod = () => {
    const newPm = { id: uid(), name: "새 결제수단" };
    setPaymentMethods((prev) => {
      const idx = prev.findIndex((p) => p.id === "unassigned");
      const next = [...prev];
      next.splice(idx === -1 ? prev.length : idx, 0, newPm);
      return next;
    });
    setEditingPmId(newPm.id);
  };
  const deletePaymentMethod = (id) => {
    if (id === "unassigned") return;
    setTransactions((prev) => prev.map((t) => (t.paymentMethodId === id ? { ...t, paymentMethodId: "unassigned" } : t)));
    setPaymentMethods((prev) => prev.filter((p) => p.id !== id));
  };

  // ---- asset type CRUD ----
  const updateAssetType = (id, patch) => {
    setAssetTypes((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };
  const addAssetType = () => {
    const newType = { id: uid(), name: "새 자산 종류", color: PALETTE[assetTypes.length % PALETTE.length] };
    setAssetTypes((prev) => [...prev, newType]);
    setEditingAssetTypeId(newType.id);
  };
  const deleteAssetType = (id) => {
    const removedAssetIds = new Set(assets.filter((a) => a.assetTypeId === id).map((a) => a.id));
    setAssets((prev) => prev.filter((a) => a.assetTypeId !== id));
    setAssetTypes((prev) => prev.filter((a) => a.id !== id));
    if (removedAssetIds.size) {
      setTransactions((prev) => prev.map((t) => (removedAssetIds.has(t.assetId) ? { ...t, assetId: "" } : t)));
      setTransfers((prev) =>
        prev.map((tr) => ({
          ...tr,
          fromAssetId: removedAssetIds.has(tr.fromAssetId) ? "" : tr.fromAssetId,
          toAssetId: removedAssetIds.has(tr.toAssetId) ? "" : tr.toAssetId
        }))
      );
    }
  };

  // ---- asset entry CRUD ----
  const addAsset = () => {
    const newAsset = { id: uid(), name: "새 자산", assetTypeId: assetTypes[0]?.id || "", amount: 0, date: todayStr() };
    setAssets((prev) => [newAsset, ...prev]);
  };
  const updateAsset = (id, patch) => setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const deleteAsset = (id) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setSelectedAssetIds((prev) => prev.filter((x) => x !== id));
    setTransactions((prev) => prev.map((t) => (t.assetId === id ? { ...t, assetId: "" } : t)));
    setTransfers((prev) =>
      prev.map((tr) => ({
        ...tr,
        fromAssetId: tr.fromAssetId === id ? "" : tr.fromAssetId,
        toAssetId: tr.toAssetId === id ? "" : tr.toAssetId
      }))
    );
  };
  const toggleAssetSelection = (id) => {
    setSelectedAssetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ---- transfer CRUD (계좌 간 이체: 보내는 자산은 차감, 받는 자산은 증액) ----
  const addTransfer = (opts) => {
    const date = opts?.date ?? transferDate;
    const fromId = opts?.fromAssetId ?? transferFromId;
    const toId = opts?.toAssetId ?? transferToId;
    const amountRaw = opts?.amount ?? transferAmount;
    const memo = opts?.memo ?? transferMemo;
    const absAmount = Number(String(amountRaw).replace(/[^0-9]/g, "")) || 0;
    if (absAmount === 0 || !fromId || !toId || fromId === toId) return false;
    const newTransfer = {
      id: uid(),
      date: date || todayStr(),
      fromAssetId: fromId,
      toAssetId: toId,
      amount: absAmount,
      memo: (memo || "").trim(),
      createdAt: Date.now()
    };
    setTransfers((prev) => [newTransfer, ...prev]);
    if (!opts) {
      setTransferAmount("");
      setTransferMemo("");
      setTransferDate(todayStr());
    }
    return true;
  };
  const deleteTransfer = (id) => setTransfers((prev) => prev.filter((tr) => tr.id !== id));
  const updateTransfer = (id, patch) => setTransfers((prev) => prev.map((tr) => (tr.id === id ? { ...tr, ...patch } : tr)));

  // 사용 내역 목록에서 바로 지출/입금 ↔ 이체 로 전환할 수 있게 해준다 (자산 탭까지 갈 필요 없이).
  const convertTransactionToTransfer = (t) => {
    setTransactions((prev) => prev.filter((x) => x.id !== t.id));
    setTransfers((prev) => [
      { id: uid(), date: t.date, fromAssetId: t.assetId || "", toAssetId: "", amount: Math.abs(Number(t.amount) || 0), memo: t.description || "", createdAt: t.createdAt || Date.now() },
      ...prev
    ]);
  };
  const convertTransferToTransaction = (tr) => {
    setTransfers((prev) => prev.filter((x) => x.id !== tr.id));
    const uncategorized = categories.find((c) => c.id === "uncategorized")?.id || categories[0]?.id;
    const transferPm = paymentMethods.find((p) => p.id === "transfer")?.id || paymentMethods[0]?.id;
    setTransactions((prev) => [
      { id: uid(), date: tr.date, description: tr.memo || "이체", amount: Math.abs(Number(tr.amount) || 0), categoryId: uncategorized, paymentMethodId: transferPm, assetId: tr.fromAssetId || "", createdAt: tr.createdAt || Date.now() },
      ...prev
    ]);
  };

  // ---- transaction CRUD ----
  const updateTx = (id, patch) => setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const deleteTx = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id));
  const handleTxCategoryChange = (tx, newCategoryId) => {
    const becomesSaving = catMap[newCategoryId]?.type === "saving" || catMap[newCategoryId]?.type === "income";
    updateTx(tx.id, { categoryId: newCategoryId, ...(becomesSaving ? { amount: Math.abs(Number(tx.amount || 0)) } : {}) });
    rememberCategory(tx.description, newCategoryId);
  };

  const resetTransactions = () => {
    if (periodTransactions.length === 0) return;
    if (window.confirm(`${formatPeriodDate(payPeriod.start)} ~ ${formatPeriodDate(payPeriod.end)} 기간의 내역을 모두 지울까요? 다른 기간의 내역과 카테고리 설정은 유지됩니다.`)) {
      const periodIds = new Set(periodTransactions.map((t) => t.id));
      setTransactions((prev) => prev.filter((t) => !periodIds.has(t.id)));
    }
  };

  const addManualTransaction = () => {
    if (manualIsTransfer) {
      const ok = addTransfer({
        date: manualDate,
        fromAssetId: manualTransferFromId,
        toAssetId: manualTransferToId,
        amount: manualAmount,
        memo: manualDesc
      });
      if (!ok) return;
      setManualDesc("");
      setManualAmount("");
      setManualDate(todayStr());
      return;
    }
    const absAmount = Number(String(manualAmount).replace(/[^0-9]/g, "")) || 0;
    if (!manualDesc.trim() && absAmount === 0) return;
    const isSavingCat = catMap[manualCatId]?.type === "saving" || catMap[manualCatId]?.type === "income";
    const amountNum = isSavingCat ? absAmount : (manualIsIncome ? -absAmount : absAmount);
    const newTx = {
      id: uid(),
      date: manualDate || todayStr(),
      description: manualDesc.trim() || "내역 없음",
      amount: amountNum,
      categoryId: manualCatId || categories[0]?.id,
      paymentMethodId: manualPmId || paymentMethods[0]?.id,
      assetId: manualAssetId || "",
      createdAt: Date.now()
    };
    setTransactions((prev) => [newTx, ...prev]);
    rememberCategory(newTx.description, newTx.categoryId);
    setManualDesc("");
    setManualAmount("");
    setManualIsIncome(false);
    setManualDate(todayStr());
  };

  // ---- derived summaries ----
  const payPeriod = useMemo(() => getPayPeriodByOffset(paydayDom, periodOffset), [paydayDom, periodOffset]);

  const periodTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const d = parseTxDate(t.date, payPeriod.start, payPeriod.end);
      if (!d) return true; // don't hide entries we can't confidently date
      return d >= payPeriod.start && d <= payPeriod.end;
    });
  }, [transactions, payPeriod]);

  const periodTransfers = useMemo(() => {
    return transfers.filter((tr) => {
      const d = parseTxDate(tr.date, payPeriod.start, payPeriod.end);
      if (!d) return true;
      return d >= payPeriod.start && d <= payPeriod.end;
    });
  }, [transfers, payPeriod]);

  const totalsByCategory = useMemo(() => {
    return categories
      .map((c) => {
        const raw = periodTransactions.filter((t) => t.categoryId === c.id).reduce((s, t) => s + Number(t.amount || 0), 0);
        return { ...c, total: c.type === "income" ? Math.abs(raw) : c.type === "saving" ? Math.abs(raw) : raw };
      })
      .filter((c) => c.total !== 0);
  }, [categories, periodTransactions]);

  const totalsByType = useMemo(() => {
    return TYPE_ORDER.map((type) => {
      const raw = categories
        .filter((c) => c.type === type)
        .reduce((sum, c) => sum + periodTransactions.filter((t) => t.categoryId === c.id).reduce((s, t) => s + Number(t.amount || 0), 0), 0);
      return { type, label: TYPE_LABEL[type], total: type === "income" || type === "saving" ? Math.abs(raw) : raw };
    });
  }, [categories, periodTransactions]);

  // ---- asset balances: 자산의 "기준 금액"에 그 자산으로 연결된 수입/지출 거래 + 계좌 이체를 누적 반영한 실제 잔액 ----
  // 거래 amount는 지출이면 양수, 입금이면 음수이므로 자산 잔액에는 -amount 만큼 더한다.
  // 이체는 보내는 자산에서 -amount, 받는 자산에서 +amount로 반영한다.
  const assetHistoryMap = useMemo(() => {
    const legsByAsset = {};
    const pushLeg = (assetId, leg) => {
      if (!assetId) return;
      if (!legsByAsset[assetId]) legsByAsset[assetId] = [];
      legsByAsset[assetId].push(leg);
    };
    transactions.forEach((t) => {
      if (!t.assetId) return;
      const isSavingCat = catMap[t.categoryId]?.type === "saving" || catMap[t.categoryId]?.type === "income";
      const delta = isSavingCat ? Math.abs(Number(t.amount || 0)) : -Number(t.amount || 0);
      pushLeg(t.assetId, { id: t.id, date: t.date, description: t.description, delta, kind: "tx" });
    });
    transfers.forEach((tr) => {
      pushLeg(tr.fromAssetId, { id: `${tr.id}-out`, date: tr.date, description: tr.memo || `${assetMap[tr.toAssetId]?.name || "다른 자산"}(으)로 이체`, delta: -Number(tr.amount || 0), kind: "transfer-out" });
      pushLeg(tr.toAssetId, { id: `${tr.id}-in`, date: tr.date, description: tr.memo || `${assetMap[tr.fromAssetId]?.name || "다른 자산"}에서 이체`, delta: Number(tr.amount || 0), kind: "transfer-in" });
    });

    const map = {};
    assets.forEach((a) => {
      const linked = (legsByAsset[a.id] || [])
        .slice()
        .sort((x, y) => {
          const dx = parseTxDate(x.date) || new Date(0);
          const dy = parseTxDate(y.date) || new Date(0);
          return dx - dy;
        });
      let running = Number(a.amount || 0);
      map[a.id] = linked.map((leg) => {
        running += leg.delta;
        return { ...leg, running };
      });
    });
    return map;
  }, [assets, transactions, transfers, assetMap, catMap]);

  const assetBalances = useMemo(() => {
    const map = {};
    assets.forEach((a) => {
      const hist = assetHistoryMap[a.id] || [];
      map[a.id] = hist.length ? hist[hist.length - 1].running : Number(a.amount || 0);
    });
    return map;
  }, [assets, assetHistoryMap]);

  const totalsByAssetType = useMemo(() => {
    return assetTypes
      .map((a) => ({ ...a, total: assets.filter((x) => x.assetTypeId === a.id).reduce((s, x) => s + (assetBalances[x.id] ?? Number(x.amount || 0)), 0) }))
      .filter((a) => a.total !== 0);
  }, [assetTypes, assets, assetBalances]);

  // 자산 정렬: 자산 종류(자산 종류 편집에 나열된 순서) → 이름(가나다/ABC) 순으로 항상 자동 정렬.
  // 자산 목록 카드, 드롭다운 등 자산이 나열되는 모든 곳에서 이 순서를 그대로 사용한다.
  const sortedAssets = useMemo(() => {
    const typeOrder = Object.fromEntries(assetTypes.map((t, i) => [t.id, i]));
    return assets.slice().sort((a, b) => {
      const ta = typeOrder[a.assetTypeId] ?? 999;
      const tb = typeOrder[b.assetTypeId] ?? 999;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [assets, assetTypes]);

  const sortedFilteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    return sortedAssets.filter((a) => !q || a.name.toLowerCase().includes(q));
  }, [sortedAssets, assetSearch]);

  const grandTotal = periodTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalAssets = assets.reduce((s, a) => s + (assetBalances[a.id] ?? Number(a.amount || 0)), 0);
  const selectedAssetsTotal = assets.filter((a) => selectedAssetIds.includes(a.id)).reduce((s, a) => s + (assetBalances[a.id] ?? Number(a.amount || 0)), 0);
  const actualIncomeTotal = totalsByType.find((t) => t.type === "income")?.total || 0;
  const incomeNum = Number(income) || actualIncomeTotal;
  const fixedTotal = totalsByType.find((t) => t.type === "fixed")?.total || 0;
  const savingTotal = totalsByType.find((t) => t.type === "saving")?.total || 0;
  const fixedRatio = incomeNum > 0 ? (fixedTotal / incomeNum) * 100 : null;
  const savingRatio = incomeNum > 0 ? (savingTotal / incomeNum) * 100 : null;

  const pieData = totalsByCategory.filter((c) => c.total > 0 && c.type !== "saving" && c.type !== "income");
  const assetPieData = totalsByAssetType.filter((a) => a.total > 0);

  const toggleCategoryFilter = (id) => {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // flip every transaction in the selected categories to 지출(positive) or 입금(negative) at once —
  // handy for fixing a whole category (e.g. 카드깡) that came in tagged the "wrong" way
  const bulkSetTransactionSign = (makeExpense) => {
    if (selectedCategoryIds.length === 0) return;
    setTransactions((prev) =>
      prev.map((t) => {
        if (!selectedCategoryIds.includes(t.categoryId)) return t;
        const abs = Math.abs(Number(t.amount || 0));
        return { ...t, amount: makeExpense ? abs : -abs };
      })
    );
  };

  const filteredTransactions = periodTransactions.filter((t) => {
    const matchesCategory = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(t.categoryId);
    const catType = catMap[t.categoryId]?.type;
    const matchesType =
      typeFilter === "all" ? true :
      typeFilter === "transfer" ? false :
      typeFilter === "expense" ? (t.amount >= 0 && catType !== "saving") :
      typeFilter === "saving" ? catType === "saving" :
      t.amount < 0; // income
    return matchesCategory && matchesType;
  });
  const showTransfersInLedger = selectedCategoryIds.length === 0 && (typeFilter === "all" || typeFilter === "transfer");
  const ledgerItems = useMemo(() => {
    const txItems = filteredTransactions.map((t) => ({ kind: "tx", key: t.id, date: t.date, createdAt: t.createdAt || 0, tx: t }));
    const trItems = showTransfersInLedger ? periodTransfers.map((tr) => ({ kind: "transfer", key: tr.id, date: tr.date, createdAt: tr.createdAt || 0, tr })) : [];
    // 최근에 추가/수정한 항목이 위로 오도록 정렬한다 (createdAt이 없는 옛 데이터는 날짜순으로 폴백).
    return [...txItems, ...trItems].sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return (b.date || "").localeCompare(a.date || "");
    });
  }, [filteredTransactions, periodTransfers, showTransfersInLedger]);
  const filteredTotal = filteredTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const filteredTransferTotal = periodTransfers.reduce((s, tr) => s + Math.abs(Number(tr.amount || 0)), 0);
  const filteredTotalLabel =
    typeFilter === "transfer" ? "이체 합계" :
    typeFilter === "income" ? "입금 합계" :
    typeFilter === "saving" ? "저축 합계" :
    typeFilter === "expense" ? "지출 합계" :
    filteredTotal >= 0 ? "지출 합계" : "순수입";
  const filteredTotalAbs = typeFilter === "transfer" ? filteredTransferTotal : Math.abs(filteredTotal);

  const card = { background: "#16233A", border: "1px solid #2A3B57" };
  const inputStyle = { background: "#101B2D", border: "1px solid #2A3B57", color: "#EDE6D3" };

  return (
    <div className="min-h-screen w-full pb-24" style={{ background: "#101B2D", color: "#EDE6D3", fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ledger-serif { font-family: 'Noto Serif KR','Nanum Myeongjo',serif; }
        .tabular { font-variant-numeric: tabular-nums; font-family: 'Roboto Mono','SF Mono',monospace; }
        input, select { color-scheme: dark; }
      `}</style>

      {/* Cover header */}
      <header className="px-5 pt-8 pb-6 md:px-10" style={{ borderBottom: "1px solid #2A3B57" }}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <PiggyBank size={28} style={{ color: "#C9A227" }} />
          <div>
            <h1 className="ledger-serif text-2xl md:text-3xl font-bold" style={{ color: "#C9A227", letterSpacing: "0.02em" }}>
              가계부 결산
            </h1>
            <p className="text-xs md:text-sm mt-0.5" style={{ color: "#93A0B8" }}>
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-10 py-6">
        {/* ---------------- HOME ---------------- */}
        {activeTab === "home" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div
                tabIndex={0}
                onPaste={handlePaste}
                className="rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 outline-none focus:ring-2"
                style={{ ...card, border: "2px dashed #3A4E6E", minHeight: 180, ringColor: "#C9A227" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#C9A227" }} />
                    <p className="text-sm" style={{ color: "#93A0B8" }}>이미지를 읽고 분류하는 중...</p>
                  </>
                ) : (
                  <>
                    <ImagePlus size={28} style={{ color: "#C9A227" }} />
                    <p className="text-sm font-medium">여기를 클릭하고 <span className="tabular">Ctrl/Cmd + V</span> 로 캡처 이미지를 붙여넣으세요</p>
                    <p className="text-xs" style={{ color: "#93A0B8" }}>카드 명세서, 은행 앱, 가계부 앱 캡처 모두 가능해요</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "#C9A227", color: "#101B2D" }}
                    >
                      <Upload size={14} /> 파일에서 선택
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  </>
                )}
              </div>
              {error && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(181,83,59,0.15)", border: "1px solid #B5533B", color: "#E8B4A6" }}>
                  {error}
                </div>
              )}
              {notice && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(78,143,114,0.15)", border: "1px solid #4E8F72", color: "#B7D9C6" }}>
                  {notice}
                </div>
              )}

              <div className="rounded-2xl p-4" style={card}>
                <button onClick={() => setShowAssetBreakdown((v) => !v)} className="flex items-center justify-between w-full text-left">
                  <p className="text-xs font-semibold" style={{ color: "#93A0B8" }}>총 자산</p>
                  <span className="text-xs" style={{ color: "#93A0B8" }}>{showAssetBreakdown ? "접기 ▲" : "선택해서 보기 ▼"}</span>
                </button>
                <p className="tabular text-2xl font-bold" style={{ color: "#C9A227" }}>{won(totalAssets)}</p>
                {selectedAssetIds.length > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5" style={{ background: "#101B2D", border: "1px solid #C9A227" }}>
                    <span style={{ color: "#93A0B8" }}>{selectedAssetIds.length}개 선택</span>
                    <span className="tabular font-bold" style={{ color: "#C9A227" }}>{won(selectedAssetsTotal)}</span>
                    <button onClick={() => setSelectedAssetIds([])} style={{ color: "#93A0B8" }}>선택 해제</button>
                  </div>
                )}
                {showAssetBreakdown && (
                  <div className="mt-3 flex flex-col" style={{ borderTop: "1px solid #2A3B57", paddingTop: 6 }}>
                    {assets.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: "#5A6478" }}>아직 등록된 자산이 없어요.</p>
                    ) : (
                      sortedAssets.map((a) => {
                        const at = assetTypeMap[a.assetTypeId];
                        const selected = selectedAssetIds.includes(a.id);
                        return (
                          <label key={a.id} className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleAssetSelection(a.id)}
                              style={{ accentColor: "#C9A227", width: 15, height: 15, flexShrink: 0 }}
                            />
                            <span className="flex-1 min-w-0 truncate" style={{ color: at?.color || "#EDE6D3" }}>{a.name}</span>
                            <span className="tabular font-semibold flex-shrink-0">{won(assetBalances[a.id] ?? a.amount)}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {(fixedRatio !== null || savingRatio !== null) && (
                <div className="rounded-2xl p-4 flex flex-col gap-2" style={card}>
                  {fixedRatio !== null && (
                    <p className="text-sm">고정지출 비율 <span className="tabular font-bold" style={{ color: fixedRatio > 50 ? "#B5533B" : "#4E8F72" }}>{fixedRatio.toFixed(1)}%</span></p>
                  )}
                  {savingRatio !== null && (
                    <p className="text-sm">저축 비율 <span className="tabular font-bold" style={{ color: "#4E8F72" }}>{savingRatio.toFixed(1)}%</span></p>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-3 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3">
                {totalsByType.map((t) => (
                  <button
                    key={t.type}
                    onClick={() => setExpandedTypeCard((cur) => (cur === t.type ? null : t.type))}
                    className="rounded-2xl p-3 text-center overflow-hidden text-left"
                    style={{ ...card, outline: expandedTypeCard === t.type ? "1px solid #C9A227" : "none" }}
                  >
                    <p className="text-xs truncate" style={{ color: "#93A0B8" }}>{t.label}</p>
                    <p className="tabular text-sm sm:text-base md:text-lg font-bold mt-1 whitespace-nowrap" style={{ color: "#C9A227" }}>{won(t.total)}</p>
                  </button>
                ))}
              </div>

              {expandedTypeCard && (
                <div className="rounded-2xl p-4" style={card}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold" style={{ color: "#93A0B8" }}>{TYPE_LABEL[expandedTypeCard]}에 포함된 카테고리</p>
                    <button onClick={() => setExpandedTypeCard(null)} className="text-xs" style={{ color: "#93A0B8" }}>닫기</button>
                  </div>
                  {totalsByCategory.filter((c) => c.type === expandedTypeCard).length === 0 ? (
                    <p className="text-xs" style={{ color: "#5A6478" }}>이 기간엔 해당 항목이 없어요.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {totalsByCategory
                        .filter((c) => c.type === expandedTypeCard)
                        .map((c) => (
                          <div key={c.id} className="flex items-center justify-between text-sm">
                            <span style={{ color: c.color }}>{labelWithEmoji(c)}</span>
                            <span className="tabular font-semibold">{won(c.total)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {pieData.length > 0 && (
                <div className="rounded-2xl p-4" style={card}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "#93A0B8" }}>카테고리별 지출</p>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} dataKey="total" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                          {pieData.map((entry) => (<Cell key={entry.id} fill={entry.color} stroke="#16233A" strokeWidth={2} />))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [won(v), n]} contentStyle={{ background: "#101B2D", border: "1px solid #2A3B57", borderRadius: 8, color: "#EDE6D3" }} itemStyle={{ color: "#EDE6D3" }} labelStyle={{ color: "#EDE6D3" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {pieData.map((c) => (
                      <span key={c.id} className="text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{ background: "#101B2D", color: c.color }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: c.color }} /> {labelWithEmoji(c)} {won(c.total)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl overflow-hidden" style={card}>
                <p className="ledger-serif text-lg font-bold px-4 pt-4 pb-2" style={{ color: "#C9A227" }}>최근 내역</p>
                {periodTransactions.length === 0 ? (
                  <div className="px-4 pb-6 pt-2 text-sm text-center" style={{ color: "#5A6478" }}>
                    이 기간엔 내역이 없어요. 왼쪽에 캡처 이미지를 붙여넣어 시작하세요.
                  </div>
                ) : (
                  <div className="pb-1">
                    {periodTransactions.slice(0, 5).map((t) => {
                      const cat = catMap[t.categoryId];
                      return (
                        <div key={t.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                          <div className="min-w-0">
                            <p className="text-sm truncate" style={{ color: "#EDE6D3" }}>{t.description}</p>
                            <p className="text-xs" style={{ color: cat?.color || "#5A6478" }}>{labelWithEmoji(cat)} · {t.date}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: cat?.type === "saving" ? "rgba(201,162,39,0.15)" : cat?.type === "income" ? "rgba(78,143,114,0.15)" : t.amount < 0 ? "rgba(78,143,114,0.15)" : "rgba(181,83,59,0.15)",
                                color: cat?.type === "saving" ? "#C9A227" : cat?.type === "income" ? "#4E8F72" : t.amount < 0 ? "#4E8F72" : "#B5533B"
                              }}
                            >
                              {cat?.type === "saving" ? "저축" : cat?.type === "income" ? "수입" : t.amount < 0 ? "입금" : "지출"}
                            </span>
                            <p className="tabular text-sm font-semibold" style={{ color: "#EDE6D3" }}>{won(Math.abs(t.amount))}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- EXPENSES ---------------- */}
        {activeTab === "expenses" && (
          <div className="flex flex-col gap-5">
            {/* Pay-period navigator */}
            <div className="rounded-2xl p-3 flex items-center justify-between" style={card}>
              <button onClick={() => setPeriodOffset((o) => o - 1)} className="px-2 py-1 text-lg font-bold" style={{ color: "#93A0B8" }}>‹</button>
              <div className="text-center">
                <p className="text-xs flex items-center justify-center gap-1.5" style={{ color: "#93A0B8" }}>
                  급여주기{periodOffset === 0 ? " · 이번 기간" : ""}
                  {periodOffset !== 0 && (
                    <button onClick={() => setPeriodOffset(0)} className="underline" style={{ color: "#C9A227" }}>오늘로</button>
                  )}
                </p>
                <p className="tabular text-sm font-semibold">{formatPeriodDate(payPeriod.start)} ~ {formatPeriodDate(payPeriod.end)}</p>
              </div>
              <button onClick={() => setPeriodOffset((o) => o + 1)} className="px-2 py-1 text-lg font-bold" style={{ color: "#93A0B8" }}>›</button>
            </div>

            {/* Manual add form */}
            <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={card}>
              <p className="text-sm font-semibold" style={{ color: "#93A0B8" }}>직접 추가</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="tabular rounded-lg px-2 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder={manualIsTransfer ? "메모 (선택)" : "내역 (예: 스타벅스)"}
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="flex-1 min-w-[120px] rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="금액"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="tabular w-24 rounded-lg px-3 py-2 text-sm text-right outline-none"
                  style={inputStyle}
                />
                <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid #2A3B57" }}>
                  <button
                    onClick={() => {
                      setManualIsIncome(false);
                      setManualIsTransfer(false);
                      if (catMap[manualCatId]?.type === "income") {
                        setManualCatId(categories.find((c) => c.type !== "income")?.id || categories[0]?.id);
                      }
                    }}
                    className="px-2.5 py-2 text-xs font-semibold"
                    style={{ background: !manualIsIncome && !manualIsTransfer ? "rgba(181,83,59,0.2)" : "transparent", color: !manualIsIncome && !manualIsTransfer ? "#B5533B" : "#93A0B8" }}
                  >
                    지출
                  </button>
                  <button
                    onClick={() => {
                      setManualIsIncome(true);
                      setManualIsTransfer(false);
                      if (catMap[manualCatId]?.type !== "income") {
                        setManualCatId(categories.find((c) => c.type === "income")?.id || manualCatId);
                      }
                    }}
                    className="px-2.5 py-2 text-xs font-semibold"
                    style={{ background: manualIsIncome && !manualIsTransfer ? "rgba(78,143,114,0.2)" : "transparent", color: manualIsIncome && !manualIsTransfer ? "#4E8F72" : "#93A0B8" }}
                  >
                    입금
                  </button>
                  <button
                    onClick={() => setManualIsTransfer(true)}
                    className="px-2.5 py-2 text-xs font-semibold"
                    style={{ background: manualIsTransfer ? "rgba(201,162,39,0.2)" : "transparent", color: manualIsTransfer ? "#C9A227" : "#93A0B8" }}
                  >
                    이체
                  </button>
                </div>
              </div>
              {manualIsTransfer ? (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs flex-shrink-0 w-14" style={{ color: "#5A6478" }}>보내는</span>
                  <select value={manualTransferFromId} onChange={(e) => setManualTransferFromId(e.target.value)} className="flex-1 min-w-[120px] rounded-lg px-2 py-2 text-sm outline-none" style={inputStyle}>
                    <option value="">자산 선택</option>
                    {assetTypes.map((at) => {
                      const opts = sortedAssets.filter((a) => a.assetTypeId === at.id);
                      if (!opts.length) return null;
                      return (
                        <optgroup key={at.id} label={at.name}>
                          {opts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <select value={manualCatId} onChange={(e) => setManualCatId(e.target.value)} className="flex-1 min-w-[120px] rounded-lg px-2 py-2 text-sm outline-none" style={inputStyle}>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{labelWithEmoji(c)}</option>))}
                  </select>
                  <select value={manualPmId} onChange={(e) => setManualPmId(e.target.value)} className="flex-1 min-w-[120px] rounded-lg px-2 py-2 text-sm outline-none" style={inputStyle}>
                    {paymentMethods.map((p) => (<option key={p.id} value={p.id}>{labelWithEmoji(p)}</option>))}
                  </select>
                  <button onClick={addManualTransaction} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1" style={{ background: "#C9A227", color: "#101B2D" }}>
                    <Plus size={14} /> 추가
                  </button>
                </div>
              )}
              {manualIsTransfer ? (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs flex-shrink-0 w-14" style={{ color: "#5A6478" }}>받는</span>
                  <select value={manualTransferToId} onChange={(e) => setManualTransferToId(e.target.value)} className="flex-1 min-w-[120px] rounded-lg px-2 py-2 text-sm outline-none" style={inputStyle}>
                    <option value="">자산 선택</option>
                    {assetTypes.map((at) => {
                      const opts = sortedAssets.filter((a) => a.assetTypeId === at.id);
                      if (!opts.length) return null;
                      return (
                        <optgroup key={at.id} label={at.name}>
                          {opts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <button
                    onClick={addManualTransaction}
                    disabled={!manualTransferFromId || !manualTransferToId || manualTransferFromId === manualTransferToId || !manualAmount}
                    className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 disabled:opacity-40"
                    style={{ background: "#C9A227", color: "#101B2D" }}
                  >
                    <Plus size={14} /> 이체
                  </button>
                </div>
              ) : (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs flex-shrink-0" style={{ color: "#5A6478" }}>반영할 자산</span>
                <select
                  value={manualAssetTypeId}
                  onChange={(e) => {
                    setManualAssetTypeId(e.target.value);
                    if (manualAssetId && assetMap[manualAssetId]?.assetTypeId !== e.target.value && e.target.value) {
                      setManualAssetId("");
                    }
                  }}
                  className="rounded-lg px-2 py-2 text-sm outline-none flex-shrink-0 w-[110px]"
                  style={inputStyle}
                >
                  <option value="">종류 전체</option>
                  {assetTypes.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
                <select value={manualAssetId} onChange={(e) => setManualAssetId(e.target.value)} className="flex-1 min-w-[140px] rounded-lg px-2 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="">연결 안 함</option>
                  {sortedAssets.filter((a) => !manualAssetTypeId || a.assetTypeId === manualAssetTypeId).map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
              )}
              {manualIsTransfer && manualTransferFromId && manualTransferFromId === manualTransferToId && (
                <p className="text-xs" style={{ color: "#B5533B" }}>보내는 자산과 받는 자산은 다르게 선택해 주세요.</p>
              )}
            </div>

            {/* Category filter */}
            <div className="rounded-2xl p-4" style={card}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold" style={{ color: "#93A0B8" }}>카테고리별 조회</p>
                {selectedCategoryIds.length > 0 && (
                  <button onClick={() => setSelectedCategoryIds([])} className="text-xs" style={{ color: "#93A0B8" }}>선택 해제</button>
                )}
              </div>
              {selectedCategoryIds.length > 0 && (
                <div className="flex gap-1.5 mb-2">
                  <button
                    onClick={() => bulkSetTransactionSign(true)}
                    className="text-[11px] px-2.5 py-1 rounded-full font-semibold flex-1"
                    style={{ background: "rgba(181,83,59,0.15)", color: "#B5533B", border: "1px solid #B5533B" }}
                  >
                    선택 카테고리 전체 지출로
                  </button>
                  <button
                    onClick={() => bulkSetTransactionSign(false)}
                    className="text-[11px] px-2.5 py-1 rounded-full font-semibold flex-1"
                    style={{ background: "rgba(78,143,114,0.15)", color: "#4E8F72", border: "1px solid #4E8F72" }}
                  >
                    선택 카테고리 전체 입금으로
                  </button>
                </div>
              )}
              <div className="flex gap-1.5 mb-2">
                {[["all", "전체"], ["expense", "지출만"], ["income", "입금만"], ["saving", "저축만"], ["transfer", "이체만"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setTypeFilter(val)}
                    className="text-xs px-3 py-1.5 rounded-full font-semibold flex-1"
                    style={typeFilter === val ? { background: "#C9A227", color: "#101B2D" } : { background: "#101B2D", color: "#93A0B8", border: "1px solid #2A3B57" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const active = selectedCategoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCategoryFilter(c.id)}
                      className="text-xs px-3 py-1.5 rounded-full font-semibold"
                      style={active ? { background: c.color, color: "#101B2D" } : { background: "#101B2D", color: c.color, border: `1px solid ${c.color}` }}
                    >
                      {labelWithEmoji(c)}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm mt-3">
                {selectedCategoryIds.length === 0 ? filteredTotalLabel : `${selectedCategoryIds.length}개 카테고리 ${filteredTotalLabel}`}{" "}
                <span className="tabular font-bold" style={{ color: "#C9A227" }}>{won(filteredTotalAbs)}</span>
                <span className="text-xs ml-2" style={{ color: "#5A6478" }}>({ledgerItems.length}건)</span>
              </p>
            </div>

            {/* Ledger table */}
            <div className="rounded-2xl overflow-hidden" style={card}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="ledger-serif text-lg font-bold" style={{ color: "#C9A227" }}>사용 내역</p>
                <button onClick={resetTransactions} className="flex items-center gap-1 text-xs" style={{ color: "#93A0B8" }}>
                  <RotateCcw size={12} /> 이 기간 초기화
                </button>
              </div>
              {ledgerItems.length === 0 ? (
                <div className="px-4 pb-6 pt-2 text-sm text-center" style={{ color: "#5A6478" }}>
                  {periodTransactions.length === 0 && periodTransfers.length === 0 ? "이 기간엔 내역이 없어요." : "이 조건에 맞는 내역이 없어요."}
                </div>
              ) : (
                <div className="pb-1">
                  {ledgerItems.map((item) => {
                    if (item.kind === "transfer") {
                      const tr = item.tr;
                      return (
                        <div key={`tr-${tr.id}`} className="flex flex-col gap-1 px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                          <div className="flex items-center gap-2">
                            <input
                              value={tr.memo}
                              onChange={(e) => updateTransfer(tr.id, { memo: e.target.value })}
                              placeholder="메모 (선택)"
                              className="flex-1 min-w-0 bg-transparent outline-none text-sm"
                              style={{ color: "#EDE6D3" }}
                            />
                            <button onClick={() => deleteTransfer(tr.id)} className="flex-shrink-0" style={{ color: "#5A6478" }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => convertTransferToTransaction(tr)}
                              title="지출/입금으로 전환"
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: "rgba(92,158,255,0.15)", color: "#5C9EFF" }}
                            >
                              이체
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={Math.abs(Number(tr.amount || 0)).toLocaleString("ko-KR")}
                              onChange={(e) => {
                                const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                                updateTransfer(tr.id, { amount: digitsOnly === "" ? 0 : Number(digitsOnly) });
                              }}
                              className="tabular flex-1 min-w-0 bg-transparent outline-none text-sm text-right font-semibold"
                              style={{ color: "#C9A227" }}
                            />
                          </div>
                          <div className="flex items-center">
                            <input
                              type="date"
                              value={tr.date}
                              onChange={(e) => updateTransfer(tr.id, { date: e.target.value })}
                              className="tabular bg-transparent outline-none text-xs flex-shrink-0"
                              style={{ color: "#5A6478" }}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={tr.fromAssetId || ""}
                              onChange={(e) => updateTransfer(tr.id, { fromAssetId: e.target.value })}
                              className="w-full min-w-0 text-xs rounded-md px-1 py-0.5 outline-none"
                              style={{ background: "transparent", border: "1px solid #2A3B57", color: tr.fromAssetId ? "#EDE6D3" : "#5A6478" }}
                            >
                              <option value="">자산 연결 안 함</option>
                              {assetTypes.map((at) => {
                                const opts = sortedAssets.filter((a) => a.assetTypeId === at.id);
                                if (!opts.length) return null;
                                return (
                                  <optgroup key={at.id} label={at.name}>
                                    {opts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                                  </optgroup>
                                );
                              })}
                            </select>
                            <select
                              value={tr.toAssetId || ""}
                              onChange={(e) => updateTransfer(tr.id, { toAssetId: e.target.value })}
                              className="w-full min-w-0 text-xs rounded-md px-1 py-0.5 outline-none"
                              style={{ background: "transparent", border: "1px solid #2A3B57", color: tr.toAssetId ? "#EDE6D3" : "#5A6478" }}
                            >
                              <option value="">자산 연결 안 함</option>
                              {assetTypes.map((at) => {
                                const opts = sortedAssets.filter((a) => a.assetTypeId === at.id);
                                if (!opts.length) return null;
                                return (
                                  <optgroup key={at.id} label={at.name}>
                                    {opts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                                  </optgroup>
                                );
                              })}
                            </select>
                          </div>
                          {tr.fromAssetId && tr.fromAssetId === tr.toAssetId && (
                            <p className="text-[11px]" style={{ color: "#B5533B" }}>보내는 자산과 받는 자산이 같아요.</p>
                          )}
                        </div>
                      );
                    }
                    const t = item.tx;
                    const cat = catMap[t.categoryId];
                    return (
                      <div key={t.id} className="flex flex-col gap-1 px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                        <div className="flex items-center gap-2">
                          <input
                            value={t.description}
                            onChange={(e) => updateTx(t.id, { description: e.target.value })}
                            className="flex-1 min-w-0 bg-transparent outline-none text-sm"
                            style={{ color: "#EDE6D3" }}
                          />
                          <button onClick={() => deleteTx(t.id)} className="flex-shrink-0" style={{ color: "#5A6478" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={t.categoryId}
                            onChange={(e) => handleTxCategoryChange(t, e.target.value)}
                            className="text-xs rounded-md px-1 py-1 outline-none flex-shrink-0 w-[92px]"
                            style={{ background: "#101B2D", border: `1px solid ${cat?.color || "#2A3B57"}`, color: cat?.color || "#EDE6D3" }}
                          >
                            {categories.map((c) => (<option key={c.id} value={c.id}>{labelWithEmoji(c)}</option>))}
                          </select>
                          <button
                            onClick={() => cat?.type !== "saving" && cat?.type !== "income" && updateTx(t.id, { amount: -t.amount })}
                            disabled={cat?.type === "saving" || cat?.type === "income"}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                              background: cat?.type === "saving" ? "rgba(201,162,39,0.15)" : cat?.type === "income" ? "rgba(78,143,114,0.15)" : t.amount < 0 ? "rgba(78,143,114,0.15)" : "rgba(181,83,59,0.15)",
                              color: cat?.type === "saving" ? "#C9A227" : cat?.type === "income" ? "#4E8F72" : t.amount < 0 ? "#4E8F72" : "#B5533B"
                            }}
                          >
                            {cat?.type === "saving" ? "저축" : cat?.type === "income" ? "수입" : t.amount < 0 ? "입금" : "지출"}
                          </button>
                          <button
                            onClick={() => convertTransactionToTransfer(t)}
                            title="이체로 전환"
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: "transparent", color: "#5A6478", border: "1px solid #2A3B57" }}
                          >
                            ⇄이체
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={Math.abs(Number(t.amount || 0)).toLocaleString("ko-KR")}
                            onChange={(e) => {
                              const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                              const abs = digitsOnly === "" ? 0 : Number(digitsOnly);
                              const signed = (cat?.type === "saving" || cat?.type === "income") ? abs : (t.amount < 0 ? -abs : abs);
                              updateTx(t.id, { amount: signed });
                            }}
                            className="tabular flex-1 min-w-0 bg-transparent outline-none text-sm text-right font-semibold"
                            style={{ color: cat?.type === "saving" ? "#C9A227" : cat?.type === "income" ? "#4E8F72" : t.amount < 0 ? "#4E8F72" : "#EDE6D3" }}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={t.date}
                            onChange={(e) => updateTx(t.id, { date: e.target.value })}
                            className="tabular bg-transparent outline-none text-xs flex-shrink-0"
                            style={{ color: "#5A6478" }}
                          />
                          <select
                            value={t.assetId || ""}
                            onChange={(e) => updateTx(t.id, { assetId: e.target.value })}
                            className="text-xs rounded-md px-1 py-0.5 outline-none flex-shrink-0 max-w-[110px]"
                            style={{ background: "transparent", border: "1px solid #2A3B57", color: t.assetId ? "#C9A227" : "#5A6478" }}
                          >
                            <option value="">자산 연결 안 함</option>
                            {assetTypes.map((at) => {
                              const opts = sortedAssets.filter((a) => a.assetTypeId === at.id);
                              if (!opts.length) return null;
                              return (
                                <optgroup key={at.id} label={at.name}>
                                  {opts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                                </optgroup>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- ASSETS ---------------- */}
        {activeTab === "assets" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-xs font-semibold" style={{ color: "#93A0B8" }}>총 자산</p>
              <p className="tabular text-2xl font-bold mt-1" style={{ color: "#C9A227" }}>{won(totalAssets)}</p>
            </div>

            {/* 자산 잔액 이미지 업데이트: 새 거래를 추가하는 게 아니라, 캡처 이미지 속 금액으로
                이름이 같은 기존 자산의 현재 금액을 그대로 덮어쓴다. 주식/펀드처럼 값이 계속 바뀌는 자산용. */}
            <div
              tabIndex={0}
              onPaste={handleAssetBalancePaste}
              className="rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2.5 outline-none focus:ring-2"
              style={{ ...card, border: "2px dashed #3A4E6E", minHeight: 140, ringColor: "#C9A227" }}
            >
              {balanceLoading ? (
                <>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#C9A227" }} />
                  <p className="text-sm" style={{ color: "#93A0B8" }}>이미지에서 잔액을 읽는 중...</p>
                </>
              ) : (
                <>
                  <RefreshCw size={24} style={{ color: "#C9A227" }} />
                  <p className="text-sm font-medium">자산 잔액 이미지로 업데이트</p>
                  <p className="text-xs" style={{ color: "#93A0B8" }}>주식·펀드 등 평가금액 캡처를 붙여넣으면 이름이 같은 자산의 금액을 갱신해요</p>
                  <button
                    onClick={() => assetFileInputRef.current?.click()}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#C9A227", color: "#101B2D" }}
                  >
                    <Upload size={14} /> 파일에서 선택
                  </button>
                  <input ref={assetFileInputRef} type="file" accept="image/*" onChange={handleAssetFileSelect} className="hidden" />
                </>
              )}
            </div>
            {balanceError && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(181,83,59,0.15)", border: "1px solid #B5533B", color: "#E8B4A6" }}>
                {balanceError}
              </div>
            )}
            {balanceNotice && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(78,143,114,0.15)", border: "1px solid #4E8F72", color: "#B7D9C8" }}>
                {balanceNotice}
              </div>
            )}

            {assetPieData.length > 0 && (
              <div className="rounded-2xl p-4" style={card}>
                <p className="text-sm font-semibold mb-2" style={{ color: "#93A0B8" }}>자산 구성</p>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={assetPieData} dataKey="total" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {assetPieData.map((entry) => (<Cell key={entry.id} fill={entry.color} stroke="#16233A" strokeWidth={2} />))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [won(v), n]} contentStyle={{ background: "#101B2D", border: "1px solid #2A3B57", borderRadius: 8, color: "#EDE6D3" }} itemStyle={{ color: "#EDE6D3" }} labelStyle={{ color: "#EDE6D3" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {assetPieData.map((a) => (
                    <span key={a.id} className="text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{ background: "#101B2D", color: a.color }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: a.color }} /> {a.name} {won(a.total)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Asset type manager */}
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-sm font-semibold mb-2" style={{ color: "#93A0B8" }}>자산 종류 편집</p>
              <div className="flex flex-col gap-2" ref={assetTypeDrag.containerRef}>
                {assetTypes.map((at) => (
                  <div key={at.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#101B2D", border: `1.5px dashed ${at.color}`, ...assetTypeDrag.rowStyle(at.id) }}>
                    <div
                      onPointerDown={assetTypeDrag.handlePointerDown(at.id)}
                      className="flex-shrink-0"
                      style={{ color: "#5A6478", touchAction: "none", cursor: "grab" }}
                    >
                      <GripVertical size={16} />
                    </div>
                    {editingAssetTypeId === at.id ? (
                      <input
                        autoFocus
                        value={at.name}
                        onChange={(e) => updateAssetType(at.id, { name: e.target.value })}
                        onBlur={() => setEditingAssetTypeId(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingAssetTypeId(null)}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold"
                        style={{ color: at.color }}
                      />
                    ) : (
                      <button onClick={() => setEditingAssetTypeId(at.id)} className="flex-1 min-w-0 text-left text-sm font-semibold truncate" style={{ color: at.color }}>
                        {at.name}
                      </button>
                    )}
                    <div className="flex gap-0.5 flex-shrink-0">
                      {PALETTE.slice(0, 6).map((c) => (
                        <button key={c} onClick={() => updateAssetType(at.id, { color: c })} className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: c, outline: at.color === c ? "1.5px solid #EDE6D3" : "none", outlineOffset: 1 }} />
                      ))}
                    </div>
                    <button onClick={() => deleteAssetType(at.id)} className="flex-shrink-0" style={{ color: "#93A0B8" }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={addAssetType} className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold mt-1" style={{ background: "#101B2D", border: "1px dashed #3A4E6E", color: "#C9A227" }}>
                  <Plus size={14} /> 새 자산 종류
                </button>
              </div>
            </div>

            {/* Asset entries */}
            <div className="rounded-2xl overflow-hidden" style={card}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="ledger-serif text-lg font-bold" style={{ color: "#C9A227" }}>자산 목록</p>
                <button onClick={addAsset} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#C9A227" }}>
                  <Plus size={12} /> 자산 추가
                </button>
              </div>
              <div className="px-4 pb-2">
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="자산 이름 검색"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              {selectedAssetIds.length > 0 && (
                <div className="mx-4 mb-2 rounded-xl px-3 py-2 flex items-center justify-between" style={{ background: "#101B2D", border: "1px solid #C9A227" }}>
                  <span className="text-xs" style={{ color: "#93A0B8" }}>{selectedAssetIds.length}개 선택됨</span>
                  <span className="tabular text-sm font-bold" style={{ color: "#C9A227" }}>{won(selectedAssetsTotal)}</span>
                  <button onClick={() => setSelectedAssetIds([])} className="text-xs" style={{ color: "#93A0B8" }}>선택 해제</button>
                </div>
              )}
              {assets.length === 0 ? (
                <div className="px-4 pb-6 pt-2 text-sm text-center" style={{ color: "#5A6478" }}>
                  아직 등록된 자산이 없어요. "자산 추가"로 시작하세요.
                </div>
              ) : sortedFilteredAssets.length === 0 ? (
                <div className="px-4 pb-6 pt-2 text-sm text-center" style={{ color: "#5A6478" }}>
                  검색 결과가 없어요.
                </div>
              ) : (
                <div className="pb-1">
                  {sortedFilteredAssets.map((a) => {
                    const at = assetTypeMap[a.assetTypeId];
                    const selected = selectedAssetIds.includes(a.id);
                    const history = assetHistoryMap[a.id] || [];
                    const currentBalance = assetBalances[a.id] ?? Number(a.amount || 0);
                    const changed = currentBalance !== Number(a.amount || 0);
                    const historyOpen = expandedAssetHistoryId === a.id;
                    return (
                      <div key={a.id} className="flex flex-col gap-1.5 px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b", background: selected ? "rgba(201,162,39,0.08)" : "transparent" }}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleAssetSelection(a.id)}
                            className="flex-shrink-0"
                            style={{ accentColor: "#C9A227", width: 16, height: 16 }}
                          />
                          <input
                            value={a.name}
                            onChange={(e) => updateAsset(a.id, { name: e.target.value })}
                            className="flex-1 min-w-0 bg-transparent outline-none text-sm truncate"
                            style={{ color: "#EDE6D3" }}
                          />
                          <select
                            value={a.assetTypeId}
                            onChange={(e) => updateAsset(a.id, { assetTypeId: e.target.value })}
                            className="text-xs rounded-md px-1 py-1 outline-none flex-shrink-0 w-[100px]"
                            style={{ background: "#101B2D", border: `1px solid ${at?.color || "#2A3B57"}`, color: at?.color || "#EDE6D3" }}
                          >
                            {assetTypes.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                          </select>
                          <button onClick={() => deleteAsset(a.id)} className="flex-shrink-0" style={{ color: "#5A6478" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2 pl-6">
                          <p className="tabular text-base font-bold" style={{ color: "#C9A227" }}>{won(currentBalance)}</p>
                          {history.length > 0 && (
                            <button
                              onClick={() => setExpandedAssetHistoryId(historyOpen ? null : a.id)}
                              className="text-[11px] flex-shrink-0"
                              style={{ color: "#93A0B8" }}
                            >
                              변동내역 {history.length}건 {historyOpen ? "닫기" : "보기"}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pl-6">
                          <span className="text-xs flex-shrink-0" style={{ color: "#5A6478" }}>기준금액</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={Number(a.amount || 0).toLocaleString("ko-KR")}
                            onChange={(e) => {
                              const digitsOnly = e.target.value.replace(/[^0-9-]/g, "");
                              updateAsset(a.id, { amount: digitsOnly === "" ? 0 : Number(digitsOnly) });
                            }}
                            className="tabular w-24 flex-shrink-0 bg-transparent outline-none text-xs text-right"
                            style={{ color: "#93A0B8" }}
                          />
                          <span className="text-xs flex-shrink-0" style={{ color: "#5A6478" }}>기준일</span>
                          <input
                            type="date"
                            value={a.date}
                            onChange={(e) => updateAsset(a.id, { date: e.target.value })}
                            className="tabular bg-transparent outline-none text-xs"
                            style={{ color: "#5A6478" }}
                          />
                        </div>
                        {changed && (
                          <p className="text-[11px] pl-6" style={{ color: "#5A6478" }}>
                            기준금액 {won(a.amount)}에서 연결된 거래 {history.length}건이 반영되어 현재 {won(currentBalance)}이에요.
                          </p>
                        )}
                        {historyOpen && (
                          <div className="ml-6 mt-1 rounded-lg overflow-hidden" style={{ background: "#101B2D", border: "1px solid #2A3B57" }}>
                            {history.slice().reverse().map((h) => (
                              <div key={h.id} className="flex items-center justify-between px-3 py-1.5 text-xs" style={{ borderBottom: "1px solid #1e293b" }}>
                                <div className="min-w-0">
                                  <p className="truncate" style={{ color: "#93A0B8" }}>{h.date} · {h.description}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="tabular font-semibold" style={{ color: h.delta >= 0 ? "#4E8F72" : "#B5533B" }}>
                                    {h.delta >= 0 ? "+" : ""}{won(h.delta)}
                                  </span>
                                  <span className="tabular" style={{ color: "#5A6478" }}>{won(h.running)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Account-to-account transfer */}
            <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={card}>
              <p className="text-sm font-semibold" style={{ color: "#93A0B8" }}>계좌 이체 (한 자산 → 다른 자산)</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="tabular rounded-lg px-2 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="이체 금액"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="tabular flex-1 min-w-[100px] rounded-lg px-3 py-2 text-sm text-right outline-none"
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs flex-shrink-0 w-10" style={{ color: "#5A6478" }}>보내는</span>
                <select value={transferFromId} onChange={(e) => setTransferFromId(e.target.value)} className="flex-1 min-w-[120px] rounded-lg px-2 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="">자산 선택</option>
                  {assetTypes.map((at) => {
                    const opts = sortedAssets.filter((a) => a.assetTypeId === at.id);
                    if (!opts.length) return null;
                    return (
                      <optgroup key={at.id} label={at.name}>
                        {opts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs flex-shrink-0 w-10" style={{ color: "#5A6478" }}>받는</span>
                <select value={transferToId} onChange={(e) => setTransferToId(e.target.value)} className="flex-1 min-w-[120px] rounded-lg px-2 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="">자산 선택</option>
                  {assetTypes.map((at) => {
                    const opts = sortedAssets.filter((a) => a.assetTypeId === at.id);
                    if (!opts.length) return null;
                    return (
                      <optgroup key={at.id} label={at.name}>
                        {opts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="메모 (선택)"
                  value={transferMemo}
                  onChange={(e) => setTransferMemo(e.target.value)}
                  className="flex-1 min-w-[120px] rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <button
                  onClick={addTransfer}
                  disabled={!transferFromId || !transferToId || transferFromId === transferToId || !transferAmount}
                  className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 disabled:opacity-40"
                  style={{ background: "#C9A227", color: "#101B2D" }}
                >
                  <Plus size={14} /> 이체
                </button>
              </div>
              {transferFromId && transferFromId === transferToId && (
                <p className="text-xs" style={{ color: "#B5533B" }}>보내는 자산과 받는 자산은 다르게 선택해 주세요.</p>
              )}
              {transfers.length > 0 && (
                <div className="mt-1 rounded-lg overflow-hidden" style={{ background: "#101B2D", border: "1px solid #2A3B57" }}>
                  {transfers.slice(0, 8).map((tr) => (
                    <div key={tr.id} className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderBottom: "1px solid #1e293b" }}>
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: "#EDE6D3" }}>
                          {assetMap[tr.fromAssetId]?.name || "삭제된 자산"} → {assetMap[tr.toAssetId]?.name || "삭제된 자산"}
                        </p>
                        <p style={{ color: "#5A6478" }}>{tr.date}{tr.memo ? ` · ${tr.memo}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="tabular font-semibold" style={{ color: "#C9A227" }}>{won(tr.amount)}</span>
                        <button onClick={() => deleteTransfer(tr.id)} style={{ color: "#5A6478" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- SETTINGS ---------------- */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-5 max-w-xl">
            {/* Cloud sync */}
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                <Cloud size={15} style={{ color: "#C9A227" }} /> 기기 간 동기화
              </p>
              <p className="text-xs mb-2" style={{ color: "#93A0B8" }}>
                동기화 비밀번호를 설정하면 폰·PC 등 여러 기기에서 같은 데이터를 볼 수 있어요. 모든 기기에 똑같은 비밀번호를 입력해야 해요.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={syncSecretDraft}
                  onChange={(e) => setSyncSecretDraft(e.target.value)}
                  placeholder="동기화 비밀번호"
                  className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <button
                  onClick={saveSyncSecret}
                  className="flex-shrink-0 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "#C9A227", color: "#101B2D" }}
                >
                  적용
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: "#93A0B8" }}>
                {!syncSecret && <span>미설정 — 이 기기에만 저장됩니다</span>}
                {syncSecret && syncStatus === "syncing" && (
                  <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> 동기화 중...</>
                )}
                {syncSecret && syncStatus === "synced" && <span style={{ color: "#4E8F72" }}>✓ 동기화됨</span>}
                {syncSecret && syncStatus === "error" && (
                  <span style={{ color: "#B5533B" }}>동기화 실패: {syncErrorMessage}</span>
                )}
              </div>
            </div>

            {/* Income */}
            <div className="rounded-2xl p-4" style={card}>
              <label className="text-xs font-semibold" style={{ color: "#93A0B8" }}>월 소득 (선택 — 비워두면 이 기간 급여/상여금 내역 합계를 자동으로 사용해요)</label>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder={actualIncomeTotal > 0 ? `자동 계산: ${actualIncomeTotal.toLocaleString("ko-KR")}` : "예: 3500000"}
                  className="tabular flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <span className="text-sm" style={{ color: "#93A0B8" }}>원</span>
              </div>
            </div>

            {/* Payday */}
            <div className="rounded-2xl p-4" style={card}>
              <label className="text-xs font-semibold" style={{ color: "#93A0B8" }}>급여일 (매월 며칠, 지출 탭의 급여주기 계산 기준)</label>
              <p className="text-xs mt-1 mb-1.5" style={{ color: "#5A6478" }}>급여일이 주말·공휴일이면 자동으로 그 앞 영업일로 계산해요.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={paydayDom}
                  onChange={(e) => setPaydayDom(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="tabular w-20 rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <span className="text-sm" style={{ color: "#93A0B8" }}>일</span>
                <span className="text-xs ml-2 tabular" style={{ color: "#5A6478" }}>
                  이번 기간: {formatPeriodDate(payPeriod.start)} ~ {formatPeriodDate(payPeriod.end)}
                </span>
              </div>
            </div>

            {/* Category manager */}
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-sm font-semibold mb-2">🏷️ 카테고리 편집 ({categories.length}개)</p>
              <div className="flex flex-col gap-2" ref={catDrag.containerRef}>
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#101B2D", border: `1.5px dashed ${cat.color}`, ...catDrag.rowStyle(cat.id) }}>
                    <div
                      onPointerDown={catDrag.handlePointerDown(cat.id)}
                      className="flex-shrink-0"
                      style={{ color: "#5A6478", touchAction: "none", cursor: "grab" }}
                    >
                      <GripVertical size={16} />
                    </div>
                    {editingCatId === cat.id ? (
                      <input
                        autoFocus
                        value={cat.name}
                        onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                        onBlur={() => setEditingCatId(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingCatId(null)}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold"
                        style={{ color: cat.color }}
                      />
                    ) : (
                      <button onClick={() => setEditingCatId(cat.id)} className="flex-1 min-w-0 text-left text-sm font-semibold truncate" style={{ color: cat.color }}>
                        {labelWithEmoji(cat)}
                      </button>
                    )}
                    <select
                      value={cat.type}
                      onChange={(e) => updateCategory(cat.id, { type: e.target.value })}
                      className="text-xs rounded-md px-1.5 py-1 outline-none flex-shrink-0"
                      style={{ background: "#16233A", border: "1px solid #2A3B57", color: "#EDE6D3" }}
                    >
                      <option value="income">수입</option>
                      <option value="fixed">고정</option>
                      <option value="variable">변동</option>
                      <option value="saving">저축</option>
                    </select>
                    <div className="flex gap-0.5 flex-shrink-0">
                      {PALETTE.slice(0, 6).map((c) => (
                        <button key={c} onClick={() => updateCategory(cat.id, { color: c })} className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: c, outline: cat.color === c ? "1.5px solid #EDE6D3" : "none", outlineOffset: 1 }} />
                      ))}
                    </div>
                    {cat.id !== "uncategorized" && (
                      <button onClick={() => deleteCategory(cat.id)} className="flex-shrink-0" style={{ color: "#93A0B8" }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addCategory} className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold mt-1" style={{ background: "#101B2D", border: "1px dashed #3A4E6E", color: "#C9A227" }}>
                  <Plus size={14} /> 새 카테고리 (이모지는 이름에 직접 입력하세요)
                </button>
              </div>
            </div>

            {/* Payment method manager */}
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-sm font-semibold mb-2">💳 결제수단 편집 ({paymentMethods.length}개)</p>
              <div className="flex flex-col gap-2" ref={pmDrag.containerRef}>
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#101B2D", border: "1.5px dashed #3A4E6E", ...pmDrag.rowStyle(pm.id) }}>
                    <div
                      onPointerDown={pmDrag.handlePointerDown(pm.id)}
                      className="flex-shrink-0"
                      style={{ color: "#5A6478", touchAction: "none", cursor: "grab" }}
                    >
                      <GripVertical size={16} />
                    </div>
                    {editingPmId === pm.id ? (
                      <input
                        autoFocus
                        value={pm.name}
                        onChange={(e) => updatePaymentMethod(pm.id, { name: e.target.value })}
                        onBlur={() => setEditingPmId(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingPmId(null)}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold"
                        style={{ color: "#EDE6D3" }}
                      />
                    ) : (
                      <button onClick={() => setEditingPmId(pm.id)} className="flex-1 min-w-0 text-left text-sm font-semibold truncate" style={{ color: "#EDE6D3" }}>
                        {labelWithEmoji(pm)}
                      </button>
                    )}
                    {pm.id !== "unassigned" && (
                      <button onClick={() => deletePaymentMethod(pm.id)} className="flex-shrink-0" style={{ color: "#93A0B8" }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addPaymentMethod} className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold mt-1" style={{ background: "#101B2D", border: "1px dashed #3A4E6E", color: "#C9A227" }}>
                  <Plus size={14} /> 새 결제수단
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-4 text-xs leading-relaxed" style={{ ...card, color: "#5A6478" }}>
              카테고리를 한 번 직접 수정하면, 같은 가맹점명이 다음에 또 나올 때 자동으로 같은 카테고리가 적용돼요. (총 {Object.keys(categoryMemory).length}개 학습됨)
            </div>
          </div>
        )}
      </main>

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-10 flex items-stretch justify-around"
        style={{ background: "#16233A", borderTop: "1px solid #2A3B57", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5"
              style={{ color: isActive ? "#C9A227" : "#5A6478" }}
            >
              <Icon size={20} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
