// v2 of "Путь в Claude: 10 шагов" — series style @iishka26 (dark, one orange accent, dot grid + grain) with Apple-style
// motion: critically damped springs by default, bounce only on "thrown" elements, push transitions with both slides on
// screen and a speed blur, liquid-glass panels with a specular sweep, negative tracking on display type.
// Same voice (final.mp4 audio) and same music (added at mastering). Slides change on the 120 BPM beat grid.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { brandFont } from "./kit/brand";
import { Word, buildChunks } from "./kit/Subtitles";
import type { ReelKitProps } from "./ReelKit";

const FPS = 30;
export const END_CARD_V2 = 91.0 - 80.133; // bonus cheat-sheet slides (music only) + the end card after the voice
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const outExpo = Easing.out(Easing.exp);
const inOut = Easing.inOut(Easing.cubic);
const C = { bg: "#0E0E10", panel: "#1B1B20", ink: "#F2EFE9", dim: "#8C8982", acc: "#FF7A30", dot: "#26262C", onAcc: "#141414" };
// house safe box for Shorts/Reels: x 72–890, y 230–1340
const S = { x: 72, y: 230, w: 818, bottom: 1340 };

// ---------------------------------------------------------------- springs (Apple: damping 1.0 by default)
const sp = (frame: number, at: number, kind: "calm" | "throw" | "snap" = "calm") =>
  spring({ frame: frame - at * FPS, fps: FPS, config: kind === "throw" ? { damping: 11, stiffness: 190, mass: 0.7 }
    : kind === "snap" ? { damping: 26, stiffness: 380, mass: 0.6 } : { damping: 200, stiffness: 160 } });
const vis = (frame: number, at: number) => interpolate(frame - at * FPS, [0, 3], [0, 1], clamp);
const beatPulse = (frame: number) => Math.exp(-(((frame / FPS) % 0.5) * FPS) / 3);

// seeded hash for grain
const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- timeline
type Scene = { from: number; to: number; id: string; step?: number; title?: string };
const SCENES: Scene[] = [
  { from: 0, to: 5.0, id: "hook" },
  { from: 5.0, to: 8.0, id: "flick" },
  { from: 8.0, to: 16.0, id: "s1", step: 1, title: "Основы" },
  { from: 16.0, to: 26.5, id: "s2", step: 2, title: "Сильные промпты" },
  { from: 26.5, to: 34.5, id: "s3", step: 3, title: "Артефакты" },
  { from: 34.5, to: 42.5, id: "s4", step: 4, title: "Навыки" },
  { from: 42.5, to: 48.0, id: "s5", step: 5, title: "Совместная работа" },
  { from: 48.0, to: 55.0, id: "s6", step: 6, title: "Интеграции" },
  { from: 55.0, to: 59.0, id: "s7", step: 7, title: "Автоматизация" },
  { from: 59.0, to: 65.5, id: "s8", step: 8, title: "Claude Code" },
  { from: 65.5, to: 71.5, id: "s9", step: 9, title: "Реальные кейсы" },
  { from: 71.5, to: 77.5, id: "s10", step: 10, title: "Продвинутый уровень" },
  { from: 77.5, to: 80.5, id: "save" },
  { from: 80.5, to: 83.0, id: "b1" },
  { from: 83.0, to: 85.5, id: "b2" },
  { from: 85.5, to: 88.0, id: "b3" },
  { from: 88.0, to: 91.0, id: "end" },
];
const STEP_NAMES = ["Основы", "Промпты", "Артефакты", "Навыки", "Команда", "Интеграции", "Автоматизация", "Claude Code", "Кейсы", "Системы"];
const PUSH = 10; // frames of the push transition, centered so the new slide owns the beat

// ---------------------------------------------------------------- primitives
const Mono: React.FC<{ f: string; size?: number; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ f, size = 34, color = C.acc, children, style }) => (
  <div style={{ fontFamily: f, fontWeight: 700, fontSize: size, color, letterSpacing: "0.08em", ...style }}>{children}</div>
);

/** Liquid glass: translucent panel, bright top edge, a specular sweep that crosses it once after it lands. */
const Glass: React.FC<{ frame: number; at: number; style?: React.CSSProperties; children?: React.ReactNode; accent?: boolean }> = ({ frame, at, style, children, accent }) => {
  const sweep = interpolate(frame - at * FPS, [6, 30], [-60, 160], clamp);
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 28, background: accent ? C.acc : "rgba(38,38,46,0.62)",
      border: `1.5px solid ${accent ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.10)"}`, boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.18), 0 24px 60px rgba(0,0,0,0.45)",
      backdropFilter: "blur(18px) saturate(160%)", ...style }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: `linear-gradient(105deg, transparent ${sweep - 18}%, rgba(255,255,255,${accent ? 0.35 : 0.13}) ${sweep}%, transparent ${sweep + 18}%)` }} />
      {children}
    </div>
  );
};

