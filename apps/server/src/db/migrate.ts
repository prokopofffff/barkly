import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Apply pending drizzle migrations using postgres-js (the same driver the app
// uses) — drizzle-kit's `migrate` command defaults to the `pg` driver, which we
// don't depend on. Run with `bun run db:migrate` after `db:generate`.

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
await sql.end();
console.log("✅ migrations applied");
