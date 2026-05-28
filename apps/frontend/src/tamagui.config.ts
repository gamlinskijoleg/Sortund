import { config } from "@tamagui/config";
import { createTamagui } from "tamagui";

const tamaguiConfig = createTamagui(config);

// Нам потрібен саме цей тип для розширення глобальних типів Tamagui
type AppConfig = typeof tamaguiConfig;

declare module "tamagui" {
    // Цей інтерфейс повідомляє TypeScript про всі твої пропси, токени та шортхенди!
    interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
