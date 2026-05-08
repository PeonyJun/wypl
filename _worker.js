export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 获取评论列表
    if (url.pathname === "/api/comments" && request.method === "GET") {
      try {
        const { results } = await env.DB.prepare("SELECT * FROM comments ORDER BY id DESC").all();
        return Response.json(results);
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }

    // 2. 提交新评论
    if (url.pathname === "/api/comments" && request.method === "POST") {
      try {
        const { name, qq, content } = await request.json();
        if (!name || !content) return new Response("不能为空", { status: 400 });
        
        await env.DB.prepare("INSERT INTO comments (name, qq, content) VALUES (?, ?, ?)")
          .bind(name, qq || '', content)
          .run();
        return Response.json({ success: true });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }

    // 3. 管理员删除评论
    if (url.pathname.startsWith("/api/comments/") && request.method === "DELETE") {
      const adminKey = request.headers.get("Admin-Key");
      if (adminKey !== "5280") {
        return new Response("密码错误", { status: 401 });
      }
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
      return Response.json({ success: true });
    }

    // 4. 【关键新增】如果请求的不是 /api 接口，统统交还给 Pages 处理（比如展示 index.html）
    return env.ASSETS.fetch(request);
  }
};
