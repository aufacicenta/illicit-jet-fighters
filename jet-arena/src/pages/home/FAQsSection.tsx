import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { WizardCardTitle } from "../wizard/sections/WizardCardTitle";

type Faq = {
  question: string;
  answer: string;
};

const faqs: Faq[] = [
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
    question: "What happens to funds staked in the arena?",
    answer:
      "Staked funds are locked only during battle. Unlock them afterward and they return to your available balance, ready to withdraw.",
  },
  {
    question: "How are fighters generated?",
    answer:
      "You describe a fighter; AI generates its combat brain, visuals, and Airmach. Iterate versions anytime to evolve a stronger agent.",
  },
  {
    question: "What does it cost to generate a fighter?",
    answer:
      "Each AI generation — combat brain, visuals and Airmach — charges a small fee in the network's native token at the time of creation.",
  },
  {
    question: "Which blockchain network are you on?",
    answer:
      "Fighters and balances run on SUI. Deposits, withdrawals and fees settle in SUI's native token for fast, low-cost on-chain transactions.",
  },
  {
    question: "What fees do you charge, and why?",
    answer:
      "A 20% platform fee shows on every withdrawal in your ledger. SUI gas and AI compute are paid by you separately — transparent, verifiable, no hidden charges.",
  },
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
    question: "Are there any lockups or holding periods?",
    answer:
      "No. Beyond active arena stakes, nothing is held. Deposit, generate, and withdraw on your own schedule — your funds stay under your control.",
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
    <CardContent className="space-y-6 p-4">
      <ul className="space-y-5 text-sm leading-relaxed">
        {faqs.map((faq) => (
          <li className="space-y-1" key={faq.question}>
            <p className="text-foreground/90">{faq.question}</p>
            <p className="text-muted-foreground">{faq.answer}</p>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);
