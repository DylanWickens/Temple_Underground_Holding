import { favoriteItems, type FavoriteItem } from "../../data/equipment";

function splitEquipmentList(columnCount: number) {
  const splitSize = Math.ceil(favoriteItems.length / columnCount);

  return Array.from({ length: columnCount }, (_, index) =>
    favoriteItems.slice(index * splitSize, index * splitSize + splitSize)
  );
}

function EquipmentColumns({
  columns,
  className,
}: {
  columns: FavoriteItem[][];
  className: string;
}) {
  return (
    <div className={className}>
      {columns.map((column) => (
        <ul key={column[0]?.title ?? column.length} className="flex flex-col gap-y-8">
          {column.map((item) => (
            <li key={item.title} className="text-muted">
              {item.title}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export default function EquipmentListM() {
  const twoColumns = splitEquipmentList(2);
  const threeColumns = splitEquipmentList(3);

  return (
    <div className="px-4 min-[1396px]:hidden">
      <h4 className="text-primary opacity-80 uppercase font-mono font-semibold text-xs tracking-[0.13em] leading-mono-list-item pb-8">
        Our Favourites
      </h4>

      <EquipmentColumns
        columns={twoColumns}
        className="flex gap-x-8 justify-start items-start max-w-[560px] min-[650px]:hidden"
      />

      <EquipmentColumns
        columns={threeColumns}
        className="hidden min-[650px]:flex gap-x-5 justify-between items-start max-w-[560px]"
      />
    </div>
  );
}
