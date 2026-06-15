import { Hono } from "hono";
import { config } from "@/lib/config";
import { admin } from "@/routes/admin";
import { auth } from "@/routes/auth";
import { curator } from "@/routes/curator";
import { health } from "@/routes/health";
import { push } from "@/zero/push";

const app = new Hono();

app.route("/health", health);
app.route("/auth", auth); // anonymous-first auth + identity linking
app.route("/admin", admin); // role grants (curator/admin) — bk-jaz.9.1
app.route("/curator", curator); // YouTube Shorts submission — bk-jaz.9.2
app.route("/push", push); // Zero custom-mutators endpoint

export default {
  port: config.PORT,
  fetch: app.fetch,
};
