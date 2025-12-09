export default function Categories() {
  const categories = [
    "All",
    "Engineering",
    "Marketing",
    "Research",
    "Operations",
    "Finance",
  ];

  return (
    <div className="categories">
      {categories.map((cat, index) => (
        <span key={index} className={index === 0 ? "active" : ""}>
          {cat}
        </span>
      ))}
    </div>
  );
}
