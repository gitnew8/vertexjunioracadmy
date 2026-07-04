import { createFileRoute } from "@tanstack/react-router";

const DAILY_API = "https://api.daily.co/v1";

async function daily(path: string, init: RequestInit = {}) {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY not configured");
  const res = await fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, body };
}

export const Route = createFileRoute("/api/public/daily-room")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { room_code, role, user_name } = (await request.json()) as {
            room_code?: string;
            role?: "teacher" | "student";
            user_name?: string;
          };
          if (!room_code || !/^[A-Za-z0-9_-]{3,32}$/.test(room_code)) {
            return Response.json({ error: "Invalid room_code" }, { status: 400 });
          }
          const name = `vertex-${room_code.toLowerCase()}`;

          // Ensure room exists
          let room = await daily(`/rooms/${name}`);
          if (room.status === 404) {
            const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 6; // 6h
            room = await daily(`/rooms`, {
              method: "POST",
              body: JSON.stringify({
                name,
                privacy: "public",
                properties: {
                  exp,
                  enable_prejoin_ui: false,
                  enable_screenshare: true,
                  enable_chat: false,
                  start_video_off: true,
                  start_audio_off: true,
                  eject_at_room_exp: true,
                  lang: "en",
                },
              }),
            });
          }
          if (!room.ok) {
            return Response.json(
              { error: "Failed to create room", detail: room.body },
              { status: 500 }
            );
          }

          const url = room.body.url as string;

          // Mint a meeting token (owner for teacher)
          const tokenRes = await daily(`/meeting-tokens`, {
            method: "POST",
            body: JSON.stringify({
              properties: {
                room_name: name,
                user_name: user_name || (role === "teacher" ? "Teacher" : "Student"),
                is_owner: role === "teacher",
                start_video_off: true,
                start_audio_off: role !== "teacher",
                exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
              },
            }),
          });
          if (!tokenRes.ok) {
            return Response.json(
              { error: "Failed to mint token", detail: tokenRes.body },
              { status: 500 }
            );
          }

          return Response.json({ url, token: tokenRes.body.token });
        } catch (e: any) {
          return Response.json({ error: e?.message || "Server error" }, { status: 500 });
        }
      },
    },
  },
});
