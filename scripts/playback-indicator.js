console.log("Playlist Playback Indicator | Module loaded");

const controls = {};
const animationFrames = {};

function handleDirectory(app, html, data) {
  console.log("Playlist Playback Indicator | Hook triggered", {app, html, data});

  // `app` is the Application (PlaylistDirectory), `html` is the HTMLElement (no longer jQuery in v13), `data` is the data context
  // Only run this logic for a PlaylistDirectory
  if (app instanceof PlaylistDirectory) {
    console.log("Playlist Playback Indicator | App is PlaylistDirectory");
    // Find sound elements in "currently playing" area
    console.log("Playlist Playback Indicator | HTML element:", html);
    console.log("Playlist Playback Indicator | HTML innerHTML preview:", html.innerHTML.substring(0, 500));

    const soundElements = html.querySelectorAll(".playlist-sounds .sound");
    console.log("Playlist Playback Indicator | Found sound elements:", soundElements.length, soundElements);

    const sounds = Array.from(soundElements).map(element => {
      const playlistId = element.dataset.playlistId;
      const soundId = element.dataset.soundId;
      const playlist = game.playlists.get(playlistId);
      if (!playlist) return null;
      const playlistSound = playlist.sounds.get(soundId);
      if (!playlistSound) return null;
      return { element, playlistSound };
    }).filter(s => s);

    console.log("Playlist Playback Indicator | Valid sounds found:", sounds.length, sounds);

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
        console.log("Playlist Playback Indicator | Creating controls for sound:", sid);
        const newRow = document.createElement("div");
        newRow.classList.add("jenny-controls", "flexrow");

        const seeker = document.createElement("input");
        seeker.type = "range";
        seeker.min = 0;
        seeker.step = 0.05;

        // Set initial max value from sound duration if available
        const snd = playlistSound.sound;
        console.log("Playlist Playback Indicator | Sound object:", snd);
        console.log("Playlist Playback Indicator | Initial duration:", snd?.duration);
        console.log("Playlist Playback Indicator | Initial currentTime:", snd?.currentTime);

        if (snd && typeof snd.duration === "number" && snd.duration > 0) {
          seeker.max = snd.duration;
          console.log("Playlist Playback Indicator | Set seeker.max to:", seeker.max);
        } else {
          // Default to a reasonable value that will be updated later
          seeker.max = 100;
          console.log("Playlist Playback Indicator | Duration not available, defaulting to 100");
        }

        // Set initial value from current time if available
        if (snd && typeof snd.currentTime === "number") {
          seeker.value = snd.currentTime;
        } else {
          seeker.value = playlistSound.pausedTime || 0;
        }

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
          const snd = playlistSound.sound;

          // Always update duration if available and not set correctly
          if (snd && typeof snd.duration === "number" && snd.duration > 0 && seeker.max !== snd.duration) {
            console.log("Playlist Playback Indicator | Updating seeker.max from", seeker.max, "to", snd.duration);
            seeker.max = snd.duration;
          }

          // Only update position if actually playing
          if (playlistSound.playing && !updating) {
            if (snd && typeof snd.currentTime === "number") {
              seeker.value = snd.currentTime;
            }
          }

          // Continue animation loop if:
          // 1. Sound is playing, OR
          // 2. We don't have the correct duration yet
          const needsUpdate = playlistSound.playing || (snd && (!snd.duration || seeker.max < snd.duration || seeker.max === 100));
          if (needsUpdate) {
            animationFrames[sid] = requestAnimationFrame(liveUpdate);
          } else {
            // Clear animation frame reference when stopped and duration is set
            delete animationFrames[sid];
          }
        }

        // Start the update loop
        liveUpdate();

        controls[sid] = newRow;
      }

      console.log("Playlist Playback Indicator | Appending controls to element:", element);
      element.appendChild(controls[playlistSound.id]);
    }
  }
}

console.log("Playlist Playback Indicator | Registering hook");

// Hook into rendering of PlaylistDirectory
Hooks.on("renderPlaylistDirectory", handleDirectory);
