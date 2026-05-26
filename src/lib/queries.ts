import { queryOptions } from "@tanstack/react-query";
import { api, type Artist, type ListResp, type NowPlaying, type Release, type Track } from "./api";

export const tracksQuery = () =>
  queryOptions({
    queryKey: ["tracks"],
    queryFn: () => api<ListResp<Track>>("/tracks"),
  });

export const trackQuery = (id: string) =>
  queryOptions({
    queryKey: ["tracks", id],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(id)}`),
  });

export const artistsQuery = () =>
  queryOptions({
    queryKey: ["artists"],
    queryFn: () => api<ListResp<Artist>>("/artists"),
  });

export const releasesQuery = () =>
  queryOptions({
    queryKey: ["releases"],
    queryFn: () => api<ListResp<Release>>("/releases"),
  });

export const nowPlayingQuery = () =>
  queryOptions({
    queryKey: ["nowplaying"],
    queryFn: () => api<NowPlaying>("/integrations/azuracast/nowplaying"),
    refetchInterval: 15000,
    staleTime: 10000,
  });