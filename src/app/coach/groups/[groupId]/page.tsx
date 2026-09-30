import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentEnrollmentStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { formatCoachDate } from "@/lib/coach-format";
import { requireCoachSession } from "@/server/coach/auth";

export const dynamic="force-dynamic";

export default async function CoachGroupPage({params}:{params:Promise<{groupId:string}>}) {
  const auth=await requireCoachSession();
  const {groupId}=await params;
  const prisma=getPrisma();
  const now=new Date();
  const since7=new Date(now.getTime()-7*86400000);
  const group=await prisma.trainingGroup.findFirst({
    where:{id:groupId,primaryCoachId:auth.coachId,status:"ACTIVE"},
    include:{
      branch:true,sport:true,
      enrollments:{where:{status:StudentEnrollmentStatus.ACTIVE},include:{child:{include:{progressAssessments:{orderBy:{assessedAt:"desc"},take:1}}}},orderBy:{createdAt:"asc"}},
      sessions:{where:{startsAt:{gte:since7}},orderBy:{startsAt:"asc"},take:12}
    }
  });
  if(!group) notFound();
  return <>
    <section className="coach-page-head"><p className="eyebrow">ГРУППА</p><h1>{group.internalName}</h1><p>{group.sport.nameRu} · {group.branch.publicNameRu} · {group.enrollments.length}/{group.capacityRegular} учеников</p></section>
    <section className="coach-section"><div className="coach-section-head"><h2>Ближайшие занятия</h2><span>{group.sessions.length}</span></div>
      <div className="coach-session-grid">{group.sessions.map(s=><Link className="coach-session-card" key={s.id} href={"/coach/sessions/"+s.id}><strong>{formatCoachDate(s.startsAt)}</strong><p>{s.status}</p></Link>)}</div>
    </section>
    <section className="coach-section"><div className="coach-section-head"><h2>Ученики</h2><span>{group.enrollments.length}</span></div>
      <div className="coach-group-grid">{group.enrollments.map(e=><article className="coach-group-card" key={e.id}><h2>{e.child.name}</h2><p>{e.child.progressAssessments[0]?"Оценка: "+formatCoachDate(e.child.progressAssessments[0].assessedAt):"Нужна оценка"}</p><Link className="coach-student-link" href={"/coach/students/"+e.childId}>Открыть карточку ученика</Link></article>)}</div>
    </section>
  </>;
}
