import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const api=(token:string,method:string)=>"https://api.telegram.org/bot"+token+"/"+method;
async function send(token:string,chat:number,text:string,markup?:unknown){
 await fetch(api(token,"sendMessage"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chat,text,reply_markup:markup})});
}
const inline=(rows:unknown[][])=>({inline_keyboard:rows});
export async function POST(req:NextRequest){
 const token=process.env.TELEGRAM_BOT_TOKEN;
 const adminChatId=process.env.ADMIN_CHAT_ID;
 if(!token)return NextResponse.json({ok:false});
 const u=await req.json();
 if(u.callback_query){
  const q=u.callback_query,chat=q.message.chat.id,d=String(q.data);
  await fetch(api(token,"answerCallbackQuery"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({callback_query_id:q.id})});
  if(d==="lang_ru")await send(token,chat,"SHARK TEAM 🦈\n\nБаскетбол для детей 8–16 лет\n📍 Шахристан, школа №117\n🗓 Вт • Чт • Сб\n🕔 17:00\n💳 Пробное — 50 000 сум",inline([[{text:"Записаться на пробное",callback_data:"book_ru"}]]));
  if(d==="lang_uz")await send(token,chat,"SHARK TEAM 🦈\n\n8–16 yoshli bolalar uchun basketbol\n📍 Shahriston, 117-maktab\n🗓 Sesh • Pay • Shan\n🕔 17:00\n💳 Sinov — 50 000 so‘m",inline([[{text:"Sinovga yozilish",callback_data:"book_uz"}]]));
  if(d==="book_ru")await send(token,chat,"Как зовут ребёнка?\n[NAME_RU]",{force_reply:true});
  if(d==="book_uz")await send(token,chat,"Farzandingizning ismi nima?\n[NAME_UZ]",{force_reply:true});
  if(d==="pay_ru")await send(token,chat,"💳 Заявка заполнена. Следующий этап — подключение реальной оплаты Payme/Click.");
  if(d==="pay_uz")await send(token,chat,"💳 Ariza to‘ldirildi. Keyingi bosqich — Payme/Click haqiqiy to‘lovini ulash.");
  return NextResponse.json({ok:true});
 }
 const m=u.message;
 if(!m?.chat?.id)return NextResponse.json({ok:true});
 const chat=m.chat.id,text=String(m.text||"").trim(),reply=String(m.reply_to_message?.text||"");
 if(text.startsWith("/admin") && (m.chat.type==="group" || m.chat.type==="supergroup")){
  const title=String(m.chat.title||"SHARK TEAM Admin");
  await send(token,chat,"✅ Группа администраторов подключена.\n\nНазвание: "+title+"\nChat ID: "+chat+"\n\nСкопируйте Chat ID и добавьте его в Vercel как переменную ADMIN_CHAT_ID. После этого сюда будут приходить заявки SHARK TEAM.");
  return NextResponse.json({ok:true});
 }
 if(text.startsWith("/start")){
  await send(token,chat,"SHARK TEAM 🦈\n\nВыберите язык / Tilni tanlang",inline([[{text:"Русский",callback_data:"lang_ru"},{text:"O‘zbekcha",callback_data:"lang_uz"}]]));
 }else if(reply.includes("[NAME_RU]")||reply.includes("[NAME_UZ]")){
  const uz=reply.includes("_UZ"),name=text;
  await send(token,chat,(uz?"Сколько лет ребёнку? / Farzandingiz necha yoshda?":"Сколько лет ребёнку?")+"\n[AGE_"+(uz?"UZ":"RU")+"|"+encodeURIComponent(name)+"]",{force_reply:true});
 }else if(reply.includes("[AGE_RU|")||reply.includes("[AGE_UZ|")){
  const uz=reply.includes("[AGE_UZ|"),age=parseInt(text,10),match=reply.match(/\[AGE_(?:RU|UZ)\|([^\]]+)\]/),name=decodeURIComponent(match?.[1]||"");
  if(!Number.isFinite(age)||age<8||age>16){await send(token,chat,uz?"Guruh 8–16 yosh uchun. Yoshni raqam bilan kiriting.":"Группа рассчитана на 8–16 лет. Введите возраст числом.");}
  else await send(token,chat,(uz?"Ota-ona telefon raqamini yuboring.":"Отправьте номер телефона родителя.")+"\n[PHONE_"+(uz?"UZ":"RU")+"|"+encodeURIComponent(name)+"|"+age+"]",{keyboard:[[{text:uz?"📱 Telefon raqamini yuborish":"📱 Отправить номер телефона",request_contact:true}]],resize_keyboard:true,one_time_keyboard:true});
 }else if(m.contact&&(reply.includes("[PHONE_RU|")||reply.includes("[PHONE_UZ|"))){
  const uz=reply.includes("[PHONE_UZ|"),match=reply.match(/\[PHONE_(?:RU|UZ)\|([^|]+)\|(\d+)\]/),name=decodeURIComponent(match?.[1]||""),age=match?.[2]||"",phone=m.contact.phone_number;
  const summary=uz?"👤 "+name+", "+age+" yosh\n🏀 Basketbol\n📍 Shahriston, 117-maktab\n🗓 Sesh • Pay • Shan, 17:00\n💳 50 000 so‘m\n📱 "+phone:"👤 "+name+", "+age+" лет\n🏀 Баскетбол\n📍 Шахристан, школа №117\n🗓 Вт • Чт • Сб, 17:00\n💳 50 000 сум\n📱 "+phone;
  await send(token,chat,summary,inline([[{text:uz?"💳 To‘lash":"💳 Оплатить 50 000 сум",callback_data:uz?"pay_uz":"pay_ru"}],[{text:uz?"📍 Yo‘nalish":"📍 Построить маршрут",url:"https://yandex.uz/maps/-/CXEXq4iH"}]]));
  if(adminChatId){
   const adminText="🆕 НОВАЯ ЗАЯВКА SHARK TEAM\n\n👤 Ребёнок: "+name+", "+age+" лет\n🏀 Баскетбол\n📍 Шахристан — школа №117\n🗓 Вт • Чт • Сб, 17:00–18:00\n📱 Родитель: "+phone+"\n💳 Статус: ожидает оплату\n\nTelegram ID родителя: "+chat;
   await send(token,Number(adminChatId),adminText);
  }
 }else await send(token,chat,"Нажмите /start • /start ni bosing");
 return NextResponse.json({ok:true});
}