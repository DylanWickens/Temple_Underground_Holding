import { favoriteItems } from "../../data/equipment";


export default function EquipmentListM() {

    function splitEquipmentListInHalf() {
      const targetArray = favoriteItems;
      const targetListLength = targetArray.length;
      const splitAtThird = Math.ceil(targetListLength / 3);
      const arrayColOne = targetArray.slice(0, splitAtThird);
      const arrayColTwo = targetArray.slice(splitAtThird, splitAtThird + splitAtThird);
      const arrayColThree = targetArray.slice(splitAtThird + splitAtThird, targetListLength);

      return [arrayColOne, arrayColTwo, arrayColThree];
    }
    const [arrayColOne, arrayColTwo, arrayColThree] = splitEquipmentListInHalf();

  return (
    <div className="px-4 min-[1396px]:hidden">
      <h4 className="text-primary opacity-80 uppercase font-mono font-semibold text-xs tracking-[0.13em] leading-mono-list-item pb-8">
        Our Favourites
      </h4>

      <div className="flex gap-x-5 justify-between items-start max-w-[560px]">
        <ul className="flex flex-col gap-y-8">
          {arrayColOne.map((item) => (
            <li key={item.title} className="text-muted">
              {item.title}
            </li>
          ))}
        </ul>

        <ul className="flex flex-col gap-y-8">
          {arrayColTwo.map((item) => (
            <li key={item.title} className="text-muted">
              {item.title}
            </li>
          ))}
        </ul>

        <ul className="flex flex-col gap-y-8">
          {arrayColThree.map((item) => (
            <li key={item.title} className="text-muted">
              {item.title}
            </li>
          ))}
        </ul>

      </div>
    </div>
  );
}
