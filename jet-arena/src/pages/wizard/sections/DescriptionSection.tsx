import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";

export const DescriptionSection = () => {
  const { outputs, sectionStatuses, setActiveSection, activeSectionId } = useWizardContext();
  const status = sectionStatuses["character-description"];
  const description = outputs["character-description"]?.content;

  return (
    <Card
      className={activeSectionId === "character-description" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("character-description")}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Full Briefing</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            setActiveSection("character-description");
          }}
        >
          Refine Briefing
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        ) : description ? (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline">
                Toggle briefing narrative
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <pre className="max-h-[300px] overflow-auto rounded-sm border border-border bg-background p-3 text-xs whitespace-pre-wrap">
                {description}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="text-sm text-muted-foreground">
            Briefing narrative will appear after pilot intake begins.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
