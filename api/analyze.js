export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "허용되지 않는 요청입니다." });
    return;
  }

  const { image, mediaType, categories, paymentMethods, assetNames, merchantHints } = req.body || {};
  if (!image || !Array.isArray(categories) || categories.length === 0) {
    res.status(400).json({ error: "이미지 또는 카테고리 목록이 없습니다." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다." });
    return;
  }

  const pmList = Array.isArray(paymentMethods) && paymentMethods.length ? paymentMethods : ["미지정"];
  const hintsText = Array.isArray(merchantHints) && merchantHints.length
    ? `\n\n참고: 사용자가 과거에 아래 가맹점들을 직접 이렇게 분류했어. 비슷하거나 같은 가맹점이 보이면 참고해:\n${merchantHints.map((h) => `- ${h.merchant} → ${h.category}`).join("\n")}`
    : "";
  const assetNamesList = Array.isArray(assetNames) ? assetNames.filter(Boolean) : [];
  const assetHintsText = assetNamesList.length
    ? `\n\n참고: 사용자가 앱에 등록해 둔 자산(계좌/상품) 이름 목록이야. 이체의 보내는/받는 쪽을 적을 때 아래 목록에 있는 이름과 같거나 가장 가까운 것을 그대로 써:\n${assetNamesList.map((n) => `- ${n}`).join("\n")}`
    : "";

  const prompt = `다음은 카드 사용 내역 또는 가계부 캡처 이미지야. 이미지에서 보이는 모든 거래 내역을 읽어줘.

오직 아래 형식의 순수 JSON 배열만 출력해. 설명이나 다른 텍스트 없이 JSON 배열만.

일반 지출/입금:
{"type": "normal", "date": "이미지에 보이는 날짜 그대로 (없으면 빈 문자열)", "description": "가맹점명 또는 내역명", "amount": 정수(원 단위, 쉼표/원 기호 제외), "category": "다음 중 하나: ${categories.join(", ")}", "payment": "다음 중 하나 (보이지 않으면 \\"미지정\\"): ${pmList.join(", ")}"}

계좌/자산 간 이체 (사용자 본인 계좌끼리 돈이 옮겨간 경우 — 예: "적금 자동이체", "OO계좌로 이체", "본인 명의 계좌 이체" 등):
{"type": "transfer", "date": "이미지에 보이는 날짜 그대로 (없으면 빈 문자열)", "description": "이체 내역명 (없으면 빈 문자열)", "amount": 정수(이체 금액, 항상 양수), "fromAsset": "보내는 계좌/자산 이름", "toAsset": "받는 계좌/자산 이름"}

규칙:
- 이미지에 있는 모든 거래를 빠짐없이 배열에 포함해.
- 일반 거래는 amount를 지출이면 양수, 환불/입금처럼 반대 방향이면 음수로.
- 이체(transfer)로 볼 수 있는 근거가 이미지에 명확히 없으면 절대 transfer로 분류하지 말고 일반(normal) 거래로 처리해. 확실하지 않으면 normal.
- category는 반드시 주어진 목록 중 가장 알맞은 것 하나를 그대로 적어. 애매하면 "미분류".
- payment는 이미지에 카드명/결제수단이 보이면 주어진 목록 중 가장 가까운 것으로, 안 보이면 "미지정"으로.
- 텍스트를 읽을 수 없는 이미지면 빈 배열 []을 출력해.${hintsText}${assetHintsText}`;

  const model = "gemini-3.1-flash-lite";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mediaType || "image/png", data: image } },
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            response_mime_type: "application/json",
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: `Gemini API 오류: ${errText}` });
      return;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: "응답에서 텍스트를 찾지 못했습니다." });
      return;
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      res.status(502).json({ error: "응답을 JSON으로 해석하지 못했습니다." });
      return;
    }
    if (!Array.isArray(parsed)) {
      res.status(502).json({ error: "예상한 배열 형식이 아닙니다." });
      return;
    }

    res.status(200).json({ transactions: parsed });
  } catch (e) {
    res.status(500).json({ error: e.message || "서버 오류가 발생했습니다." });
  }
}
