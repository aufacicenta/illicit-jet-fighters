import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/Auth/useAuth";
import { routes } from "../../hooks/useRoutes";
import { cn } from "../../lib/utils";

type CreateFighterGridCellProps = {
  className?: string;
};

export const CreateFighterGridCell = ({ className }: CreateFighterGridCellProps) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleClick = () => {
    navigate(isAuthenticated ? routes.createFighter() : routes.signup());
  };

  return (
    <button
      className={cn(
        "group relative aspect-square w-[calc(50%-0.375rem)] shrink-0 overflow-hidden rounded-sm border border-dashed border-border/90 bg-muted/20 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.5625rem)] lg:w-[calc(20%-0.6rem)] xl:w-[calc(16.666%-0.625rem)]",
        className,
      )}
      onClick={handleClick}
      type="button"
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <span className="font-pixel text-5xl text-muted-foreground transition-colors group-hover:text-primary">
          ?
        </span>
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-foreground uppercase">
            Create Your Fighter
          </p>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
            {isAuthenticated ? "Start intake" : "Sign up to begin"}
          </p>
        </div>
      </div>
    </button>
  );
};
