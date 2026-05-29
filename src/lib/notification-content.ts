export type NotifLang = "sv" | "en";
export type NotifKind = "submission_approved" | "submission_rejected";

export function buildNotification(
  kind: NotifKind,
  lang: NotifLang,
  title: string,
  comment?: string | null,
): { subject: string; body: string } {
  const t = title || "—";
  if (kind === "submission_approved") {
    if (lang === "sv") {
      return {
        subject: "Din uppladdning har blivit godkänd",
        body: `Hej!\n\nDin uppladdning "${t}" har blivit godkänd och finns nu publicerad på catalog.mediarosenqvist.com.\n\nTack för ditt bidrag till Catalogus Musicus.`,
      };
    }
    return {
      subject: "Your submission has been approved",
      body: `Hello!\n\nYour submission "${t}" has been approved and is now published on catalog.mediarosenqvist.com.\n\nThank you for contributing to Catalogus Musicus.`,
    };
  }
  const c = (comment ?? "").trim();
  if (lang === "sv") {
    return {
      subject: "Din uppladdning behöver ändras",
      body: `Hej!\n\nDin uppladdning "${t}" kunde tyvärr inte godkännas just nu.\n\nKommentar från admin:\n${c || "(ingen kommentar lämnades)"}\n\nDu kan uppdatera och skicka in materialet igen.`,
    };
  }
  return {
    subject: "Your submission needs changes",
    body: `Hello!\n\nUnfortunately your submission "${t}" could not be approved at this time.\n\nAdmin comment:\n${c || "(no comment provided)"}\n\nYou may update and resubmit your content.`,
  };
}