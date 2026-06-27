import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { roomName } = await req.json()

  const res = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("DAILY_API_KEY")}`,
    },
    body: JSON.stringify({
      name: roomName,
      properties: { enable_chat: false, start_audio_off: false }
    }),
  })

  const room = await res.json()

  return new Response(JSON.stringify({ url: room.url }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
})
