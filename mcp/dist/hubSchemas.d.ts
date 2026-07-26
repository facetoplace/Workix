/**
 * Shared Zod fields + format notes for hub write tools.
 * Keep in sync with UI hints (assets/hub/i18n.js) and Hub API.
 */
import { z } from "zod";
export declare const HUB_FIELD_GUIDE: string;
export declare const zSlug: z.ZodString;
export declare const zUrlSoft: z.ZodString;
export declare const zEmailSoft: z.ZodString;
export declare const zTelegram: z.ZodString;
export declare const zTags: z.ZodArray<z.ZodString, "many">;
export declare const zPayment: z.ZodObject<{
    budget: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    type: z.ZodOptional<z.ZodEnum<["hour", "work"]>>;
    cur: z.ZodOptional<z.ZodEnum<["USDT", "USD", "RUB", "CNY", "GBP", "UAH", "EUR", "TON"]>>;
}, "strip", z.ZodTypeAny, {
    budget: string | number;
    type?: "hour" | "work" | undefined;
    cur?: "USDT" | "USD" | "RUB" | "CNY" | "GBP" | "UAH" | "EUR" | "TON" | undefined;
}, {
    budget: string | number;
    type?: "hour" | "work" | undefined;
    cur?: "USDT" | "USD" | "RUB" | "CNY" | "GBP" | "UAH" | "EUR" | "TON" | undefined;
}>;
export declare const zApplyDefaults: z.ZodObject<{
    apply_url: z.ZodOptional<z.ZodString>;
    apply_email: z.ZodOptional<z.ZodString>;
    apply_telegram: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    apply_url?: string | undefined;
    apply_email?: string | undefined;
    apply_telegram?: string | undefined;
}, {
    apply_url?: string | undefined;
    apply_email?: string | undefined;
    apply_telegram?: string | undefined;
}>;
export declare const zRoleKind: z.ZodEnum<["task", "project", "time_job", "full_job", "fixes"]>;
export declare const zStatus: z.ZodEnum<["draft", "pending"]>;
export declare const zDisplayCurrency: z.ZodEnum<["USDT", "USD", "RUB", "CNY", "GBP", "UAH", "EUR", "TON"]>;
export declare const zInfoLink: z.ZodObject<{
    label: z.ZodString;
    url: z.ZodString;
    kind: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    label: string;
    url: string;
    kind?: string | undefined;
}, {
    label: string;
    url: string;
    kind?: string | undefined;
}>;
export declare const zInfoLinks: z.ZodArray<z.ZodUnion<[z.ZodObject<{
    label: z.ZodString;
    url: z.ZodString;
    kind: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    label: string;
    url: string;
    kind?: string | undefined;
}, {
    label: string;
    url: string;
    kind?: string | undefined;
}>, z.ZodString]>, "many">;
