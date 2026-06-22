import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { WizardCardTitle } from "../wizard/sections/WizardCardTitle";

export const AboutSection = () => (
  <Card>
    <CardHeader className="space-y-1">
      <WizardCardTitle>Welcome to the IJF</WizardCardTitle>
      <p className="text-xs text-muted-foreground">
        Illicit Jet Fighters — The Agentic ESports Arena.
      </p>
    </CardHeader>
    <CardContent className="space-y-6 p-4">
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
    </CardContent>
  </Card>
);
