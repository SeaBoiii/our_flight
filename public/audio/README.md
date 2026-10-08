# Wedding music

`our-song.mp3` is the web copy of "Untamable Love" by Kurtz Martin (Uppbeat). It is credited in `credit.md` and in the invitation footer. Keep `credit.md` with the deployed track.

- **Web copy:** 128 kbps, about 3.7 MB, streamed progressively. The cover art is stripped.
- **Master:** the original 320 kbps file is kept outside the deployed site at `artwork/audio/our-song-master.mp3`.

To rebuild the web copy, run this from the repository root (ffmpeg is not a project dependency):

```sh
ffmpeg -i artwork/audio/our-song-master.mp3 -map 0:a -map_metadata 0 -c:a libmp3lame -b:a 128k -ar 44100 public/audio/our-song.mp3
```

Playback is implemented in `src/music.ts`:

- **Opt-in only:** nothing is requested or played until the guest turns on **Board with music** on the boarding pass, or uses the music toggle in the invitation's navigation.
- **No preloading:** the track is never preloaded, so visual journey assets keep network priority.
- **Pausing:** playback pauses when the page is hidden and fades out when the guest reaches the RSVP form.
- **Missing file:** if the track fails to load, the music controls hide themselves after that attempt and the rest of the invitation is unaffected.
