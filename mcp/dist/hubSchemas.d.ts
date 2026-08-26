/**
 * Shared Zod fields + format notes for hub write tools.
 * Keep in sync with UI hints (assets/hub/i18n.js) and Hub API.
 */
import { z } from "zod";
/** Tell agents: early listings are welcome — do not scare users off publishing. */
export declare const HUB_PUBLISH_GUIDE: string;
export declare const HUB_FIELD_GUIDE: string;
export declare const zSlug: z.ZodString;
export declare const zUrlSoft: z.ZodString;
export declare const zEmailSoft: z.ZodString;
export declare const zTelegram: z.ZodString;
export declare const zTags: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
export declare const zPayment: z.ZodObject<{
    budget: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    type: z.ZodOptional<z.ZodEnum<["hour", "work"]>>;
    cur: z.ZodOptional<z.ZodEnum<["USDT", "USD", "RUB", "CNY", "GBP", "UAH", "EUR", "TON"]>>;
}, "strip", z.ZodTypeAny, {
    budget: string | number;
    type?: "hour" | "work" | undefined;
    cur?: "USD" | "USDT" | "RUB" | "CNY" | "GBP" | "UAH" | "EUR" | "TON" | undefined;
}, {
    budget: string | number;
    type?: "hour" | "work" | undefined;
    cur?: "USD" | "USDT" | "RUB" | "CNY" | "GBP" | "UAH" | "EUR" | "TON" | undefined;
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
/** Owner lifecycle on update (projects, roles, orders). */
export declare const zLifecycleStatus: z.ZodEnum<["draft", "pending", "active", "approved", "closed", "frozen"]>;
export declare const zProjectStage: z.ZodEnum<["idea", "stealth", "preseed", "seed", "mvp", "early", "growth", "scale", "mature", "project"]>;
export declare const zAvailability: z.ZodEnum<["open", "working", "resting", "ideas", "busy"]>;
export declare const zDisplayCurrency: z.ZodEnum<["USDT", "USD", "RUB", "CNY", "GBP", "UAH", "EUR", "TON"]>;
export declare const zCollab: z.ZodObject<{
    networking: z.ZodOptional<z.ZodEnum<["yes", "unknown", "no"]>>;
    startups: z.ZodOptional<z.ZodEnum<["yes", "unknown", "no"]>>;
    opensource: z.ZodOptional<z.ZodEnum<["yes", "unknown", "no"]>>;
    equity: z.ZodOptional<z.ZodEnum<["yes", "unknown", "no"]>>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
    networking?: "unknown" | "yes" | "no" | undefined;
    startups?: "unknown" | "yes" | "no" | undefined;
    opensource?: "unknown" | "yes" | "no" | undefined;
    equity?: "unknown" | "yes" | "no" | undefined;
}, {
    note?: string | undefined;
    networking?: "unknown" | "yes" | "no" | undefined;
    startups?: "unknown" | "yes" | "no" | undefined;
    opensource?: "unknown" | "yes" | "no" | undefined;
    equity?: "unknown" | "yes" | "no" | undefined;
}>;
export declare const zInfoLink: z.ZodObject<{
    label: z.ZodString;
    url: z.ZodString;
    kind: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    label: string;
    kind?: string | undefined;
}, {
    url: string;
    label: string;
    kind?: string | undefined;
}>;
export declare const zInfoLinks: z.ZodArray<z.ZodUnion<[z.ZodObject<{
    label: z.ZodString;
    url: z.ZodString;
    kind: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    label: string;
    kind?: string | undefined;
}, {
    url: string;
    label: string;
    kind?: string | undefined;
}>, z.ZodString]>, "many">;
