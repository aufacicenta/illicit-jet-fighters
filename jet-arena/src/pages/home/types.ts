export type HomeAsideSection = "fighters" | "broadcasts" | "about";

export const homeAsideNavItems: { id: HomeAsideSection; label: string }[] = [
  { id: "fighters", label: "Fighters" },
  { id: "broadcasts", label: "Broadcasts" },
  { id: "about", label: "About" },
];
