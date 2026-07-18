import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-surface-container-highest border-t border-outline-variant w-full mt-auto">
      <div className="w-full py-stack-lg px-margin-desktop flex flex-col md:flex-row-reverse justify-between items-center gap-stack-md max-w-container-max-width mx-auto">
        <div className="text-headline-sm font-heading font-bold text-primary">منصة الخير</div>
        <nav className="flex flex-row-reverse flex-wrap justify-center gap-6">
          <Link className="text-on-surface-variant text-label-md font-heading hover:text-primary transition-colors" to="/about">
            عن المنصة
          </Link>
          <Link className="text-on-surface-variant text-label-md font-heading hover:text-primary transition-colors" to="/privacy">
            سياسة الخصوصية
          </Link>
          <Link className="text-on-surface-variant text-label-md font-heading hover:text-primary transition-colors" to="/contact">
            تواصل معنا
          </Link>
          <Link className="text-primary font-bold text-label-md font-heading hover:text-primary transition-colors" to="/projects">
            تبرع الآن
          </Link>
        </nav>
        <div className="text-on-surface-variant text-body-sm text-center md:text-right">
          © ٢٠٢٦ منصة الخير للإدارة الشفافة. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}
