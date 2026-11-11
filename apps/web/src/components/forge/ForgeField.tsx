import type { ReactNode } from "react";

export default function ForgeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-3 block font-mono text-[13px] tracking-[0.1em] uppercase text-bone">
        {label}
      </label>
      {children}
    </div>
  );
}
