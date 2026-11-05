import { requireAdminSession } from "@/server/admin/auth";
import { SandboxLab } from "@/components/admin/sandbox-lab";

export const dynamic = "force-dynamic";

export default async function AdminSandboxPage() {
  await requireAdminSession();
  return <>
    <div className="admin-page-head">
      <div>
        <p className="eyebrow">QA / TEST LAB</p>
        <h1>Тестовая лаборатория Shark Team</h1>
        <p className="admin-page-note">Проверка кабинета тренера без реальных родителей и филиалов.</p>
      </div>
    </div>
    <SandboxLab />
  </>;
}
