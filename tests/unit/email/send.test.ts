import { describe, expect, it, vi } from "vitest";
import { buildResendBody, classifyResendError, RESEND_ENDPOINT, sendEmail, type OutgoingEmail } from "@/lib/email/send";

const message: OutgoingEmail = {
  to: "anna@example.ch",
  subject: "Neue Nachricht von Martin",
  html: "<p>Hallo</p>",
  text: "Hallo",
  replyTo: "support@immovia.ch",
  tags: [{ name: "template", value: "new_message" }, { name: "ungültig", value: "x y" }],
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("Versand über Resend", () => {
  it("sendet mit Bearer-Token, Idempotency-Key und User-Agent", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => jsonResponse(200, { id: "re_123" }));
    const result = await sendEmail(message, {
      apiKey: "re_test",
      idempotencyKey: "0b5e2f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      from: "Immovia <noreply@immovia.ch>",
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, id: "re_123", duplicate: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toBe("0b5e2f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b");
    expect(headers["User-Agent"]).toMatch(/immovia/);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: "Immovia <noreply@immovia.ch>",
      to: ["anna@example.ch"],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: ["support@immovia.ch"],
      tags: [{ name: "template", value: "new_message" }],
    });
  });

  it("überträgt Anhänge als Base64 mit Dateinamen", () => {
    const body = buildResendBody({ ...message, attachments: [{ filename: "besichtigung.ics", content: "QkVHSU4=" }] }, "Immovia <a@b.ch>");
    expect(body.attachments).toEqual([{ filename: "besichtigung.ics", content: "QkVHSU4=" }]);
  });

  it("meldet fehlende Konfiguration, ohne zu senden", async () => {
    const fetchMock = vi.fn();
    const previous = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail(message, { fetch: fetchMock as unknown as typeof fetch });
    if (previous !== undefined) process.env.RESEND_API_KEY = previous;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_configured");
      expect(result.stopBatch).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wiederholt bei Rate Limit und bricht den Durchlauf ab", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(429, { name: "rate_limit_exceeded", message: "Too many requests" }, { "retry-after": "2" }));
    const result = await sendEmail(message, { apiKey: "re_test", fetch: fetchMock as unknown as typeof fetch });
    expect(result).toMatchObject({ ok: false, reason: "rate_limited", retryable: true, stopBatch: true, retryAfterMs: 2000 });
  });

  it("behandelt Validierungsfehler als endgültig", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(422, { name: "missing_required_field", message: "Missing `to` field." }));
    const result = await sendEmail(message, { apiKey: "re_test", fetch: fetchMock as unknown as typeof fetch });
    expect(result).toMatchObject({ ok: false, reason: "invalid", retryable: false });
  });

  it("wertet einen wiederverwendeten Idempotenz-Schlüssel als bereits gesendet", () => {
    expect(classifyResendError(409, "invalid_idempotent_request", "")).toEqual({ ok: true, id: null, duplicate: true });
    expect(classifyResendError(409, "concurrent_idempotent_requests", "")).toMatchObject({ ok: false, retryable: true, stopBatch: false });
  });

  it("stoppt bei ungültigem Schlüssel oder nicht verifizierter Domain", () => {
    expect(classifyResendError(401, "validation_error", "API key is invalid")).toMatchObject({ reason: "auth", retryable: true, stopBatch: true });
    expect(classifyResendError(403, "validation_error", "domain is not verified")).toMatchObject({ reason: "auth", stopBatch: true });
  });

  it("wiederholt bei Serverfehlern und Netzwerkproblemen", async () => {
    expect(classifyResendError(503, "application_error", "")).toMatchObject({ reason: "server", retryable: true, stopBatch: false });
    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await sendEmail(message, { apiKey: "re_test", fetch: failing as unknown as typeof fetch });
    expect(result).toMatchObject({ ok: false, reason: "network", retryable: true });
  });

  it("wartet bei ausgeschöpftem Tageskontingent länger", () => {
    const result = classifyResendError(429, "daily_quota_exceeded", "");
    expect(result).toMatchObject({ reason: "rate_limited", stopBatch: true });
    if (!result.ok) expect(result.retryAfterMs).toBeGreaterThanOrEqual(60 * 60_000);
  });
});
