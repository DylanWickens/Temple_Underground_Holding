import { equipmentCatagories } from "../data/equipment";

type LargerEquipmentListProps = {
    index: number;
}

export default function LargerEquipmentList({index}:LargerEquipmentListProps) {

  function splitEquipmentListInHalf(arrayTargetIndex: number) {
    const targetArray = equipmentCatagories[arrayTargetIndex];
    const targetListLength = targetArray.items.length;
    const splitAtCenter = Math.ceil(targetListLength / 2);
    const splitArrayFirstHalf = targetArray.items.slice(0, splitAtCenter);
    const splitArrayLastHalf = targetArray.items.slice(splitAtCenter, targetListLength);

    return [splitArrayFirstHalf, splitArrayLastHalf];
  }
  const [splitArrayFirstHalf, splitArrayLastHalf] = splitEquipmentListInHalf(index);

  return (
    <div className="flex flex-col gap-x-5 pb-[53px]">
      <h4 className="text-grey-600 uppercase font-mono text-xs tracking-[0.13em] leading-mono-list-item pb-5">
        {equipmentCatagories[index].title}
      </h4>
      <div className="flex gap-x-5">
        {splitArrayFirstHalf && (
          <ul className="flex flex-col gap-y-5">
            {splitArrayFirstHalf.map((item) => (
              <li key={item.title}>{item.title}</li>
            ))}
          </ul>
        )}
        {splitArrayLastHalf && (
          <ul className="flex flex-col gap-y-5">
            {splitArrayLastHalf.map((item) => (
              <li key={item.title}>{item.title}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
