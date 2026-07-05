
export default function Navbar() {
  return (
    <div className="flex justify-end">
      <nav className="fixed top-9 right-8 z-100 flex gap-x-4 md:gap-x-6">
        <a href="#" className="nav">
          About
        </a>
        <a href="#" className="nav">
          Equipment
        </a>
        <a href="#" className="nav">
          Team
        </a>
        <a href="#" className="nav">
          Book
        </a>
      </nav>
    </div>
  );
}   
