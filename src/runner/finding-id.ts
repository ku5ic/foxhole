import { createHash } from "node:crypto";

interface FindingIdInput {
  pageUrl: string;
  ruleId: string;
  semanticPath: string;
  textFingerprint: string;
}

function computeFindingId(input: FindingIdInput): string {
  const raw = `${input.pageUrl}\0${input.ruleId}\0${input.semanticPath}\0${input.textFingerprint}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function buildSemanticPath(html: string): string {
  const trimmed = html.trim();

  /* eslint-disable @typescript-eslint/prefer-regexp-exec */
  const tagMatch = trimmed.match(/^<([a-z][a-z0-9-]*)/i);
  const tagRaw = tagMatch?.[1];
  if (!tagRaw) return trimmed.slice(0, 64);
  const tag = tagRaw.toLowerCase();

  const idValue = trimmed.match(/\sid="([^"]+)"/)?.[1];
  if (idValue !== undefined) return `${tag}#${idValue}`;

  const ariaLabel = trimmed.match(/\saria-label="([^"]+)"/)?.[1];
  if (ariaLabel !== undefined) return `${tag}:${ariaLabel}`;

  const role = trimmed.match(/\srole="([^"]+)"/)?.[1];
  if (role !== undefined) return `${tag}[role=${role}]`;
  /* eslint-enable @typescript-eslint/prefer-regexp-exec */

  return tag;
}

function buildTextFingerprint(input: { ruleId: string; detail: string }): string {
  return `${input.ruleId}: ${input.detail}`.slice(0, 64);
}

export { computeFindingId, buildSemanticPath, buildTextFingerprint };
export type { FindingIdInput };
