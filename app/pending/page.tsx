import Image from "next/image";
import { logout } from "../(auth)/actions";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Vteam" width={36} height={36} />
          <h1 className="text-xl font-semibold text-gray-900">승인 대기 중</h1>
        </div>
        <p className="text-sm text-gray-500">
          관리자의 승인을 기다리고 있습니다.<br />
          승인되면 바로 사용할 수 있습니다.
        </p>
        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            다른 계정으로 로그인
          </button>
        </form>
      </div>
    </div>
  );
}
