import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";

const parseNameAndEpithet = (markdown: string | undefined) => {
  if (!markdown) {
    return { name: "Unnamed Pilot", epithet: null as string | null };
  }

  const nameMatch = markdown.match(/^#\s+(.+)$/m);
  const quoteMatch = markdown.match(/^>\s+"?(.+?)"?$/m);

  return {
    name: nameMatch?.[1]?.trim() || "Unnamed Pilot",
    epithet: quoteMatch?.[1]?.trim() || null,
  };
};

export const SpecsheetSection = () => {
  const { outputs, sectionStatuses, activeSectionId, setActiveSection } = useWizardContext();

  const imageOutput = outputs["specsheet-image"];
  const imageStatus = sectionStatuses["specsheet-image"];
  const { name, epithet } = parseNameAndEpithet(outputs["character-description"]?.content);

  return (
    <Card
      className={activeSectionId === "specsheet-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("specsheet-image")}
    >
      <CardHeader className="space-y-2">
        <CardTitle>Pilot Specsheet</CardTitle>
        <div className="space-y-1">
          <p className="text-base font-bold tracking-wide text-foreground uppercase">{name}</p>
          {epithet ? (
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{epithet}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {imageStatus === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-4 w-4/12" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated specsheet"
            className="max-h-[700px] w-full rounded-sm border border-border bg-background object-contain"
            src={imageOutput.assetUrl ?? imageOutput.content}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Specsheet image will appear here after generation.
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            setActiveSection("specsheet-image");
          }}
        >
          Refine visual output
        </Button>
      </CardContent>
    </Card>
  );
};
