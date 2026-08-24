/**
 * Bertini's Vault — the Foundry end.
 *
 * A player types the code their character was built under, and this fetches it
 * and hands each reference to Plutonium.
 */

import { importPayload } from "./import.js";
import { PlutoniumUnavailableError, isPlutoniumReady } from "./plutonium.js";

const MODULE_ID = "bertinis-vault";
const DEFAULT_VAULT_URL = "https://bertinis-vault.bertinisdnd.workers.dev";

/** The payload format this module understands. */
const SUPPORTED_PAYLOAD_VERSION = 1;

function t(key, data) {
  return game.i18n.format(`${MODULE_ID}.${key}`, data ?? {});
}

function setting(key) {
  return game.settings.get(MODULE_ID, key);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "vaultUrl", {
    name: t("settings.vaultUrl.name"),
    hint: t("settings.vaultUrl.hint"),
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_VAULT_URL,
  });

  game.settings.register(MODULE_ID, "folderName", {
    name: t("settings.folderName.name"),
    hint: t("settings.folderName.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "Bertini's Vault",
  });

  game.settings.register(MODULE_ID, "openSheetOnImport", {
    name: t("settings.openSheet.name"),
    hint: t("settings.openSheet.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });
});

Hooks.once("ready", () => {
  if (!isPlutoniumReady()) {
    // Said once, at startup, rather than when the player is mid-import.
    ui.notifications.warn(t("notifications.plutoniumMissing"));
  }
});

/** A button on the Actors tab, where a player goes to make a character. */
Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  const footer = root?.querySelector(".directory-footer") ?? root?.querySelector(".header-actions");
  if (!footer || footer.querySelector(`.${MODULE_ID}-import`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = `${MODULE_ID}-import`;
  button.innerHTML = `<i class="fas fa-dice-d20"></i> ${t("ui.importButton")}`;
  button.addEventListener("click", () => promptForCode());

  footer.append(button);
});

/** Ask for a code. */
export async function promptForCode() {
  const content = `
    <div class="${MODULE_ID}-prompt">
      <p>${t("ui.promptHelp")}</p>
      <input type="text" name="code" placeholder="XXXXX-XXXXX" autocomplete="off" spellcheck="false" />
      <p class="notes">${t("ui.promptNote")}</p>
    </div>`;

  const code = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("ui.importTitle") },
    content,
    ok: {
      label: t("ui.importAction"),
      callback: (_event, button) => button.form.elements.code.value?.trim(),
    },
    rejectClose: false,
  });

  if (code) await importByCode(code);
}

/**
 * Fetch a build and import it.
 *
 * Every failure here is something a player can act on — a typo, an expired
 * code, a module that needs updating — so each is reported as itself rather
 * than as a generic error.
 */
export async function importByCode(code) {
  const baseUrl = String(setting("vaultUrl")).replace(/\/+$/, "");

  let payload;
  try {
    const response = await fetch(`${baseUrl}/builds/${encodeURIComponent(code)}`);

    if (response.status === 404) return ui.notifications.error(t("errors.notFound", { code }));
    if (response.status === 400) return ui.notifications.error(t("errors.badCode", { code }));
    if (!response.ok) return ui.notifications.error(t("errors.server", { status: response.status }));

    ({ payload } = await response.json());
  } catch (error) {
    console.error(`${MODULE_ID} |`, error);
    return ui.notifications.error(t("errors.offline", { url: baseUrl }));
  }

  if (payload?.version !== SUPPORTED_PAYLOAD_VERSION) {
    return ui.notifications.error(t("errors.payloadVersion", { version: payload?.version }));
  }

  await runImport(payload);
}

async function runImport(payload) {
  const name = payload.identity.characterName;
  const notification = ui.notifications.info(t("notifications.importing", { name }), { permanent: true });

  try {
    const folderId = await ensureFolder();

    const result = await importPayload(payload, {
      folderId,
      onProgress: ({ index, total }) => {
        SceneNavigation.displayProgressBar?.({ label: name, pct: Math.round(((index + 1) / total) * 100) });
      },
    });

    ui.notifications.remove?.(notification);

    if (result.failures.length) {
      // Naming what failed lets the player fix it in the builder and re-import.
      console.warn(`${MODULE_ID} | unresolved:`, result.failures);
      ui.notifications.warn(
        t("notifications.importedWithFailures", { name, count: result.failures.length }),
      );
      for (const failure of result.failures.slice(0, 5)) {
        ui.notifications.warn(`${failure.ref.hash} (${failure.ref.source}): ${failure.reason}`);
      }
    } else {
      ui.notifications.info(t("notifications.imported", { name, count: result.imported }));
    }

    if (setting("openSheetOnImport")) result.actor.sheet?.render(true);
    return result;
  } catch (error) {
    ui.notifications.remove?.(notification);

    if (error instanceof PlutoniumUnavailableError) {
      ui.notifications.error(error.message);
    } else {
      console.error(`${MODULE_ID} |`, error);
      ui.notifications.error(t("errors.importFailed", { message: error?.message ?? String(error) }));
    }

    throw error;
  }
}

/** The folder imports land in, created once. */
async function ensureFolder() {
  const name = String(setting("folderName")).trim();
  if (!name) return null;

  const existing = game.folders.find((f) => f.type === "Actor" && f.name === name);
  if (existing) return existing.id;

  const folder = await Folder.create({ name, type: "Actor" });
  return folder?.id ?? null;
}

// Exposed so a macro can import without going through the dialog.
Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = { importByCode, promptForCode };
});
