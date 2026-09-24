import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(){
 const token=process.env.TELEGRAM_BOT_TOKEN;
 if(!token)return NextResponse.json({ok:false,error:"Token is not configured"},{status:500});
 const url="https://shark-team-website.vercel.app/api/telegram/webhook";
 const response=await fetch("https://api.telegram.org/bot"+token+"/setWebhook",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url,allowed_updates:["message","callback_query"],drop_pending_updates:true})});
 return NextResponse.json(await response.json());
}