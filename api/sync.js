import { Redis } from "@upstash/redis";

const STORAGE_KEY = "ledger-data";

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  const redis = getRedis();
  if (!redis) {
    res.status(500).json({ error: "서버에 Redis 저장소가 연결되어 있지 않습니다. Vercel Marketplace에서 Upstash Redis를 추가해주세요." });
    return;
  }

  const requiredSecret = process.env.SYNC_SECRET;
  const provided = req.method === "GET" ? req.headers["x-sync-secret"] : (req.body || {}).secret;
  if (requiredSecret && provided !== requiredSecret) {
    res.status(401).json({ error: "동기화 비밀번호가 올바르지 않습니다." });
    return;
  }

  if (req.method === "GET") {
    try {
      const data = await redis.get(STORAGE_KEY);
      res.status(200).json({ data: data ?? null });
    } catch (e) {
      res.status(500).json({ error: e.message || "불러오기에 실패했습니다." });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const { data } = req.body || {};
      if (data === undefined) {
        res.status(400).json({ error: "저장할 데이터가 없습니다." });
        return;
      }
      await redis.set(STORAGE_KEY, data);
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message || "저장에 실패했습니다." });
    }
    return;
  }

  res.status(405).json({ error: "허용되지 않는 요청입니다." });
}
