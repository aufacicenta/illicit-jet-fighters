export type SettingStorySegment = {
  text: string;
  className?: string;
  delayMs?: number;
};

export const settingStorySegments: SettingStorySegment[] = [
  {
    text: "2187\n\n",
    delayMs: 500,
  },
  {
    text: "Wazscania fractured Earth into combat zones.\n\n",
  },
  {
    text: "The IJF emerged.\n\n",
    delayMs: 150,
  },
  {
    text: "A network of bounty contractors, midflight in-cockpit, midflight in exchange.\n\n",
  },
  {
    text: "Each hunter flies an Airmach.\n\n",
    delayMs: 120,
  },
  {
    text: "Part fighter jet, ",
    delayMs: 90,
  },
  {
    text: "part expression of identity",
    delayMs: 112,
  },
  {
    text: ".",
    delayMs: 1500,
  },
];

export const settingStoryTextLength = settingStorySegments.reduce(
  (length, segment) => length + segment.text.length,
  0,
);
