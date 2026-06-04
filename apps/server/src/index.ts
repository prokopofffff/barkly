import { Hono } from "hono";
import { config } from "@/lib/config";
import { health } from "@/routes/health";
import { push } from "@/zero/push";

const app = new Hono();

app.route("/health", health);
app.route("/push", push); // Zero custom-mutators endpoint

export default {
  port: config.PORT,
  fetch: app.fetch,
};
