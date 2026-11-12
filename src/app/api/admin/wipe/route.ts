import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei } from "@/lib/verified";
import { wipeSite } from "@/lib/wipe";

/**
 * Czyszczenie całego serwisu — wyłącznie `sensei69`.
 *
 * Kasuje wszystkie konta, filmy, komentarze, subskrypcje, odznaki, bany
 * i niedokończone uploady. Wymaga wpisania słowa potwierdzenia, żeby nie
 * dało się tego zrobić jednym niechcianym kliknięciem.
 */
const CONFIRM_WORD = "WYCZYŚĆ";

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  }
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może wyczyścić cały serwis." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const confirm = typeof body.confirm === "string" ? body.confirm.trim() : "";
  if (confirm.toUpperCase() !== CONFIRM_WORD) {
    return NextResponse.json(
      { error: `Aby wyczyścić serwis, wpisz „${CONFIRM_WORD}”.` },
      { status: 400 }
    );
  }

  try {
    const summary = await wipeSite();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[polhub] czyszczenie serwisu nie udało się:", err);
    // Nie zostawiamy użytkownika bez informacji, co poszło nie tak.
    const message =
      err instanceof Error ? err.message : "Nieznany błąd bazy danych.";
    return NextResponse.json(
      { error: `Nie udało się wyczyścić serwisu: ${message}` },
      { status: 500 }
    );
  }
}
