import { useEffect, useState } from "react";

const GLYPHS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ✦✧⟁⟂⌬⍜";

export default function GlyphScramble({
  text,
  className = "",
  speed = 40,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    let frame = 0;
    const total = text.length;
    const interval = setInterval(() => {
      frame++;
      const resolved = Math.floor(frame / 2);
      setDisplay(
        text
          .split("")
          .map((ch, i) => {
            if (ch === " ") return " ";
            if (i < resolved) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );
      if (resolved >= total) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className={`font-mono ${className}`}>{display}</span>;
}
