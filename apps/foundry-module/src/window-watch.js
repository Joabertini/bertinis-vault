/**
 * Naming whatever opens a window during an import.
 *
 * The import is supposed to be silent. It has not been three times running,
 * and each time the only report available was "a window appeared", which costs
 * a round trip to turn into a call site. This watches every application render
 * for the duration of an import and writes the class, the title and the stack
 * to the console, so the next window names itself the first time it opens.
 *
 * It patches Foundry's own `render` rather than Plutonium's dialogs because
 * that is the one funnel everything passes through — `DialogV2`, Plutonium's
 * `Charactermancer_*` components and its importer wizards alike.
 */

const MODULE_ID = "bertinis-vault";

/**
 * Start watching. Returns a function that stops watching and hands back what
 * was seen, so a caller can report it as part of the import's result.
 */
export function watchWindows({ label = "" } = {}) {
  const sightings = [];
  const restores = [];

  const patch = (target, name) => {
    const proto = target?.prototype;
    if (!proto || typeof proto.render !== "function") return;

    const original = proto.render;
    proto.render = function patched(...args) {
      if (isNoise(this)) return original.apply(this, args);

      const sighting = {
        app: this?.constructor?.name ?? name,
        title: safeTitle(this),
        label,
        stack: new Error("window opened during import").stack,
      };
      sightings.push(sighting);
      console.warn(`${MODULE_ID} | a window opened during the import:`, sighting);

      return original.apply(this, args);
    };

    restores.push(() => {
      proto.render = original;
    });
  };

  patch(globalThis.Application, "Application");
  patch(globalThis.foundry?.applications?.api?.ApplicationV2, "ApplicationV2");

  return function stop() {
    for (const restore of restores) restore();
    return sightings;
  };
}

/**
 * Whether a render is something we already expect to happen.
 *
 * An import creates an actor and puts items on it, and Foundry redraws what was
 * already on screen in response — the actor directory most of all. Those are
 * re-renders of an application that is already open, not a window appearing,
 * and reporting them buries the one sighting that would matter.
 *
 * The test is `rendered`, not a list of class names: anything already on screen
 * is not something the import opened.
 */
export function isNoise(app) {
  try {
    return app?.rendered === true;
  } catch {
    return false;
  }
}

/**
 * An application's title without trusting it to have one.
 *
 * `title` is a getter on most application classes and throws on some when the
 * app has not finished constructing, which is exactly when we are calling it.
 */
function safeTitle(app) {
  try {
    return app?.title ?? app?.options?.window?.title ?? app?.options?.title ?? null;
  } catch {
    return null;
  }
}
