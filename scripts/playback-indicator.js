const controls = {};
const animationFrames = {};

function handleDirectory(app, html, data) {
  // `app` is the Application (PlaylistDirectory), `html` is the HTMLElement (no longer jQuery in v13), `data` is the data context
  // Only run this logic for a PlaylistDirectory
  if (app instanceof PlaylistDirectory) {
    // Find sound elements in "currently playing" area
    const sounds = Array.from(html.querySelectorAll(".playlist-sounds .sound")).map(element => {
      const playlistId = element.dataset.playlistId;
      const soundId = element.dataset.soundId;
      const playlist = game.playlists.get(playlistId);
      if (!playlist) return null;
      const playlistSound = playlist.sounds.get(soundId);
      if (!playlistSound) return null;
      return { element, playlistSound };
    }).filter(s => s);

    // Track which sounds are currently present
    const currentSoundIds = new Set(sounds.map(s => s.playlistSound.id));

    // Cleanup controls for sounds that no longer exist
    for (const sid in controls) {
      if (!currentSoundIds.has(sid)) {
        // Cancel any running animation frames
        if (animationFrames[sid]) {
          cancelAnimationFrame(animationFrames[sid]);
          delete animationFrames[sid];
        }
        // Remove control element if it exists
        if (controls[sid] && controls[sid].parentNode) {
          controls[sid].parentNode.removeChild(controls[sid]);
        }
        delete controls[sid];
      }
    }

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
          const newTime = parseFloat(event.target.value);

          // Try to seek directly on the audio element if possible
          const snd = playlistSound.sound;
          if (snd && typeof snd.currentTime === "number") {
            try {
              snd.currentTime = newTime;
              updating = false;
              return;
            } catch (e) {
              // Fall back to the pause/update/resume method if direct seeking fails
              console.warn("Direct seeking failed, using fallback method", e);
            }
          }

          // Fallback: pause, update pausedTime, optionally resume
          const wasPlaying = playlistSound.playing;
          await playlistSound.update({ playing: false, pausedTime: newTime });
          if (wasPlaying) {
            await playlistSound.update({ playing: true });
          }
          updating = false;
        });

        newRow.appendChild(seeker);

        function liveUpdate() {
          // Only update if actually playing
          if (playlistSound.playing && !updating) {
            const snd = playlistSound.sound;
            if (snd && typeof snd.currentTime === "number") {
              seeker.value = snd.currentTime;
            }
            if (snd && typeof snd.duration === "number") {
              seeker.max = snd.duration;
            }
            // Continue animation only while playing
            animationFrames[sid] = requestAnimationFrame(liveUpdate);
          } else {
            // Clear animation frame reference when stopped
            delete animationFrames[sid];
          }
        }

        // Start the update loop
        liveUpdate();

        controls[sid] = newRow;
      }

      element.appendChild(controls[playlistSound.id]);
    }
  }
}

// Hook into rendering of PlaylistDirectory
Hooks.on("renderPlaylistDirectory", handleDirectory);
