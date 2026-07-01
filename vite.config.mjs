import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { scanMainlines } from "./server/mainlineScan.mjs";

export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    {
      name: "mainline-scan-api",
      configureServer(server) {
        server.middlewares.use("/api/mainline-scan", async (req, res) => {
          try {
            const url = new URL(req.url ?? "", "http://127.0.0.1");
            const forceFallback = url.searchParams.get("fallback") === "1";
            const payload = await scanMainlines({ forceFallback });

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(payload));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                mode: "error",
                message: error instanceof Error ? error.message : "主线扫描失败",
                results: [],
              }),
            );
          }
        });
      },
    },
  ],
});
