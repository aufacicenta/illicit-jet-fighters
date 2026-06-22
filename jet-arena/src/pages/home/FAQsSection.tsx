import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { WizardCardTitle } from "../wizard/sections/WizardCardTitle";

type Faq = {
  question: string;
  answer: ReactNode;
};

type FaqSection = {
  title: string;
  faqs: Faq[];
};

const faqSections: FaqSection[] = [
  {
    title: "Funds & Wallet",
    faqs: [
      {
        question: "How do I get started and add funds?",
        answer:
          "Deposit SUI to the custodial wallet address shown on your wallet page. Once it lands, top up any fighter from that balance to make it battle-ready, then queue it into an arena pool.",
      },
      {
        question: "Can I withdraw my funds at any time?",
        answer:
          "Yes. Any unlocked balance withdraws to your own address anytime. Only funds actively staked in an arena pool are temporarily locked.",
      },
      {
        question: "How do I move funds back to my wallet?",
        answer:
          "Unlock any arena stake, withdraw fighter funds to your owner wallet, then cash out to any external address — instantly, no waiting period.",
      },
      {
        question: "Are my funds safe while they're on the platform?",
        answer:
          "Your balance lives in a dedicated custodial wallet tied to your account. You can withdraw any unlocked balance to your own address whenever you want — funds only move when you act: staking, withdrawing, or paying a generation fee.",
      },
      {
        question: "What fees do you charge, and why?",
        answer:
          "A 20% platform fee shows on every withdrawal in your ledger. SUI gas and AI compute are paid by you separately — transparent, verifiable, no hidden charges.",
      },
      {
        question: "Which blockchain network are you on?",
        answer:
          "Fighters and balances run on SUI. Deposits, withdrawals and fees settle in SUI's native token for fast, low-cost on-chain transactions.",
      },
      {
        question: "Are there any lockups or holding periods?",
        answer:
          "No. Beyond active arena stakes, nothing is held. Deposit, generate, and withdraw on your own schedule — your funds stay under your control.",
      },
    ],
  },
  {
    title: "Arena & Battles",
    faqs: [
      {
        question: "What happens to funds staked in the arena?",
        answer:
          "Staked funds are locked only during battle. Unlock them afterward and they return to your available balance, ready to withdraw.",
      },
      {
        question: "What do I win if my fighter wins a battle?",
        answer:
          "Each battle has a single winner who takes the whole pot. Your stake comes back and you collect every other fighter's stake on top — so a 1v1 win doubles your stake, and a Squad or World War win sweeps the entire pool. If a match ends in a draw, every fighter's stake is simply returned. Winnings land in your fighter's available balance, ready to redeploy or withdraw.",
      },
      {
        question: "What happens to my stake if my fighter loses?",
        answer:
          "If your fighter loses, its staked amount is transferred to the winner — that stake is gone. Only the amount you put on the line is ever at risk; your unstaked balance is never touched. Stake amounts you're comfortable losing.",
      },
      {
        question: "What battle modes can I play?",
        answer:
          "Four modes: 1v1 (you versus one opponent), Squad 4 and Squad 8 (team battles of 4 or 8 fighters), and World War (large-scale fights of 8 to 16 fighters). Pools also group by stake, so you only face fighters wagering the same amount.",
      },
      {
        question: "How is the winner of a battle decided?",
        answer: (
          <>
            <strong className="text-foreground">
              A fighter wins by being the last one flying and having landed at least one effective
              hit on an enemy.
            </strong>{" "}
            Rivals can be knocked out by your fire, by running out of fuel, or by collisions — but
            landing effective hits is what earns the win. If a fighter outlasts everyone without
            ever landing a hit, the match has no winner and all stakes are returned. When time runs
            out with multiple fighters still alive, the winner is the one in the best shape — most
            health, then fuel, then ammo — provided they've landed an effective hit.
          </>
        ),
      },
      {
        question: "How long does a battle last?",
        answer:
          "Every battle runs a fixed length of 5,400 simulation ticks, identical for all fighters. The match is settled the moment that clock runs out, so outcomes are deterministic and repeatable — no battle drags on indefinitely.",
      },
      {
        question: "How are opponents matched, and are battles fair?",
        answer: (
          <>
            Matchmaking is currently first-in, first-served: your fighter is paired with the next
            available opponent in the same stake pool and battle mode, regardless of their combat
            brain level.{" "}
            <strong className="text-foreground">
              Combat brain code quality comes even from generation V1, as it depends on the quality
              of the initial debrief prompt.
            </strong>{" "}
            A sharp first briefing can outfight a fighter that's been iterated many times.
          </>
        ),
      },
    ],
  },
  {
    title: "Fighters & Generation",
    faqs: [
      {
        question: "How are fighters generated?",
        answer:
          "You describe a fighter; AI generates its combat brain, visuals, and Airmach. Iterate versions anytime to evolve a stronger agent.",
      },
      {
        question: "Can I improve my fighter, and which version battles?",
        answer:
          "Yes. Each time you regenerate your combat brain it's saved as a new version (v1, v2, v3…) and older versions are kept. In the arena your fighter battles with its latest version by default, or you can pin a specific version for a match.",
      },
      {
        question: "What does it cost to generate a fighter?",
        answer:
          "Each AI generation — combat brain, visuals and Airmach — charges a small fee in the network's native token at the time of creation.",
      },
    ],
  },
  {
    title: "Ownership & Support",
    faqs: [
      {
        question: "Who owns my generated assets?",
        answer:
          "You do. You own all generation assets — images, fighter visuals, agent code generations and training data tied to your fighters.",
      },
      {
        question: "Can I keep my agent code and training data?",
        answer:
          "Yes. Your agent code generations and training data are yours to export and reuse. Ownership stays with you, not the platform.",
      },
      {
        question: "What if something goes wrong — how do I get support?",
        answer:
          "Every deposit, withdrawal, stake, payout and generation fee is recorded in your ledger with a reference you can point to. If something doesn't resolve as expected, reach out to support and we'll trace it from your ledger history.",
      },
    ],
  },
];

export const FAQsSection = () => (
  <Card>
    <CardHeader className="space-y-1">
      <WizardCardTitle>Frequently Asked</WizardCardTitle>
      <p className="text-xs text-muted-foreground">
        Your funds, your fighters, your assets — here's how it works.
      </p>
    </CardHeader>
    <CardContent className="space-y-8 p-4">
      {faqSections.map((section) => (
        <section className="space-y-4" key={section.title}>
          <h2 className="font-semibold tracking-wider text-highlight uppercase">{section.title}</h2>
          <ul className="space-y-5 text-sm leading-relaxed">
            {section.faqs.map((faq) => (
              <li className="space-y-1" key={faq.question}>
                <p className="text-foreground/90">{faq.question}</p>
                <p className="text-muted-foreground">{faq.answer}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </CardContent>
  </Card>
);
