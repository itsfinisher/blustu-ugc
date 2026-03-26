import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#060b18]">
      {/* Branded side panel — desktop only */}
      <div className="hidden lg:flex flex-col justify-center items-center flex-shrink-0 w-[460px] relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0f1a35 0%, #0a1128 100%)" }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 25% 75%, #3BA4F5 1.5px, transparent 1.5px), radial-gradient(circle at 75% 25%, #3BA4F5 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div className="relative z-10 text-center px-12">
          <Image
            src="/logos/blustu-logo.png"
            alt="BluStu Talent Agency"
            width={200}
            height={70}
            className="mx-auto"
            style={{ objectFit: "contain", width: "auto", height: "auto" }}
            priority
          />
          <p className="text-[#64748b] text-base mt-7 leading-relaxed max-w-[300px] mx-auto font-medium">
            Browse campaigns, submit content, and track your earnings — all in one place.
          </p>
          <div className="flex gap-2.5 justify-center mt-8">
            {["Campaigns", "Submit", "Earn"].map((w) => (
              <span key={w}
                className="bg-blu-500/10 border border-blu-500/20 px-5 py-1.5 rounded-full text-xs font-semibold text-blu-400">
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden text-center mb-8">
            <Image src="/logos/blustu-logo.png" alt="BluStu" width={140} height={50}
              className="mx-auto rounded-md" style={{ objectFit: "contain", width: "auto", height: "auto" }} priority />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
