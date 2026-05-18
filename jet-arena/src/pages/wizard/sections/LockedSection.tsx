import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

export const LockedSection = ({ title }: { title: string }) => (
  <Card className="opacity-60">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-slate-400">Complete previous sections to unlock this step.</p>
    </CardContent>
  </Card>
);
