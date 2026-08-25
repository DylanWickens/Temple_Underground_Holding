import { equipmentCatagories } from "../../data/equipment";
import Row from "./accordian/Row";

export default function MobileAccordian() {
  return (
    <div className="px-4">
      {equipmentCatagories.map((category) => (
        <Row
          key={category.id}
          title={category.title}
          items={category.items.map((item) => item.title)}
          isOpen={false}
        />
      ))}
    </div>
  );
}
