const controls = {};

function handleDirectory(app, html, data) {
  // `app` is the Application (PlaylistDirectory), `html` is the jQuery-wrapped HTML, `data` is the data context
  // Only run this logic for a PlaylistDirectory
  if (app instanceof PlaylistDirectory) {
    // Find sound elements in “currently playing” area
    const sounds = Array.from(html[0].querySelectorAll(".playlist-sounds .sound")).map(element => {
      const playlistId = element.dataset.playlistId;
      const soundId = element.dataset.soundId;
      const playlist = game.playlists.get(playlistId);
      if (!playlist) return null;
      const playlistSound = playlist.sounds.get(soundId);
      if (!playlistSound) return null;
      return { element, playlistSound };
    }).filter(s => s);

    for (const { element, playlistSound } of sounds) {
      const sid = playlistSound.id;
      if (!controls[sid]) {
        const newRow = document.createElement("div");
        newRow.classList.add("jenny-controls", "flexrow");

        const seeker = document.createElement("input");
        seeker.type = "range";
        seeker.min = 0;
        seeker.step = 0.05;

        // When slider is changed, seek
        let updating = false;
        seeker.addEventListener("input", async (event) => {
          updating = true;
          const wasPlaying = playlistSound.playing;
          const newTime = parseFloat(event.target.value);
          // Pause, update pausedTime, optionally resume
          await playlistSound.update({ playing: false });
          await playlistSound.update({ pausedTime: newTime });
          if (wasPlaying) {
            await playlistSound.update({ playing: true });
          }
          updating = false;
        });

        newRow.appendChild(seeker);

        function liveUpdate() {
          if (playlistSound.playing && !updating) {
            // In modern Foundry, the internal audio object is `playlistSound.sound`
            const snd = playlistSound.sound;
            if (snd && typeof snd.currentTime === "number") {
              seeker.value = snd.currentTime;
            }
            if (snd && typeof snd.duration === "number") {
              seeker.max = snd.duration;
            }
          }
          // Continue loop while still playing or has pausedTime
          if (playlistSound.playing || (playlistSound.pausedTime != null)) {
            requestAnimationFrame(liveUpdate);
          }
        }
        liveUpdate();

        controls[sid] = newRow;
      }

      element.appendChild(controls[playlistSound.id]);
    }
  }
}

// Hook into rendering of PlaylistDirectory
Hooks.on("renderPlaylistDirectory", handleDirectory);
// Also re-render on change of tab (if the sidebar tab changes)
Hooks.on("changeSidebarTab", (tabName) => {
  // If switched to “playlists” tab, re-trigger existing PlaylistDirectory
  const dir = ui.sidebar.getTab("playlists");
  if (dir && dir.directory) {
    handleDirectory(dir.directory.app, dir.directory.html, dir.directory.data);
  }
});
