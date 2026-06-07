import { useState } from "react";

import { Navbar } from "../components/Navbar";
import {
  CockpitStatScreens,
  CockpitTopCenterSlot,
  RTLScrollEffect,
} from "../components/Navbar/CockpitStatScreens";
import { AboutSection } from "./home/AboutSection";
import { BroadcastsSection } from "./home/BroadcastsSection";
import { FightersSection } from "./home/FightersSection";
import { HomeAside } from "./home/HomeAside";
import { StorySection } from "./home/StorySection";
import type { HomeAsideSection } from "./home/types";

export const HomePage = () => {
  const [activeAsideSection, setActiveAsideSection] = useState<HomeAsideSection>("fighters");

  const renderSection = () => {
    if (activeAsideSection === "fighters") {
      return <FightersSection />;
    }

    if (activeAsideSection === "broadcasts") {
      return <BroadcastsSection />;
    }

    if (activeAsideSection === "story") {
      return <StorySection />;
    }

    return <AboutSection />;
  };

  return (
    <>
      <Navbar />

      <CockpitStatScreens>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="font-pixel text-2xl">Choose Your Fighter</p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
      </CockpitStatScreens>

      <main className="page-with-navbar-offset page-with-screen-bottom-offset mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-10 md:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <section className="w-full min-w-0 flex-1">{renderSection()}</section>

          <HomeAside activeSection={activeAsideSection} onSectionChange={setActiveAsideSection} />
        </div>
      </main>
    </>
  );
};
