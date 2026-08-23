/**
 * Talking to the build store.
 *
 * One POST to get a code, one GET to read a build back. Everything else the
 * builder needs is local: the index ships with the app, and entity data comes
 * from Plutonium inside Foundry.
 */

import type { ImportPayload } from "@bertinis-vault/contracts";

export type PublishedBuild = {
  code: string;
  characterName: string;
  expiresAt: string;
};

export type ValidationIssue = { path: string; message: string };

export class VaultRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = "VaultRequestError";
  }
}

/**
 * Where the store lives.
 *
 * Defaults to the local worker so `pnpm worker:dev` and `pnpm web:dev` work
 * together without configuration.
 */
export function vaultBaseUrl(): string {
  return import.meta.env.VITE_VAULT_URL?.trim() || "http://127.0.0.1:8787";
}

async function readError(response: Response): Promise<VaultRequestError> {
  let message = `Request failed (${response.status}).`;
  let issues: ValidationIssue[] = [];

  try {
    const body = await response.json();
    if (typeof body?.error === "string") message = body.error;
    if (Array.isArray(body?.issues)) issues = body.issues;
  } catch {
    // A response with no JSON body leaves the status-based message in place.
  }

  return new VaultRequestError(message, response.status, issues);
}

/** Store a build and get the code a player types into Foundry. */
export async function publishBuild(
  payload: ImportPayload,
  baseUrl = vaultBaseUrl(),
): Promise<PublishedBuild> {
  const response = await fetch(`${baseUrl}/builds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw await readError(response);

  return (await response.json()) as PublishedBuild;
}

/** Read a build back by code. */
export async function fetchBuild(
  code: string,
  baseUrl = vaultBaseUrl(),
): Promise<{ payload: ImportPayload; createdAt: string }> {
  const response = await fetch(`${baseUrl}/builds/${encodeURIComponent(code)}`);

  if (!response.ok) throw await readError(response);

  return (await response.json()) as { payload: ImportPayload; createdAt: string };
}
