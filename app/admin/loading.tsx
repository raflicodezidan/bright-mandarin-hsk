export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="h-6 w-40 rounded-[2px] bg-[#ECEAE3]" />
        <div className="h-4 w-64 rounded-[2px] bg-[#ECEAE3]" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-[3px] border border-[#DCD9D0] bg-[#F8F7F3]"
          />
        ))}
      </div>
      <div className="h-64 rounded-[3px] border border-[#DCD9D0] bg-[#F8F7F3]" />
    </div>
  );
}
