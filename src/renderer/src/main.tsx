import "./assets/main.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DetachedApp from "./DetachedApp";

// A popped-out window loads the same bundle with ?view=detached and renders a
// single-terminal shell instead of the full app.
const isDetached =
  new URLSearchParams(window.location.search).get("view") === "detached";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isDetached ? <DetachedApp /> : <App />}</StrictMode>,
);
