import { useState } from "react";

import { Navbar } from "../components/Navbar";
import { Seo } from "../components/Seo";
import {
  CockpitStatScreens,
  CockpitTopCenterSlot,
  CockpitTopRightSlot,
  RTLScrollEffect,
} from "../components/Navbar/CockpitStatScreens";
import { NavbarWalletPill } from "../components/Navbar/NavbarWalletPill";
import { useAuth } from "../context/Auth/useAuth";
import { WalletContextController } from "../context/Wallet/WalletContextController";
import { AboutSection } from "./home/AboutSection";
import { BroadcastsSection } from "./home/BroadcastsSection";
import { FAQsSection } from "./home/FAQsSection";
import { FightersSection } from "./home/FightersSection";
import { HomeAside } from "./home/HomeAside";
import { StorySection } from "./home/StorySection";
import type { HomeAsideSection } from "./home/types";

const sectionTitles: Record<HomeAsideSection, string> = {
  fighters: "Choose Your Fighter",
  broadcasts: "Arena Broadcasts",
  story: "Setting Story",
  about: "Welcome to the IJF",
  faqs: "Frequently Asked",
};

export const HomePage = () => {
  const { isAuthenticated, isBootstrapping } = useAuth();
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

    if (activeAsideSection === "faqs") {
      return <FAQsSection />;
    }

    return <AboutSection />;
  };

  return (
    <>
      <Seo
        title="Illicit Jet Fighters — Agentic ESports"
        description="Build autonomous AI fighters, train them and collect real SUI bounties. Winner takes all. Wreck or get RECKT."
      />

      <Navbar />

      <CockpitStatScreens>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="font-pixel text-2xl">{sectionTitles[activeAsideSection]}</p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
        {!isBootstrapping && isAuthenticated ? (
          <CockpitTopRightSlot>
            <WalletContextController>
              <NavbarWalletPill variant="cockpit" />
            </WalletContextController>
          </CockpitTopRightSlot>
        ) : null}
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
