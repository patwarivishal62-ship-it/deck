"use client";

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Greeting({ name }) {
  const hour = typeof window === "undefined" ? 9 : new Date().getHours();
  const first = name ? name.trim().split(/\s+/)[0] : "";
  return (
    <div className="mt-5">
      {/* suppressHydrationWarning: the greeting depends on the viewer's local
          hour, which can differ between server render and the browser. */}
      <h1 suppressHydrationWarning className="text-[17px] font-semibold leading-none text-[#172033]">
        {greetingForHour(hour)}
        {first ? `, ${first}` : ""}! 👋
      </h1>
      <p className="mt-[10px] text-[12px] leading-none text-[#7B8498]">
        Here&rsquo;s what&rsquo;s happening with your projects.
      </p>
    </div>
  );
}
