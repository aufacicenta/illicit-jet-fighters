import { TypingEffect } from "./CockpitStatScreens";

type CockpitErrorProps = {
  message: string | null | undefined;
};

export const CockpitError = ({ message }: CockpitErrorProps) => {
  if (!message) {
    return null;
  }

  return (
    <TypingEffect revision={message.length}>
      <p className="px-2 text-xs leading-snug text-destructive normal-case" role="alert">
        {message}
      </p>
    </TypingEffect>
  );
};
