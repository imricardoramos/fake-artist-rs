import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { routes } from "./App.tsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { SocketProvider } from "./contexts/SocketContext.tsx";

const router = createBrowserRouter(routes);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SocketProvider>
      <RouterProvider router={router} />
    </SocketProvider>
  </StrictMode>,
);
