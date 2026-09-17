/**
 * HTTP client for the on-device summary model — plan.md §9, Phase 5b.
 *
 * Talks to `scripts/summary-server.py`, a plain local HTTP server. Node 18+
 * ships `fetch` and `AbortController` in the global scope, so this needs no
 * HTTP client dependency — matching plan.md §4's "no third-party AI SDK,
 * no API key": there is nothing here to add to `package.json` at all.
 */

export interface SummaryModelResult {
  output: string;
  model: string | null;
}

export class SummaryModelError extends Error {}
export class SummaryModelTimeoutError extends SummaryModelError {}

/**
 * Calls POST /summarize. Throws `SummaryModelTimeoutError` on the deadline,
 * `SummaryModelError` on anything else (connection refused, non-200, bad
 * body) — the caller's job is to catch both and fall back to the template,
 * never to distinguish them, since plan.md §9 treats every failure mode the
 * same way: template, not a half-completed request.
 */
export async function callSummaryModel(
  baseUrl: string,
  input: string,
  timeoutMs: number,
): Promise<SummaryModelResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new SummaryModelError(`summary model returned ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as { output?: unknown; model?: unknown };
    if (typeof data.output !== 'string' || !data.output.trim()) {
      throw new SummaryModelError('summary model returned an empty output');
    }

    return { output: data.output, model: typeof data.model === 'string' ? data.model : null };
  } catch (err) {
    if (err instanceof SummaryModelError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SummaryModelTimeoutError(`summary model did not respond within ${timeoutMs}ms`);
    }
    throw new SummaryModelError(`summary model request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
