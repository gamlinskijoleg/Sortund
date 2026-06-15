export type NavigationRoute = {
    label: string;
    href: string;
    icon?: string;
};

// Bottom Navigation Routes
export const bottomNavRoutes: NavigationRoute[] = [
    { label: "My music", href: "/", icon: "headphones" },
    { label: "AI Sync", href: "/ai-sync", icon: "television-classic" },
];

export const isBottomNavVisible = (pathname: string) => {
    return bottomNavRoutes.some((route) => route.href === pathname);
};

// Top Section Tabs Routes (for music-home-screen)
export const sectionTabRoutes: NavigationRoute[] = [
    { label: "Songs", href: "/" },
];
