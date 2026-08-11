/**
 * Telegram Bot API Relay Worker
 *
 * 解决部分地区无法直连 Telegram API 的问题。
 * 所有敏感配置（BOT_TOKEN / CHAT_ID）存储在 Worker 的环境变量中，
 * 前端和源码均无法读取。
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // ——— 路由 ———
    if (path === "/") {
      return handleIndex();
    }

    if (path === "/send") {
      return handleSend(request, env, url);
    }

    return json({ error: "Not Found" }, 404);
  },
};

// ─────────────────────────────────────
//  GET /  —  健康检查
// ─────────────────────────────────────
function handleIndex() {
  return json({
    status: "ok",
    service: "telegram-relay",
    endpoints: ["/send"],
    usage: "POST /send  { \"message\": \"hello\" }",
  });
}

// ─────────────────────────────────────
//  POST /send  —  转发消息到 Telegram
// ─────────────────────────────────────
async function handleSend(request, env, url) {
  // ---- 1. 可选鉴权 ----
  if (env.AUTH_KEY) {
    const key =
      request.headers.get("X-Auth-Key") || url.searchParams.get("key");
    if (key !== env.AUTH_KEY) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  // ---- 2. 校验环境变量 ----
  const { BOT_TOKEN, CHAT_ID } = env;
  if (!BOT_TOKEN || !CHAT_ID) {
    return json(
      { error: "Server misconfiguration: missing BOT_TOKEN or CHAT_ID" },
      500
    );
  }

  // ---- 3. 提取 message（兼容 GET / POST 多种格式）----
  let message;

  try {
    message = await extractMessage(request, url);
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!message) {
    return json({ error: "Missing required parameter: message" }, 400);
  }

  if (message.length > 4096) {
    return json({ error: "Message too long (max 4096 characters)" }, 400);
  }

  // ---- 4. 调用 Telegram sendMessage ----
  const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const resp = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const result = await resp.json();

    if (!result.ok) {
      return json(
        { error: "Telegram API error", description: result.description },
        502
      );
    }

    return json({ ok: true, message_id: result.result.message_id });
  } catch (err) {
    return json(
      { error: "Failed to reach Telegram API", detail: err.message },
      502
    );
  }
}

// ─────────────────────────────────────
//  工具函数
// ─────────────────────────────────────

async function extractMessage(request, url) {
  const method = request.method.toUpperCase();

  // GET — 从 query string 取
  if (method === "GET") {
    return url.searchParams.get("message");
  }

  const ct = (request.headers.get("content-type") || "").toLowerCase();

  // JSON
  if (ct.includes("application/json")) {
    const body = await request.json();
    return body.message ?? body.text ?? null;
  }

  // Form
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const form = await request.formData();
    return form.get("message") ?? form.get("text") ?? null;
  }

  // 纯文本兜底
  const raw = await request.text();
  return raw || null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
