import { EmptyState } from "./ui/States";
import PageHeader from "./ui/PageHeader";

// Temporary scaffold shown until a page is fully implemented.
export default function Placeholder({ title, note = "هذه الشاشة قيد الإنشاء." }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState icon="construction" title={title} description={note} />
    </div>
  );
}
