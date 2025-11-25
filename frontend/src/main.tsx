import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { routes } from "./App.tsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { SocketProvider } from "./contexts/SocketContext.tsx";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  ui_host: "https://us.posthog.com",
  defaults: "2025-05-24",
});

const router = createBrowserRouter(routes);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <SocketProvider>
        <RouterProvider router={router} />
      </SocketProvider>
    </PostHogProvider>
  </StrictMode>,
);
