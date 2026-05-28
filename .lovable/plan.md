Problemet är att appen skickar jobben till `AUDIO_PROCESSOR_URL + /process`, men den konfigurerade URL:en verkar redan innehålla pathen `/audio-processing` och träffar en tjänst som svarar `Cannot POST /audio-processing/process`. Workern i repo:t lyssnar på `POST /process`, så vi behöver göra dispatchen tydligare och mer robust.

Plan:

1. Uppdatera dispatch-logiken
   - Bygg worker-endpoint smartare från `AUDIO_PROCESSOR_URL`.
   - Om URL:en redan slutar med `/process`, använd den exakt.
   - Annars lägg bara till `/process` på bas-URL:en.
   - Logga vilken endpoint som används, utan att exponera signed URL eller hemligheter.

2. Förbättra felmeddelandet i admin
   - När worker svarar 404 med HTML, spara ett kortare och mer hjälpsamt fel, t.ex. att worker-URL/path troligen är felkonfigurerad.
   - Behåll teknisk statuskod i payload/loggen för felsökning.

3. Gör worker mer tolerant om den faktiskt körs bakom `/audio-processing`
   - Låt worker acceptera både `POST /process` och `POST /audio-processing/process`.
   - Lägg även till health på båda path-varianterna om möjligt.

4. Uppdatera worker-dokumentationen
   - Förtydliga att `AUDIO_PROCESSOR_URL` kan sättas till antingen bas-URL (`https://host`) eller full endpoint (`https://host/process`).
   - Om reverse proxy använder `/audio-processing`, ska den antingen rewrita till `/process` eller så ska full endpoint anges.

5. Verifiering
   - Kontrollera berörda filer efter ändring och bekräfta att appen inte längre hårdkodar fel path.
   - Efter deploy/uppdaterad worker kan du köra Retry/Backfill igen; befintliga failed-rader behöver retryas eftersom de redan misslyckats.