/** Display text that rises word by word under a mask (no bounce: Apple default). */
const Rise: React.FC<{ text: string; f: string; size: number; frame: number; at: number; color?: string; accent?: string[]; stagger?: number; weight?: number; lh?: number }> = (
  { text, f, size, frame, at, color = C.ink, accent = [], stagger = 2, weight = 900, lh = 1.04 }) => {
  let n = 0;
  return (
    <div style={{ fontFamily: f, fontWeight: weight, fontSize: size, lineHeight: lh, letterSpacing: "-0.03em", color }}>
      {text.split(/(\s+|\n)/).map((w, i) => {
        if (w === "\n") return <br key={i} />;
        if (/^\s+$/.test(w)) return <span key={i}> </span>;
        const k = sp(frame, at + (n++ * stagger) / FPS);
        const acc = accent.includes(w.replace(/[.,?!]/g, ""));
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: size * 0.08 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 105}%)`, color: acc ? C.acc : color }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

const Progress: React.FC<{ step: number; frame: number; from: number }> = ({ step, frame, from }) => {
  const fill = outExpo(interpolate(frame - from * FPS, [6, 22], [0, 1], clamp));
  return (
    <div style={{ position: "absolute", left: S.x, top: S.y + 40, width: S.w, display: "flex", gap: 10 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 10, borderRadius: 5, background: C.dot, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${i < step - 1 ? 100 : i === step - 1 ? fill * 100 : 0}%`, background: C.acc, borderRadius: 5 }} />
        </div>
      ))}
    </div>
  );
};

/** Header shared by step cards: big accent number with a settle wobble, mono label, title, an accent rule that draws. */
const StepHead: React.FC<{ s: Scene; frame: number; F: Fonts }> = ({ s, frame, F }) => {
  const v = frame / FPS - s.from;
  const k = sp(frame, s.from + 0.05, "throw");
  const num = String(s.step).padStart(2, "0");
  const rule = outExpo(interpolate(v, [0.45, 1.1], [0, 1], clamp));
  return (
    <>
      <Progress step={s.step!} frame={frame} from={s.from} />
      <div style={{ position: "absolute", left: S.x - 8, top: S.y + 82, fontFamily: F.d, fontWeight: 900, fontSize: 250, lineHeight: 1,
        letterSpacing: "-0.05em", color: C.acc, transform: `translateY(${(1 - k) * 160}px) scale(${0.8 + 0.2 * k})`, transformOrigin: "0% 100%",
        opacity: vis(frame, s.from) }}>{num}</div>
      <Mono f={F.m} size={30} color={C.dim} style={{ position: "absolute", left: S.x + 330, top: S.y + 130, opacity: sp(frame, s.from + 0.15) }}>
        ШАГ {num} / 10</Mono>
      <div style={{ position: "absolute", left: S.x, top: S.y + 345, width: S.w }}>
        <Rise text={s.title!} f={F.d} size={fitTitle(s.title!)} frame={frame} at={s.from + 0.12} />
      </div>
      <div style={{ position: "absolute", left: S.x, top: S.y + 475, height: 5, width: S.w * rule, background: C.acc, borderRadius: 3 }} />
    </>
  );
};

type Fonts = { d: string; m: string };
// Inter Display Black, Cyrillic: ~0.66 em per character on average — one line inside the safe width
const fitTitle = (t: string, max = 104) => Math.min(max, Math.floor(S.w / (t.length * 0.66)));

// ---------------------------------------------------------------- step modules (area y ≈ 740–1160)
const AREA = S.y + 515;
const Pill: React.FC<{ frame: number; at: number; F: Fonts; children: React.ReactNode; accent?: boolean }> = ({ frame, at, F, children, accent }) => {
  const k = sp(frame, at, "throw");
  return (
    <div style={{ opacity: vis(frame, at), transform: `translateY(${(1 - k) * 70}px) scale(${0.7 + 0.3 * k})` }}>
      <Glass frame={frame} at={at} accent={accent} style={{ padding: "20px 34px" }}>
        <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 60, letterSpacing: "-0.01em", color: accent ? C.onAcc : C.ink, whiteSpace: "nowrap" }}>{children}</div>
      </Glass>
    </div>
  );
};
const Dim: React.FC<{ frame: number; at: number; F: Fonts; children: React.ReactNode; style?: React.CSSProperties }> = ({ frame, at, F, children, style }) => {
  const k = sp(frame, at);
  return <div style={{ fontFamily: F.d, fontWeight: 500, fontSize: 46, color: C.dim, lineHeight: 1.2, opacity: k, transform: `translateY(${(1 - k) * 24}px)`, ...style }}>{children}</div>;
};

