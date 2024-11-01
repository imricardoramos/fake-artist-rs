import HomePage from "@/pages/Homepage";
import { RouteRecord } from "vite-react-ssg/single-page";
import ErrorPage from "./pages/ErrorPage";

export const routes: RouteRecord[] = [
  {
    path: "/",
    element: <HomePage />,
    entry: "@/pages/Homepage.tsx",
    errorElement: <ErrorPage />,
  },
  {
    path: "/room/:roomId",
    entry: "@/pages/Room.tsx",
    lazy: async () => {
      const Room = await import("@/pages/Room.tsx");
      return { Component: Room.default };
    },
    getStaticPaths: () => ["/room/index"],
  },
];
