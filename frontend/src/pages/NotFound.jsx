import { Link } from "react-router-dom";
import { Button, Icon } from "@/components/ui";
import Brand from "@/components/Brand";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-gutter">
      <div className="mb-stack-lg">
        <Brand size="lg" />
      </div>

      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-stack-md bg-primary/10 rounded-full flex items-center justify-center">
          <Icon name="search_off" className="text-primary text-[40px]" />
        </div>
        <h1 className="text-display-lg font-heading text-primary mb-2">٤٠٤</h1>
        <h2 className="text-headline-md font-heading text-on-surface mb-3">الصفحة غير موجودة</h2>
        <p className="text-body-lg text-on-surface-variant mb-stack-lg">
          عذرًا، لم نتمكن من العثور على الصفحة التي تبحث عنها. ربما تم نقلها أو حُذفت أو أن الرابط غير صحيح.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button as={Link} to="/" variant="primary" icon="home">
            العودة للرئيسية
          </Button>
          <Button as={Link} to="/projects" variant="ghost" icon="volunteer_activism">
            تصفح المشاريع
          </Button>
        </div>
      </div>
    </div>
  );
}