const Window: React.FC<{ frame: number; at: number; F: Fonts; kind: "site" | "calc" | "doc"; label: string }> = ({ frame, at, F, kind, label }) => {
  const k = sp(frame, at, "throw");
  const g = (d: number) => outExpo(interpolate(frame - at * FPS, [6 + d, 18 + d], [0, 1], clamp));
  return (
    <div style={{ width: 246, opacity: vis(frame, at), transform: `translateY(${(1 - k) * 90}px) rotate(${(1 - k) * -6}deg)` }}>
      <Glass frame={frame} at={at} style={{ height: 280, padding: 18 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}</div>
        {kind === "site" ? (<>
          <div style={{ height: 70, borderRadius: 12, background: C.acc, opacity: 0.9, width: `${g(0) * 100}%` }} />
          {[0.9, 0.7, 0.8].map((w, i) => <div key={i} style={{ height: 16, borderRadius: 8, background: C.dim, opacity: 0.5, marginTop: 16, width: `${w * g(3 + i * 3) * 100}%` }} />)}
        </>) : kind === "calc" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <div style={{ gridColumn: "span 3", height: 46, borderRadius: 10, background: C.panel, color: C.ink, fontFamily: F.m, fontSize: 30, textAlign: "right", padding: "6px 12px" }}>
              {Math.round(g(0) * 1240)}</div>
            {Array.from({ length: 9 }, (_, i) => <div key={i} style={{ height: 40, borderRadius: 10, background: i === 8 ? C.acc : "rgba(255,255,255,0.12)", opacity: g(i * 1.2) }} />)}
          </div>
        ) : (
          [1, 0.85, 0.95, 0.6, 0.9, 0.7].map((w, i) => <div key={i} style={{ height: 14, borderRadius: 7, background: i === 0 ? C.ink : C.dim, opacity: i === 0 ? 0.9 : 0.5, marginTop: i ? 18 : 4, width: `${w * g(i * 2) * 100}%` }} />)
        )}
      </Glass>
      <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 32, color: C.ink, marginTop: 12, textAlign: "center" }}>{label}</div>
    </div>
  );
};

const Terminal: React.FC<{ frame: number; F: Fonts }> = ({ frame, F }) => {
  const t = frame / FPS;
  const typed = (txt: string, at: number) => txt.slice(0, Math.max(0, Math.min(txt.length, Math.floor((frame - at * FPS) / 1.3))));
  const caret = Math.floor(frame / 8) % 2 === 0;
  const rows: { at: number; el: React.ReactNode }[] = [
    { at: 59.6, el: <><span style={{ color: C.dim }}>$ </span>{typed("claude", 59.6)}</> },
    { at: 61.73, el: <><span style={{ color: C.acc }}>✓ </span>пишет код</> },
    { at: 62.34, el: <><span style={{ color: C.acc }}>✓ </span>запускает</> },
    { at: 63.47, el: <><span style={{ color: C.dim }}>&gt; </span>{typed("ваша задача", 63.47)}{t < 64.77 && caret ? <span style={{ color: C.acc }}>▍</span> : null}</> },
    { at: 64.77, el: <span style={{ color: C.acc, display: "inline-block", transform: `scale(${1 + beatPulse(frame) * 0.05})`, transformOrigin: "0 50%" }}>✓ выполнено</span> },
  ];
  const k = sp(frame, 59.3, "snap");
  return (
    <div style={{ opacity: vis(frame, 59.3), transform: `translateY(${(1 - k) * 80}px)` }}>
      <Glass frame={frame} at={59.3} style={{ width: S.w, padding: "22px 34px 30px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>{["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />)}
          <Mono f={F.m} size={24} color={C.dim} style={{ marginLeft: 16 }}>terminal</Mono></div>
        {rows.map((r, i) => t >= r.at ? <div key={i} style={{ fontFamily: F.m, fontWeight: 700, fontSize: 46, color: C.ink, lineHeight: 1.45, opacity: vis(frame, r.at) }}>{r.el}</div> : null)}
      </Glass>
    </div>
  );
};

const Hub: React.FC<{ frame: number; F: Fonts }> = ({ frame, F }) => {
  const cx = 409, cy = 140;
  const nodes = [{ t: "Google Drive", at: 50.39, x: 120, y: 30 }, { t: "GitHub", at: 51.31, x: 690, y: 100 }, { t: "Notion", at: 51.88, x: 270, y: 250 }];
  const kc = sp(frame, 48.6, "throw");
  return (
    <div style={{ position: "relative", width: S.w, height: 300 }}>
      <svg width={S.w} height={300} style={{ position: "absolute", inset: 0 }}>
        {nodes.map((n, i) => {
          const p = outExpo(interpolate(frame - n.at * FPS, [-6, 8], [0, 1], clamp));
          return <line key={i} x1={cx} y1={cy} x2={cx + (n.x - cx) * p} y2={cy + (n.y - cy) * p} stroke={C.acc} strokeWidth={4} strokeDasharray="10 10" strokeDashoffset={-frame * 1.5} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: cx - 95, top: cy - 95, width: 190, height: 190, borderRadius: 95, background: C.acc, display: "flex", alignItems: "center",
        justifyContent: "center", transform: `scale(${kc * (1 + beatPulse(frame) * 0.04)})`, boxShadow: `0 0 0 ${14 + beatPulse(frame) * 10}px rgba(255,122,48,0.15)` }}>
        <div style={{ fontFamily: F.d, fontWeight: 900, fontSize: 44, color: C.onAcc, letterSpacing: "-0.02em" }}>Claude</div>
      </div>
      {nodes.map((n, i) => {
        const k = sp(frame, n.at, "throw");
        return (
          <div key={i} style={{ position: "absolute", left: Math.max(0, Math.min(n.x - 110, S.w - 330)), top: n.y - 40, opacity: vis(frame, n.at), transform: `scale(${0.6 + 0.4 * k})` }}>
            <Glass frame={frame} at={n.at} style={{ padding: "16px 28px" }}><div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 44, color: C.ink }}>{n.t}</div></Glass>
          </div>
        );
      })}
    </div>
  );
};

