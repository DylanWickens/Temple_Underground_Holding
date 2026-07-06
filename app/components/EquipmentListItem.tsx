import { equipmentCatagories } from "../data/equipment";

type EquipmentListItemProps = { 
    index: number;
    htmlId: string;
}

export default function EquipmentListItem({ index, htmlId }: EquipmentListItemProps) {
  return (
    <div id={htmlId}>
      <h4>{equipmentCatagories[index].title}</h4>
      {equipmentCatagories && (
        <ul>
          {equipmentCatagories[index].items.map((item) => (
            <li key={item.title}>{item.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
