import { mergeConfig } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

import viteConfig from "./vite.config";

/**
 * The app's own aliases, plus a DOM. The builder derives a character while it
 * renders, so a test that only imports modules would miss the failures that
 * happen on the page.
 *
 * `test/pending/` is excluded on purpose: those suites describe behaviour the
 * Faro front does not expose yet, under the old front's API. They are kept as
 * a specification rather than deleted — see `test/pending/README.md`. Spread
 * of `configDefaults.exclude` keeps node_modules and friends excluded too;
 * setting `exclude` alone would replace those defaults.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["test/**/*.test.{ts,tsx}"],
      exclude: [...configDefaults.exclude, "test/pending/**"],
      restoreMocks: true,
      /*
       * Cinco segundos alcanzan en CI y no en una maquina cargada.
       * El recorrido de camaras pinta la Forja entera nueve veces y tarda
       * ocho segundos de trabajo real; con el default fallaba de a ratos por
       * la maquina y no por el codigo, que es la clase de test que despues
       * nadie cree cuando se pone rojo de verdad.
       */
      testTimeout: 30000,
      /*
       * Dos procesos, no uno por nucleo.
       * Con el default, vitest levanta ocho forks a la vez sobre un disco que
       * da 18 IOPS y siete de ellos no llegan a arrancar: "Failed to start
       * forks worker", con las 264 pruebas en verde igual. Un verify que se
       * pone rojo por la maquina ensena a ignorarlo, que es exactamente lo que
       * no queremos el dia que se ponga rojo de verdad.
       */
      maxWorkers: 2,
      /*
       * Hilos, no procesos.
       * Bajar a dos forks no alcanzo: el fallo no es de contencion sino de
       * arranque — "Timeout waiting for worker to respond" mientras el fork
       * todavia levantaba un Node entero desde un disco de 18 IOPS. Un hilo
       * comparte el proceso que ya esta en memoria y no paga ese arranque.
       * Medido en esta maquina: 219s con dos forks y una suite que nunca
       * arranco, contra 111s con las 38 en verde. Ningun test depende de
       * aislamiento de proceso.
       */
      pool: "threads",
    },
  }),
);
