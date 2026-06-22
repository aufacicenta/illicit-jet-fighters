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
      "A small network fee shows on every withdrawal in your ledger. Fees cover SUI gas and AI compute — transparent, verifiable, no hidden charges.",
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
  <div className="space-y-6 rounded-sm border border-border/70 bg-background/80 px-5 py-8 md:px-8">
    <div className="space-y-2">
      <p className="font-pixel text-xl text-highlight">Frequently Asked</p>
      <p className="text-sm leading-relaxed text-foreground/90">
        Your funds, your fighters, your assets — here's how it works.
      </p>
    </div>

    <ul className="space-y-5 text-sm leading-relaxed">
      {faqs.map((faq) => (
        <li className="space-y-1" key={faq.question}>
          <p className="text-foreground/90">{faq.question}</p>
          <p className="text-muted-foreground">{faq.answer}</p>
        </li>
      ))}
    </ul>

    <p className="font-pixel text-xs tracking-wide text-secondary uppercase">
      Withdraw Anytime. Own Everything.
    </p>
  </div>
);
