type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">프로젝트 상세</h1>

      {/* Kanban Board */}
      <div className="grid grid-cols-3 gap-4">
        {(["todo", "in_progress", "done"] as const).map((status) => {
          const labels = { todo: "할 일", in_progress: "진행 중", done: "완료" };
          const colors = { todo: "bg-gray-100", in_progress: "bg-blue-50", done: "bg-green-50" };
          return (
            <div key={status} className="flex flex-col gap-3">
              <div className={`rounded-lg px-3 py-2 ${colors[status]}`}>
                <h3 className="text-sm font-medium text-gray-700">{labels[status]}</h3>
              </div>
              <div className="flex min-h-[200px] flex-col gap-2 rounded-xl bg-white p-3">
                <p className="text-center text-xs text-gray-400">태스크 없음</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
