import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

// Ethos / منصة الخير wordmark + logo lockup.
export default function Brand({ to = "/", showText = true, size = "md", className = "" }) {
  const sizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };
  const content = (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={logo} alt="شعار منصة الخير" className={`${sizes[size]} object-contain rounded-full`} />
      {showText && (
        <span className="text-headline-md font-heading font-bold text-primary">منصة الخير</span>
      )}
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}
