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

async function extractTransactions(base64, mediaType, categoryNames, paymentMethodNames, merchantHints) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mediaType, categories: categoryNames, paymentMethods: paymentMethodNames, merchantHints })
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

export default function App() {
  const [activeTab, setActiveTab] = useState("home");

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [assetTypes, setAssetTypes] = useState(DEFAULT_ASSET_TYPES);
  const [categoryMemory, setCategoryMemory] = useState({}); // normalizedMerchant -> categoryId

  const [transactions, setTransactions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [income, setIncome] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAssetBreakdown, setShowAssetBreakdown] = useState(false);
  const [expandedTypeCard, setExpandedTypeCard] = useState(null); // "fixed" | "variable" | "saving" | null
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

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
  const [manualCatId, setManualCatId] = useState("");
  const [manualPmId, setManualPmId] = useState("");

  const fileInputRef = useRef(null);
  const saveTimer = useRef(null);
  const [syncSecret, setSyncSecret] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error | no-secret
  const [syncSecretDraft, setSyncSecretDraft] = useState("");
  const [syncErrorMessage, setSyncErrorMessage] = useState("");

  const buildSnapshot = () => ({
    categories, paymentMethods, assetTypes, categoryMemory, transactions, assets, income, paydayDom
  });

  const applySnapshot = (parsed) => {
    if (!parsed) return;
    if (parsed.categories?.length) setCategories(parsed.categories);
    if (parsed.paymentMethods?.length) setPaymentMethods(parsed.paymentMethods);
    if (parsed.assetTypes?.length) setAssetTypes(parsed.assetTypes);
    if (parsed.categoryMemory) setCategoryMemory(parsed.categoryMemory);
    if (parsed.transactions) setTransactions(parsed.transactions);
    if (parsed.assets) setAssets(parsed.assets);
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
  }, [categories, paymentMethods, assetTypes, categoryMemory, transactions, assets, income, paydayDom, loaded, syncSecret]);

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

      const hasLocalData = transactions.length > 0 || assets.length > 0;
      const hasCloudData = !!json.data && ((json.data.transactions?.length || 0) > 0 || (json.data.assets?.length || 0) > 0);

      if (hasCloudData) {
        if (hasLocalData) {
          const useCloud = window.confirm(
            "이미 클라우드에 저장된 데이터가 있어요.\n\n확인: 클라우드 데이터를 불러옵니다 (이 기기의 현재 데이터는 대체됩니다)\n취소: 이 기기 데이터를 클라우드에 저장합니다 (클라우드 데이터가 대체됩니다)"
          );
          if (useCloud) applySnapshot(json.data);
        } else {
          applySnapshot(json.data);
        }
      }
      // if the cloud has no data yet, do nothing here — the normal debounced save effect
      // will push this device's current (local) data up once syncSecret is set below.

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

  const processImageFile = useCallback(async (file) => {
    setError("");
    setLoading(true);
    try {
      const { base64, mediaType } = await prepareImageForUpload(file);
      const categoryNames = categories.map((c) => c.name);
      const paymentMethodNames = paymentMethods.map((p) => p.name);
      const merchantHints = Object.entries(categoryMemory)
        .slice(-40)
        .map(([merchant, categoryId]) => ({ merchant, category: catMap[categoryId]?.name }))
        .filter((h) => h.category);
      const rows = await extractTransactions(base64, mediaType, categoryNames, paymentMethodNames, merchantHints);
      if (rows.length === 0) {
        setError("이미지에서 거래 내역을 찾지 못했어요. 더 선명한 캡처로 다시 시도해 주세요.");
      } else {
        const uncategorized = categories.find((c) => c.id === "uncategorized")?.id || categories[0].id;
        const unassignedPm = paymentMethods.find((p) => p.id === "unassigned")?.id || paymentMethods[0].id;
        const newTx = rows.map((r) => {
          const remembered = recallCategory(r.description);
          const matchedCat = remembered ? categories.find((c) => c.id === remembered) : findCategoryByName(r.category);
          const matchedPm = findPaymentMethodByName(r.payment);
          return {
            id: uid(),
            date: r.date || todayStr(),
            description: r.description || "내역 없음",
            amount: Number(r.amount) || 0,
            categoryId: matchedCat ? matchedCat.id : uncategorized,
            paymentMethodId: matchedPm ? matchedPm.id : unassignedPm
          };
        });
        setTransactions((prev) => [...newTx, ...prev]);
      }
    } catch (e) {
      setError(e.message || "이미지를 분석하는 중 문제가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [categories, paymentMethods, categoryMemory, catMap, findCategoryByName, findPaymentMethodByName, recallCategory]);

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
    setAssets((prev) => prev.filter((a) => a.assetTypeId !== id));
    setAssetTypes((prev) => prev.filter((a) => a.id !== id));
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
  };
  const toggleAssetSelection = (id) => {
    setSelectedAssetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ---- transaction CRUD ----
  const updateTx = (id, patch) => setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const deleteTx = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id));
  const handleTxCategoryChange = (tx, newCategoryId) => {
    updateTx(tx.id, { categoryId: newCategoryId });
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
    const absAmount = Number(String(manualAmount).replace(/[^0-9]/g, "")) || 0;
    if (!manualDesc.trim() && absAmount === 0) return;
    const amountNum = manualIsIncome ? -absAmount : absAmount;
    const newTx = {
      id: uid(),
      date: manualDate || todayStr(),
      description: manualDesc.trim() || "내역 없음",
      amount: amountNum,
      categoryId: manualCatId || categories[0]?.id,
      paymentMethodId: manualPmId || paymentMethods[0]?.id
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

  const totalsByCategory = useMemo(() => {
    return categories
      .map((c) => {
        const raw = periodTransactions.filter((t) => t.categoryId === c.id).reduce((s, t) => s + Number(t.amount || 0), 0);
        return { ...c, total: c.type === "income" ? Math.abs(raw) : raw };
      })
      .filter((c) => c.total !== 0);
  }, [categories, periodTransactions]);

  const totalsByType = useMemo(() => {
    return TYPE_ORDER.map((type) => {
      const raw = categories
        .filter((c) => c.type === type)
        .reduce((sum, c) => sum + periodTransactions.filter((t) => t.categoryId === c.id).reduce((s, t) => s + Number(t.amount || 0), 0), 0);
      return { type, label: TYPE_LABEL[type], total: type === "income" ? Math.abs(raw) : raw };
    });
  }, [categories, periodTransactions]);

  const totalsByAssetType = useMemo(() => {
    return assetTypes
      .map((a) => ({ ...a, total: assets.filter((x) => x.assetTypeId === a.id).reduce((s, x) => s + Number(x.amount || 0), 0) }))
      .filter((a) => a.total !== 0);
  }, [assetTypes, assets]);

  const grandTotal = periodTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalAssets = assets.reduce((s, a) => s + Number(a.amount || 0), 0);
  const selectedAssetsTotal = assets.filter((a) => selectedAssetIds.includes(a.id)).reduce((s, a) => s + Number(a.amount || 0), 0);
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
      typeFilter === "expense" ? (t.amount >= 0 && catType !== "saving") :
      typeFilter === "saving" ? catType === "saving" :
      t.amount < 0; // income
    return matchesCategory && matchesType;
  });
  const filteredTotal = filteredTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const filteredTotalLabel =
    typeFilter === "income" ? "입금 합계" :
    typeFilter === "saving" ? "저축 합계" :
    typeFilter === "expense" ? "지출 합계" :
    filteredTotal >= 0 ? "지출 합계" : "순수입";
  const filteredTotalAbs = Math.abs(filteredTotal);

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
                      assets.map((a) => {
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
                            <span className="tabular font-semibold flex-shrink-0">{won(a.amount)}</span>
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
                                background: t.amount < 0 ? "rgba(78,143,114,0.15)" : "rgba(181,83,59,0.15)",
                                color: t.amount < 0 ? "#4E8F72" : "#B5533B"
                              }}
                            >
                              {t.amount < 0 ? "입금" : "지출"}
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
                  placeholder="내역 (예: 스타벅스)"
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
                      if (catMap[manualCatId]?.type === "income") {
                        setManualCatId(categories.find((c) => c.type !== "income")?.id || categories[0]?.id);
                      }
                    }}
                    className="px-2.5 py-2 text-xs font-semibold"
                    style={{ background: !manualIsIncome ? "rgba(181,83,59,0.2)" : "transparent", color: !manualIsIncome ? "#B5533B" : "#93A0B8" }}
                  >
                    지출
                  </button>
                  <button
                    onClick={() => {
                      setManualIsIncome(true);
                      if (catMap[manualCatId]?.type !== "income") {
                        setManualCatId(categories.find((c) => c.type === "income")?.id || manualCatId);
                      }
                    }}
                    className="px-2.5 py-2 text-xs font-semibold"
                    style={{ background: manualIsIncome ? "rgba(78,143,114,0.2)" : "transparent", color: manualIsIncome ? "#4E8F72" : "#93A0B8" }}
                  >
                    입금
                  </button>
                </div>
              </div>
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
                {[["all", "전체"], ["expense", "지출만"], ["income", "입금만"], ["saving", "저축만"]].map(([val, label]) => (
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
                <span className="text-xs ml-2" style={{ color: "#5A6478" }}>({filteredTransactions.length}건)</span>
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
              {filteredTransactions.length === 0 ? (
                <div className="px-4 pb-6 pt-2 text-sm text-center" style={{ color: "#5A6478" }}>
                  {periodTransactions.length === 0 ? "이 기간엔 내역이 없어요." : "이 조건에 맞는 내역이 없어요."}
                </div>
              ) : (
                <div className="pb-1">
                  {filteredTransactions.map((t) => {
                    const cat = catMap[t.categoryId];
                    return (
                      <div key={t.id} className="flex flex-col gap-1 px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                        <div className="flex items-center gap-2">
                          <input
                            value={t.description}
                            onChange={(e) => updateTx(t.id, { description: e.target.value })}
                            className="flex-1 min-w-0 bg-transparent outline-none text-sm truncate"
                            style={{ color: "#EDE6D3" }}
                          />
                          <select
                            value={t.categoryId}
                            onChange={(e) => handleTxCategoryChange(t, e.target.value)}
                            className="text-xs rounded-md px-1 py-1 outline-none flex-shrink-0 w-[92px]"
                            style={{ background: "#101B2D", border: `1px solid ${cat?.color || "#2A3B57"}`, color: cat?.color || "#EDE6D3" }}
                          >
                            {categories.map((c) => (<option key={c.id} value={c.id}>{labelWithEmoji(c)}</option>))}
                          </select>
                          <button
                            onClick={() => updateTx(t.id, { amount: -t.amount })}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                              background: t.amount < 0 ? "rgba(78,143,114,0.15)" : "rgba(181,83,59,0.15)",
                              color: t.amount < 0 ? "#4E8F72" : "#B5533B"
                            }}
                          >
                            {t.amount < 0 ? "입금" : "지출"}
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={Math.abs(Number(t.amount || 0)).toLocaleString("ko-KR")}
                            onChange={(e) => {
                              const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                              const abs = digitsOnly === "" ? 0 : Number(digitsOnly);
                              const signed = t.amount < 0 ? -abs : abs;
                              updateTx(t.id, { amount: signed });
                            }}
                            className="tabular w-20 flex-shrink-0 bg-transparent outline-none text-sm text-right font-semibold"
                            style={{ color: t.amount < 0 ? "#4E8F72" : "#EDE6D3" }}
                          />
                          <button onClick={() => deleteTx(t.id)} className="flex-shrink-0" style={{ color: "#5A6478" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={t.date}
                            onChange={(e) => updateTx(t.id, { date: e.target.value })}
                            className="tabular bg-transparent outline-none text-xs"
                            style={{ color: "#5A6478" }}
                          />
                          <select
                            value={t.paymentMethodId || "unassigned"}
                            onChange={(e) => updateTx(t.id, { paymentMethodId: e.target.value })}
                            className="text-xs rounded-md px-1 py-0.5 outline-none flex-shrink-0"
                            style={{ background: "transparent", border: "1px solid #2A3B57", color: "#93A0B8" }}
                          >
                            {paymentMethods.map((p) => (<option key={p.id} value={p.id}>{labelWithEmoji(p)}</option>))}
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
              ) : (
                <div className="pb-1">
                  {assets.map((a) => {
                    const at = assetTypeMap[a.assetTypeId];
                    const selected = selectedAssetIds.includes(a.id);
                    return (
                      <div key={a.id} className="flex flex-col gap-1 px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b", background: selected ? "rgba(201,162,39,0.08)" : "transparent" }}>
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
                          <input
                            type="text"
                            inputMode="numeric"
                            value={Number(a.amount || 0).toLocaleString("ko-KR")}
                            onChange={(e) => {
                              const digitsOnly = e.target.value.replace(/[^0-9-]/g, "");
                              updateAsset(a.id, { amount: digitsOnly === "" ? 0 : Number(digitsOnly) });
                            }}
                            className="tabular w-24 flex-shrink-0 bg-transparent outline-none text-sm text-right font-semibold"
                            style={{ color: "#EDE6D3" }}
                          />
                          <button onClick={() => deleteAsset(a.id)} className="flex-shrink-0" style={{ color: "#5A6478" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <input
                          type="date"
                          value={a.date}
                          onChange={(e) => updateAsset(a.id, { date: e.target.value })}
                          className="tabular bg-transparent outline-none text-xs"
                          style={{ color: "#5A6478" }}
                        />
                      </div>
                    );
                  })}
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