const StepBody: React.FC<{ s: Scene; frame: number; F: Fonts }> = ({ s, frame, F }) => {
  const t = frame / FPS;
  const row = (children: React.ReactNode, gap = 20) => <div style={{ display: "flex", flexWrap: gap === 40 ? "nowrap" : "wrap", gap: gap === 40 ? 40 - 26 : gap, alignItems: "flex-start" }}>{children}</div>;
  switch (s.id) {
    case "s1": return <>{row(<><Pill frame={frame} at={11.05} F={F}>Промпт</Pill><Pill frame={frame} at={11.7} F={F}>Контекст</Pill><Pill frame={frame} at={13.15} F={F}>Модели</Pill></>)}
      <Dim frame={frame} at={13.95} F={F} style={{ marginTop: 34 }}>Без этого всё работает <span style={{ color: C.acc }}>вслепую</span></Dim></>;
    case "s2": {
      const items = [["Роль", 20.39], ["Контекст", 20.88], ["Задача", 21.64], ["Ограничение", 22.29], ["Формат", 23.19]] as const;
      const k = sp(frame, 18.35, "snap");
      return (
        <div style={{ opacity: vis(frame, 18.35), transform: `translateY(${(1 - k) * 60}px)` }}>
          <Glass frame={frame} at={18.35} style={{ padding: "24px 36px 26px 48px" }}>
            <div style={{ position: "absolute", left: 0, top: 26, bottom: 26, width: 8, borderRadius: 4, background: C.acc }} />
            <Mono f={F.m} size={30}>ФОРМУЛА · 5 ЭЛЕМЕНТОВ</Mono>
            {items.map(([w, at], i) => {
              const kk = sp(frame, at - 0.03, "snap");
              const on = t >= at;
              return <div key={w} style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 14, opacity: on ? 1 : 0.18, transform: `translateX(${(1 - kk) * 40}px)` }}>
                <div style={{ fontFamily: F.m, fontWeight: 700, fontSize: 30, color: on ? C.acc : C.dim, width: 40 }}>{i + 1}</div>
                <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 50, color: C.ink, letterSpacing: "-0.01em" }}>{w}</div>
              </div>;
            })}
          </Glass>
        </div>
      );
    }
    case "s3": return <>{row(<><Window frame={frame} at={29.2} F={F} kind="site" label="Сайты" /><Window frame={frame} at={29.82} F={F} kind="calc" label="Калькуляторы" />
      <Window frame={frame} at={30.5} F={F} kind="doc" label="Документы" /></>, 40)}
      <Mono f={F.m} size={28} color={C.dim} style={{ marginTop: 26, opacity: sp(frame, 32.3) }}>+ ПАНЕЛИ · МИНИ-ПРИЛОЖЕНИЯ · ФОРМЫ · КОД</Mono></>;
    case "s4": {
      const rot = interpolate(t, [38.7, 41.9], [0, 720], { ...clamp, easing: inOut });
      return <><div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        <Pill frame={frame} at={36.68} F={F}>Описали 1 раз</Pill>
        <div style={{ opacity: vis(frame, 38.6) }}>
          <svg width={150} height={150} viewBox="0 0 100 100" style={{ transform: `rotate(${rot}deg)` }}>
            <path d="M50 12 A38 38 0 1 1 15 35" fill="none" stroke={C.acc} strokeWidth={9} strokeLinecap="round" />
            <path d="M6 22 L15 38 L30 28" fill="none" stroke={C.acc} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ opacity: vis(frame, 39.6) }}><Mono f={F.m} size={40} color={C.ink}>×∞</Mono><Dim frame={frame} at={39.6} F={F}>каждый раз</Dim></div>
      </div>
      <Mono f={F.m} size={28} color={C.dim} style={{ marginTop: 40, opacity: sp(frame, 40.5) }}>СТРУКТУРА НАВЫКА</Mono>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
        {["Роль", "Правила", "Процесс", "Примеры", "Формат"].map((x, i) => <div key={x} style={{ opacity: vis(frame, 40.6 + i * 0.25),
          transform: `translateY(${(1 - sp(frame, 40.6 + i * 0.25, "snap")) * 30}px)`, padding: "10px 20px", borderRadius: 16, border: `2px solid ${i === 0 ? C.acc : "rgba(255,255,255,0.16)"}`,
          fontFamily: F.d, fontWeight: 800, fontSize: 40, color: C.ink }}>{x}</div>)}
      </div></>;
    }
    case "s5": {
      const k = sp(frame, 44.65, "throw");
      return <>
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start", height: 190 }}>
          {["Стратег", "Ревизор", "Редактор"].map((m, i) => <div key={i} style={{ width: 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            opacity: sp(frame, 43.6 + i * 0.25), transform: `scale(${0.6 + 0.4 * sp(frame, 43.6 + i * 0.25)})` }}>
            <div style={{ width: 120, height: 120, borderRadius: 60, background: "rgba(255,255,255,0.10)", border: "1.5px solid rgba(255,255,255,0.14)" }} />
            <Mono f={F.m} size={22} color={C.dim}>{m.toUpperCase()}</Mono></div>)}
          <div style={{ width: 150, height: 150, borderRadius: 75, background: C.acc, display: "flex", alignItems: "center", justifyContent: "center",
            transform: `translateX(${(1 - k) * 420}px) scale(${0.7 + 0.3 * k})`, opacity: vis(frame, 44.65) }}>
            <div style={{ fontFamily: F.d, fontWeight: 900, fontSize: 70, color: C.onAcc }}>C</div></div>
        </div>
        <div style={{ marginTop: 30 }}><Pill frame={frame} at={45.3} F={F} accent>Участник команды</Pill></div>
        <Dim frame={frame} at={46.7} F={F} style={{ marginTop: 22 }}>не только личный помощник</Dim>
      </>;
    }
    case "s6": return <><Hub frame={frame} F={F} />
      <Dim frame={frame} at={52.6} F={F} style={{ marginTop: 6, fontSize: 40 }}>Работает с файлами там, где они лежат</Dim>
      <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
        {["Slack", "Веб-поиск", "MCP", "API"].map((x, i) => <div key={x} style={{ opacity: vis(frame, 53.5 + i * 0.25), transform: `scale(${0.7 + 0.3 * sp(frame, 53.5 + i * 0.25, "throw")})`,
          padding: "8px 18px", borderRadius: 14, background: "rgba(255,255,255,0.08)", fontFamily: F.m, fontWeight: 700, fontSize: 30, color: C.ink }}>{x}</div>)}
      </div></>;
    case "s7": {
      const on = interpolate(frame - 57.3 * FPS, [0, 8], [0, 1], { ...clamp, easing: inOut });
      const flow = [["Триггер", 57.4], ["Claude", 57.9], ["Результат", 58.4]] as const;
      return <>
        <div style={{ display: "flex", alignItems: "center", gap: 24, opacity: vis(frame, 55.6) }}>
          <div style={{ width: 200, height: 112, borderRadius: 56, background: on > 0.5 ? C.acc : C.dot, position: "relative" }}>
            <div style={{ position: "absolute", top: 8, left: 8 + on * 88, width: 96, height: 96, borderRadius: 48, background: C.ink, boxShadow: "0 6px 16px rgba(0,0,0,0.4)" }} />
          </div>
          <Mono f={F.m} size={32} color={on > 0.5 ? C.acc : C.dim}>{on > 0.5 ? "АВТО: ВКЛ" : "АВТО: ВЫКЛ"}</Mono>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 40 }}>
          {flow.map(([x, at], i) => <React.Fragment key={x}>
            {i ? <div style={{ width: 40, height: 5, borderRadius: 3, background: t >= at ? C.acc : C.dot }} /> : null}
            <div style={{ opacity: vis(frame, at), transform: `scale(${0.7 + 0.3 * sp(frame, at, "throw")})` }}>
              <Glass frame={frame} at={at} accent={i === 1} style={{ padding: "16px 22px" }}>
                <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 42, color: i === 1 ? C.onAcc : C.ink }}>{x}</div></Glass></div>
          </React.Fragment>)}
        </div>
      </>;
    }
    case "s8": return <Terminal frame={frame} F={F} />;
    case "s9": {
      const arrow = outExpo(interpolate(frame - 69.6 * FPS, [0, 12], [0, 1], clamp));
      return <>
        <Pill frame={frame} at={67.62} F={F}>Как другие решают<br />живые задачи</Pill>
        <div style={{ height: 90, display: "flex", alignItems: "center", paddingLeft: 40 }}>
          <div style={{ width: 6, height: 70 * arrow, background: C.acc, borderRadius: 3 }} /></div>
        <Pill frame={frame} at={70.05} F={F} accent>Примените к своим</Pill>
      </>;
    }
    case "s10": {
      const cells = Array.from({ length: 12 }, (_, i) => i);
      return <>
        <Dim frame={frame} at={73.4} F={F}>Не просто пользуетесь Claude —</Dim>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginTop: 26, width: S.w }}>
          {cells.map((i) => {
            const at = 74.0 + i * 0.125;
            const k = sp(frame, at, "throw");
            return <div key={i} style={{ height: 80, borderRadius: 16, background: i % 5 === 0 ? C.acc : "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.12)",
              opacity: vis(frame, at), transform: `translateY(${(1 - k) * -120}px)` }} />;
          })}
        </div>
        <div style={{ marginTop: 26 }}><Pill frame={frame} at={75.8} F={F} accent>строите свои системы</Pill></div>
      </>;
    }
  }
  return null;
};

