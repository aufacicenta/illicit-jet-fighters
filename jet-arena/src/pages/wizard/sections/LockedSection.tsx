import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const LockedSection = ({ title }: { title: string }) => (
  <Card className="opacity-60">
    <CardHeader className={wizardCardHeaderClassName}>
      <WizardCardTitle>{title}</WizardCardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-slate-400">Complete previous sections to unlock this step.</p>
    </CardContent>
  </Card>
);
