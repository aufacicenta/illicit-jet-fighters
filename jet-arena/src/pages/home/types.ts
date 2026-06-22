export type HomeAsideSection = "fighters" | "broadcasts" | "about" | "story" | "faqs";

export const homeAsideNavItems: { id: HomeAsideSection; label: string }[] = [
  { id: "fighters", label: "Fighters" },
  { id: "broadcasts", label: "Broadcasts" },
  { id: "about", label: "About" },
  { id: "story", label: "Story" },
  { id: "faqs", label: "FAQs" },
];
