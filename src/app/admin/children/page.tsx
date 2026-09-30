import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminChildrenPage() {
  const prisma = getPrisma();

  const children = await prisma.child.findMany({
    take: 200,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      parent: true,
      enrollments: {
        include: {
          group: {
            include: {
              branch: true,
              sport: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      _count: {
        select: {
          leads: true
        }
      }
    }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">CLIENTS</p>
          <h1>Дети</h1>
        </div>
        <span className="admin-count">{children.length} записей</span>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ребёнок</th>
                <th>Возраст при регистрации</th>
                <th>Родитель</th>
                <th>Телефон</th>
                <th>Связанных лидов</th>
                <th>Постоянная группа</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {children.map((child) => (
                <tr key={child.id}>
                  <td>{child.name}</td>
                  <td>{child.ageAtRegistration}</td>
                  <td>{child.parent.name}</td>
                  <td>{child.parent.phone}</td>
                  <td>{child._count.leads}</td>
                  <td>
                    {child.enrollments.length > 0 ? (
                      child.enrollments.map((enrollment) => (
                        <div key={enrollment.id}>
                          <strong>{enrollment.group.internalName}</strong>
                          <br />
                          <small>
                            {enrollment.group.sport.nameRu} ·{" "}
                            {enrollment.status}
                          </small>
                        </div>
                      ))
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatAdminDate(child.createdAt)}</td>
                </tr>
              ))}
              {children.length === 0 ? (
                <tr><td colSpan={7}>Подтверждённых детей пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
