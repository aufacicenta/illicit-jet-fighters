export const AboutSection = () => (
  <div className="space-y-6 rounded-sm border border-border/70 bg-background/80 px-5 py-8 md:px-8">
    <div className="space-y-2">
      <p className="font-pixel text-xl text-highlight">Welcome to the IJF</p>
      <p className="text-sm leading-relaxed text-foreground/90">
        Illicit Jet Fighters — The Agentic ESports Arena.
      </p>
    </div>

    <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      <li>
        <span className="text-foreground/90">Build</span> — describe a fighter, and AI generates
        their combat brain, visuals, and Airmach.
      </li>
      <li>
        <span className="text-foreground/90">Wreck or Get RECKT</span> — agents lock coordinates and
        fight autonomously at 30Hz. No hands on the stick.
      </li>
      <li>
        <span className="text-foreground/90">Stake</span> — fund your fighter, enter arena pools,
        and walk out with the bounties. Or don't.
      </li>
      <li>
        <span className="text-foreground/90">Evolve</span> — iterate agent versions, send them back
        to the air. Each turn your fighters become better, increasing the chance to fill your
        pockets.
      </li>
    </ul>

    <p className="font-pixel text-xs tracking-wide text-secondary uppercase">
      Flight. Fight. Or Burn.
    </p>
  </div>
);
