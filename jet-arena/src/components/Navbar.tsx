import { Link } from "react-router-dom";

import { routes } from "../hooks/useRoutes";

export const Navbar = () => (
  <nav className="flex w-full items-center justify-center border-b border-border px-4 py-4">
    <Link to={routes.terminalFighters()}>
      <img alt="Illicit Jet Fighters" className="w-full max-w-[280px]" src="/ijf-1.png" />
    </Link>
  </nav>
);
