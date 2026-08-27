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
    /**
     * What the Worker itself said, kept for diagnosis rather than display.
     *
     * The server answers in English and in its own vocabulary — "Request
     * failed", "invalid payload" — which is the right register for a log and
     * the wrong one for someone mid-ritual. `message` carries what the player
     * reads; this carries what actually happened.
     */
    readonly serverDetail?: string,
  ) {
    super(message);
    this.name = "VaultRequestError";
  }
}

/** What went wrong, said to the person waiting rather than to a log. */
function messageForStatus(status: number): string {
  if (status === 400 || status === 422) {
    return "El almacen rechazo el personaje: algun dato no paso su validacion.";
  }
  if (status === 401 || status === 403) {
    return "El almacen rechazo la credencial de este front.";
  }
  if (status === 404) {
    return "El almacen no respondio en esa ruta. Puede estar desplegada otra version.";
  }
  if (status === 413) {
    return "El personaje pesa mas de lo que el almacen acepta.";
  }
  if (status === 429) {
    return "Demasiados envios seguidos. Espera unos segundos y volve a intentar.";
  }
  if (status >= 500) {
    return "El almacen fallo del otro lado. Volve a intentar en un momento.";
  }

  return "El almacen no acepto el envio.";
}

/**
 * Where the store lives.
 *
 * Defaults to the local worker so `pnpm worker:dev` and `pnpm web:dev` work
 * together without configuration.
 */
export function vaultBaseUrl(): string {
  const configured = import.meta.env.VITE_VAULT_URL?.trim() || "http://127.0.0.1:8787";
  // A trailing slash in the env file would make every request go to `//builds`,
  // which some routers treat as a different path and others reject outright.
  return configured.replace(/\/+$/, "");
}

/**
 * How long to wait for the store before giving up.
 *
 * Without this the request has no deadline: a Worker that accepts the
 * connection and never answers leaves the summoning circle turning forever,
 * with no error and no way back except reloading the page.
 */
const requestTimeoutMs = 15_000;

async function readError(response: Response): Promise<VaultRequestError> {
  let serverDetail: string | undefined;
  let issues: ValidationIssue[] = [];

  try {
    const body = await response.json();
    if (typeof body?.error === "string") serverDetail = body.error;
    if (Array.isArray(body?.issues)) issues = body.issues;
  } catch {
    // A response with no JSON body leaves only the status to go on.
  }

  // Stored for diagnosis and logged here, because a field nobody ever reads is
  // the same as not keeping it.
  if (serverDetail || issues.length > 0) {
    console.error("[vault] %d %s", response.status, serverDetail ?? "", issues);
  }

  return new VaultRequestError(
    messageForStatus(response.status),
    response.status,
    issues,
    serverDetail,
  );
}

/** Store a build and get the code a player types into Foundry. */
export async function publishBuild(
  payload: ImportPayload,
  baseUrl = vaultBaseUrl(),
): Promise<PublishedBuild> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  // Trimmed here rather than only in `vaultBaseUrl`, because a caller passing
  // its own base would otherwise slip past the trim and request `//builds`.
  const root = baseUrl.replace(/\/+$/, "");

  let response: Response;
  try {
    response = await fetch(`${root}/builds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    // An abort is this front's own deadline, not a network fault, and saying
    // "revisa la conexion" when the connection is fine sends the player
    // looking in the wrong place.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new VaultRequestError(
        "El almacen tardo demasiado en responder. Volve a intentar.",
        0,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw await readError(response);

  return readPublished(response);
}

/**
 * The store's answer, checked before it is believed.
 *
 * The code is the entire point of this crossing. Casting the body without
 * looking meant a store that answered `{}` produced a success screen with no
 * code on it and no explanation — the player is told it worked and has
 * nothing to type into Foundry.
 */
async function readPublished(response: Response): Promise<PublishedBuild> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new VaultRequestError("El almacen respondio algo que no es JSON.", response.status);
  }

  const candidate = body as Partial<PublishedBuild> | null;
  if (!candidate || typeof candidate.code !== "string" || candidate.code.trim() === "") {
    throw new VaultRequestError(
      "El almacen acepto el personaje pero no devolvio un codigo.",
      response.status,
      [],
      JSON.stringify(body)?.slice(0, 200),
    );
  }

  return {
    code: candidate.code,
    characterName: typeof candidate.characterName === "string" ? candidate.characterName : "",
    expiresAt: typeof candidate.expiresAt === "string" ? candidate.expiresAt : "",
  };
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
