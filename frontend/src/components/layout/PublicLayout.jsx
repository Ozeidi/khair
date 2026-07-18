import { Outlet } from "react-router-dom";
import PublicNav from "./PublicNav";
import Footer from "./Footer";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNav />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
