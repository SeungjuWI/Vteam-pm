import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Vteam" width={40} height={40} />
          <h1 className="text-2xl font-semibold text-gray-900">Vteam</h1>
        </div>
        <p className="text-gray-600">원격 팀을 위한 올인원 워크스페이스</p>
        <Link
          href="/login"
          className="rounded-lg bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
        >
          시작하기
        </Link>
      </div>
    </div>
  );
}
