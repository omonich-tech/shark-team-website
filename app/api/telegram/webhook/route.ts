import { NextRequest, NextResponse } from "next/server";
export const runtime="nodejs";
const api=(t:string,m:string)=>"https://api.telegram.org/bot"+t+"/"+m;
async function send(t:string,c:number,text:string,markup?:unknown){await fetch(api(t,"sendMessage"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:c,text,reply_markup:markup})})}
const ik=(rows:unknown[][])=>({inline_keyboard:rows});
const pack=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString("base64url");
const unpack=(s:string)=>{try{return JSON.parse(Buffer.from(s,"base64url").toString())}catch{return null}};
function dates(){
 const out:{iso:string;ru:string;uz:string}[]=[],d=new Date(Date.now()+5*3600000);
 for(let i=0;i<14&&out.length<5;i++){const x=new Date(d);x.setUTCDate(d.getUTCDate()+i);const w=x.getUTCDay();if([2,4,6].includes(w)){const iso=x.toISOString().slice(0,10);out.push({iso,ru:x.toLocaleDateString("ru-RU",{day:"numeric",month:"long",weekday:"short",timeZone:"UTC"}),uz:x.toLocaleDateString("uz-UZ",{day:"numeric",month:"long",weekday:"short",timeZone:"UTC"})})}}
 return out;
}
export async function POST(req:NextRequest){
 const token=process.env.TELEGRAM_BOT_TOKEN,admin=process.env.ADMIN_CHAT_ID;if(!token)return NextResponse.json({ok:false});
 const u=await req.json();
 if(u.callback_query){
  const q=u.callback_query,c=q.message.chat.id,d=String(q.data);await fetch(api(token,"answerCallbackQuery"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({callback_query_id:q.id})});
  if(d==="lang_ru")await send(token,c,"SHARK TEAM 🦈\n\n🏀 Баскетбол для детей 8–16 лет\n📍 Шахристан, школа №117\n👨‍🏫 Тренер: Дилшод\n🗓 Вт • Чт • Сб\n🕔 17:00–18:00\n💳 Пробное занятие — 50 000 сум",ik([[{text:"Записаться на пробное",callback_data:"book_ru"}],[{text:"📍 Где находимся",url:"https://yandex.uz/maps/-/CXEXq4iH"}]]));
  else if(d==="lang_uz")await send(token,c,"SHARK TEAM 🦈\n\n🏀 8–16 yoshli bolalar uchun basketbol\n📍 Shahriston, 117-maktab\n👨‍🏫 Murabbiy: Dilshod\n🗓 Sesh • Pay • Shan\n🕔 17:00–18:00\n💳 Sinov mashg‘uloti — 50 000 so‘m",ik([[{text:"Sinovga yozilish",callback_data:"book_uz"}],[{text:"📍 Manzil",url:"https://yandex.uz/maps/-/CXEXq4iH"}]]));
  else if(d==="book_ru"||d==="book_uz"){const uz=d.endsWith("uz");await send(token,c,uz?"Farzandingizning ismini yozing:":"Напишите имя ребёнка:",{force_reply:true,selective:true,input_field_placeholder:uz?"Masalan: Rustam":"Например: Рустам"});}
  else if(d.startsWith("date:")){
   const [,lang,iso,data]=d.split(":"),x=unpack(data);if(!x)return NextResponse.json({ok:true});const uz=lang==="uz",dt=dates().find(z=>z.iso===iso),label=dt?(uz?dt.uz:dt.ru):iso;
   const summary=uz?"✅ Ma’lumotlarni tekshiring:\n\n👤 "+x.n+", "+x.a+" yosh\n📱 "+x.p+"\n🏀 Basketbol\n👨‍🏫 Dilshod\n📍 Shahriston, 117-maktab\n📅 "+label+"\n🕔 17:00–18:00\n💳 50 000 so‘m":"✅ Проверьте запись:\n\n👤 "+x.n+", "+x.a+" лет\n📱 "+x.p+"\n🏀 Баскетбол\n👨‍🏫 Дилшод\n📍 Шахристан, школа №117\n📅 "+label+"\n🕔 17:00–18:00\n💳 50 000 сум";
   await send(token,c,summary,ik([[{text:uz?"💳 To‘lash":"💳 Оплатить 50 000 сум",callback_data:"pay:"+lang+":"+iso+":"+data}],[{text:uz?"📍 Yo‘nalish":"📍 Построить маршрут",url:"https://yandex.uz/maps/-/CXEXq4iH"}]]));
   if(admin)await send(token,Number(admin),"🆕 НОВАЯ ЗАЯВКА SHARK TEAM\n\n👤 Ребёнок: "+x.n+", "+x.a+" лет\n📱 "+x.p+"\n🏀 Баскетбол\n📍 Шахристан — школа №117\n📅 "+label+"\n🕔 17:00–18:00\n💳 Статус: ожидает оплату\nTelegram ID: "+c);
  }else if(d.startsWith("pay:")){
   const [,lang,iso,data]=d.split(":"),x=unpack(data),uz=lang==="uz";
   await send(token,c,uz?"💳 Onlayn to‘lov hali ulanmagan. Payme/Click merchant ulanishidan keyin shu tugma orqali to‘lov qilinadi.":"💳 Онлайн-оплата пока не подключена. После подключения merchant Payme/Click оплата будет проходить по этой кнопке.");
   if(admin&&x)await send(token,Number(admin),"💳 ПОЛЬЗОВАТЕЛЬ НАЖАЛ «ОПЛАТИТЬ»\n\n👤 "+x.n+", "+x.a+" лет\n📅 "+iso+"\n📱 "+x.p+"\n\nПлатёжный провайдер ещё не подключён.");
  }
  return NextResponse.json({ok:true});
 }
 const m=u.message;if(!m?.chat?.id)return NextResponse.json({ok:true});const c=m.chat.id,text=String(m.text||"").trim(),reply=String(m.reply_to_message?.text||"");
 if(text.startsWith("/admin")&&(m.chat.type==="group"||m.chat.type==="supergroup")){await send(token,c,"✅ Группа администраторов подключена.\nChat ID: "+c);return NextResponse.json({ok:true})}
 if(text.startsWith("/start")){await send(token,c,"SHARK TEAM 🦈\n\nВыберите язык / Tilni tanlang",ik([[{text:"Русский",callback_data:"lang_ru"},{text:"O‘zbekcha",callback_data:"lang_uz"}]]));return NextResponse.json({ok:true})}
 if(reply.startsWith("Напишите имя ребёнка:")||reply.startsWith("Farzandingizning ismini yozing:")){
  const uz=reply.startsWith("Farz"),payload=pack({n:text});await send(token,c,uz?"Farzandingiz necha yoshda?":"Сколько лет ребёнку?",{force_reply:true,selective:true,input_field_placeholder:"8–16",keyboard:undefined});await send(token,c,"state:"+payload,{remove_keyboard:true});return NextResponse.json({ok:true});
 }
 if((reply==="Сколько лет ребёнку?"||reply==="Farzandingiz necha yoshda?")){
  const uz=reply.startsWith("Farz"),age=parseInt(text,10);if(!Number.isFinite(age)||age<8||age>16){await send(token,c,uz?"Bu guruh 8–16 yosh uchun. Yoshni 8 dan 16 gacha raqam bilan kiriting.":"Эта группа для детей 8–16 лет. Введите возраст от 8 до 16.");return NextResponse.json({ok:true})}
  const hist=u.message.reply_to_message?.reply_to_message?.text||"";const nameMatch=hist.match(/.+/);const name=nameMatch?.[0]||"Ребёнок";
  await send(token,c,uz?"Ota-onaning telefon raqamini yuboring:":"Отправьте номер телефона родителя:",{keyboard:[[{text:uz?"📱 Telefon raqamini yuborish":"📱 Отправить мой номер",request_contact:true}]],resize_keyboard:true,one_time_keyboard:true,selective:true});
  await send(token,c,"data:"+pack({n:name,a:age,l:uz?"uz":"ru"}));return NextResponse.json({ok:true});
 }
 if(m.contact){
  const phone=m.contact.phone_number;const uz=reply.includes("telefon");const name=String(m.contact.first_name||"Ребёнок");const data=pack({n:name,a:"8–16",p:phone});const ds=dates();
  await send(token,c,uz?"Sinov mashg‘uloti uchun kunni tanlang:":"Выберите дату пробного занятия:",{remove_keyboard:true});
  await send(token,c,uz?"Yaqin mashg‘ulotlar:":"Ближайшие тренировки:",ik(ds.map(z=>[{text:(uz?z.uz:z.ru)+" • 17:00",callback_data:"date:"+(uz?"uz":"ru")+":"+z.iso+":"+data}])));
  return NextResponse.json({ok:true});
 }
 await send(token,c,"Нажмите /start • /start ni bosing");return NextResponse.json({ok:true});
}