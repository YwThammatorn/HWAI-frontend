import Navbar from "@/components/Navbar";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#E0F7F4] flex items-center justify-center mb-2">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 6v10l6 3" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="16" r="11" stroke="#2DD4BF" strokeWidth="2.5"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#0F2137]">{title}</h1>
        <p className="text-sm text-gray-400">หน้านี้กำลังสร้าง — จะพร้อมเร็ว ๆ นี้</p>
      </main>
    </div>
  );
}
