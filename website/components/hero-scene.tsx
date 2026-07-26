"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Icon } from "./icons";

export function HeroScene() {
  const scene = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: -4, y: 7 });

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const box = scene.current?.getBoundingClientRect();
    if (!box) return;
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    setTilt({ x: y * -8, y: x * 12 });
  }

  return (
    <div
      aria-label="SafeCity monitoring interface illustration"
      className="hero-scene"
      onPointerLeave={() => setTilt({ x: -4, y: 7 })}
      onPointerMove={onMove}
      ref={scene}
      role="img"
    >
      <div className="scene-grid" />
      <div className="scene-orbit scene-orbit-one" />
      <div className="scene-orbit scene-orbit-two" />
      <div className="scene-pulse" />
      <div
        className="phone-shell"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(-2deg)`,
        }}
      >
        <div className="phone-top">
          <span>9:41</span>
          <span className="phone-island" />
          <span>•••</span>
        </div>
        <div className="phone-brand">
          <span className="phone-logo">
            <Icon name="shield" />
          </span>
          <span>
            <small>SAFECITY</small>
            Protection active
          </span>
          <i />
        </div>
        <div className="signal-card">
          <div className="signal-head">
            <span>
              <i />
              Live on-device check
            </span>
            <b>PRIVATE</b>
          </div>
          <div className="signal-visual">
            {Array.from({ length: 24 }).map((_, index) => (
              <i
                key={index}
                style={{ "--bar": `${18 + ((index * 17) % 56)}%` } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="signal-meta">
            <span>
              <small>Audio</small>
              Ready
            </span>
            <span>
              <small>Motion</small>
              Ready
            </span>
            <span>
              <small>Cloud</small>
              None
            </span>
          </div>
        </div>
        <div className="safe-state">
          <span className="safe-state-icon">
            <Icon name="shield" />
          </span>
          <span>
            <small>CURRENT STATE</small>
            All systems calm
          </span>
        </div>
        <button tabIndex={-1} type="button">
          Hold for SOS
        </button>
        <p>Audio windows stay in volatile memory.</p>
      </div>
      <div className="floating-card floating-card-one">
        <span>
          <Icon name="lock" />
        </span>
        <small>Inference</small>
        On your phone
      </div>
      <div className="floating-card floating-card-two">
        <span>
          <Icon name="route" />
        </span>
        <small>Safety route</small>
        Ready when needed
      </div>
    </div>
  );
}
