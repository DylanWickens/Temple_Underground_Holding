
interface RowProps {
    title: string,
    items: string[],
    isOpen: boolean,
}

export default function Row({ title, items, isOpen } :RowProps) {
  return (
    <div>
      <div className="flex justify-between items-center self-stretch border-b border-white-100">
        <div className="flex py-6 justify-between items-center flex-1">
          <div>
            <h5 className="text-white-100 accordian-title sm:text-[5vw]"> {title}
            </h5>
          </div>

          <div id="cheveron">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none">
              <path d="M6 15L11.9994 8L18 15" stroke="#F1F1F1" strokeWidth="1.33333" />
            </svg>
          </div>

        </div>
      </div>
    </div>
  );
}
