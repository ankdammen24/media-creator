import { createFileRoute } from "@tanstack/react-router";
import { Music, Radio, Disc, BookOpen, Globe, Database, Server, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Catalogus Musicus" },
      { name: "description", content: "Learn about the Catalogus Musicus ecosystem, Media Rosenqvist, Crystal Pier Records, Guerilla Minstrel Publishing and Radio Uppsala." },
      { property: "og:title", content: "About — Catalogus Musicus" },
      { property: "og:description", content: "Learn about the Catalogus Musicus ecosystem, Media Rosenqvist, Crystal Pier Records, Guerilla Minstrel Publishing and Radio Uppsala." },
      { property: "og:url", content: "https://catalog.mediarosenqvist.com/about" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "https://catalog.mediarosenqvist.com/about" },
    ],
  }),
  component: AboutPage,
});

const LINKS = {
  mr: "https://mediarosenqvist.com",
  cpr: "https://crystalpierrecords.org",
  gmp: "https://guerillaminstrel.com",
  ru: "https://radiouppsala.se",
} as const;

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

function AboutPage() {
  const { t } = useTranslation();
  const list = (key: string) =>
    (t(key, { returnObjects: true }) as string[]).map((item, i) => <li key={i}>{item}</li>);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {t("about.title")}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        {t("about.tagline")}
      </p>

      <section className="mt-12 space-y-6 text-foreground/90">
        <p>
          <strong className="text-foreground">{t("about.intro1Bold1")}</strong>
          {t("about.intro1Mid")}
          <strong className="text-foreground">
            <ExtLink href={LINKS.mr}>{t("about.intro1Bold2")}</ExtLink>
          </strong>
          {t("about.intro1Suffix")}
        </p>
        <p>{t("about.intro2")}</p>
        <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.intro2List")}</ul>
        <p>{t("about.intro3")}</p>
        <p className="text-center text-xl font-semibold tracking-tight text-foreground">{t("about.relation")}</p>
        <p>{t("about.intro4")}</p>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Globe className="h-5 w-5 text-primary" />
          <ExtLink href={LINKS.mr}>{t("about.mr.heading")}</ExtLink>
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("about.mr.sub")}</p>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>{t("about.mr.p1")}</p>
          <p>{t("about.mr.p2")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.mr.list1")}</ul>
          <p>{t("about.mr.p3")}</p>
          <p>{t("about.mr.p4")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.mr.list2")}</ul>
          <p>{t("about.mr.p5")}</p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Disc className="h-5 w-5 text-primary" />
          <ExtLink href={LINKS.cpr}>{t("about.cpr.heading")}</ExtLink>
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("about.cpr.sub")}</p>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>{t("about.cpr.p1")}</p>
          <p>{t("about.cpr.p2")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.cpr.list1")}</ul>
          <p>{t("about.cpr.p3")}</p>
          <p>{t("about.cpr.p4")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.cpr.list2")}</ul>
          <p>{t("about.cpr.p5")}</p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <BookOpen className="h-5 w-5 text-primary" />
          <ExtLink href={LINKS.gmp}>{t("about.gmp.heading")}</ExtLink>
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("about.gmp.sub")}</p>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>{t("about.gmp.p1")}</p>
          <p>{t("about.gmp.p2")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.gmp.list1")}</ul>
          <p>{t("about.gmp.p3")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.gmp.list2")}</ul>
          <p>{t("about.gmp.p4")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.gmp.list3")}</ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Radio className="h-5 w-5 text-primary" />
          <ExtLink href={LINKS.ru}>{t("about.ru.heading")}</ExtLink>
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("about.ru.sub")}</p>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>{t("about.ru.p1")}</p>
          <p>{t("about.ru.p2")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.ru.list1")}</ul>
          <p>{t("about.ru.p3")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.ru.list2")}</ul>
          <p>{t("about.ru.p4")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.ru.list3")}</ul>
          <p>{t("about.ru.p5")}</p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Server className="h-5 w-5 text-primary" />
          {t("about.eco.heading")}
        </h2>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>{t("about.eco.p1")}</p>

          <div className="overflow-x-auto rounded-lg border border-border bg-secondary/30 p-6">
            <pre className="text-sm text-foreground/80 leading-relaxed whitespace-pre">
<ExtLink href={LINKS.mr}>Media Rosenqvist</ExtLink>{`
│
├── `}Catalogus Musicus{`
│      └── Central metadata & music catalog
│
├── `}<ExtLink href={LINKS.cpr}>Crystal Pier Records</ExtLink>{`
│      └── Releases & master recordings
│
├── `}<ExtLink href={LINKS.gmp}>Guerilla Minstrel Publishing</ExtLink>{`
│      └── Publishing & composition rights
│
└── `}<ExtLink href={LINKS.ru}>Radio Uppsala</ExtLink>{`
       └── Broadcast, discovery & distribution`}
            </pre>
          </div>

          <p>{t("about.eco.p2")}</p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Database className="h-5 w-5 text-primary" />
          {t("about.meta.heading")}
        </h2>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>{t("about.meta.p1")}</p>
          <p>{t("about.meta.p2")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.meta.list1")}</ul>
          <p>{t("about.meta.p3")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.meta.list2")}</ul>
          <p>{t("about.meta.p4")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.meta.list3")}</ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t("about.tech.heading")}
        </h2>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>{t("about.tech.p1")}</p>
          <p>{t("about.tech.p2")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.tech.list1")}</ul>
          <p>{t("about.tech.p3")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.tech.list2")}</ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Music className="h-5 w-5 text-primary" />
          {t("about.vision.heading")}
        </h2>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>{t("about.vision.p1")}</p>
          <p>{t("about.vision.p2")}</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">{list("about.vision.list1")}</ul>
          <p>{t("about.vision.p3")}</p>
          <p>{t("about.vision.p4")}</p>
        </div>
      </section>
    </div>
  );
}
