export declare function hhProfileDir(): string;
export declare function closeHhBrowser(): Promise<void>;
/** Load `url` in the logged-in profile and return its HTML. */
export declare function fetchHhHtmlViaBrowser(url: string): Promise<{
    html?: string;
    error?: string;
}>;
