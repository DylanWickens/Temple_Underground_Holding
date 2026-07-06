import { equipmentCatagories } from "../data/equipment";

type EquipmentListItemProps = { 
    index: number;
    htmlId: string;
}

export default function EquipmentListItem({ index, htmlId }: EquipmentListItemProps) {
  return (
    <div className="flex flex-col gap-y-5 pb-[44px]" id={htmlId}>
      <h4 className="text-grey-600 uppercase font-mono text-xs tracking-[0.13em] leading-mono-list-item pb-5" >{equipmentCatagories[index].title}</h4>
      {equipmentCatagories && (
        <ul className="flex flex-col gap-y-5">
          {equipmentCatagories[index].items.map((item) => (
            <li key={item.title}>{item.title}</li>
          ))}
        </ul>
      )}
    </div>
  )
}