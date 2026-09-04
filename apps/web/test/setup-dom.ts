/**
 * jsdom no implementa `matchMedia`, y el navegador siempre la tiene. Un
 * componente que consulta `prefers-reduced-motion` no deberia defenderse de
 * una carencia del entorno de prueba, asi que la carencia se tapa aca.
 *
 * Devuelve `matches: false` — sin preferencia declarada — que es lo que
 * contesta un navegador por defecto y deja corriendo el camino con efecto.
 */
/**
 * Lo mismo con `scrollTo`: jsdom la declara pero no la implementa, y cada
 * cambio de camara la llama para volver al tope. Sin tapar, cada navegacion
 * del test de humo escupe "Not implemented: window.scrollTo" y ensucia una
 * salida que despues nadie lee cuando importa.
 */
window.scrollTo = (() => {}) as typeof window.scrollTo;

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