// ---------------------------------------------------------------- non-step scenes
const Hook: React.FC<{ frame: number; F: Fonts }> = ({ frame, F }) => {
  const t = frame / FPS;
  // pattern break at "чат" (2.37): a short shake + scale punch
  const hit = interpolate(frame - 2.37 * FPS, [0, 8], [1, 0], clamp);
  const sh = hit * 10 * Math.sin(frame * 2.7);
  const half = outExpo(interpolate(frame - 3.58 * FPS, [0, 18], [0, 1], clamp));
  // zoom-through into the flick: the frame scales up from 4.6 s (log-space dolly)
  const z = Math.pow(6, interpolate(t, [4.6, 5.0], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) }));
  return (
    <AbsoluteFill style={{ transform: `translate(${sh}px, ${sh * 0.4}px) scale(${z})`, transformOrigin: "50% 45%", opacity: interpolate(t, [4.85, 5.0], [1, 0], clamp) }}>
      <div style={{ position: "absolute", left: S.x, top: S.y + 70, width: S.w }}>
        <Rise text={"Большинство\nиспользуют Claude\nкак обычный"} f={F.d} size={92} frame={frame} at={0.0} stagger={4} />
        <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 4 }}>
          <div style={{ transform: `scale(${1 + hit * 0.25})`, transformOrigin: "0% 60%" }}><Rise text="чат" f={F.d} size={150} frame={frame} at={2.3} accent={["чат"]} /></div>
          <div style={{ opacity: vis(frame, 2.45), transform: `scale(${sp(frame, 2.45, "throw")})` }}>
            <Glass frame={frame} at={2.45} style={{ padding: "18px 26px", borderRadius: 30 }}>
              <div style={{ display: "flex", gap: 10 }}>{[0, 1, 2].map((i) => <div key={i} style={{ width: 18, height: 18, borderRadius: 9, background: C.ink,
                opacity: 0.3 + 0.7 * Math.max(0, Math.sin(t * 7 - i * 0.9)) }} />)}</div>
            </Glass>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: S.x, top: S.y + 610, width: S.w, display: "flex", alignItems: "center", gap: 34, opacity: vis(frame, 2.7) }}>
        <svg width={230} height={230} viewBox="0 0 100 100" style={{ transform: `scale(${0.6 + 0.4 * sp(frame, 2.7, "throw")})` }}>
          <circle cx={50} cy={50} r={40} fill="none" stroke={C.dot} strokeWidth={14} />
          <circle cx={50} cy={50} r={40} fill="none" stroke={C.acc} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${251 * 0.5 * half} 251`} transform="rotate(-90 50 50)" />
          <text x={50} y={58} textAnchor="middle" fontFamily={F.d} fontWeight={900} fontSize={24} fill={C.ink}>½</text>
        </svg>
        <div style={{ flex: 1 }}><Rise text={"возможностей\nмимо вас"} f={F.d} size={72} frame={frame} at={3.55} weight={800} accent={["мимо"]} /></div>
      </div>
    </AbsoluteFill>
  );
};

/** Cheat-sheet slides from the infographic (after the voice; read on pause). */
const Bonus: React.FC<{ s: Scene; frame: number; F: Fonts }> = ({ s, frame, F }) => {
  const data: Record<string, { label: string; title: string; mark: string; items: string[] }> = {
    b1: { label: "ШПАРГАЛКА 1/3 · ПАУЗА — ЧИТАЙ", title: "Частые ошибки", mark: "✕", items: ["Слишком расплывчатые запросы", "Мало контекста", "Перегрузка промпта задачами", "Нет нужного формата", "Не проверяете результат", "Нет уточняющих вопросов"] },
    b2: { label: "ШПАРГАЛКА 2/3 · ПАУЗА — ЧИТАЙ", title: "Быстрые советы", mark: "✓", items: ["Будьте конкретны", "Давайте примеры", "Разбивайте сложное на шаги", "Используйте роли", "Указывайте контекст и ограничения", "Просите 3 варианта ответа"] },
    b3: { label: "ШПАРГАЛКА 3/3", title: "Путь прокачки", mark: "", items: ["Изучи основы", "Построй систему", "Автоматизируй", "Масштабируй и создавай", "Стань экспертом"] },
  };
  const d = data[s.id];
  const path = s.id === "b3";
  return (
    <>
      <Mono f={F.m} size={28} color={C.acc} style={{ position: "absolute", left: S.x, top: S.y + 40, opacity: sp(frame, s.from) }}>{d.label}</Mono>
      <div style={{ position: "absolute", left: S.x, top: S.y + 100, width: S.w }}><Rise text={d.title} f={F.d} size={fitTitle(d.title)} frame={frame} at={s.from + 0.05} /></div>
      <div style={{ position: "absolute", left: S.x, top: S.y + 250, width: S.w }}>
        <Glass frame={frame} at={s.from + 0.15} style={{ padding: "26px 34px" }}>
          {d.items.map((x, i) => {
            const at = s.from + 0.25 + i * 0.12;
            const k = sp(frame, at, "snap");
            const last = path && i === d.items.length - 1;
            return <div key={x} style={{ display: "flex", alignItems: "center", gap: 22, padding: "13px 0", opacity: vis(frame, at), transform: `translateX(${(1 - k) * 50}px)`,
              borderTop: i ? "1.5px solid rgba(255,255,255,0.07)" : undefined }}>
              <div style={{ width: 52, height: 52, borderRadius: path ? 26 : 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: path ? (last ? C.acc : "rgba(255,255,255,0.10)") : s.id === "b1" ? "rgba(255,122,48,0.16)" : C.acc,
                fontFamily: F.m, fontWeight: 700, fontSize: 30, color: path ? (last ? C.onAcc : C.ink) : s.id === "b1" ? C.acc : C.onAcc }}>{path ? i + 1 : d.mark}</div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 46, letterSpacing: "-0.01em", color: last ? C.acc : C.ink, lineHeight: 1.12 }}>{x}</div>
            </div>;
          })}
        </Glass>
      </div>
    </>
  );
};

const Flick: React.FC<{ frame: number; F: Fonts }> = ({ frame, F }) => {
  const t = frame / FPS;
  const i = Math.max(0, Math.min(9, Math.floor((t - 5.25) / 0.25)));
  const u0 = 5.25 + i * 0.25;
  const k = sp(frame, u0 - 0.03, "snap");
  const zin = Math.pow(0.35, 1 - interpolate(t, [5.0, 5.3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })); // arrive from the zoom
  const w = t < 5.25 ? STEP_NAMES[0] : STEP_NAMES[i];
  return (
    <AbsoluteFill style={{ transform: `scale(${1 / zin})`, transformOrigin: "50% 45%" }}>
      <Mono f={F.m} size={36} color={C.dim} style={{ position: "absolute", left: S.x, top: S.y + 120 }}>ПУТЬ: НОВИЧОК → ПРОФИ</Mono>
      <div style={{ position: "absolute", left: S.x - 6, top: S.y + 200, fontFamily: F.d, fontWeight: 900, fontSize: 230, color: C.acc, letterSpacing: "-0.05em", lineHeight: 1 }}>
        {i + 1}<span style={{ fontSize: 96, color: C.dim, letterSpacing: "-0.02em" }}>/10</span></div>
      <div style={{ position: "absolute", left: S.x, top: S.y + 500, width: S.w, fontFamily: F.d, fontWeight: 900, fontSize: w.length > 10 ? 110 : 140, color: C.ink,
        letterSpacing: "-0.04em", transform: `scale(${1 + 0.16 * (1 - k)})`, transformOrigin: "0% 50%", whiteSpace: "nowrap" }}>{w}</div>
      <div style={{ position: "absolute", left: S.x, top: S.y + 720, width: S.w, display: "flex", gap: 10 }}>
        {Array.from({ length: 10 }, (_, j) => <div key={j} style={{ flex: 1, height: 10, borderRadius: 5, background: j <= i && t >= 5.25 ? C.acc : C.dot }} />)}</div>
    </AbsoluteFill>
  );
};

const Save: React.FC<{ frame: number; F: Fonts }> = ({ frame, F }) => {
  const k = sp(frame, 77.85, "throw");
  const fillP = outExpo(interpolate(frame - 77.9 * FPS, [0, 14], [0, 1], clamp));
  return (
    <>
      <Progress step={10} frame={frame} from={70} />
      <div style={{ position: "absolute", left: S.x, top: S.y + 150, transform: `translateY(${(1 - k) * -200}px) rotate(${(1 - k) * 12}deg)`, opacity: vis(frame, 77.6) }}>
        <svg width={230} height={290} viewBox="0 0 46 58">
          <defs><clipPath id="bm"><path d="M4 2 H42 V56 L23 42 L4 56 Z" /></clipPath></defs>
          <path d="M4 2 H42 V56 L23 42 L4 56 Z" fill="none" stroke={C.acc} strokeWidth={3.5} strokeLinejoin="round" />
          <rect x={0} y={58 - 58 * fillP} width={46} height={58} fill={C.acc} clipPath="url(#bm)" />
        </svg>
      </div>
      <div style={{ position: "absolute", left: S.x, top: S.y + 500, width: S.w }}>
        <Rise text="Сохраните" f={F.d} size={150} frame={frame} at={77.8} accent={["Сохраните"]} />
        <div style={{ marginTop: 20 }}><Dim frame={frame} at={78.5} F={F}>чтобы пройти путь шаг за шагом</Dim></div>
      </div>
    </>
  );
};

const End: React.FC<{ frame: number; F: Fonts; start: number }> = ({ frame, F, start }) => {
  const nick = "t.me/iishka26";
  return (
    <>
      <div style={{ position: "absolute", left: S.x, top: 560, width: S.w, textAlign: "center" }}>
        <Dim frame={frame} at={start + 0.1} F={F} style={{ fontSize: 52 }}>Больше — в Telegram-канале</Dim>
      </div>
      <div style={{ position: "absolute", left: S.x, top: 690, width: S.w, display: "flex", justifyContent: "center" }}>
        {nick.split("").map((ch, i) => {
          const k = sp(frame, start + 0.3 + i * 0.035, "throw");
          return <span key={i} style={{ display: "inline-block", fontFamily: F.d, fontWeight: 900, fontSize: 104, letterSpacing: "-0.03em", color: C.acc,
            transform: `translateY(${(1 - k) * 120}px) scale(${0.5 + 0.5 * k})`, opacity: vis(frame, start + 0.3 + i * 0.035) }}>{ch}</span>;
        })}
      </div>
      <div style={{ position: "absolute", left: S.x, top: 880, width: S.w, display: "flex", justifyContent: "center" }}>
        <div style={{ transform: `scale(${1 + beatPulse(frame) * 0.04})` }}><Pill frame={frame} at={start + 1.0} F={F} accent>Подпишись!</Pill></div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------- captions: phrase chunks, the spoken word pops in accent
const Captions: React.FC<{ words: Word[]; frame: number; F: Fonts; until: number }> = ({ words, frame, F, until }) => {
  const t = frame / FPS;
  if (t >= until) return null;
  const chunks = React.useMemo(() => buildChunks(words, 4, 24), [words]);
  const ch = chunks.find((c) => t >= c.words[0].start - 0.05 && t < (c.words[c.words.length - 1].end + 0.25)) ;
  if (!ch) return null;
  const k0 = sp(frame, ch.words[0].start - 0.08, "snap");
  return (
    <div style={{ position: "absolute", left: S.x, top: 1196, width: S.w, display: "flex", opacity: k0, transform: `translateY(${(1 - k0) * 20}px)` }}>
      <div style={{ padding: "14px 26px", borderRadius: 24, background: "rgba(14,14,16,0.72)", border: "1.5px solid rgba(255,255,255,0.10)", backdropFilter: "blur(14px)",
        fontFamily: F.d, fontWeight: 800, fontSize: 58, letterSpacing: "-0.01em", lineHeight: 1.15, maxWidth: S.w }}>
        {ch.words.map((w, i) => {
          const on = t >= w.start;
          const cur = on && (i === ch.words.length - 1 || t < ch.words[i + 1].start);
          const kp = sp(frame, w.start, "snap");
          return <span key={i} style={{ display: "inline-block", marginRight: 14, color: cur ? C.acc : on ? C.ink : "rgba(242,239,233,0.35)",
            transform: cur ? `scale(${1 + 0.1 * (1 - kp)})` : undefined }}>{w.text}</span>;
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- frame
const Backdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame / FPS;
  const off = (t * 22) % 54;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: -60, backgroundImage: `radial-gradient(${C.dot} 2.4px, transparent 2.9px)`, backgroundSize: "54px 54px",
        transform: `translate(${-off * 0.5}px, ${off}px)` }} />
      <div style={{ position: "absolute", width: 900, height: 900, left: 420 + Math.sin(t * 0.21) * 60, top: -380, borderRadius: 450,
        background: "radial-gradient(circle, rgba(255,122,48,0.13), transparent 65%)" }} />
    </AbsoluteFill>
  );
};
const Grain: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.07, mixBlendMode: "screen" }}>
    <svg width="1080" height="1920"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(hash(frame) * 1000)} /></filter>
      <rect width="1080" height="1920" filter="url(#g)" /></svg>
  </AbsoluteFill>
);

const SceneView: React.FC<{ s: Scene; frame: number; F: Fonts; voiceEnd: number }> = ({ s, frame, F, voiceEnd }) => {
  if (s.id === "hook") return <Hook frame={frame} F={F} />;
  if (s.id === "flick") return <Flick frame={frame} F={F} />;
  if (s.id === "save") return <Save frame={frame} F={F} />;
  if (s.id.startsWith("b")) return <Bonus s={s} frame={frame} F={F} />;
  if (s.id === "end") return <End frame={frame} F={F} start={s.from} />;
  return (
    <>
      <StepHead s={s} frame={frame} F={F} />
      <div style={{ position: "absolute", left: S.x, top: AREA, width: S.w }}><StepBody s={s} frame={frame} F={F} /></div>
    </>
  );
};

export const ReelClaudeMapV2: React.FC<ReelKitProps> = (p) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const F: Fonts = {
    d: brandFont({ family: "Inter Display", source: "local", files: ["fonts/InterDisplay-Medium.otf", "fonts/InterDisplay-Bold.otf", "fonts/InterDisplay-ExtraBold.otf", "fonts/InterDisplay-Black.otf"] }),
    m: brandFont({ family: "DejaVu Sans Mono", source: "local", files: ["fonts/DejaVuSansMono-Bold.ttf"] }),
  };
  const voiceEnd = p.captions.duration;
  // push transition: outgoing slides left while incoming comes from the right, both on screen, with a speed blur.
  // Not used where the hook zooms through into the flick (5.0 s).
  const idx = SCENES.findIndex((s) => t >= s.from && t < s.to);
  const cur = SCENES[Math.max(0, idx)];
  const next = SCENES[idx + 1];
  const layers: { s: Scene; x: number; blur: number }[] = [];
  const pushIn = (s: Scene) => {
    const f = frame - s.from * FPS; // centered push: from -PUSH/2 to +PUSH/2
    return interpolate(f, [-PUSH / 2, PUSH / 2], [0, 1], { ...clamp, easing: inOut });
  };
  const usesPush = (s: Scene | undefined) => !!s && s.id !== "flick";
  if (next && usesPush(next) && frame >= next.from * FPS - PUSH / 2) {
    const p2 = pushIn(next);
    const v = Math.sin(Math.PI * p2) * 14;
    layers.push({ s: cur, x: -1080 * p2, blur: v }, { s: next, x: 1080 * (1 - p2), blur: v });
  } else if (usesPush(cur) && idx > 0 && frame < cur.from * FPS + PUSH / 2) {
    const p2 = pushIn(cur);
    const v = Math.sin(Math.PI * p2) * 14;
    layers.push({ s: SCENES[idx - 1], x: -1080 * p2, blur: v }, { s: cur, x: 1080 * (1 - p2), blur: v });
  } else layers.push({ s: cur, x: 0, blur: 0 });
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Audio src={staticFile(p.video)} />
      <Backdrop frame={frame} />
      {layers.map((l) => (
        <AbsoluteFill key={l.s.id} style={{ transform: `translateX(${l.x}px)`, filter: l.blur > 0.5 ? `blur(${l.blur.toFixed(1)}px)` : undefined }}>
          <SceneView s={l.s} frame={frame} F={F} voiceEnd={voiceEnd} />
        </AbsoluteFill>
      ))}
      <Captions words={p.captions.words} frame={frame} F={F} until={voiceEnd} />
      <Grain frame={frame} />
    </AbsoluteFill>
  );
};
