export type AnalysisStatus = "none" | "queued" | "processing" | "done" | "failed";

export type TagCategory =
    | "genre"
    | "style"
    | "mood"
    | "instrument"
    | "vocal"
    | "language"
    | "theme"
    | "user";

export type TagDetail = {
    label: string;
    category: TagCategory;
    confidence: number;
};

/** Fields the user can edit manually; listed in `userEdited` so automatic analysis never overwrites them. */
export type EditableField = "title" | "artist" | "album" | "year" | "genre" | "mood";

export type MusicTrack = {
    assetId: string;
    sourceUri: string;
    filename?: string;
    title: string;
    artist: string;
    color: string;
    /** Duration in milliseconds. */
    duration: number;
    album?: string;
    artwork?: string;
    genre?: string;
    /** Release date as text (usually the year). */
    date?: string;
    year?: number;
    rating?: number;
    analysis_source?: string;
    /** Effective tag labels: AI tags minus removed ones plus the user's own tags. */
    tags?: string[];
    isAnalyzed?: boolean;
    modificationTime?: number;

    addedAt?: number;
    fingerprint?: string;
    bpm?: number;
    musicalKey?: string;
    mood?: string;
    language?: string;
    themes?: string[];
    instruments?: string[];
    vocal?: string;
    lyrics?: string;
    tagDetails?: TagDetail[];
    analysisStatus?: AnalysisStatus;
    analysisJobId?: string;
    analysisError?: string;
    modelVersion?: string;

    userEdited?: EditableField[];
    userTags?: string[];
    removedTags?: string[];
    isFavourite?: boolean;
    /** Last manual change (edits, tags, favourite) — used for "last write wins" sync. */
    userUpdatedAt?: number;
    /** Signature of the audio data; equal values mean identical files (see library/duplicates.ts). */
    contentHash?: string;
    /** "lrclib" — published lyrics; "whisper" — transcript of the analysed fragment only. */
    lyricsSource?: string;
};

export type SortKey = "title" | "artist" | "year" | "addedAt" | "bpm";
export type SortDir = "asc" | "desc";

export type Playlist = {
    id: string;
    name: string;
    isSmart: boolean;
    rules?: SmartRules;
    sortBy?: SortKey;
    sortDir?: SortDir;
    limitCount?: number;
    trackIds: string[];
    createdAt: number;
    updatedAt: number;
    deleted?: boolean;
};

export type SmartField =
    | "genre"
    | "mood"
    | "language"
    | "theme"
    | "year"
    | "bpm"
    | "key"
    | "tag"
    | "artist"
    | "favourite";

export type SmartOp = "is" | "isNot" | "contains" | "gte" | "lte" | "between";

export type SmartCondition = {
    field: SmartField;
    op: SmartOp;
    value: string | number | boolean;
    value2?: number;
};

export type SmartGroup = {
    match: "all" | "any";
    conditions: SmartCondition[];
};

/** Groups are combined with `match`; conditions inside a group with the group's own `match`. */
export type SmartRules = {
    match: "all" | "any";
    groups: SmartGroup[];
};
