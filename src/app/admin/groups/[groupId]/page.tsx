import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceStatus, LifecycleStatus, StudentEnrollmentStatus } from "@/generated/prisma/client";
import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const weekday: Record<string,string> = {
  MONDAY:"Пн", TUESDAY:"Вт", WEDNESDAY:"Ср", THURSDAY:"Чт", FRIDAY:"Пт", SATURDAY:"Сб", SUNDAY:"Вс"
};
function time(minutes:number){ return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0"); }

export default async function AdminGroupPage({ params }:{ params:Promise<{groupId:string}>}) {
  const { groupId } = await params;
  const prisma=getPrisma();
  const currentDate=new Date();
  const since30=new Date(currentDate.getTime()-30*24*60*60*1000);
  const group=await prisma.trainingGroup.findUnique({
    where:{id:groupId},
    include:{
      branch:true,sport:true,primaryCoach:true,
      scheduleRules:{where:{status:LifecycleStatus.ACTIVE},orderBy:{weekday:"asc"}},
      enrollments:{
        where:{status:StudentEnrollmentStatus.ACTIVE},
        include:{child:{include:{parent:true,progressAssessments:{orderBy:{assessedAt:"desc"},take:1}}}},
        orderBy:{createdAt:"asc"}
      },
      sessions:{
        where:{startsAt:{gte:since30}},
        include:{attendances:true},
        orderBy:{startsAt:"desc"},
        take:24
      }
    }
  });
  if(!group) notFound();

  const allAttendance=group.sessions.flatMap(s=>s.attendances.filter(a=>a.trialBookingId===null));
  const present=allAttendance.filter(a=>a.status===AttendanceStatus.PRESENT).length;
  const rate=allAttendance.length?Math.round(present/allAttendance.length*100):null;
  const now=currentDate.getTime();
  const expiring=group.enrollments.filter(e=>e.currentPeriodEnd && e.currentPeriodEnd.getTime()-now<=7*86400000 && e.currentPeriodEnd.getTime()>=now).length;
  const needsAssessment=group.enrollments.filter(e=>!e.child.progressAssessments.length || now-e.child.progressAssessments[0].assessedAt.getTime()>35*86400000).length;

  return <>
    <div className="admin-page-head">
      <div><p className="eyebrow">GROUP WORKSPACE</p><h1>{group.internalName}</h1><p className="admin-help">{group.sport.nameRu} · {group.branch.publicNameRu} · {[group.primaryCoach.firstName,group.primaryCoach.lastName].filter(Boolean).join(" ")}</p></div>
      <Link className="admin-status" href="/admin/groups">← Все группы</Link>
    </div>

    <div className="admin-metrics">
      <div className="admin-metric"><span>Ученики</span><strong>{group.enrollments.length} / {group.capacityRegular}</strong></div>
      <div className="admin-metric"><span>Посещаемость · 30 дней</span><strong>{rate===null?"—":rate+"%"}</strong></div>
      <div className="admin-metric"><span>Требуют внимания</span><strong>{expiring+needsAssessment}</strong></div>
    </div>

    <section className="admin-panel"><div className="admin-panel-head"><h2>Расписание</h2></div><div className="admin-table-wrap"><table className="admin-table"><tbody>
      <tr><th>Регулярно</th><td>{group.scheduleRules.map(r=>weekday[r.weekday]+" "+time(r.startMinutes)+"–"+time(r.endMinutes)).join(" · ") || "—"}</td><th>Набор</th><td>{group.enrollmentStatus}</td></tr>
      <tr><th>Возраст</th><td>{group.ageMin}–{group.ageMax}</td><th>Статус</th><td>{group.status}</td></tr>
    </tbody></table></div></section>

    <section className="admin-panel"><div className="admin-panel-head"><h2>Ученики</h2></div><div className="admin-table-wrap"><table className="admin-table">
      <thead><tr><th>Ученик</th><th>Родитель</th><th>Абонемент</th><th>Оплачено до</th><th>Последняя оценка</th></tr></thead>
      <tbody>{group.enrollments.map(e=><tr key={e.id}>
        <td><Link href={"/admin/children/"+e.childId}><strong>{e.child.name}</strong></Link></td>
        <td>{e.child.parent.name}<br/><small>{e.child.parent.phone}</small></td>
        <td>{e.subscriptionStatus ?? e.status}</td>
        <td>{e.currentPeriodEnd?formatAdminDate(e.currentPeriodEnd):"—"}</td>
        <td>{e.child.progressAssessments[0]?formatAdminDate(e.child.progressAssessments[0].assessedAt):"Нужна оценка"}</td>
      </tr>)}
      {!group.enrollments.length?<tr><td colSpan={5}>Активных учеников пока нет.</td></tr>:null}</tbody>
    </table></div></section>

    <section className="admin-panel"><div className="admin-panel-head"><h2>Последние занятия</h2></div><div className="admin-table-wrap"><table className="admin-table">
      <thead><tr><th>Дата</th><th>Статус</th><th>Отмечено</th><th>Присутствовали</th><th>Отсутствовали</th></tr></thead>
      <tbody>{group.sessions.map(s=>{
        const regular=s.attendances.filter(a=>a.trialBookingId===null);
        return <tr key={s.id}><td>{formatAdminDate(s.startsAt)}</td><td>{s.status}</td><td>{regular.length}</td><td>{regular.filter(a=>a.status===AttendanceStatus.PRESENT).length}</td><td>{regular.filter(a=>a.status!==AttendanceStatus.PRESENT).length}</td></tr>
      })}
      {!group.sessions.length?<tr><td colSpan={5}>Занятий за период нет.</td></tr>:null}</tbody>
    </table></div></section>
  </>;
}
