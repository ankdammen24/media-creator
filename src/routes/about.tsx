import { createFileRoute } from "@tanstack/react-router";
import { Music, Radio, Disc, BookOpen, Globe, Database, Server, ShieldCheck } from "lucide-react";

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

function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        About Catalogus Musicus
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        A Living Music Catalog
      </p>

      <section className="mt-12 space-y-6 text-foreground/90">
        <p>
          <strong className="text-foreground">Catalogus Musicus</strong> is the central music catalog within the{" "}
          <strong className="text-foreground">Media Rosenqvist</strong> ecosystem — created to organize, preserve and distribute music, metadata and creative works across multiple platforms, projects and audiences.
        </p>
        <p>The catalog is designed as a long-term foundation for:</p>
        <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
          <li>artists</li>
          <li>releases</li>
          <li>songs</li>
          <li>metadata</li>
          <li>publishing</li>
          <li>radio broadcasting</li>
          <li>digital distribution</li>
          <li>rights management</li>
          <li>future media services</li>
        </ul>
        <p>
          Rather than treating music as isolated uploads, the platform is built around relationships between:
        </p>
        <p className="text-center text-xl font-semibold tracking-tight text-foreground">
          Artist → Album/Release → Song
        </p>
        <p>
          This allows the catalog to maintain structure, history and consistency across an evolving media landscape.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Globe className="h-5 w-5 text-primary" />
          Media Rosenqvist
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">The Core Platform</p>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>
            Media Rosenqvist is the overarching creative and technical platform behind the ecosystem.
          </p>
          <p>It combines:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>music</li>
            <li>radio</li>
            <li>publishing</li>
            <li>digital infrastructure</li>
            <li>metadata systems</li>
            <li>automation</li>
            <li>AI-assisted workflows</li>
            <li>media distribution</li>
          </ul>
          <p>
            The purpose is to build an independent and sustainable framework for modern media creation and management.
          </p>
          <p>Media Rosenqvist acts as:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>technical operator</li>
            <li>infrastructure layer</li>
            <li>creative umbrella</li>
            <li>long-term catalog steward</li>
          </ul>
          <p>
            The goal is not simply to publish content, but to build systems that preserve and connect creative works over time.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Disc className="h-5 w-5 text-primary" />
          Crystal Pier Records
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Record Label & Releases</p>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>
            Crystal Pier Records is the label and release-oriented part of the ecosystem.
          </p>
          <p>The label focuses on:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>official releases</li>
            <li>artist identities</li>
            <li>album structures</li>
            <li>singles and EPs</li>
            <li>visual presentation</li>
            <li>long-term catalog development</li>
          </ul>
          <p>The philosophy is artist-first and independent.</p>
          <p>Rather than chasing short-term trends, the focus is on:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>atmosphere</li>
            <li>storytelling</li>
            <li>identity</li>
            <li>continuity</li>
            <li>sustainable catalog growth</li>
          </ul>
          <p>
            Crystal Pier Records handles the master release side of the ecosystem and acts as one of the primary origins of music entering the catalog.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <BookOpen className="h-5 w-5 text-primary" />
          Guerilla Minstrel Publishing
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Publishing & Rights</p>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>
            Guerilla Minstrel Publishing manages the publishing and rights-related side of the ecosystem.
          </p>
          <p>This includes:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>songwriting rights</li>
            <li>compositions</li>
            <li>lyrics</li>
            <li>publishing administration</li>
            <li>licensing preparation</li>
            <li>future sync opportunities</li>
          </ul>
          <p>
            The publishing structure exists separately from the label structure in order to properly support the relationship between:
          </p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>master recordings</li>
            <li>underlying compositions</li>
            <li>creative ownership</li>
          </ul>
          <p>As the catalog evolves, publishing data will become increasingly important for:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>licensing</li>
            <li>attribution</li>
            <li>royalty structures</li>
            <li>archival integrity</li>
          </ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Radio className="h-5 w-5 text-primary" />
          Radio Uppsala
        </h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Radio, Discovery & Distribution</p>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>
            Radio Uppsala serves as one of the living recipients of the catalog.
          </p>
          <p>It is not only a digital radio station, but also:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>a discovery platform</li>
            <li>a local media initiative</li>
            <li>a testing ground for distribution</li>
            <li>an editorial environment</li>
            <li>a future-facing broadcast platform</li>
          </ul>
          <p>Music from the catalog may be used within:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>radio rotation</li>
            <li>special programming</li>
            <li>thematic broadcasts</li>
            <li>local cultural programming</li>
            <li>pilot distribution workflows</li>
          </ul>
          <p>The platform combines:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>local information</li>
            <li>music discovery</li>
            <li>automation</li>
            <li>AI-assisted news workflows</li>
            <li>independent media production</li>
          </ul>
          <p>
            Radio Uppsala represents the public-facing and audience-oriented side of the ecosystem.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Server className="h-5 w-5 text-primary" />
          How the Ecosystem Connects
        </h2>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>
            The ecosystem is designed around interconnected but independent components.
          </p>

          <div className="overflow-x-auto rounded-lg border border-border bg-secondary/30 p-6">
            <pre className="text-sm text-foreground/80 leading-relaxed whitespace-pre">
{`Media Rosenqvist
│
├── Catalogus Musicus
│      └── Central metadata & music catalog
│
├── Crystal Pier Records
│      └── Releases & master recordings
│
├── Guerilla Minstrel Publishing
│      └── Publishing & composition rights
│
└── Radio Uppsala
       └── Broadcast, discovery & distribution`}
            </pre>
          </div>

          <p>
            Each part has its own role, while still contributing to the same long-term structure.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Database className="h-5 w-5 text-primary" />
          Metadata & Catalog Philosophy
        </h2>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>
            The catalog is built around structured relationships and metadata integrity.
          </p>
          <p>Examples of supported metadata include:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>Artist</li>
            <li>Album / Release</li>
            <li>Track</li>
            <li>UPC</li>
            <li>ISRC</li>
            <li>artwork</li>
            <li>release information</li>
            <li>publishing relationships</li>
            <li>audio assets</li>
            <li>distribution references</li>
          </ul>
          <p>The system is intentionally designed to support:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>multiple versions of songs</li>
            <li>re-releases</li>
            <li>compilations</li>
            <li>alternate releases</li>
            <li>archival preservation</li>
          </ul>
          <p>
            A song may exist on several releases while still maintaining accurate relationships to:
          </p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>artists</li>
            <li>releases</li>
            <li>identifiers</li>
            <li>rights holders</li>
          </ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Technology & Infrastructure
        </h2>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>
            Catalogus Musicus is being built as a modern media platform rather than a traditional static database.
          </p>
          <p>The ecosystem is designed around:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>APIs</li>
            <li>automation</li>
            <li>metadata consistency</li>
            <li>cloud infrastructure</li>
            <li>scalable storage</li>
            <li>AI-assisted workflows</li>
            <li>future interoperability</li>
          </ul>
          <p>The platform is intended to support:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>radio systems</li>
            <li>future streaming solutions</li>
            <li>publishing systems</li>
            <li>artist portals</li>
            <li>licensing workflows</li>
            <li>distribution integrations</li>
          </ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Music className="h-5 w-5 text-primary" />
          Vision
        </h2>
        <div className="mt-6 space-y-4 text-foreground/90">
          <p>
            We believe music should be treated as long-term cultural infrastructure — not disposable uploads.
          </p>
          <p>The purpose of the ecosystem is to create:</p>
          <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
            <li>sustainable catalog management</li>
            <li>independent media infrastructure</li>
            <li>stronger relationships between creative works</li>
            <li>preservation of artistic identity over time</li>
          </ul>
          <p>
            This is not only a catalog.
          </p>
          <p>
            It is the foundation of an independent media ecosystem built around music, storytelling, publishing and digital broadcasting.
          </p>
        </div>
      </section>
    </div>
  );
}
