import { useEffect } from "react";
import { useParams } from "react-router-dom";

export const BroadcastPage = () => {
  const { id } = useParams();

  useEffect(() => {
    void import("../main.ts");
  }, []);

  return (
    <div id="app">
      <aside id="controls" />
      <main id="stage">
        <canvas id="arena" />
        <div id="status" />
        <section id="jet-stats" aria-label="Jet stats panel" />
      </main>
      <span style={{ display: "none" }} data-broadcast-id={id} />
    </div>
  );
};
