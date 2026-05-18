import { useWizardContext } from "../../context/Wizard/useWizardContext";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Separator } from "../../components/ui/separator";

type FileDescriptor = {
  fileName: string;
  sectionId: "character-description" | "specsheet-prompt" | "specsheet-image";
  kind: "markdown" | "image";
};

const files: FileDescriptor[] = [
  {
    fileName: "character-description.md",
    sectionId: "character-description",
    kind: "markdown",
  },
  { fileName: "specsheet-gen.md", sectionId: "specsheet-prompt", kind: "markdown" },
  { fileName: "specsheet.jpeg", sectionId: "specsheet-image", kind: "image" },
];

export const PreviewPanel = () => {
  const { outputs, sectionStatuses, setActiveSection } = useWizardContext();

  return (
    <Card className="h-[calc(100vh-210px)]">
      <CardHeader>
        <CardTitle>Character File Bundle</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-86px)] p-0">
        <ScrollArea className="h-full px-5 pb-5">
          <div className="space-y-4">
            {files.map((file) => {
              const output = outputs[file.sectionId];
              const status = sectionStatuses[file.sectionId];

              return (
                <div key={file.fileName} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      className="text-left text-sm font-medium text-slate-100 hover:text-sky-300"
                      onClick={() => setActiveSection(file.sectionId)}
                      type="button"
                    >
                      {file.fileName}
                    </button>
                    <Badge variant={status === "complete" ? "default" : "outline"}>{status}</Badge>
                  </div>
                  {file.kind === "image" ? (
                    output ? (
                      <img
                        alt={file.fileName}
                        className="max-h-40 w-full rounded-md border border-slate-800 object-contain"
                        src={output.content}
                      />
                    ) : (
                      <p className="text-xs text-slate-500">Pending generation.</p>
                    )
                  ) : output ? (
                    <pre className="max-h-40 overflow-auto rounded-md bg-slate-900 p-2 text-xs whitespace-pre-wrap">
                      {output.content}
                    </pre>
                  ) : (
                    <p className="text-xs text-slate-500">Pending generation.</p>
                  )}
                  {output ? (
                    <a
                      className="inline-flex h-8 items-center rounded-md border border-slate-700 px-3 text-xs text-slate-100 hover:bg-slate-800"
                      download={file.fileName}
                      href={output.content}
                    >
                      Download
                    </a>
                  ) : null}
                  <Separator />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
