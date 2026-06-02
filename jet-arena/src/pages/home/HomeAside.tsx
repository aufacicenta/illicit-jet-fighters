import { homeAsideNavItems, type HomeAsideSection } from "./types";

type HomeAsideProps = {
  activeSection: HomeAsideSection;
  onSectionChange: (section: HomeAsideSection) => void;
};

export const HomeAside = ({ activeSection, onSectionChange }: HomeAsideProps) => (
  <aside className="w-full space-y-3 lg:sticky lg:top-6 lg:w-[260px] lg:shrink-0">
    <div className="border-border/80 bg-card/70">
      {homeAsideNavItems.map((item) => {
        const isActive = activeSection === item.id;

        return (
          <button
            key={item.id}
            className={`flex w-full items-center gap-2 rounded-sm border px-2.5 py-2 text-left text-xs tracking-wide uppercase transition-colors ${
              isActive
                ? "border-secondary bg-secondary/10 text-foreground"
                : "border-border/70 bg-background hover:border-border hover:bg-muted/60"
            }`}
            onClick={() => onSectionChange(item.id)}
            type="button"
          >
            <span
              className={`size-1.5 shrink-0 rounded-full ${isActive ? "bg-secondary" : "bg-muted"}`}
            />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  </aside>
);
