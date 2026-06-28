import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();
const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(
  <StrictMode>
    <router.Provider>{/* Router will render here */}</router.Provider>
  </StrictMode>,
);