import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Upload, X, Plus, RotateCcw, Loader2, ImagePlus, Trash2, PiggyBank,
  Home, Receipt, Wallet, Settings as SettingsIcon
} from "lucide-react";

const PALETTE = [
  "#4E8F72", "#5B8A72", "#6B8CAE", "#8C7853", "#7A8CA3",
  "#9C7EA8", "#C99A3E", "#B5533B", "#5F8FA6", "#8A93A3", "#C9A227"
];

const DEFAULT_CATEGORIES = [
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

const TYPE_LABEL = { fixed: "고정지출", variable: "변동지출", saving: "저축/자산" };
const TYPE_ORDER = ["fixed", "variable", "saving"];

const NAV_ITEMS = [
  { id: "home", label: "홈화면", icon: Home },
  { id: "expenses", label: "지출", icon: Receipt },
  { id: "assets", label: "자산", icon: Wallet },
  { id: "settings", label: "설정", icon: SettingsIcon }
];

function uid() {
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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

  const [editingCatId, setEditingCatId] = useState(null);
  const [editingPmId, setEditingPmId] = useState(null);
  const [editingAssetTypeId, setEditingAssetTypeId] = useState(null);

  const [expenseFilter, setExpenseFilter] = useState("all");

  const [manualDate, setManualDate] = useState(todayStr());
  const [manualDesc, setManualDesc] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCatId, setManualCatId] = useState("");
  const [manualPmId, setManualPmId] = useState("");

  const fileInputRef = useRef(null);
  const saveTimer = useRef(null);

  // ---- load persisted data ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ledger-data");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.categories?.length) setCategories(parsed.categories);
        if (parsed.paymentMethods?.length) setPaymentMethods(parsed.paymentMethods);
        if (parsed.assetTypes?.length) setAssetTypes(parsed.assetTypes);
        if (parsed.categoryMemory) setCategoryMemory(parsed.categoryMemory);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.assets) setAssets(parsed.assets);
        if (parsed.income) setIncome(parsed.income);
      }
    } catch (e) {
      // no saved data yet — keep defaults
    } finally {
      setLoaded(true);
    }
  }, []);

  // ---- debounced save ----
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem("ledger-data", JSON.stringify({
          categories, paymentMethods, assetTypes, categoryMemory, transactions, assets, income
        }));
      } catch (e) {
        console.error("저장 실패", e);
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [categories, paymentMethods, assetTypes, categoryMemory, transactions, assets, income, loaded]);

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
  const deleteAsset = (id) => setAssets((prev) => prev.filter((a) => a.id !== id));

  // ---- transaction CRUD ----
  const updateTx = (id, patch) => setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const deleteTx = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id));
  const handleTxCategoryChange = (tx, newCategoryId) => {
    updateTx(tx.id, { categoryId: newCategoryId });
    rememberCategory(tx.description, newCategoryId);
  };

  const resetTransactions = () => {
    if (transactions.length === 0) return;
    if (window.confirm("이번 달 사용 내역을 모두 지울까요? 카테고리 설정은 유지됩니다.")) {
      setTransactions([]);
    }
  };

  const addManualTransaction = () => {
    const amountNum = Number(String(manualAmount).replace(/[^0-9-]/g, "")) || 0;
    if (!manualDesc.trim() && amountNum === 0) return;
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
    setManualDate(todayStr());
  };

  // ---- derived summaries ----
  const totalsByCategory = useMemo(() => {
    return categories
      .map((c) => ({ ...c, total: transactions.filter((t) => t.categoryId === c.id).reduce((s, t) => s + Number(t.amount || 0), 0) }))
      .filter((c) => c.total !== 0);
  }, [categories, transactions]);

  const totalsByType = useMemo(() => {
    return TYPE_ORDER.map((type) => ({
      type,
      label: TYPE_LABEL[type],
      total: categories
        .filter((c) => c.type === type)
        .reduce((sum, c) => sum + transactions.filter((t) => t.categoryId === c.id).reduce((s, t) => s + Number(t.amount || 0), 0), 0)
    }));
  }, [categories, transactions]);

  const totalsByAssetType = useMemo(() => {
    return assetTypes
      .map((a) => ({ ...a, total: assets.filter((x) => x.assetTypeId === a.id).reduce((s, x) => s + Number(x.amount || 0), 0) }))
      .filter((a) => a.total !== 0);
  }, [assetTypes, assets]);

  const grandTotal = transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalAssets = assets.reduce((s, a) => s + Number(a.amount || 0), 0);
  const incomeNum = Number(income) || 0;
  const fixedTotal = totalsByType.find((t) => t.type === "fixed")?.total || 0;
  const savingTotal = totalsByType.find((t) => t.type === "saving")?.total || 0;
  const fixedRatio = incomeNum > 0 ? (fixedTotal / incomeNum) * 100 : null;
  const savingRatio = incomeNum > 0 ? (savingTotal / incomeNum) * 100 : null;

  const pieData = totalsByCategory.filter((c) => c.total > 0);
  const assetPieData = totalsByAssetType.filter((a) => a.total > 0);

  const filteredTransactions = expenseFilter === "all" ? transactions : transactions.filter((t) => t.categoryId === expenseFilter);
  const filteredTotal = filteredTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);

  const card = { background: "#16233A", border: "1px solid #2A3B57" };
  const inputStyle = { background: "#101B2D", border: "1px solid #2A3B57", color: "#EDE6D3" };

  return (
    <div className="min-h-screen w-full pb-24" style={{ background: "#101B2D", color: "#EDE6D3", fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ledger-serif { font-family: 'Noto Serif KR','Nanum Myeongjo',serif; }
        .tabular { font-variant-numeric: tabular-nums; font-family: 'Roboto Mono','SF Mono',monospace; }
        .stamp-chip:nth-child(odd) { transform: rotate(-0.6deg); }
        .stamp-chip:nth-child(even) { transform: rotate(0.6deg); }
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
                <p className="text-xs font-semibold mb-1" style={{ color: "#93A0B8" }}>총 자산</p>
                <p className="tabular text-2xl font-bold" style={{ color: "#C9A227" }}>{won(totalAssets)}</p>
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
              <div className="grid grid-cols-3 gap-3">
                {totalsByType.map((t) => (
                  <div key={t.type} className="rounded-2xl p-3 text-center" style={card}>
                    <p className="text-xs" style={{ color: "#93A0B8" }}>{t.label}</p>
                    <p className="tabular text-base md:text-lg font-bold mt-1" style={{ color: "#C9A227" }}>{won(t.total)}</p>
                  </div>
                ))}
              </div>

              {pieData.length > 0 && (
                <div className="rounded-2xl p-4" style={card}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "#93A0B8" }}>카테고리별 지출</p>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} dataKey="total" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                          {pieData.map((entry) => (<Cell key={entry.id} fill={entry.color} stroke="#16233A" strokeWidth={2} />))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [won(v), n]} contentStyle={{ background: "#101B2D", border: "1px solid #2A3B57", borderRadius: 8, color: "#EDE6D3" }} />
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
                {transactions.length === 0 ? (
                  <div className="px-4 pb-6 pt-2 text-sm text-center" style={{ color: "#5A6478" }}>
                    아직 내역이 없어요. 왼쪽에 캡처 이미지를 붙여넣어 시작하세요.
                  </div>
                ) : (
                  <div className="pb-1">
                    {transactions.slice(0, 5).map((t) => {
                      const cat = catMap[t.categoryId];
                      return (
                        <div key={t.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                          <div className="min-w-0">
                            <p className="text-sm truncate" style={{ color: "#EDE6D3" }}>{t.description}</p>
                            <p className="text-xs" style={{ color: cat?.color || "#5A6478" }}>{labelWithEmoji(cat)} · {t.date}</p>
                          </div>
                          <p className="tabular text-sm font-semibold flex-shrink-0 ml-3" style={{ color: t.amount < 0 ? "#4E8F72" : "#EDE6D3" }}>{won(t.amount)}</p>
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
                  onChange={(e) => setManualAmount(e.target.value.replace(/[^0-9-]/g, ""))}
                  className="tabular w-28 rounded-lg px-3 py-2 text-sm text-right outline-none"
                  style={inputStyle}
                />
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
              <p className="text-sm font-semibold mb-2" style={{ color: "#93A0B8" }}>카테고리별 조회</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setExpenseFilter("all")}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={expenseFilter === "all" ? { background: "#C9A227", color: "#101B2D" } : { background: "#101B2D", color: "#93A0B8", border: "1px solid #2A3B57" }}
                >
                  전체
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setExpenseFilter(c.id)}
                    className="text-xs px-3 py-1.5 rounded-full font-semibold"
                    style={expenseFilter === c.id ? { background: c.color, color: "#101B2D" } : { background: "#101B2D", color: c.color, border: `1px solid ${c.color}` }}
                  >
                    {labelWithEmoji(c)}
                  </button>
                ))}
              </div>
              <p className="text-sm mt-3">
                {expenseFilter === "all" ? "전체 합계" : `${labelWithEmoji(catMap[expenseFilter])} 합계`}{" "}
                <span className="tabular font-bold" style={{ color: "#C9A227" }}>{won(filteredTotal)}</span>
                <span className="text-xs ml-2" style={{ color: "#5A6478" }}>({filteredTransactions.length}건)</span>
              </p>
            </div>

            {/* Ledger table */}
            <div className="rounded-2xl overflow-hidden" style={card}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="ledger-serif text-lg font-bold" style={{ color: "#C9A227" }}>사용 내역</p>
                <button onClick={resetTransactions} className="flex items-center gap-1 text-xs" style={{ color: "#93A0B8" }}>
                  <RotateCcw size={12} /> 이번 달 초기화
                </button>
              </div>
              {filteredTransactions.length === 0 ? (
                <div className="px-4 pb-6 pt-2 text-sm text-center" style={{ color: "#5A6478" }}>
                  {transactions.length === 0 ? "아직 내역이 없어요." : "이 카테고리에는 내역이 없어요."}
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
                          <input
                            type="text"
                            inputMode="numeric"
                            value={Number(t.amount || 0).toLocaleString("ko-KR")}
                            onChange={(e) => {
                              const digitsOnly = e.target.value.replace(/[^0-9-]/g, "");
                              const num = digitsOnly === "" || digitsOnly === "-" ? 0 : Number(digitsOnly);
                              updateTx(t.id, { amount: num });
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
                      <Tooltip formatter={(v, n) => [won(v), n]} contentStyle={{ background: "#101B2D", border: "1px solid #2A3B57", borderRadius: 8, color: "#EDE6D3" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Asset type manager */}
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-sm font-semibold mb-2" style={{ color: "#93A0B8" }}>자산 종류 편집</p>
              <div className="flex flex-col gap-2">
                {assetTypes.map((at) => (
                  <div key={at.id} className="stamp-chip flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#101B2D", border: `1.5px dashed ${at.color}` }}>
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
              {assets.length === 0 ? (
                <div className="px-4 pb-6 pt-2 text-sm text-center" style={{ color: "#5A6478" }}>
                  아직 등록된 자산이 없어요. "자산 추가"로 시작하세요.
                </div>
              ) : (
                <div className="pb-1">
                  {assets.map((a) => {
                    const at = assetTypeMap[a.assetTypeId];
                    return (
                      <div key={a.id} className="flex flex-col gap-1 px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                        <div className="flex items-center gap-2">
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
            {/* Income */}
            <div className="rounded-2xl p-4" style={card}>
              <label className="text-xs font-semibold" style={{ color: "#93A0B8" }}>월 소득 (선택 — 고정비 비율 계산용)</label>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="예: 3500000"
                  className="tabular flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <span className="text-sm" style={{ color: "#93A0B8" }}>원</span>
              </div>
            </div>

            {/* Category manager */}
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-sm font-semibold mb-2">🏷️ 카테고리 편집 ({categories.length}개)</p>
              <div className="flex flex-col gap-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="stamp-chip flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#101B2D", border: `1.5px dashed ${cat.color}` }}>
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
              <div className="flex flex-col gap-2">
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#101B2D", border: "1.5px dashed #3A4E6E" }}>
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
