export type MusicTrack = {
    title: string;
    artist: string;
    color: string;
};

export type MusicSection = {
    href: "/" | "/videos" | "/artists" | "/albums";
    label: string;
};

export type LibrarySectionKey = "favourites" | "playlists" | "recent";

export const musicTracks: MusicTrack[] = [
    {
        title: "That's Life (2008 Remastered)",
        artist: "Frank Sinatra | Nothing But The Best",
        color: "#2f7bb4",
    },
    {
        title: "『フールフールフール』 feat. Ado (fo...",
        artist: "Unknown artist | Unknown album",
        color: "#9c7a35",
    },
    {
        title: "Shukusei!!_Loli_Kami_Requiem!_Ui_Sh...",
        artist: "Unknown artist | Unknown album",
        color: "#8d3550",
    },
    {
        title: "Mr_Blue_Sky_Electric_Light_Orchestr...",
        artist: "Unknown artist | Unknown album",
        color: "#4f7f99",
    },
    {
        title: "Drowning Pool - Bodies",
        artist: "Drowning Pool | Unknown album",
        color: "#61617e",
    },
    {
        title: "Warriors",
        artist: "Imagine Dragons | Smoke + Mirrors",
        color: "#b88a2f",
    },
    {
        title: "blackbear - idfc (Lyrics)",
        artist: "7clouds | Unknown album",
        color: "#416f87",
    },
    {
        title: "シカバネーゼ_jon_YAKITORY_feat_Ad...",
        artist: "Unknown artist | Unknown album",
        color: "#6c5ccf",
    },
];

export const musicSections: MusicSection[] = [
    { href: "/", label: "Songs" },
    { href: "/videos", label: "Videos" },
    { href: "/artists", label: "Artists" },
    { href: "/albums", label: "Albums" },
];

export const featureCards = [
    {
        title: "Favourites",
        color: "#a53a67",
        href: "/library/favourites" as const,
    },
    {
        title: "Playlists",
        color: "#3d748d",
        href: "/library/playlists" as const,
    },
    { title: "Recent", color: "#5b4db3", href: "/library/recent" as const },
];

export const searchSuggestions = [
    "Search songs, playlists, and artists",
    "Find albums, videos, and saved mixes",
];

export const librarySectionCopy: Record<
    LibrarySectionKey,
    { title: string; subtitle: string }
> = {
    favourites: {
        title: "Favourites",
        subtitle: "Tracks you starred most recently.",
    },
    playlists: {
        title: "Playlists",
        subtitle: "Your saved queues and mixes.",
    },
    recent: {
        title: "Recent",
        subtitle: "What you opened most recently.",
    },
};
