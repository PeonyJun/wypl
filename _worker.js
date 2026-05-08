export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Admin-Key",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";

    if (url.pathname.startsWith("/api/comments")) {
      if (request.method === "GET") {
        try {
          const { results: comments } = await env.DB.prepare("SELECT id, parent_id, name, qq, content, is_pinned, created_at FROM comments ORDER BY is_pinned DESC, id DESC").all();
          const { results: config } = await env.DB.prepare("SELECT value FROM config WHERE key = 'dev_qqs'").all();
          const devQQs = config[0]?.value ? config[0].value.split(',') : [];
          return Response.json({ comments, devQQs }, { headers: corsHeaders });
        } catch (e) {
          return new Response(e.message, { status: 500, headers: corsHeaders });
        }
      }

      if (request.method === "POST") {
        try {
          const { results: banConf } = await env.DB.prepare("SELECT value FROM config WHERE key = 'banned_ips'").all();
          const bannedIps = banConf[0]?.value || "";
          if (bannedIps.includes(clientIp)) {
            return new Response("Banned", { status: 403, headers: corsHeaders });
          }

          const { name, qq, content, parent_id } = await request.json();
          if (!name || !content) {
            return new Response("Invalid", { status: 400, headers: corsHeaders });
          }

          const pid = parent_id ? parseInt(parent_id) : null;
          await env.DB.prepare("INSERT INTO comments (name, qq, content, ip, parent_id) VALUES (?, ?, ?, ?, ?)")
            .bind(name, qq || '', content, clientIp, pid)
            .run();
          return Response.json({ success: true }, { headers: corsHeaders });
        } catch (e) {
          return new Response(e.message, { status: 500, headers: corsHeaders });
        }
      }
    }

    if (url.pathname.startsWith("/api/admin")) {
      const adminKey = request.headers.get("Admin-Key");
      if (adminKey !== "5280") {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }

      if (url.pathname === "/api/admin/comments" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM comments ORDER BY id DESC").all();
        return Response.json(results, { headers: corsHeaders });
      }

      if (url.pathname.startsWith("/api/admin/comments/") && request.method === "DELETE") {
        const id = url.pathname.split("/").pop();
        await env.DB.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?").bind(id, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (url.pathname.startsWith("/api/admin/pin/") && request.method === "POST") {
        const id = url.pathname.split("/").pop();
        const { is_pinned } = await request.json();
        await env.DB.prepare("UPDATE comments SET is_pinned = ? WHERE id = ?").bind(is_pinned, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/admin/config" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM config").all();
        return Response.json(results, { headers: corsHeaders });
      }

      if (url.pathname === "/api/admin/config" && request.method === "POST") {
        const { dev_qqs, banned_ips } = await request.json();
        await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'dev_qqs'").bind(dev_qqs).run();
        await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'banned_ips'").bind(banned_ips).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
