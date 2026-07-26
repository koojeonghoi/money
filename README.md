# 가계부 결산

카드/가계부 캡처 이미지를 붙여넣으면 자동으로 거래 내역을 읽어 카테고리별로 분류해주는 개인용 고정지출 계산기입니다.

이미지 분석은 서버(Vercel 서버리스 함수)를 통해 Google AI Studio(Gemini) API를 호출하므로, API 키가 브라우저에 노출되지 않습니다.

## 1. 준비물

- [Google AI Studio](https://aistudio.google.com/apikey)에서 발급받은 API 키
- GitHub 계정
- [Vercel](https://vercel.com) 계정 (GitHub으로 가입 가능, 무료 플랜으로 충분)

## 2. GitHub에 올리기

이 폴더 전체를 그대로 새 GitHub 저장소에 올리면 됩니다.

```bash
cd fixed-expense-tracker
git init
git add .
git commit -m "init: 가계부 결산 앱"
git branch -M main
git remote add origin https://github.com/<본인계정>/<저장소이름>.git
git push -u origin main
```

## 3. Vercel로 배포하기

1. [vercel.com/new](https://vercel.com/new)에서 방금 만든 GitHub 저장소를 선택 → Import
2. Framework Preset은 **Vite**로 자동 인식됩니다 (따로 설정할 필요 없음)
3. **Environment Variables**에 아래 값을 추가합니다
   - Key: `GEMINI_API_KEY`
   - Value: 본인의 Google AI Studio API 키
4. **Deploy** 클릭 → 몇 분 후 `https://<프로젝트이름>.vercel.app` 주소로 접속 가능

이후 GitHub에 새로 push할 때마다 Vercel이 자동으로 재배포합니다.

## 4. 로컬에서 개발/테스트하기

`api/` 폴더의 서버리스 함수까지 함께 테스트하려면 Vercel CLI를 쓰는 게 가장 편합니다.

```bash
npm install
npm install -g vercel      # 최초 1회
vercel dev                 # http://localhost:3000
```

실행 전에 프로젝트 루트에 `.env` 파일을 만들고 아래처럼 키를 넣어주세요 (이 파일은 `.gitignore`에 포함되어 있어 GitHub에 올라가지 않습니다).

```
GEMINI_API_KEY=본인의-Google-AI-Studio-키
```

`npm run dev`(Vite 단독 실행)로는 `/api/analyze` 호출이 동작하지 않으니, API까지 테스트하려면 반드시 `vercel dev`를 사용하세요.

## 5. 데이터는 어디에 저장되나요?

모든 거래 내역과 카테고리 설정은 브라우저의 `localStorage`에 저장됩니다. 서버로 전송되거나 별도로 기록되지 않으며, 이미지 분석 요청 시 이미지 자체만 Google Gemini API로 전송됩니다.

## 6. 사용법

1. 카드 명세서나 가계부 앱 캡처를 화면에 붙여넣기(Ctrl/Cmd+V)
2. 자동으로 인식된 내역과 카테고리, 결제수단(카드)을 확인, 필요하면 직접 수정
3. 카테고리·결제수단은 "설정" 탭에서 이름/색상/고정·변동·저축 구분을 자유롭게 편집
4. 월 소득을 입력하면 고정지출 비율을 함께 확인 가능
5. 사용 내역에서 카테고리를 한 번 직접 고치면, 같은 가맹점명이 다음번 이미지에도 나올 경우 자동으로 그 카테고리가 적용됩니다 (설정 탭에서 학습된 개수 확인 가능)
