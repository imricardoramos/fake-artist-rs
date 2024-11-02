import HomePage from "@/pages/Homepage";
import { RouteRecord } from "vite-react-ssg/single-page";
import ErrorPage from "./pages/ErrorPage";
import Room from "@/pages/Room.tsx";

export const routes: RouteRecord[] = [
  {
    path: "/",
    element: <HomePage />,
    entry: "@/pages/Homepage.tsx",
    errorElement: <ErrorPage />,
  },
  {
    path: "/room/:roomId",
    element: <Room />,
    entry: "@/pages/Room.tsx",
    getStaticPaths: () => ["/room/index"],
  },
];
