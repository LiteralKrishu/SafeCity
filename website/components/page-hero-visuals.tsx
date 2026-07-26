import { Icon } from "./icons";

export function FeaturesHeroVisual() {
  const modules = [
    ["audio", "SENSE", "Audio intelligence", "LOCAL"],
    ["motion", "VERIFY", "Signal fusion", "READY"],
    ["route", "NAVIGATE", "Route context", "VISIBLE"],
    ["voice", "EXIT", "Escape tools", "ARMED"],
  ] as const;

  return (
    <div className="features-hero-visual" aria-hidden="true">
      <div className="rich-hero-orbit rich-orbit-one" />
      <div className="rich-hero-orbit rich-orbit-two" />
      <div className="features-console">
        <div className="features-console-head">
          <span><Icon name="shield" /></span>
          <div>
            <small>SAFECITY · PROTECTION SUITE</small>
            <strong>Four tools. One control layer.</strong>
          </div>
          <b><i /> LIVE</b>
        </div>
        <div className="features-console-grid">
          {modules.map(([icon, label, title, state]) => (
            <div className="features-console-module" key={label}>
              <span><Icon name={icon} /></span>
              <small>{label}</small>
              <strong>{title}</strong>
              <b>{state}</b>
            </div>
          ))}
        </div>
        <div className="features-console-foot">
          <Icon name="lock" />
          <span><small>INCIDENT EVIDENCE</small>Encrypted only after confirmation</span>
          <Icon name="chevron" />
        </div>
      </div>
      <div className="rich-hero-float feature-float-top">
        <Icon name="device" />
        <span><small>PRIMARY INFERENCE</small>On your phone</span>
      </div>
      <div className="rich-hero-float feature-float-bottom">
        <Icon name="check" />
        <span><small>FINAL DECISION</small>Still yours</span>
      </div>
    </div>
  );
}

export function FlowHeroVisual() {
  const stages = [
    ["device", "01", "Start", "You opt in"],
    ["audio", "02", "Sense", "Short signals"],
    ["motion", "03", "Verify", "Evidence agrees"],
    ["timer", "04", "Check in", "Time to cancel"],
    ["message", "05", "Act", "You press send"],
  ] as const;

  return (
    <div className="flow-hero-visual" aria-hidden="true">
      <div className="flow-hero-glow" />
      <div className="flow-hero-track">
        <div className="flow-hero-track-head">
          <span>VISIBLE SAFETY FLOW</span>
          <b>HUMAN IN THE LOOP</b>
        </div>
        <div className="flow-hero-steps">
          {stages.map(([icon, number, title, state], index) => (
            <div className="flow-hero-step" key={number}>
              <span>{number}</span>
              <i><Icon name={icon} /></i>
              <p><strong>{title}</strong><small>{state}</small></p>
              <b className={index === stages.length - 1 ? "is-final" : ""}>
                {index === stages.length - 1 ? "USER ACTION" : "LOCAL"}
              </b>
            </div>
          ))}
        </div>
        <div className="flow-hero-boundary">
          <Icon name="shield" />
          Context supports a decision. It never creates one.
        </div>
      </div>
      <div className="rich-hero-float flow-float">
        <Icon name="eyeOff" />
        <span><small>ORDINARY WINDOWS</small>Discarded</span>
      </div>
    </div>
  );
}

export function TrustHeroVisual() {
  const badges = [
    ["trust-badge-a", "check", "TWO SIGNALS", "Ordinary SOS"],
    ["trust-badge-b", "lock", "LOCAL FIRST", "Private by design"],
    ["trust-badge-c", "spark", "VISIBLE LIMITS", "No mystery score"],
    ["trust-badge-d", "device", "USER CONTROL", "Cancel · delete"],
  ] as const;

  return (
    <div className="trust-hero-visual" aria-hidden="true">
      <div className="trust-hero-ring trust-ring-one" />
      <div className="trust-hero-ring trust-ring-two" />
      <div className="trust-hero-scan" />
      <div className="trust-hero-core">
        <span><Icon name="shield" /></span>
        <small>SAFETY STANDARD</small>
        <strong>Assist,<br />never promise</strong>
        <i>01 / 04</i>
      </div>
      {badges.map(([className, icon, label, value]) => (
        <div className={`trust-hero-badge ${className}`} key={label}>
          <span><Icon name={icon} /></span>
          <p><small>{label}</small>{value}</p>
        </div>
      ))}
      <div className="trust-hero-warning">
        <i />
        Safety tool · Not an emergency service
      </div>
    </div>
  );
}
