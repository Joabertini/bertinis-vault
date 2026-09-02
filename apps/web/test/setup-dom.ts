/**
 * jsdom no implementa `matchMedia`, y el navegador siempre la tiene. Un
 * componente que consulta `prefers-reduced-motion` no deberia defenderse de
 * una carencia del entorno de prueba, asi que la carencia se tapa aca.
 *
 * Devuelve `matches: false` — sin preferencia declarada — que es lo que
 * contesta un navegador por defecto y deja corriendo el camino con efecto.
 */
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
