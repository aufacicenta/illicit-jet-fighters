import { Link } from "react-router-dom";

import { routes } from "../../hooks/useRoutes";
import { Button } from "../ui/button";

export const NavbarPublicActions = () => (
  <div className="flex items-center gap-2">
    <Button asChild size="sm" variant="ghost">
      <Link to={routes.login()}>Sign in</Link>
    </Button>
    <Button asChild size="sm" variant="secondary">
      <Link to={routes.signup()}>Sign up</Link>
    </Button>
  </div>
);
