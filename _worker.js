export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 【1】定义全局跨域放行规则 (CORS)
    // 允许任何第三方域名或本地网页调用此 API
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Admin-Key",
    };

    // 【2】处理浏览器的 OPTIONS 预检请求
    // 跨域发送 POST/DELETE 前，浏览器会先发一次 OPTIONS 探路，必须拦截并放行
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- 以下是 API 核心业务逻辑 ---
    if (url.pathname.startsWith("/api/comments")) {
      
      // 【3】接口：获取评论列表
      if (request.method === "GET") {
        try {
          // 按 ID 倒序读取数据（最新评论在前）
          const { results } = await env.DB.prepare("SELECT * FROM comments ORDER BY id DESC").all();
          return Response.json(results, { headers: corsHeaders });
        } catch (e) {
          return new Response("读取数据库失败: " + e.message, { status: 500, headers: corsHeaders });
        }
      }

      // 【4】接口：提交新评论
      if (request.method === "POST") {
        try {
          const { name, qq, content } = await request.json();
          // 后端二次校验防脏数据
          if (!name || !content) {
            return new Response("昵称或内容不能为空", { status: 400, headers: corsHeaders });
          }
          // 写入 D1 数据库
          await env.DB.prepare("INSERT INTO comments (name, qq, content) VALUES (?, ?, ?)")
            .bind(name, qq || '', content)
            .run();
          return Response.json({ success: true }, { headers: corsHeaders });
        } catch (e) {
          return new Response("写入数据库失败: " + e.message, { status: 500, headers: corsHeaders });
        }
      }

      // 【5】接口：管理员删除评论
      if (request.method === "DELETE") {
        const adminKey = request.headers.get("Admin-Key");
        // 校验 Header 中携带的管理员密码
        if (adminKey !== "5280") {
          return new Response("管理员密码错误", { status: 401, headers: corsHeaders });
        }
        
        // 从 URL 末尾提取需要删除的评论 ID
        const id = url.pathname.split("/").pop();
        try {
          await env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
          return Response.json({ success: true }, { headers: corsHeaders });
        } catch (e) {
          return new Response("删除失败: " + e.message, { status: 500, headers: corsHeaders });
        }
      }
    }

    // 【6】静态资源兜底与页面托管适配
    // 如果请求不是针对 API 的，则交还给 Cloudflare Pages 处理静态文件 (如 index.html)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // 【7】找不到路径时的全局 404
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
