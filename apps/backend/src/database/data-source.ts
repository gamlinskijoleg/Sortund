import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { join } from "path";

// Load .env from the backend app root (apps/backend/.env)
dotenv.config({ path: join(__dirname, "../../.env") });

export default new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [join(__dirname, "../**/*.entity{.ts,.js}")],
    migrations: [join(__dirname, "./migrations/*{.ts,.js}")],
    logging: true,
});
