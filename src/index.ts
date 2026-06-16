/**
 * MailGuard: tiny, dependency-free client for the MailGuard email-verification API.
 *
 * @example
 * import { MailGuard } from "mailguard";
 * const mg = new MailGuard("mg_yourkey");
 * const result = await mg.verify("jane@gmial.com");
 * // { status: "risky", score: 75, did_you_mean: "gmail.com", ... }
 */

export type Deliverability = "deliverable" | "risky" | "undeliverable" | "unknown";

export interface VerifyChecks {
  syntax: boolean;
  mx_found: boolean;
  disposable: boolean;
  role: boolean;
  free_provider: boolean;
}

export interface VerifyResult {
  /** The address as supplied. */
  email: string;
  /** Lowercased/trimmed form that was evaluated. */
  normalized: string;
  /** Overall verdict. */
  status: Deliverability;
  /** 0–100; higher is safer to send to. */
  score: number;
  checks: VerifyChecks;
  /** Suggested correction for an obvious typo, e.g. "gmail.com", or null. */
  did_you_mean: string | null;
  /** Human-readable reasons behind the verdict. */
  reasons: string[];
}

export interface BatchResult {
  count: number;
  results: VerifyResult[];
}

export interface MailGuardOptions {
  /** Your API key (get a free one at the homepage). */
  apiKey: string;
  /** Override the API base URL (defaults to the hosted service). */
  baseUrl?: string;
  /** Provide a custom fetch (defaults to the global fetch; Node 18+ has one). */
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds (default 10000). */
  timeoutMs?: number;
}

/** Thrown for non-2xx responses and network/timeout failures. */
export class MailGuardError extends Error {
  /** HTTP status (0 for network/timeout errors). */
  readonly status: number;
  /** Machine-readable error code from the API (e.g. "quota_exceeded"). */
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "MailGuardError";
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_BASE_URL = "https://mailguard-api.atek.workers.dev";

export class MailGuard {
  #apiKey: string;
  #baseUrl: string;
  #fetch: typeof fetch;
  #timeoutMs: number;

  constructor(apiKey: string, options?: Omit<MailGuardOptions, "apiKey">);
  constructor(options: MailGuardOptions);
  constructor(
    apiKeyOrOptions: string | MailGuardOptions,
    options: Omit<MailGuardOptions, "apiKey"> = {},
  ) {
    const opts: MailGuardOptions =
      typeof apiKeyOrOptions === "string"
        ? { apiKey: apiKeyOrOptions, ...options }
        : apiKeyOrOptions;

    if (!opts.apiKey) throw new Error("MailGuard: an apiKey is required.");

    this.#apiKey = opts.apiKey;
    this.#baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#fetch = opts.fetch ?? globalThis.fetch;
    this.#timeoutMs = opts.timeoutMs ?? 10_000;

    if (typeof this.#fetch !== "function") {
      throw new Error(
        "MailGuard: no global fetch found. Use Node 18+, or pass a `fetch` in options.",
      );
    }
  }

  /** Verify a single email address. */
  verify(email: string): Promise<VerifyResult> {
    return this.#request<VerifyResult>("/v1/verify", { email });
  }

  /** Verify up to 100 addresses in one call. */
  verifyBatch(emails: string[]): Promise<BatchResult> {
    return this.#request<BatchResult>("/v1/verify/batch", { emails });
  }

  /** Convenience helper: resolves to true only when status is "deliverable". */
  async isDeliverable(email: string): Promise<boolean> {
    const result = await this.verify(email);
    return result.status === "deliverable";
  }

  async #request<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

    let res: Response;
    try {
      res = await this.#fetch(`${this.#baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.#apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = (err as Error)?.name === "AbortError";
      throw new MailGuardError(
        0,
        aborted ? "timeout" : "network_error",
        aborted ? `Request timed out after ${this.#timeoutMs}ms` : (err as Error).message,
      );
    } finally {
      clearTimeout(timer);
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new MailGuardError(
        res.status,
        typeof data.error === "string" ? data.error : "error",
        typeof data.message === "string" ? data.message : `Request failed (${res.status})`,
      );
    }
    return data as T;
  }
}

export default MailGuard;
