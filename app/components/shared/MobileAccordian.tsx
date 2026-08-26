"use client";

import { useState } from "react";
import { equipmentCatagories } from "../../data/equipment";
import Row from "./accordian/Row";

export default function MobileAccordian() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="flex flex-col gap-y-16 px-4 ">
      <div className="flex flex-col">
        {equipmentCatagories.map((category) => (
          <Row
            key={category.id}
            id={category.id}
            title={category.title}
            items={category.items.map((item) => item.title)}
            isOpen={openId === category.id}
            onToggle={toggle}
          />
        ))}
      </div>

      <p className="text-white-100 text-base leading-display-lg-M tracking-[-0.01em]">
        Full List Available on Request
      </p>
    </div>
  );
}
