type BottomNavRoutePath = "/" | "/ai-sync";
type SectionTabRoutePath = "/";

export type NavigationRoute<T extends string> = {
    label: string;
    href: T;
    icon?: string;
};

// Bottom Navigation Routes
export const bottomNavRoutes: NavigationRoute<BottomNavRoutePath>[] = [
    { label: "My music", href: "/", icon: "headphones" },
    { label: "AI Sync", href: "/ai-sync", icon: "television-classic" },
];

// Top Section Tabs Routes (for music-home-screen)
export const sectionTabRoutes: NavigationRoute<SectionTabRoutePath>[] = [
    { label: "Songs", href: "/" },
];
