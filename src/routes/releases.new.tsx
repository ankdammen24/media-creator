import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ArtistAccountGate } from "@/components/ArtistAccountGate";
import { ReleaseWizard } from "@/components/release-wizard/ReleaseWizard";

export const Route = createFileRoute("/releases/new")({
  component: NewReleasePage,
  head: () => ({
    meta: [
      { title: "Submit release · Media Rosenqvist" },
      {
        name: "description",
        content:
          "Submit a new release to the Media Rosenqvist catalog — cover, tracks, platforms and rights in one flow.",
      },
    ],
  }),
});

function NewReleasePage() {
  return (
    <ProtectedRoute>
      <ArtistAccountGate>
        <ReleaseWizard />
      </ArtistAccountGate>
    </ProtectedRoute>
  );
}