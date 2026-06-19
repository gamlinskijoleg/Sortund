import { useState, useEffect } from "react";

export function useDebouncedValue<T>(value: T, delay: number = 1000): [T, boolean] {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    const isInstant = typeof value === "string" && value.trim() === "";

    useEffect(() => {
        const handler = setTimeout(
            () => {
                setDebouncedValue(value);
            },
            isInstant ? 0 : delay
        );

        return () => clearTimeout(handler);
    }, [value, delay, isInstant]);

    const effectiveValue = isInstant ? value : debouncedValue;
    const isDebouncing = value !== effectiveValue;

    return [effectiveValue, isDebouncing];
}
