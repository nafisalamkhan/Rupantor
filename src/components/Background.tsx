import type { CSSProperties } from "react";

const GLYPHS: { ch: string; x: string; y: string; s: number; o: number; dur: number; delay: number }[] = [
  { ch: "রূ", x: "6%", y: "18%", s: 26, o: 0.1, dur: 18, delay: 0 },
  { ch: "অ", x: "14%", y: "64%", s: 20, o: 0.07, dur: 21, delay: 2 },
  { ch: "র্থ", x: "88%", y: "30%", s: 22, o: 0.09, dur: 17, delay: 1 },
  { ch: "ভাষা", x: "78%", y: "74%", s: 17, o: 0.08, dur: 23, delay: 4 },
  { ch: "স", x: "42%", y: "8%", s: 18, o: 0.06, dur: 19, delay: 3 },
  { ch: "প", x: "62%", y: "52%", s: 24, o: 0.07, dur: 20, delay: 5 },
  { ch: "ম", x: "30%", y: "38%", s: 21, o: 0.08, dur: 22, delay: 2.5 },
  { ch: "বাংলা", x: "8%", y: "84%", s: 16, o: 0.09, dur: 24, delay: 6 },
  { ch: "হ", x: "94%", y: "58%", s: 20, o: 0.07, dur: 18, delay: 3.5 },
  { ch: "ক", x: "50%", y: "26%", s: 17, o: 0.06, dur: 21, delay: 1.5 },
  { ch: "ত", x: "20%", y: "46%", s: 16, o: 0.05, dur: 25, delay: 7 },
  { ch: "র", x: "70%", y: "12%", s: 19, o: 0.08, dur: 19, delay: 4.5 },
  { ch: "ন", x: "36%", y: "70%", s: 18, o: 0.06, dur: 22, delay: 8 },
  { ch: "লিখুন", x: "84%", y: "88%", s: 15, o: 0.08, dur: 20, delay: 5.5 },
  { ch: "দ", x: "56%", y: "80%", s: 22, o: 0.07, dur: 23, delay: 2 },
  { ch: "য়", x: "26%", y: "90%", s: 17, o: 0.06, dur: 18, delay: 9 },
];

export default function Background() {
  return (
    <div className="bg-void" aria-hidden="true">
      <div className="bg-mesh" />
      <div className="bg-breathe" />
      <div className="bg-word bg-word-a">রূপ</div>
      <div className="bg-word bg-word-b">অর্থ</div>
      {GLYPHS.map((g, i) => (
        <span
          key={i}
          className="bg-glyph"
          style={
            {
              left: g.x,
              top: g.y,
              fontSize: g.s,
              "--o": g.o,
              "--dur": `${g.dur}s`,
              "--delay": `${g.delay}s`,
            } as CSSProperties
          }
        >
          {g.ch}
        </span>
      ))}
      <div className="bg-grain" />
      <div className="bg-vignette" />
    </div>
  );
}
