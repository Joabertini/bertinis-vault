import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { FARO_APP, framed } from "@/lib/faro";

/** Inside Faro's profile only `/personajes` lives in the frame; any other page takes the whole tab. */
export default function FaroGate({ children }: { children: React.ReactNode }) {
  const { pathname, search } = useLocation();
  const leaves = Boolean(FARO_APP) && framed() && pathname !== "/personajes";

  useEffect(() => {
    if (leaves) window.top!.location.href = window.location.origin + pathname + search;
  }, [leaves, pathname, search]);

  return leaves ? null : <>{children}</>;
}

/** Where the Codex used to be. */
export function ToProfile() {
  useEffect(() => {
    window.location.replace(`${FARO_APP}/perfil/#personajes`);
  }, []);
  return null;
}
